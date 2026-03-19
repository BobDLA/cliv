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
    pub compose_path: Option<String>,
    pub metadata_path: Option<String>,
    pub file_path: Option<String>,
    /// Which agent triggered the launch: "codex", "claude", "gemini", or "unknown".
    /// Auto-detected from environment variables.
    pub agent: Option<String>,
}

/// Full CLI parse result containing both mode and GUI args.
pub struct CliParsed {
    pub mode: CliMode,
    pub args: CliArgs,
}

impl CliParsed {
    pub fn from_env() -> Self {
        let argv: Vec<String> = std::env::args().collect();

        logging::log("═══════════════════════════════════════════════════");
        logging::log(&format!("cliV started  PID={}", std::process::id()));
        logging::log(&format!("  argv={:?}", argv));
        logging::debug(&format!("  CWD={}", std::env::current_dir().map(|p| p.display().to_string()).unwrap_or_default()));
        logging::debug(&format!("  CLIV_AGENT={}", std::env::var("CLIV_AGENT").unwrap_or_default()));
        logging::debug(&format!("  CODEX_THREAD_ID={}", std::env::var("CODEX_THREAD_ID").unwrap_or_default()));
        logging::debug(&format!("  CODEX_HOME={}", std::env::var("CODEX_HOME").unwrap_or_default()));
        logging::debug(&format!("  CLAUDE_SESSION_ID={}", std::env::var("CLAUDE_SESSION_ID").unwrap_or_default()));
        logging::debug(&format!("  GEMINI_SESSION_ID={}", std::env::var("GEMINI_SESSION_ID").unwrap_or_default()));

        // Check for subcommand first
        if argv.len() >= 2 {
            match argv[1].as_str() {
                "cache-codex" => {
                    let json = argv.get(2).cloned().unwrap_or_default();
                    logging::log(&format!("  mode=cache-codex  json_len={}", json.len()));
                    return CliParsed {
                        mode: CliMode::CacheCodex(json),
                        args: CliArgs {
                            compose_path: None,
                            metadata_path: None,
                            file_path: None,
                            agent: None,
                        },
                    };
                }
                "cache-claude" => {
                    logging::log("  mode=cache-claude (stdin)");
                    return CliParsed {
                        mode: CliMode::CacheClaude,
                        args: CliArgs {
                            compose_path: None,
                            metadata_path: None,
                            file_path: None,
                            agent: None,
                        },
                    };
                }
                "cache-gemini" => {
                    logging::log("  mode=cache-gemini (stdin)");
                    return CliParsed {
                        mode: CliMode::CacheGemini,
                        args: CliArgs {
                            compose_path: None,
                            metadata_path: None,
                            file_path: None,
                            agent: None,
                        },
                    };
                }
                _ => {}
            }
        }

        // GUI mode: parse args + auto-detect agent
        let agent = detect_agent();
        logging::log(&format!("  mode=gui  detected_agent={:?}", agent));

        let args = parse_gui_args(&argv[1..], agent);

        logging::log(&format!("  compose_path={:?}  file_path={:?}", args.compose_path, args.file_path));
        logging::debug(&format!("  CODEX_THREAD_ID (after detect)={}", std::env::var("CODEX_THREAD_ID").unwrap_or_default()));

        CliParsed {
            mode: CliMode::Gui,
            args,
        }
    }
}

/// Parse GUI-mode arguments from an argv slice (excluding the binary name).
fn parse_gui_args(argv: &[String], agent: Option<String>) -> CliArgs {
    let mut args = CliArgs {
        compose_path: None,
        metadata_path: None,
        file_path: None,
        agent,
    };

    let mut i = 0;
    while i < argv.len() {
        match argv[i].as_str() {
            "--metadata" => {
                if i + 1 < argv.len() {
                    args.metadata_path = Some(argv[i + 1].clone());
                    i += 2;
                } else {
                    i += 1;
                }
            }
            "--compose" => {
                if i + 1 < argv.len() {
                    args.compose_path = Some(argv[i + 1].clone());
                    i += 2;
                } else {
                    i += 1;
                }
            }
            // Skip known subcommands and flags that might be passed
            arg if arg.starts_with('-') => {
                i += 1;
            }
            arg => {
                if args.file_path.is_none() {
                    args.file_path = Some(arg.to_string());
                    if args.compose_path.is_none() {
                        args.compose_path = Some(arg.to_string());
                    }
                }
                i += 1;
            }
        }
    }

    args
}

// ═══════════════════════════════════════════════════════════
// Agent detection (shared logic)
// ═══════════════════════════════════════════════════════════

/// Auto-detect which agent triggered the launch from environment variables
/// and process tree inspection (anti-crosstalk for Codex).
fn detect_agent() -> Option<String> {
    // Explicit override
    if let Ok(agent) = std::env::var("CLIV_AGENT") {
        if !agent.is_empty() {
            logging::log(&format!("  detect: CLIV_AGENT={} → using override", agent));
            return Some(agent);
        }
    }

    // Check explicit session env vars first
    if std::env::var("CODEX_THREAD_ID").ok().filter(|s| !s.is_empty()).is_some() {
        logging::log("  detect: CODEX_THREAD_ID set → codex");
        return Some("codex".to_string());
    }

    if std::env::var("CLAUDE_SESSION_ID").ok().filter(|s| !s.is_empty()).is_some() {
        logging::log("  detect: CLAUDE_SESSION_ID set → claude");
        return Some("claude".to_string());
    }

    if std::env::var("GEMINI_SESSION_ID").ok().filter(|s| !s.is_empty()).is_some() {
        logging::log("  detect: GEMINI_SESSION_ID set → gemini");
        return Some("gemini".to_string());
    }

    logging::debug("  detect: no session env vars found, trying parent process...");

    // Process tree heuristic: check parent process chain.
    if let Some(agent) = detect_agent_from_parent_process() {
        logging::log(&format!("  detect: parent process → {} (source=pid)", agent));
        return Some(agent);
    }

    logging::log("  detect: no agent detected");
    None
}

/// Given a matched agent and its PID, set the appropriate session env var.
/// All agents use PID as their cache key — simple, deterministic, cross-platform.
fn handle_agent_match(agent_name: &str, agent_pid: u32, level: usize) -> Option<String> {
    let pid_str = agent_pid.to_string();
    let (env_var, agent) = match agent_name {
        "codex"  => ("CODEX_THREAD_ID", "codex"),
        "claude" => ("CLAUDE_SESSION_ID", "claude"),
        "gemini" => ("GEMINI_SESSION_ID", "gemini"),
        _ => return None,
    };

    logging::log(&format!("  walk[{}]: matched {} at pid={}", level, agent, agent_pid));

    if std::env::var(env_var).ok().filter(|s| !s.is_empty()).is_none() {
        logging::log(&format!("  walk[{}]: set {}={} (source=parent_process_pid)", level, env_var, pid_str));
        std::env::set_var(env_var, &pid_str);
    }

    Some(agent.to_string())
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
fn detect_agent_from_parent_process() -> Option<String> {
    let mut pid = std::os::unix::process::parent_id();

    for level in 0..5 {
        if pid <= 1 {
            logging::debug(&format!("  walk[{}]: pid={} (init), stopping", level, pid));
            break;
        }

        // Read process name from /proc/PID/comm
        let comm = match std::fs::read_to_string(format!("/proc/{}/comm", pid)) {
            Ok(s) => s.trim().to_lowercase(),
            Err(e) => {
                logging::debug(&format!("  walk[{}]: pid={} read comm failed: {}", level, pid, e));
                break;
            }
        };

        logging::debug(&format!("  walk[{}]: pid={} comm='{}'", level, pid, comm));

        if let Some(agent) = match_agent_name(&comm) {
            return handle_agent_match(agent, pid, level);
        }

        // Walk up: read PPID from /proc/PID/stat
        let stat = match std::fs::read_to_string(format!("/proc/{}/stat", pid)) {
            Ok(s) => s,
            Err(e) => {
                logging::debug(&format!("  walk[{}]: pid={} read stat failed: {}", level, pid, e));
                break;
            }
        };
        // Format: "PID (name) S PPID ..." — find last ')' to skip process name
        let after_name = match stat.rfind(')') {
            Some(pos) => &stat[pos + 2..],
            None => break,
        };
        let ppid_str = match after_name.split_whitespace().nth(1) {
            Some(s) => s,
            None => break,
        };
        pid = match ppid_str.parse::<u32>() {
            Ok(p) => p,
            Err(_) => break,
        };
    }

    None
}



// ═══════════════════════════════════════════════════════════
// macOS implementation — uses libproc / sysctl
// ═══════════════════════════════════════════════════════════

#[cfg(target_os = "macos")]
fn detect_agent_from_parent_process() -> Option<String> {
    let mut pid = std::os::unix::process::parent_id();

    for level in 0..5 {
        if pid <= 1 {
            logging::debug(&format!("  walk[{}]: pid={} (init/launchd), stopping", level, pid));
            break;
        }

        let comm = match macos_proc_name(pid) {
            Some(name) => name.to_lowercase(),
            None => {
                logging::debug(&format!("  walk[{}]: pid={} proc_name failed", level, pid));
                break;
            }
        };

        logging::debug(&format!("  walk[{}]: pid={} comm='{}'", level, pid, comm));

        if let Some(agent) = match_agent_name(&comm) {
            return handle_agent_match(agent, pid, level);
        }

        // Walk up: get parent PID via sysctl
        pid = match macos_ppid(pid) {
            Some(ppid) => ppid,
            None => {
                logging::debug(&format!("  walk[{}]: pid={} cannot get ppid", level, pid));
                break;
            }
        };
    }

    None
}

/// Get process name on macOS using proc_name() from libproc.
#[cfg(target_os = "macos")]
fn macos_proc_name(pid: u32) -> Option<String> {
    // proc_name() is available in libproc.h on macOS
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

// ═══════════════════════════════════════════════════════════
// Windows implementation — uses ToolHelp32 API
// ═══════════════════════════════════════════════════════════

#[cfg(target_os = "windows")]
fn detect_agent_from_parent_process() -> Option<String> {
    // Build a PID -> (process_name, parent_pid) map from system snapshot
    let process_map = match win_build_process_map() {
        Some(m) => m,
        None => {
            logging::log("  walk: failed to build process map");
            return None;
        }
    };

    // Get own PID, then walk parents
    let own_pid = std::process::id();
    let mut pid = match process_map.get(&own_pid) {
        Some((_, ppid)) => *ppid,
        None => return None,
    };

    for level in 0..5 {
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
        logging::debug(&format!("  walk[{}]: pid={} comm='{}'", level, pid, comm));

        if let Some(agent) = match_agent_name(&comm) {
            return handle_agent_match(agent, pid, level);
        }

        pid = ppid;
    }

    None
}

/// Build a map of PID -> (exe_name, parent_pid) using CreateToolhelp32Snapshot.
#[cfg(target_os = "windows")]
fn win_build_process_map() -> Option<std::collections::HashMap<u32, (String, u32)>> {
    use std::collections::HashMap;

    // Windows API constants
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
        let name_len = entry.sz_exe_file.iter().position(|&c| c == 0).unwrap_or(MAX_PATH);
        let name = String::from_utf16_lossy(&entry.sz_exe_file[..name_len]);

        map.insert(
            entry.th32_process_id,
            (name, entry.th32_parent_process_id),
        );

        entry.dw_size = std::mem::size_of::<ProcessEntry32W>() as u32;
        ok = unsafe { Process32NextW(snapshot, &mut entry) };
    }

    unsafe { CloseHandle(snapshot) };

    logging::debug(&format!("  win: built process map with {} entries", map.len()));
    Some(map)
}
