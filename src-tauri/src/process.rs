use crate::config::canonicalize_process_name;
use crate::logging;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct OwnerIdentity {
    pub pid: u32,
    pub started_at: u64,
}

#[derive(Debug, Clone)]
pub(crate) struct ParentProcess {
    pub pid: u32,
    pub name: String,
    pub cmdline: Option<String>,
    pub level: usize,
    pub started_at: Option<u64>,
}

pub(crate) fn resolve_owner_identity(
    process_chain: &[ParentProcess],
    ignored_callers: &[String],
) -> Option<(OwnerIdentity, usize, String)> {
    for process in process_chain {
        let canonical_name = canonicalize_process_name(&process.name);
        if ignored_callers
            .iter()
            .any(|pattern| canonical_name == *pattern)
        {
            logging::debug(&format!(
                "  owner[{}]: skipping ignored process '{}' (canonical='{}')",
                process.level, process.name, canonical_name
            ));
            continue;
        }

        let started_at = match process.started_at {
            Some(started_at) => started_at,
            None => {
                logging::debug(&format!(
                    "  owner[{}]: process '{}' (canonical='{}') missing start time; owner identity unavailable",
                    process.level, process.name, canonical_name
                ));
                return None;
            }
        };

        logging::log(&format!(
            "  owner[{}]: selected process '{}' (canonical='{}') pid={} started_at={}",
            process.level, process.name, canonical_name, process.pid, started_at
        ));
        return Some((
            OwnerIdentity {
                pid: process.pid,
                started_at,
            },
            process.level,
            canonical_name,
        ));
    }

    logging::debug("  owner: no non-wrapper process found in parent chain");
    None
}

#[cfg(target_os = "linux")]
pub(crate) fn collect_parent_processes(scan_depth: usize) -> Vec<ParentProcess> {
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
            started_at: None,
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

#[cfg(target_os = "macos")]
pub(crate) fn collect_parent_processes(scan_depth: usize) -> Vec<ParentProcess> {
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
            started_at: None,
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

#[cfg(target_os = "macos")]
fn macos_ppid(pid: u32) -> Option<u32> {
    let output = std::process::Command::new("ps")
        .args(["-o", "ppid=", "-p", &pid.to_string()])
        .output()
        .ok()?;
    let ppid_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    ppid_str.parse::<u32>().ok()
}

#[cfg(target_os = "macos")]
fn macos_cmdline(pid: u32) -> Option<String> {
    let output = std::process::Command::new("ps")
        .args(["-o", "command=", "-p", &pid.to_string()])
        .output()
        .ok()?;
    let cmd = String::from_utf8_lossy(&output.stdout)
        .trim()
        .to_lowercase();
    if cmd.is_empty() {
        None
    } else {
        Some(cmd)
    }
}

#[cfg(target_os = "windows")]
pub(crate) fn collect_parent_processes(scan_depth: usize) -> Vec<ParentProcess> {
    let process_map = match win_build_process_map() {
        Some(map) => map,
        None => {
            logging::log("  walk: failed to build process map");
            return Vec::new();
        }
    };

    let own_pid = std::process::id();
    let mut pid = match process_map.get(&own_pid) {
        Some((_, ppid, _)) => *ppid,
        None => return Vec::new(),
    };

    let mut processes = Vec::new();

    for level in 0..scan_depth {
        if pid == 0 {
            logging::debug(&format!("  walk[{}]: pid=0 (System), stopping", level));
            break;
        }

        let (name, ppid, started_at) = match process_map.get(&pid) {
            Some(entry) => entry.clone(),
            None => {
                logging::debug(&format!("  walk[{}]: pid={} not in snapshot", level, pid));
                break;
            }
        };

        let comm = name.to_lowercase();
        logging::debug(&format!(
            "  walk[{}]: pid={} comm='{}' started_at={:?}",
            level, pid, comm, started_at
        ));
        processes.push(ParentProcess {
            pid,
            name: comm,
            cmdline: None,
            level,
            started_at,
        });

        pid = ppid;
    }

    processes
}

#[cfg(target_os = "windows")]
fn win_build_process_map() -> Option<std::collections::HashMap<u32, (String, u32, Option<u64>)>> {
    use std::collections::HashMap;
    use windows_sys::Win32::Foundation::CloseHandle;

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
        let started_at = win_process_started_at(entry.th32_process_id);

        map.insert(
            entry.th32_process_id,
            (name, entry.th32_parent_process_id, started_at),
        );

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

#[cfg(target_os = "windows")]
fn win_process_started_at(pid: u32) -> Option<u64> {
    use windows_sys::Win32::Foundation::{CloseHandle, FILETIME};
    use windows_sys::Win32::System::Threading::{
        GetProcessTimes, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    fn filetime_to_u64(value: FILETIME) -> u64 {
        ((value.dwHighDateTime as u64) << 32) | value.dwLowDateTime as u64
    }

    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    if handle == 0 {
        return None;
    }

    let mut creation_time = FILETIME {
        dwLowDateTime: 0,
        dwHighDateTime: 0,
    };
    let mut exit_time = FILETIME {
        dwLowDateTime: 0,
        dwHighDateTime: 0,
    };
    let mut kernel_time = FILETIME {
        dwLowDateTime: 0,
        dwHighDateTime: 0,
    };
    let mut user_time = FILETIME {
        dwLowDateTime: 0,
        dwHighDateTime: 0,
    };

    let ok = unsafe {
        GetProcessTimes(
            handle,
            &mut creation_time,
            &mut exit_time,
            &mut kernel_time,
            &mut user_time,
        )
    };
    unsafe { CloseHandle(handle) };

    if ok == 0 {
        None
    } else {
        Some(filetime_to_u64(creation_time))
    }
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
pub(crate) fn collect_parent_processes(_scan_depth: usize) -> Vec<ParentProcess> {
    Vec::new()
}

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

#[cfg(test)]
mod tests {
    use super::{resolve_owner_identity, OwnerIdentity, ParentProcess};

    #[test]
    fn owner_identity_skips_wrappers_and_selects_first_non_wrapper() {
        let (identity, level, canonical_name) = resolve_owner_identity(
            &[
                ParentProcess {
                    pid: 10,
                    name: "cmd.exe".into(),
                    cmdline: None,
                    level: 0,
                    started_at: Some(100),
                },
                ParentProcess {
                    pid: 20,
                    name: "node.exe".into(),
                    cmdline: None,
                    level: 1,
                    started_at: Some(200),
                },
            ],
            &["cmd".into(), "explorer".into()],
        )
        .expect("expected owner identity");

        assert_eq!(
            identity,
            OwnerIdentity {
                pid: 20,
                started_at: 200,
            }
        );
        assert_eq!(level, 1);
        assert_eq!(canonical_name, "node");
    }

    #[test]
    fn owner_identity_requires_process_start_time() {
        let identity = resolve_owner_identity(
            &[ParentProcess {
                pid: 20,
                name: "node.exe".into(),
                cmdline: None,
                level: 0,
                started_at: None,
            }],
            &["cmd".into()],
        );

        assert!(identity.is_none());
    }
}
