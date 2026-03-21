// Archive: SQLite/JSONL fallback functions removed from src-tauri/src/extract/codex.rs
// Date: 2026-03-22
// Reason: Dead code — GUI always calls extractCodexReply(null, null), cwd is never
//         provided, so resolve_thread_id_from_sqlite never fires. The pid-keyed caching
//         mechanism (Strategies 1-3) fully covers all real usage.
// Branch: simplify-codex-sqlite-fallback

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::fs;

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
    if id.is_empty() {
        None
    } else {
        Some(id)
    }
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
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

fn extract_last_reply_from_jsonl(path: &PathBuf) -> Result<String, String> {
    let file = fs::File::open(path).map_err(|e| format!("Failed to open JSONL: {}", e))?;
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
