use crate::config::{canonicalize_process_name, AppConfig};
use crate::logging;
use serde::Serialize;

/// How cliV was invoked.
#[derive(Debug, Clone)]
pub enum CliMode {
    /// Launch the Tauri GUI (default).
    Gui,
    /// Cache a Codex reply from notify hook: `cliv cache-codex '<json>'`
    CacheCodex(String),
    /// Cache a Claude reply from Stop hook (stdin): `cliv cache-claude`
    CacheClaude,
    /// Cache a Gemini reply from AfterAgent hook (stdin): `cliv cache-gemini`
    CacheGemini,
}

/// CLI arguments parsed from `std::env::args()` and environment variables.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliArgs {
    pub review_path: Option<String>,
    pub target_path: Option<String>,
    pub metadata_path: Option<String>,
    pub file_path: Option<String>,
    pub workspace_path: Option<String>,
    /// Which agent triggered the launch: "codex", "claude", "gemini", or "unknown".
    /// Auto-detected from environment variables.
    pub agent: Option<String>,
    /// Which trusted caller matched the parent process chain, if any.
    pub trusted_caller: Option<String>,
}

/// Full CLI parse result containing both mode and GUI args.
pub struct CliParsed {
    pub mode: CliMode,
    pub args: CliArgs,
}

#[derive(Debug, Clone)]
struct ParentProcess {
    pid: u32,
    name: String,
    /// Full command line from /proc/PID/cmdline (Linux) or equivalent.
    /// Used as fallback when `name` (comm) is generic (e.g. "node", "python").
    cmdline: Option<String>,
    level: usize,
}

impl CliParsed {
    pub fn from_env(config: &AppConfig) -> Self {
        let argv: Vec<String> = std::env::args().collect();

        logging::log("═══════════════════════════════════════════════════");
        logging::log(&format!("cliV started  PID={}", std::process::id()));
        logging::log(&format!("  argv={:?}", argv));
        logging::debug(&format!(
            "  CWD={}",
            std::env::current_dir()
                .map(|p| p.display().to_string())
                .unwrap_or_default()
        ));
        logging::debug(&format!(
            "  CLIV_AGENT={}",
            std::env::var("CLIV_AGENT").unwrap_or_default()
        ));
        logging::debug(&format!(
            "  CODEX_THREAD_ID={}",
            std::env::var("CODEX_THREAD_ID").unwrap_or_default()
        ));
        logging::debug(&format!(
            "  CLAUDE_SESSION_ID={}",
            std::env::var("CLAUDE_SESSION_ID").unwrap_or_default()
        ));
        logging::debug(&format!(
            "  GEMINI_SESSION_ID={}",
            std::env::var("GEMINI_SESSION_ID").unwrap_or_default()
        ));

        // Check for subcommand first
        if argv.len() >= 2 {
            match argv[1].as_str() {
                "cache-codex" => {
                    let json = argv.get(2).cloned().unwrap_or_default();
                    logging::log(&format!("  mode=cache-codex  json_len={}", json.len()));
                    return CliParsed {
                        mode: CliMode::CacheCodex(json),
                        args: CliArgs::default(),
                    };
                }
                "cache-claude" => {
                    logging::log("  mode=cache-claude (stdin)");
                    return CliParsed {
                        mode: CliMode::CacheClaude,
                        args: CliArgs::default(),
                    };
                }
                "cache-gemini" => {
                    logging::log("  mode=cache-gemini (stdin)");
                    return CliParsed {
                        mode: CliMode::CacheGemini,
                        args: CliArgs::default(),
                    };
                }
                _ => {}
            }
        }

        let process_chain = collect_parent_processes(config.launch.scan_depth);
        let agent = detect_agent(&process_chain);
        let trusted_caller = detect_trusted_caller(config, &process_chain);

        logging::log(&format!(
            "  mode=gui  detected_agent={:?} trusted_caller={:?}",
            agent, trusted_caller
        ));

        let workspace_path = std::env::current_dir()
            .ok()
            .map(|path| std::fs::canonicalize(&path).unwrap_or(path))
            .map(|path| path.to_string_lossy().to_string());

        let args = parse_gui_args(&argv[1..], workspace_path, agent, trusted_caller);

        logging::log(&format!(
            "  review_path={:?} target_path={:?} file_path={:?}",
            args.review_path, args.target_path, args.file_path
        ));

        CliParsed {
            mode: CliMode::Gui,
            args,
        }
    }
}

/// Parse GUI-mode arguments from an argv slice (excluding the binary name).
fn parse_gui_args(
    argv: &[String],
    workspace_path: Option<String>,
    agent: Option<String>,
    trusted_caller: Option<String>,
) -> CliArgs {
    let mut metadata_path = None;
    let mut explicit_target = None;
    let mut positional_path = None;

    let mut i = 0;
    while i < argv.len() {
        match argv[i].as_str() {
            "--metadata" => {
                if i + 1 < argv.len() {
                    metadata_path = Some(argv[i + 1].clone());
                    i += 2;
                } else {
                    i += 1;
                }
            }
            "--compose" | "--target" | "-t" => {
                if i + 1 < argv.len() {
                    explicit_target = Some(argv[i + 1].clone());
                    i += 2;
                } else {
                    i += 1;
                }
            }
            arg if arg.starts_with('-') => {
                i += 1;
            }
            arg => {
                if positional_path.is_none() {
                    positional_path = Some(arg.to_string());
                }
                i += 1;
            }
        }
    }

    let (review_path, target_path) = resolve_launch_paths(
        positional_path.clone(),
        explicit_target,
        trusted_caller.clone(),
    );

    CliArgs {
        review_path,
        target_path,
        metadata_path,
        file_path: positional_path,
        workspace_path,
        agent,
        trusted_caller,
    }
}

fn resolve_launch_paths(
    positional_path: Option<String>,
    explicit_target: Option<String>,
    trusted_caller: Option<String>,
) -> (Option<String>, Option<String>) {
    match (positional_path, explicit_target, trusted_caller) {
        (review_path, Some(target_path), _) => (review_path, Some(target_path)),
        (Some(target_path), None, Some(_)) => (None, Some(target_path)),
        (Some(review_path), None, None) => (Some(review_path), None),
        (None, None, _) => (None, None),
    }
}

fn detect_agent(process_chain: &[ParentProcess]) -> Option<String> {
    if let Ok(agent) = std::env::var("CLIV_AGENT") {
        if !agent.is_empty() {
            logging::log(&format!("  detect: CLIV_AGENT={} → using override", agent));
            return Some(agent);
        }
    }

    if std::env::var("CODEX_THREAD_ID")
        .ok()
        .filter(|s| !s.is_empty())
        .is_some()
    {
        logging::log("  detect: CODEX_THREAD_ID set → codex");
        return Some("codex".to_string());
    }

    if std::env::var("CLAUDE_SESSION_ID")
        .ok()
        .filter(|s| !s.is_empty())
        .is_some()
    {
        logging::log("  detect: CLAUDE_SESSION_ID set → claude");
        return Some("claude".to_string());
    }

    if std::env::var("GEMINI_SESSION_ID")
        .ok()
        .filter(|s| !s.is_empty())
        .is_some()
    {
        logging::log("  detect: GEMINI_SESSION_ID set → gemini");
        return Some("gemini".to_string());
    }

    logging::debug("  detect: no session env vars found, trying parent process...");

    for process in process_chain {
        if let Some(agent) = match_agent_name(&process.name)
            .or_else(|| process.cmdline.as_deref().and_then(match_agent_name))
        {
            return handle_agent_match(agent, process.pid, process.level);
        }
    }

    logging::log("  detect: no agent detected");
    None
}

fn detect_trusted_caller(config: &AppConfig, process_chain: &[ParentProcess]) -> Option<String> {
    for process in process_chain {
        let canonical_name = canonicalize_process_name(&process.name);

        if matches_any(&canonical_name, &config.launch.ignored_callers) {
            logging::debug(&format!(
                "  trust[{}]: skipping ignored caller '{}' (canonical='{}')",
                process.level, process.name, canonical_name
            ));
            continue;
        }

        if matches_any(&canonical_name, &config.launch.trusted_callers) {
            logging::log(&format!(
                "  trust[{}]: matched trusted caller '{}' (canonical='{}') at pid={}",
                process.level, process.name, canonical_name, process.pid
            ));
            return Some(canonical_name);
        }

        // Fallback: when comm is a generic interpreter (e.g. "node"), check
        // cmdline which contains the full invocation path.
        if let Some(ref cmdline) = process.cmdline {
            let canonical_cmdline = canonicalize_process_name(cmdline);
            if matches_any(&canonical_cmdline, &config.launch.trusted_callers) {
                logging::log(&format!(
                    "  trust[{}]: matched trusted caller via cmdline '{}' (canonical='{}') at pid={}",
                    process.level, cmdline, canonical_cmdline, process.pid
                ));
                return Some(canonical_cmdline);
            }
        }

        logging::debug(&format!(
            "  trust[{}]: first non-wrapper caller '{}' (canonical='{}') is not trusted",
            process.level, process.name, canonical_name
        ));
        return None;
    }

    logging::debug("  trust: no trusted caller matched");
    None
}

/// Given a matched agent and its PID, set the appropriate lookup env var.
/// The env value is used as the active reply-cache key during GUI extraction.
fn handle_agent_match(agent_name: &str, agent_pid: u32, level: usize) -> Option<String> {
    let pid_str = agent_pid.to_string();
    let (env_var, agent) = match agent_name {
        "codex" => ("CODEX_THREAD_ID", "codex"),
        "claude" => ("CLAUDE_SESSION_ID", "claude"),
        "gemini" => ("GEMINI_SESSION_ID", "gemini"),
        _ => return None,
    };

    logging::log(&format!(
        "  walk[{}]: matched {} at pid={}",
        level, agent, agent_pid
    ));

    if std::env::var(env_var)
        .ok()
        .filter(|s| !s.is_empty())
        .is_none()
    {
        logging::log(&format!(
            "  walk[{}]: set {}={} (source=parent_process_pid)",
            level, env_var, pid_str
        ));
        std::env::set_var(env_var, &pid_str);
    }

    Some(agent.to_string())
}

fn matches_any(name: &str, patterns: &[String]) -> bool {
    patterns.iter().any(|pattern| name == pattern)
}

/// Check if a process name matches a known agent.
fn match_agent_name(comm: &str) -> Option<&'static str> {
    if comm.contains("codex") {
        Some("codex")
    } else if comm.contains("claude") {
        Some("claude")
    } else if comm.contains("gemini") {
        Some("gemini")
    } else {
        None
    }
}

// ═══════════════════════════════════════════════════════════
// Linux implementation — uses /proc filesystem
// ═══════════════════════════════════════════════════════════

#[cfg(target_os = "linux")]
fn collect_parent_processes(scan_depth: usize) -> Vec<ParentProcess> {
    let mut processes = Vec::new();
    let mut pid = std::os::unix::process::parent_id();

    for level in 0..scan_depth {
        if pid <= 1 {
            logging::debug(&format!("  walk[{}]: pid={} (init), stopping", level, pid));
            break;
        }

        let comm = match std::fs::read_to_string(format!("/proc/{}/comm", pid)) {
            Ok(s) => s.trim().to_lowercase(),
            Err(e) => {
                logging::debug(&format!(
                    "  walk[{}]: pid={} read comm failed: {}",
                    level, pid, e
                ));
                break;
            }
        };

        // When comm is a generic interpreter (node, python, etc.), read
        // /proc/PID/cmdline as fallback — it contains the full invocation
        // path which often includes the real tool name.
        let cmdline = if match_agent_name(&comm).is_none() {
            read_proc_cmdline(pid)
        } else {
            None
        };

        logging::debug(&format!(
            "  walk[{}]: pid={} comm='{}' cmdline={:?}",
            level, pid, comm, cmdline
        ));
        processes.push(ParentProcess {
            pid,
            name: comm,
            cmdline,
            level,
        });

        let stat = match std::fs::read_to_string(format!("/proc/{}/stat", pid)) {
            Ok(s) => s,
            Err(e) => {
                logging::debug(&format!(
                    "  walk[{}]: pid={} read stat failed: {}",
                    level, pid, e
                ));
                break;
            }
        };

        let after_name = match stat.rfind(')') {
            Some(pos) => &stat[pos + 2..],
            None => break,
        };
        let ppid_str = match after_name.split_whitespace().nth(1) {
            Some(s) => s,
            None => break,
        };
        pid = match ppid_str.parse::<u32>() {
            Ok(ppid) => ppid,
            Err(_) => break,
        };
    }

    processes
}

/// Read /proc/PID/cmdline and return as a single lowercase string.
/// cmdline is NUL-separated; we join with spaces for matching.
#[cfg(target_os = "linux")]
fn read_proc_cmdline(pid: u32) -> Option<String> {
    let raw = std::fs::read(format!("/proc/{}/cmdline", pid)).ok()?;
    if raw.is_empty() {
        return None;
    }
    let s = raw
        .split(|&b| b == 0)
        .map(|seg| String::from_utf8_lossy(seg))
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase();
    if s.trim().is_empty() {
        None
    } else {
        Some(s)
    }
}

// ═══════════════════════════════════════════════════════════
// macOS implementation — uses libproc / sysctl
// ═══════════════════════════════════════════════════════════

#[cfg(target_os = "macos")]
fn collect_parent_processes(scan_depth: usize) -> Vec<ParentProcess> {
    let mut processes = Vec::new();
    let mut pid = std::os::unix::process::parent_id();

    for level in 0..scan_depth {
        if pid <= 1 {
            logging::debug(&format!(
                "  walk[{}]: pid={} (init/launchd), stopping",
                level, pid
            ));
            break;
        }

        let comm = match macos_proc_name(pid) {
            Some(name) => name.to_lowercase(),
            None => {
                logging::debug(&format!("  walk[{}]: pid={} proc_name failed", level, pid));
                break;
            }
        };

        // On macOS, fall back to full command line via ps when comm is generic.
        let cmdline = if match_agent_name(&comm).is_none() {
            macos_cmdline(pid)
        } else {
            None
        };

        logging::debug(&format!(
            "  walk[{}]: pid={} comm='{}' cmdline={:?}",
            level, pid, comm, cmdline
        ));
        processes.push(ParentProcess {
            pid,
            name: comm,
            cmdline,
            level,
        });

        pid = match macos_ppid(pid) {
            Some(ppid) => ppid,
            None => {
                logging::debug(&format!("  walk[{}]: pid={} cannot get ppid", level, pid));
                break;
            }
        };
    }

    processes
}

/// Get process name on macOS using proc_name() from libproc.
#[cfg(target_os = "macos")]
fn macos_proc_name(pid: u32) -> Option<String> {
    extern "C" {
        fn proc_name(pid: i32, buffer: *mut u8, buffersize: u32) -> i32;
    }

    let mut buf = [0u8; 256];
    let len = unsafe { proc_name(pid as i32, buf.as_mut_ptr(), buf.len() as u32) };
    if len > 0 {
        Some(String::from_utf8_lossy(&buf[..len as usize]).to_string())
    } else {
        None
    }
}

/// Get parent PID on macOS via ps.
#[cfg(target_os = "macos")]
fn macos_ppid(pid: u32) -> Option<u32> {
    let output = std::process::Command::new("ps")
        .args(["-o", "ppid=", "-p", &pid.to_string()])
        .output()
        .ok()?;
    let ppid_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    ppid_str.parse::<u32>().ok()
}

/// Get full command line on macOS via ps.
#[cfg(target_os = "macos")]
fn macos_cmdline(pid: u32) -> Option<String> {
    let output = std::process::Command::new("ps")
        .args(["-o", "command=", "-p", &pid.to_string()])
        .output()
        .ok()?;
    let cmd = String::from_utf8_lossy(&output.stdout).trim().to_lowercase();
    if cmd.is_empty() {
        None
    } else {
        Some(cmd)
    }
}

// ═══════════════════════════════════════════════════════════
// Windows implementation — uses ToolHelp32 API
// ═══════════════════════════════════════════════════════════

#[cfg(target_os = "windows")]
fn collect_parent_processes(scan_depth: usize) -> Vec<ParentProcess> {
    let process_map = match win_build_process_map() {
        Some(map) => map,
        None => {
            logging::log("  walk: failed to build process map");
            return Vec::new();
        }
    };

    let own_pid = std::process::id();
    let mut pid = match process_map.get(&own_pid) {
        Some((_, ppid)) => *ppid,
        None => return Vec::new(),
    };

    let mut processes = Vec::new();

    for level in 0..scan_depth {
        if pid == 0 {
            logging::debug(&format!("  walk[{}]: pid=0 (System), stopping", level));
            break;
        }

        let (name, ppid) = match process_map.get(&pid) {
            Some(entry) => entry.clone(),
            None => {
                logging::debug(&format!("  walk[{}]: pid={} not in snapshot", level, pid));
                break;
            }
        };

        let comm = name.to_lowercase();
        // On Windows, the exe name from ToolHelp32 typically includes the
        // full filename (e.g. "node.exe"), so cmdline fallback is less
        // critical. We set it to None for now.
        logging::debug(&format!("  walk[{}]: pid={} comm='{}'", level, pid, comm));
        processes.push(ParentProcess {
            pid,
            name: comm,
            cmdline: None,
            level,
        });

        pid = ppid;
    }

    processes
}

/// Build a map of PID -> (exe_name, parent_pid) using CreateToolhelp32Snapshot.
#[cfg(target_os = "windows")]
fn win_build_process_map() -> Option<std::collections::HashMap<u32, (String, u32)>> {
    use std::collections::HashMap;

    const TH32CS_SNAPPROCESS: u32 = 0x00000002;
    const INVALID_HANDLE_VALUE: isize = -1;
    const MAX_PATH: usize = 260;

    #[repr(C)]
    struct ProcessEntry32W {
        dw_size: u32,
        cnt_usage: u32,
        th32_process_id: u32,
        th32_default_heap_id: usize,
        th32_module_id: u32,
        cnt_threads: u32,
        th32_parent_process_id: u32,
        pc_pri_class_base: i32,
        dw_flags: u32,
        sz_exe_file: [u16; MAX_PATH],
    }

    extern "system" {
        fn CreateToolhelp32Snapshot(dwFlags: u32, th32ProcessID: u32) -> isize;
        fn Process32FirstW(hSnapshot: isize, lppe: *mut ProcessEntry32W) -> i32;
        fn Process32NextW(hSnapshot: isize, lppe: *mut ProcessEntry32W) -> i32;
        fn CloseHandle(hObject: isize) -> i32;
    }

    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return None;
    }

    let mut map = HashMap::new();

    let mut entry: ProcessEntry32W = unsafe { std::mem::zeroed() };
    entry.dw_size = std::mem::size_of::<ProcessEntry32W>() as u32;

    let mut ok = unsafe { Process32FirstW(snapshot, &mut entry) };
    while ok != 0 {
        let name_len = entry
            .sz_exe_file
            .iter()
            .position(|&c| c == 0)
            .unwrap_or(MAX_PATH);
        let name = String::from_utf16_lossy(&entry.sz_exe_file[..name_len]);

        map.insert(entry.th32_process_id, (name, entry.th32_parent_process_id));

        entry.dw_size = std::mem::size_of::<ProcessEntry32W>() as u32;
        ok = unsafe { Process32NextW(snapshot, &mut entry) };
    }

    unsafe { CloseHandle(snapshot) };

    logging::debug(&format!(
        "  win: built process map with {} entries",
        map.len()
    ));
    Some(map)
}

#[cfg(test)]
mod tests {
    use super::{detect_trusted_caller, parse_gui_args, resolve_launch_paths, ParentProcess, match_agent_name};
    use crate::config::{AppConfig, LaunchConfig, PromptConfig};

    fn test_config() -> AppConfig {
        AppConfig {
            launch: LaunchConfig {
                scan_depth: 5,
                trusted_callers: vec!["codex".into(), "mycli".into()],
                ignored_callers: vec!["bash".into(), "sh".into()],
            },
            prompts: PromptConfig::default(),
        }
    }

    #[test]
    fn explicit_target_keeps_positional_as_review_path() {
        let argv = vec![
            "--target".to_string(),
            "draft.md".to_string(),
            "review.md".to_string(),
        ];
        let args = parse_gui_args(&argv, None, None, None);

        assert_eq!(args.review_path.as_deref(), Some("review.md"));
        assert_eq!(args.target_path.as_deref(), Some("draft.md"));
    }

    #[test]
    fn trusted_caller_turns_lone_positional_into_target() {
        let argv = vec!["draft.md".to_string()];
        let args = parse_gui_args(&argv, None, None, Some("codex".to_string()));

        assert_eq!(args.review_path, None);
        assert_eq!(args.target_path.as_deref(), Some("draft.md"));
    }

    #[test]
    fn explicit_target_beats_trusted_caller_fallback() {
        let argv = vec![
            "--target".to_string(),
            "draft.md".to_string(),
            "review.md".to_string(),
        ];
        let args = parse_gui_args(&argv, None, None, Some("codex".to_string()));

        assert_eq!(args.review_path.as_deref(), Some("review.md"));
        assert_eq!(args.target_path.as_deref(), Some("draft.md"));
    }

    #[test]
    fn compose_alias_sets_target_path() {
        let argv = vec![
            "--compose".to_string(),
            "draft.md".to_string(),
            "review.md".to_string(),
        ];
        let args = parse_gui_args(&argv, None, None, None);

        assert_eq!(args.review_path.as_deref(), Some("review.md"));
        assert_eq!(args.target_path.as_deref(), Some("draft.md"));
    }

    #[test]
    fn short_target_alias_sets_target_path() {
        let argv = vec![
            "-t".to_string(),
            "draft.md".to_string(),
            "review.md".to_string(),
        ];
        let args = parse_gui_args(&argv, None, None, None);

        assert_eq!(args.review_path.as_deref(), Some("review.md"));
        assert_eq!(args.target_path.as_deref(), Some("draft.md"));
    }

    #[test]
    fn standalone_lone_positional_stays_review_only() {
        let (review_path, target_path) = resolve_launch_paths(Some("note.md".into()), None, None);

        assert_eq!(review_path.as_deref(), Some("note.md"));
        assert_eq!(target_path, None);
    }

    #[test]
    fn trusted_caller_skips_ignored_wrappers() {
        let caller = detect_trusted_caller(
            &test_config(),
            &[
                ParentProcess {
                    pid: 10,
                    name: "bash".into(),
                    cmdline: None,
                    level: 0,
                },
                ParentProcess {
                    pid: 11,
                    name: "codex".into(),
                    cmdline: None,
                    level: 1,
                },
            ],
        );

        assert_eq!(caller.as_deref(), Some("codex"));
    }

    #[test]
    fn trusted_caller_matches_canonical_exact_name_only() {
        let caller = detect_trusted_caller(
            &test_config(),
            &[ParentProcess {
                pid: 13,
                name: "/Applications/Codex.exe".into(),
                cmdline: None,
                level: 0,
            }],
        );

        assert_eq!(caller.as_deref(), Some("codex"));
    }

    #[test]
    fn trusted_caller_does_not_match_substrings() {
        let caller = detect_trusted_caller(
            &test_config(),
            &[ParentProcess {
                pid: 14,
                name: "my-codex-wrapper".into(),
                cmdline: None,
                level: 0,
            }],
        );

        assert_eq!(caller, None);
    }

    #[test]
    fn untrusted_first_non_wrapper_stops_trust_walk() {
        let caller = detect_trusted_caller(
            &test_config(),
            &[
                ParentProcess {
                    pid: 15,
                    name: "bash".into(),
                    cmdline: None,
                    level: 0,
                },
                ParentProcess {
                    pid: 16,
                    name: "neovim".into(),
                    cmdline: None,
                    level: 1,
                },
                ParentProcess {
                    pid: 17,
                    name: "codex".into(),
                    cmdline: None,
                    level: 2,
                },
            ],
        );

        assert_eq!(caller, None);
    }

    #[test]
    fn untrusted_caller_does_not_enable_target_fallback() {
        let caller = detect_trusted_caller(
            &test_config(),
            &[ParentProcess {
                pid: 12,
                name: "neovim".into(),
                cmdline: None,
                level: 0,
            }],
        );

        assert_eq!(caller, None);
    }

    #[test]
    fn match_agent_name_detects_from_comm() {
        assert_eq!(match_agent_name("codex"), Some("codex"));
        assert_eq!(match_agent_name("claude"), Some("claude"));
        assert_eq!(match_agent_name("gemini"), Some("gemini"));
        assert_eq!(match_agent_name("node"), None);
        assert_eq!(match_agent_name("python"), None);
    }

    #[test]
    fn match_agent_name_detects_from_cmdline_path() {
        // Simulates Gemini CLI: comm is "node", but cmdline contains the gemini path
        let cmdline = "node --no-warnings=dep0040 /home/user/.nvm/versions/node/v22/bin/gemini";
        assert_eq!(match_agent_name(cmdline), Some("gemini"));

        // Claude via cmdline
        let cmdline = "node /home/user/.nvm/versions/node/v22/bin/claude --help";
        assert_eq!(match_agent_name(cmdline), Some("claude"));

        // Plain node process — no match
        let cmdline = "node /home/user/my-app/index.js";
        assert_eq!(match_agent_name(cmdline), None);
    }
}
