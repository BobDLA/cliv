use crate::logging;
use serde::Deserialize;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
struct CacheMetaRecord {
    agent: Option<String>,
    key: Option<String>,
    real_session_id: Option<String>,
    cached_at: Option<String>,
}

/// Read the cached Codex reply for a given cache key or thread-id.
/// The cache is populated by `cliv cache-codex` (called from Codex notify hook).
/// Returns an explicit error if no lookup key is available or cache/JSONL is missing.
#[tauri::command]
pub fn extract_codex_reply(
    thread_id: Option<String>,
    cwd: Option<String>,
) -> Result<String, String> {
    logging::timing("extract_codex_reply: start");

    let codex_home = std::env::var("CODEX_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".codex")
        });

    let param_source = if thread_id.is_some() {
        "parameter"
    } else {
        "none"
    };

    let resolved_thread_id = thread_id
        .or_else(|| {
            let env_val = std::env::var("CODEX_THREAD_ID")
                .ok()
                .filter(|s| !s.is_empty());
            if env_val.is_some() {
                logging::log("  extract codex: resolved key from CODEX_THREAD_ID env var");
            }
            env_val
        })
        .or_else(|| {
            let sqlite_val = resolve_thread_id_from_sqlite(&codex_home, cwd.as_deref());
            if sqlite_val.is_some() {
                logging::log("  extract codex: resolved key from SQLite");
            }
            sqlite_val
        });

    let source = if param_source == "parameter" {
        "parameter"
    } else if resolved_thread_id.is_some() {
        "env_or_sqlite"
    } else {
        "none"
    };

    logging::log(&format!(
        "  extract codex: resolved_key={:?} source={}",
        resolved_thread_id, source
    ));

    let result = extract_codex_reply_from(&codex_home, resolved_thread_id);
    logging::timing("extract_codex_reply: done");
    result
}

/// Testable inner function: reads Codex reply cache from a given home directory.
pub fn extract_codex_reply_from(
    codex_home: &Path,
    lookup_key: Option<String>,
) -> Result<String, String> {
    let lookup_key = match lookup_key {
        Some(key) => key,
        None => {
            return Err(
                "No Codex cache key found. Set CODEX_THREAD_ID or ensure agent detection provides it.".to_string()
            );
        }
    };

    // Strategy 1: Direct cache hit when the lookup key already is the pid-keyed filename.
    if is_pid_like(&lookup_key) {
        let cache_path = codex_home
            .join("reply_cache")
            .join(format!("{}.md", lookup_key));
        if let Some(reply) = read_cached_reply(&cache_path) {
            return reply;
        }
    }

    // Strategy 2: Resolve a pid-keyed cache file by metadata, typically from a thread-id.
    if let Some(cache_path) = resolve_cache_path_from_meta(codex_home, &lookup_key) {
        logging::log(&format!(
            "  extract codex: metadata matched key='{}' → {}",
            lookup_key,
            cache_path.display()
        ));
        if let Some(reply) = read_cached_reply(&cache_path) {
            return reply;
        }
    }

    // Strategy 3: Legacy direct cache hit for older thread-id keyed files.
    let legacy_cache_path = codex_home
        .join("reply_cache")
        .join(format!("{}.md", lookup_key));
    if let Some(reply) = read_cached_reply(&legacy_cache_path) {
        return reply;
    }

    // Strategy 4: Parse JSONL via SQLite-resolved path (deterministic, no guessing)
    if let Some(jsonl_path) = resolve_jsonl_from_sqlite(codex_home, &lookup_key) {
        logging::log(&format!(
            "  extract codex: trying JSONL path={}",
            jsonl_path.display()
        ));
        return extract_last_reply_from_jsonl(&jsonl_path);
    }

    Err(format!(
        "Codex reply not found for key '{}'. Neither cache file, metadata match, nor JSONL found.",
        lookup_key
    ))
}

fn is_pid_like(value: &str) -> bool {
    !value.is_empty() && value.chars().all(|ch| ch.is_ascii_digit())
}

fn read_cached_reply(cache_path: &Path) -> Option<Result<String, String>> {
    logging::log(&format!(
        "  extract codex: trying cache path={}",
        cache_path.display()
    ));
    if cache_path.exists() {
        logging::log(&format!(
            "  extract codex: HIT cache file={} size={}",
            cache_path.display(),
            fs::metadata(cache_path).map(|m| m.len()).unwrap_or(0)
        ));
        return Some(
            fs::read_to_string(cache_path)
                .map_err(|e| format!("Failed to read reply cache: {}", e)),
        );
    }
    None
}

fn resolve_cache_path_from_meta(codex_home: &Path, lookup_key: &str) -> Option<PathBuf> {
    let cache_dir = codex_home.join("reply_cache");
    let mut newest_match: Option<(u64, PathBuf)> = None;

    for entry in fs::read_dir(&cache_dir).ok()? {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let path = entry.path();
        let file_name = match path.file_name().and_then(|name| name.to_str()) {
            Some(name) => name,
            None => continue,
        };
        if !file_name.ends_with(".meta.json") {
            continue;
        }

        let raw = match fs::read_to_string(&path) {
            Ok(raw) => raw,
            Err(_) => continue,
        };
        let meta: CacheMetaRecord = match serde_json::from_str(&raw) {
            Ok(meta) => meta,
            Err(_) => continue,
        };
        if meta.agent.as_deref() != Some("codex") {
            continue;
        }

        let matches_lookup = meta.key.as_deref() == Some(lookup_key)
            || meta.real_session_id.as_deref() == Some(lookup_key);
        if !matches_lookup {
            continue;
        }

        let md_name = match file_name.strip_suffix(".meta.json") {
            Some(name) => name,
            None => continue,
        };
        let md_path = cache_dir.join(format!("{}.md", md_name));
        if !md_path.exists() {
            continue;
        }

        let cached_at = meta
            .cached_at
            .as_deref()
            .and_then(parse_cached_at)
            .unwrap_or(0);

        match newest_match {
            Some((best_ts, _)) if cached_at < best_ts => {}
            _ => newest_match = Some((cached_at, md_path)),
        }
    }

    newest_match.map(|(_, path)| path)
}

fn parse_cached_at(value: &str) -> Option<u64> {
    value.trim_end_matches('Z').parse::<u64>().ok()
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
