use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

/// Read the cached Codex reply for a given thread-id.
/// The cache is populated by `cliv cache-codex` (called from Codex notify hook).
/// Returns an explicit error if no thread ID is available or cache/JSONL is missing.
#[tauri::command]
pub fn extract_codex_reply(thread_id: Option<String>, cwd: Option<String>) -> Result<String, String> {
    let codex_home = std::env::var("CODEX_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".codex")
        });

    let resolved_thread_id = thread_id
        .or_else(|| std::env::var("CODEX_THREAD_ID").ok().filter(|s| !s.is_empty()))
        .or_else(|| resolve_thread_id_from_sqlite(&codex_home, cwd.as_deref()));

    extract_codex_reply_from(&codex_home, resolved_thread_id)
}

/// Testable inner function: reads Codex reply cache from a given home directory.
pub fn extract_codex_reply_from(
    codex_home: &Path,
    thread_id: Option<String>,
) -> Result<String, String> {
    // Strategy 1: Read from notify hook cache
    if let Some(ref tid) = thread_id {
        let cache_path = codex_home.join("reply_cache").join(format!("{}.md", tid));
        if cache_path.exists() {
            return fs::read_to_string(&cache_path)
                .map_err(|e| format!("Failed to read reply cache: {}", e));
        }
    }

    // Strategy 2: Parse JSONL via SQLite-resolved path (deterministic, no guessing)
    if let Some(ref tid) = thread_id {
        if let Some(jsonl_path) = resolve_jsonl_from_sqlite(codex_home, tid) {
            return extract_last_reply_from_jsonl(&jsonl_path);
        }
    }

    match thread_id {
        Some(tid) => Err(format!(
            "Codex reply not found for thread '{}'. Neither cache file nor JSONL found.",
            tid
        )),
        None => Err(
            "No Codex thread ID found. Set CODEX_THREAD_ID or ensure the notify hook provides it.".to_string()
        ),
    }
}

fn resolve_thread_id_from_sqlite(codex_home: &Path, cwd: Option<&str>) -> Option<String> {
    let cwd = cwd?;
    let db_path = codex_home.join("state_5.sqlite");
    if !db_path.exists() {
        return None;
    }

    let output = std::process::Command::new("sqlite3")
        .arg(db_path.to_string_lossy().as_ref())
        .arg(format!(
            "SELECT id FROM threads WHERE cwd='{}' AND archived=0 ORDER BY updated_at DESC LIMIT 1;",
            cwd.replace('\'', "''")
        ))
        .output()
        .ok()?;

    let id = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if id.is_empty() { None } else { Some(id) }
}

fn resolve_jsonl_from_sqlite(codex_home: &Path, thread_id: &str) -> Option<PathBuf> {
    let db_path = codex_home.join("state_5.sqlite");
    if !db_path.exists() {
        return None;
    }

    let output = std::process::Command::new("sqlite3")
        .arg(db_path.to_string_lossy().as_ref())
        .arg(format!(
            "SELECT rollout_path FROM threads WHERE id='{}';",
            thread_id.replace('\'', "''")
        ))
        .output()
        .ok()?;

    let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path_str.is_empty() {
        return None;
    }
    let path = PathBuf::from(&path_str);
    if path.exists() { Some(path) } else { None }
}

fn extract_last_reply_from_jsonl(path: &PathBuf) -> Result<String, String> {
    let file = fs::File::open(path)
        .map_err(|e| format!("Failed to open JSONL: {}", e))?;
    let reader = BufReader::new(file);

    let mut last_reply: Option<String> = None;

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };

        // Quick pre-filter to avoid parsing every line
        if !line.contains("output_text") {
            continue;
        }

        if let Ok(entry) = serde_json::from_str::<serde_json::Value>(&line) {
            if entry.get("type").and_then(|v| v.as_str()) == Some("response_item") {
                if let Some(payload) = entry.get("payload") {
                    if payload.get("role").and_then(|v| v.as_str()) == Some("assistant") {
                        if let Some(content) = payload.get("content").and_then(|v| v.as_array()) {
                            let texts: Vec<&str> = content
                                .iter()
                                .filter(|c| {
                                    c.get("type").and_then(|v| v.as_str()) == Some("output_text")
                                })
                                .filter_map(|c| c.get("text").and_then(|v| v.as_str()))
                                .collect();
                            if !texts.is_empty() {
                                last_reply = Some(texts.join("\n\n"));
                            }
                        }
                    }
                }
            }
        }
    }

    last_reply.ok_or_else(|| "No assistant reply found in JSONL".to_string())
}
