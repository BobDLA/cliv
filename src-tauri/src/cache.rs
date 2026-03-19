use crate::logging;
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::io::Read;
use std::path::PathBuf;

fn home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
}

fn now_iso8601() -> String {
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    // Simple ISO-8601 without pulling in chrono: Unix epoch seconds
    format!("{}Z", dur.as_secs())
}

/// Metadata written alongside each .md cache file.
#[derive(Debug, Serialize)]
struct CacheMeta {
    source: String,       // "real_id" or "pid"
    key: String,          // the actual filename key (thread-id, session-id, or pid)
    agent: String,        // "codex", "claude", "gemini"
    real_session_id: Option<String>, // the real thread/session ID (if different from key)
    pid: Option<u32>,     // ancestor agent PID (if found)
    cached_at: String,    // timestamp
    size_bytes: usize,    // content size
}

/// Atomic write: write to .tmp then rename.
fn atomic_write_cache(path: &PathBuf, content: &str) {
    let tmp = path.with_extension("md.tmp");

    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if fs::write(&tmp, content).is_ok() {
        if fs::rename(&tmp, path).is_ok() {
            logging::debug(&format!("  cache: wrote {} bytes → {}", content.len(), path.display()));
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
                logging::log(&format!("  cache-meta: write failed for {}: {}", meta_path.display(), e));
            } else {
                logging::debug(&format!("  cache-meta: wrote {}", meta_path.display()));
            }
        }
        Err(e) => {
            logging::log(&format!("  cache-meta: serialize failed: {}", e));
        }
    }
}

fn read_stdin() -> Option<String> {
    let mut buf = String::new();
    std::io::stdin().read_to_string(&mut buf).ok()?;
    if buf.is_empty() { None } else { Some(buf) }
}

/// Walk PPID chain to find the ancestor agent process PID.
#[cfg(target_os = "linux")]
fn find_ancestor_agent_pid(agent_name: &str) -> Option<u32> {
    let mut pid = std::os::unix::process::parent_id();

    for level in 0..5 {
        if pid <= 1 {
            break;
        }
        let comm = match std::fs::read_to_string(format!("/proc/{}/comm", pid)) {
            Ok(s) => s.trim().to_lowercase(),
            Err(_) => break,
        };

        logging::debug(&format!("  ancestor[{}]: pid={} comm='{}'", level, pid, comm));

        if comm.contains(agent_name) {
            logging::debug(&format!("  ancestor: matched {} at pid={}", agent_name, pid));
            return Some(pid);
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
        pid = match after_name.split_whitespace().nth(1).and_then(|s| s.parse().ok()) {
            Some(p) => p,
            None => break,
        };
    }

    logging::debug(&format!("  ancestor: {} not found in process chain", agent_name));
    None
}

#[cfg(target_os = "macos")]
fn find_ancestor_agent_pid(agent_name: &str) -> Option<u32> {
    let mut pid = std::os::unix::process::parent_id();

    for level in 0..5 {
        if pid <= 1 {
            break;
        }
        // Get process name via ps
        let output = std::process::Command::new("ps")
            .args(["-o", "comm=", "-p", &pid.to_string()])
            .output()
            .ok()?;
        let comm = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
        if comm.is_empty() {
            break;
        }

        logging::debug(&format!("  ancestor[{}]: pid={} comm='{}'", level, pid, comm));

        if comm.contains(agent_name) {
            logging::debug(&format!("  ancestor: matched {} at pid={}", agent_name, pid));
            return Some(pid);
        }

        // Get PPID via ps
        let output = std::process::Command::new("ps")
            .args(["-o", "ppid=", "-p", &pid.to_string()])
            .output()
            .ok()?;
        let ppid_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        pid = ppid_str.parse::<u32>().ok()?;
    }

    logging::debug(&format!("  ancestor: {} not found in process chain", agent_name));
    None
}

#[cfg(target_os = "windows")]
fn find_ancestor_agent_pid(agent_name: &str) -> Option<u32> {
    let own_pid = std::process::id();
    let mut pid = own_pid;

    for level in 0..5 {
        if pid == 0 {
            break;
        }
        let output = std::process::Command::new("wmic")
            .args(["process", "where", &format!("ProcessId={}", pid), "get", "Name,ParentProcessId", "/format:csv"])
            .output()
            .ok()?;
        let stdout = String::from_utf8_lossy(&output.stdout);

        let mut found = false;
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() >= 3 {
                let name = parts[1].trim().to_lowercase();
                let ppid: u32 = parts[2].trim().parse().unwrap_or(0);

                if level > 0 || pid != own_pid {
                    logging::debug(&format!("  ancestor[{}]: pid={} comm='{}'", level, pid, name));
                    if name.contains(agent_name) {
                        logging::debug(&format!("  ancestor: matched {} at pid={}", agent_name, pid));
                        return Some(pid);
                    }
                }
                pid = ppid;
                found = true;
                break;
            }
        }
        if !found {
            break;
        }
    }

    logging::debug(&format!("  ancestor: {} not found in process chain", agent_name));
    None
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn find_ancestor_agent_pid(_agent_name: &str) -> Option<u32> {
    None
}

// ─── Codex ────────────────────────────────────────────────

pub fn cache_codex(json_arg: &str) {
    logging::log(&format!("cache-codex: json_len={}", json_arg.len()));

    let data: Value = match serde_json::from_str(json_arg) {
        Ok(v) => v,
        Err(e) => { logging::log(&format!("cache-codex: JSON parse error: {}", e)); return; }
    };

    let event_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("");
    logging::debug(&format!("cache-codex: type={}", event_type));
    if event_type != "agent-turn-complete" {
        logging::debug("cache-codex: not agent-turn-complete, skip");
        return;
    }

    let thread_id = match data.get("thread-id").and_then(|v| v.as_str()) {
        Some(id) if !id.is_empty() => id,
        _ => { logging::log("cache-codex: no thread-id"); return; }
    };

    let message = match data.get("last-assistant-message").and_then(|v| v.as_str()) {
        Some(m) if !m.is_empty() => m,
        _ => { logging::log("cache-codex: no last-assistant-message"); return; }
    };

    logging::log(&format!("cache-codex: thread_id={}  msg_len={}", thread_id, message.len()));

    let codex_home = std::env::var("CODEX_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| home_dir().join(".codex"));

    let cache_dir = codex_home.join("reply_cache");
    let codex_pid = find_ancestor_agent_pid("codex");

    // Write by thread_id (Codex provides it, so we use it directly)
    let cache_path = cache_dir.join(format!("{}.md", thread_id));
    atomic_write_cache(&cache_path, message);
    write_cache_meta(&cache_path, &CacheMeta {
        source: "real_id".to_string(),
        key: thread_id.to_string(),
        agent: "codex".to_string(),
        real_session_id: Some(thread_id.to_string()),
        pid: codex_pid,
        cached_at: now_iso8601(),
        size_bytes: message.len(),
    });

    // Also write by agent PID for anti-crosstalk
    if let Some(pid) = codex_pid {
        let pid_path = cache_dir.join(format!("{}.md", pid));
        atomic_write_cache(&pid_path, message);
        write_cache_meta(&pid_path, &CacheMeta {
            source: "pid".to_string(),
            key: pid.to_string(),
            agent: "codex".to_string(),
            real_session_id: Some(thread_id.to_string()),
            pid: Some(pid),
            cached_at: now_iso8601(),
            size_bytes: message.len(),
        });
    }
}

// ─── Claude ───────────────────────────────────────────────

pub fn cache_claude() {
    logging::log("cache-claude: reading stdin...");

    let input = match read_stdin() {
        Some(s) => { logging::debug(&format!("cache-claude: stdin_len={}", s.len())); s }
        None => { logging::log("cache-claude: empty stdin"); return; }
    };

    let data: Value = match serde_json::from_str(&input) {
        Ok(v) => v,
        Err(e) => { logging::log(&format!("cache-claude: JSON parse error: {}", e)); return; }
    };

    let event = data.get("hook_event_name").and_then(|v| v.as_str()).unwrap_or("");
    logging::debug(&format!("cache-claude: hook_event_name={}", event));
    if event != "Stop" {
        logging::debug("cache-claude: not Stop event, skip");
        return;
    }

    let session_id = match data.get("session_id").and_then(|v| v.as_str()) {
        Some(id) if !id.is_empty() => id,
        _ => { logging::log("cache-claude: no session_id"); return; }
    };

    let message = match data.get("last_assistant_message").and_then(|v| v.as_str()) {
        Some(m) if !m.is_empty() => m,
        _ => { logging::log("cache-claude: no last_assistant_message"); return; }
    };

    logging::log(&format!("cache-claude: session_id={}  msg_len={}", session_id, message.len()));

    let cache_dir = home_dir().join(".claude").join("reply_cache");
    let claude_pid = find_ancestor_agent_pid("claude");

    // Write by agent PID — GUI looks up by the same PID (deterministic)
    if let Some(pid) = claude_pid {
        let pid_path = cache_dir.join(format!("{}.md", pid));
        atomic_write_cache(&pid_path, message);
        write_cache_meta(&pid_path, &CacheMeta {
            source: "pid".to_string(),
            key: pid.to_string(),
            agent: "claude".to_string(),
            real_session_id: Some(session_id.to_string()),
            pid: Some(pid),
            cached_at: now_iso8601(),
            size_bytes: message.len(),
        });
    }

    // Also write by session_id as fallback
    let cache_path = cache_dir.join(format!("{}.md", session_id));
    atomic_write_cache(&cache_path, message);
    write_cache_meta(&cache_path, &CacheMeta {
        source: "real_id".to_string(),
        key: session_id.to_string(),
        agent: "claude".to_string(),
        real_session_id: Some(session_id.to_string()),
        pid: claude_pid,
        cached_at: now_iso8601(),
        size_bytes: message.len(),
    });
}

// ─── Gemini ───────────────────────────────────────────────

pub fn cache_gemini() {
    let session_id = match std::env::var("GEMINI_SESSION_ID") {
        Ok(id) if !id.is_empty() => { logging::log(&format!("cache-gemini: session_id={}", id)); id }
        _ => { logging::log("cache-gemini: no GEMINI_SESSION_ID"); return; }
    };

    logging::debug("cache-gemini: reading stdin...");
    let input = match read_stdin() {
        Some(s) => { logging::debug(&format!("cache-gemini: stdin_len={}", s.len())); s }
        None => { logging::log("cache-gemini: empty stdin"); return; }
    };

    let data: Value = match serde_json::from_str(&input) {
        Ok(v) => v,
        Err(e) => { logging::log(&format!("cache-gemini: JSON parse error: {}", e)); return; }
    };

    let message = match data.get("prompt_response").and_then(|v| v.as_str()) {
        Some(m) if !m.is_empty() => m,
        _ => { logging::log("cache-gemini: no prompt_response"); return; }
    };

    logging::log(&format!("cache-gemini: msg_len={}", message.len()));

    let cache_dir = home_dir().join(".gemini").join("reply_cache");
    let gemini_pid = find_ancestor_agent_pid("gemini");

    // Write by agent PID — GUI looks up by the same PID (deterministic)
    if let Some(pid) = gemini_pid {
        let pid_path = cache_dir.join(format!("{}.md", pid));
        atomic_write_cache(&pid_path, message);
        write_cache_meta(&pid_path, &CacheMeta {
            source: "pid".to_string(),
            key: pid.to_string(),
            agent: "gemini".to_string(),
            real_session_id: Some(session_id.clone()),
            pid: Some(pid),
            cached_at: now_iso8601(),
            size_bytes: message.len(),
        });
    }

    // Also write by session_id as fallback
    let cache_path = cache_dir.join(format!("{}.md", session_id));
    atomic_write_cache(&cache_path, message);
    write_cache_meta(&cache_path, &CacheMeta {
        source: "real_id".to_string(),
        key: session_id.clone(),
        agent: "gemini".to_string(),
        real_session_id: Some(session_id),
        pid: gemini_pid,
        cached_at: now_iso8601(),
        size_bytes: message.len(),
    });
}
