use crate::config::LaunchConfig;
use crate::logging;
use crate::process::{collect_parent_processes, resolve_owner_identity, OwnerIdentity};
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::io::Read;
use std::path::PathBuf;

fn home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
}

fn now_cache_timestamp() -> String {
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    // Unix-epoch nanoseconds keep metadata ordering stable for rapid successive writes.
    format!("{}Z", dur.as_nanos())
}

/// Metadata written alongside each .md cache file.
///
/// Shared contract across Codex / Claude / Gemini:
/// - `key` is the concrete reply-cache lookup key used for the filename.
/// - `real_session_id` stores the agent-native conversation identity when available
///   (Codex thread-id, Claude session_id, Gemini session_id).
/// - `pid` stores the ancestor agent PID when available.
///
/// In other words: lookup key, conversation identity, and pid are related but not
/// interchangeable. Readers may use metadata to bridge between them, but should not
/// guess beyond direct-file hits and metadata-backed alias resolution.
#[derive(Debug, Serialize)]
struct CacheMeta {
    source: String,                  // "real_id" or "pid"
    key: String,                     // concrete reply-cache lookup key / filename stem
    agent: String,                   // "codex", "claude", "gemini"
    real_session_id: Option<String>, // agent-native conversation identity, if available
    pid: Option<u32>,                // ancestor agent PID (if found)
    owner_pid: Option<u32>,          // stable owner-process PID for deterministic GUI matching
    owner_started_at: Option<u64>,   // owner-process creation time for PID reuse safety
    cached_at: String,               // timestamp
    size_bytes: usize,               // content size
}

/// Atomic write: write to .tmp then rename.
fn atomic_write_cache(path: &PathBuf, content: &str) {
    let tmp = path.with_extension("md.tmp");

    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if fs::write(&tmp, content).is_ok() {
        if fs::rename(&tmp, path).is_ok() {
            logging::debug(&format!(
                "  cache: wrote {} bytes → {}",
                content.len(),
                path.display()
            ));
        } else {
            logging::log(&format!("  cache: rename failed for {}", path.display()));
            let _ = fs::remove_file(&tmp);
        }
    } else {
        logging::log(&format!("  cache: write failed for {}", tmp.display()));
    }
}

/// Write a .meta.json alongside a .md cache file.
fn write_cache_meta(md_path: &PathBuf, meta: &CacheMeta) {
    let meta_path = md_path.with_extension("meta.json");
    match serde_json::to_string_pretty(meta) {
        Ok(json) => {
            if let Err(e) = fs::write(&meta_path, json) {
                logging::log(&format!(
                    "  cache-meta: write failed for {}: {}",
                    meta_path.display(),
                    e
                ));
            } else {
                logging::debug(&format!("  cache-meta: wrote {}", meta_path.display()));
            }
        }
        Err(e) => {
            logging::log(&format!("  cache-meta: serialize failed: {}", e));
        }
    }
}

fn remove_cache_artifacts(md_path: &PathBuf) {
    let meta_path = md_path.with_extension("meta.json");
    let _ = fs::remove_file(md_path);
    let _ = fs::remove_file(meta_path);
}

fn read_stdin() -> Option<String> {
    let mut buf = String::new();
    std::io::stdin().read_to_string(&mut buf).ok()?;
    if buf.is_empty() {
        None
    } else {
        Some(buf)
    }
}

/// Walk PPID chain to find the ancestor agent process PID.
#[cfg(target_os = "linux")]
fn find_ancestor_agent_pid(agent_name: &str) -> Option<u32> {
    let mut pid = std::os::unix::process::parent_id();
    let mut matched_pid_by_name = None;
    let mut matched_pid_by_cmdline = None;

    for level in 0..5 {
        if pid <= 1 {
            break;
        }
        let comm = match std::fs::read_to_string(format!("/proc/{}/comm", pid)) {
            Ok(s) => s.trim().to_lowercase(),
            Err(_) => break,
        };

        logging::debug(&format!(
            "  ancestor[{}]: pid={} comm='{}'",
            level, pid, comm
        ));

        if comm.contains(agent_name) {
            logging::debug(&format!(
                "  ancestor: candidate {} match at pid={}",
                agent_name, pid
            ));
            matched_pid_by_name = Some(pid);
        }

        // Fallback: when comm is a generic interpreter (e.g. "node"),
        // read /proc/PID/cmdline for the full invocation path.
        if !comm.contains(agent_name) {
            if let Ok(raw) = std::fs::read(format!("/proc/{}/cmdline", pid)) {
                let cmdline = raw
                    .split(|&b| b == 0)
                    .map(|seg| String::from_utf8_lossy(seg))
                    .collect::<Vec<_>>()
                    .join(" ")
                    .to_lowercase();
                if cmdline.contains(agent_name) {
                    logging::debug(&format!(
                        "  ancestor: candidate {} cmdline match at pid={}",
                        agent_name, pid
                    ));
                    matched_pid_by_cmdline = Some(pid);
                }
            }
        }

        // Read PPID from /proc/PID/stat
        let stat = match std::fs::read_to_string(format!("/proc/{}/stat", pid)) {
            Ok(s) => s,
            Err(_) => break,
        };
        let after_name = match stat.rfind(')') {
            Some(pos) => &stat[pos + 2..],
            None => break,
        };
        pid = match after_name
            .split_whitespace()
            .nth(1)
            .and_then(|s| s.parse().ok())
        {
            Some(p) => p,
            None => break,
        };
    }

    if let Some(pid) = matched_pid_by_name.or(matched_pid_by_cmdline) {
        logging::debug(&format!(
            "  ancestor: selected outermost {} pid={}",
            agent_name, pid
        ));
        return Some(pid);
    }

    logging::debug(&format!(
        "  ancestor: {} not found in process chain",
        agent_name
    ));
    None
}

#[cfg(target_os = "macos")]
fn find_ancestor_agent_pid(agent_name: &str) -> Option<u32> {
    let mut pid = std::os::unix::process::parent_id();
    let mut matched_pid_by_name = None;

    for level in 0..5 {
        if pid <= 1 {
            break;
        }
        // Get process name via ps
        let output = std::process::Command::new("ps")
            .args(["-o", "comm=", "-p", &pid.to_string()])
            .output()
            .ok()?;
        let comm = String::from_utf8_lossy(&output.stdout)
            .trim()
            .to_lowercase();
        if comm.is_empty() {
            break;
        }

        logging::debug(&format!(
            "  ancestor[{}]: pid={} comm='{}'",
            level, pid, comm
        ));

        if comm.contains(agent_name) {
            logging::debug(&format!(
                "  ancestor: candidate {} match at pid={}",
                agent_name, pid
            ));
            matched_pid_by_name = Some(pid);
        }

        // Get PPID via ps
        let output = std::process::Command::new("ps")
            .args(["-o", "ppid=", "-p", &pid.to_string()])
            .output()
            .ok()?;
        let ppid_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        pid = ppid_str.parse::<u32>().ok()?;
    }

    if let Some(pid) = matched_pid_by_name {
        logging::debug(&format!(
            "  ancestor: selected outermost {} pid={}",
            agent_name, pid
        ));
        return Some(pid);
    }

    logging::debug(&format!(
        "  ancestor: {} not found in process chain",
        agent_name
    ));
    None
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn find_ancestor_agent_pid(_agent_name: &str) -> Option<u32> {
    None
}

fn resolve_cache_owner_identity(launch: &LaunchConfig) -> Option<OwnerIdentity> {
    let process_chain = collect_parent_processes(launch.scan_depth);
    let (owner, _, canonical_name) =
        resolve_owner_identity(&process_chain, &launch.ignored_callers)?;

    logging::log(&format!(
        "  owner-cache: resolved owner canonical='{}' pid={} started_at={}",
        canonical_name, owner.pid, owner.started_at
    ));
    Some(owner)
}

fn owner_fields(owner: &Option<OwnerIdentity>) -> (Option<u32>, Option<u64>) {
    (
        owner.as_ref().map(|value| value.pid),
        owner.as_ref().map(|value| value.started_at),
    )
}

fn resolve_codex_cache_identity(launch: &LaunchConfig) -> (Option<u32>, Option<OwnerIdentity>) {
    let owner_identity = resolve_cache_owner_identity(launch);

    #[cfg(target_os = "windows")]
    {
        (
            owner_identity.as_ref().map(|owner| owner.pid),
            owner_identity,
        )
    }

    #[cfg(not(target_os = "windows"))]
    {
        let pid = find_ancestor_agent_pid("codex").or_else(|| {
            std::env::var("CODEX_THREAD_ID")
                .ok()
                .and_then(|value| value.parse::<u32>().ok())
        });
        (pid, owner_identity)
    }
}

fn resolve_agent_pid(
    _agent_name: &str,
    launch: &LaunchConfig,
) -> (Option<u32>, Option<OwnerIdentity>) {
    let owner_identity = resolve_cache_owner_identity(launch);

    #[cfg(target_os = "windows")]
    {
        (
            owner_identity.as_ref().map(|owner| owner.pid),
            owner_identity,
        )
    }

    #[cfg(not(target_os = "windows"))]
    {
        (find_ancestor_agent_pid(_agent_name), owner_identity)
    }
}

// ─── Codex ────────────────────────────────────────────────

pub fn cache_codex(json_arg: &str, launch: &LaunchConfig) {
    logging::log(&format!("cache-codex: json_len={}", json_arg.len()));

    let data: Value = match serde_json::from_str(json_arg) {
        Ok(v) => v,
        Err(e) => {
            logging::log(&format!("cache-codex: JSON parse error: {}", e));
            return;
        }
    };

    let event_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("");
    logging::debug(&format!("cache-codex: type={}", event_type));
    if event_type != "agent-turn-complete" {
        logging::debug("cache-codex: not agent-turn-complete, skip");
        return;
    }

    let thread_id = match data.get("thread-id").and_then(|v| v.as_str()) {
        Some(id) if !id.is_empty() => id,
        _ => {
            logging::log("cache-codex: no thread-id");
            return;
        }
    };

    let message = match data.get("last-assistant-message").and_then(|v| v.as_str()) {
        Some(m) if !m.is_empty() => m,
        _ => {
            logging::log("cache-codex: no last-assistant-message");
            return;
        }
    };

    logging::log(&format!(
        "cache-codex: thread_id={}  msg_len={}",
        thread_id,
        message.len()
    ));

    let codex_home = std::env::var("CODEX_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| home_dir().join(".codex"));

    let cache_dir = codex_home.join("reply_cache");
    let (codex_pid, owner_identity) = resolve_codex_cache_identity(launch);
    let codex_pid = match codex_pid {
        Some(pid) => pid,
        None => {
            logging::log("cache-codex: no cache pid resolved; skip cache write");
            return;
        }
    };
    let (owner_pid, owner_started_at) = owner_fields(&owner_identity);

    let cache_path = cache_dir.join(format!("{}.md", codex_pid));
    atomic_write_cache(&cache_path, message);
    write_cache_meta(
        &cache_path,
        &CacheMeta {
            source: "pid".to_string(),
            key: codex_pid.to_string(),
            agent: "codex".to_string(),
            real_session_id: Some(thread_id.to_string()),
            pid: Some(codex_pid),
            owner_pid,
            owner_started_at,
            cached_at: now_cache_timestamp(),
            size_bytes: message.len(),
        },
    );

    // Clean up legacy thread-id keyed artifacts now that Codex caches are pid-keyed.
    let legacy_path = cache_dir.join(format!("{}.md", thread_id));
    if legacy_path != cache_path {
        remove_cache_artifacts(&legacy_path);
    }
}

// ─── Claude ───────────────────────────────────────────────

pub fn cache_claude(launch: &LaunchConfig) {
    logging::log("cache-claude: reading stdin...");

    let input = match read_stdin() {
        Some(s) => {
            logging::debug(&format!("cache-claude: stdin_len={}", s.len()));
            s
        }
        None => {
            logging::log("cache-claude: empty stdin");
            return;
        }
    };

    let data: Value = match serde_json::from_str(&input) {
        Ok(v) => v,
        Err(e) => {
            logging::log(&format!("cache-claude: JSON parse error: {}", e));
            return;
        }
    };

    let event = data
        .get("hook_event_name")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    logging::debug(&format!("cache-claude: hook_event_name={}", event));
    if event != "Stop" {
        logging::debug("cache-claude: not Stop event, skip");
        return;
    }

    let session_id = match data.get("session_id").and_then(|v| v.as_str()) {
        Some(id) if !id.is_empty() => id,
        _ => {
            logging::log("cache-claude: no session_id");
            return;
        }
    };

    let message = match data.get("last_assistant_message").and_then(|v| v.as_str()) {
        Some(m) if !m.is_empty() => m,
        _ => {
            logging::log("cache-claude: no last_assistant_message");
            return;
        }
    };

    logging::log(&format!(
        "cache-claude: session_id={}  msg_len={}",
        session_id,
        message.len()
    ));

    let cache_dir = home_dir().join(".claude").join("reply_cache");
    let (claude_pid, owner_identity) = resolve_agent_pid("claude", launch);
    let (owner_pid, owner_started_at) = owner_fields(&owner_identity);

    // Write by agent PID — GUI looks up by the same PID (deterministic)
    if let Some(pid) = claude_pid {
        let pid_path = cache_dir.join(format!("{}.md", pid));
        atomic_write_cache(&pid_path, message);
        write_cache_meta(
            &pid_path,
            &CacheMeta {
                source: "pid".to_string(),
                key: pid.to_string(),
                agent: "claude".to_string(),
                real_session_id: Some(session_id.to_string()),
                pid: Some(pid),
                owner_pid,
                owner_started_at,
                cached_at: now_cache_timestamp(),
                size_bytes: message.len(),
            },
        );
    }

    // Also write by session_id as fallback
    let cache_path = cache_dir.join(format!("{}.md", session_id));
    atomic_write_cache(&cache_path, message);
    write_cache_meta(
        &cache_path,
        &CacheMeta {
            source: "real_id".to_string(),
            key: session_id.to_string(),
            agent: "claude".to_string(),
            real_session_id: Some(session_id.to_string()),
            pid: claude_pid,
            owner_pid,
            owner_started_at,
            cached_at: now_cache_timestamp(),
            size_bytes: message.len(),
        },
    );
}

// ─── Gemini ───────────────────────────────────────────────

pub fn cache_gemini(launch: &LaunchConfig) {
    // Session ID is optional — Gemini CLI may not inject GEMINI_SESSION_ID.
    let session_id = std::env::var("GEMINI_SESSION_ID")
        .ok()
        .filter(|s| !s.is_empty());
    logging::log(&format!("cache-gemini: session_id={:?}", session_id));

    logging::debug("cache-gemini: reading stdin...");
    let input = match read_stdin() {
        Some(s) => {
            logging::debug(&format!("cache-gemini: stdin_len={}", s.len()));
            s
        }
        None => {
            logging::log("cache-gemini: empty stdin");
            return;
        }
    };

    let data: Value = match serde_json::from_str(&input) {
        Ok(v) => v,
        Err(e) => {
            logging::log(&format!("cache-gemini: JSON parse error: {}", e));
            return;
        }
    };

    let message = match data.get("prompt_response").and_then(|v| v.as_str()) {
        Some(m) if !m.is_empty() => m,
        _ => {
            logging::log("cache-gemini: no prompt_response");
            return;
        }
    };

    logging::log(&format!("cache-gemini: msg_len={}", message.len()));

    let cache_dir = home_dir().join(".gemini").join("reply_cache");
    let (gemini_pid, owner_identity) = resolve_agent_pid("gemini", launch);
    let (owner_pid, owner_started_at) = owner_fields(&owner_identity);

    // Write by agent PID — GUI looks up by the same PID (deterministic)
    if let Some(pid) = gemini_pid {
        let pid_path = cache_dir.join(format!("{}.md", pid));
        atomic_write_cache(&pid_path, message);
        write_cache_meta(
            &pid_path,
            &CacheMeta {
                source: "pid".to_string(),
                key: pid.to_string(),
                agent: "gemini".to_string(),
                real_session_id: session_id.clone(),
                pid: Some(pid),
                owner_pid,
                owner_started_at,
                cached_at: now_cache_timestamp(),
                size_bytes: message.len(),
            },
        );
    }

    // Also write by session_id as fallback (if available)
    if let Some(ref sid) = session_id {
        let cache_path = cache_dir.join(format!("{}.md", sid));
        atomic_write_cache(&cache_path, message);
        write_cache_meta(
            &cache_path,
            &CacheMeta {
                source: "real_id".to_string(),
                key: sid.clone(),
                agent: "gemini".to_string(),
                real_session_id: session_id.clone(),
                pid: gemini_pid,
                owner_pid,
                owner_started_at,
                cached_at: now_cache_timestamp(),
                size_bytes: message.len(),
            },
        );
    }

    // If neither PID nor session_id was available, log a warning.
    if gemini_pid.is_none() && session_id.is_none() {
        logging::log("cache-gemini: WARNING — no PID or session_id resolved; cache not written");
    }
}
