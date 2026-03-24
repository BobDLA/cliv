mod common;

use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};

pub mod claude;
pub mod codex;
pub mod gemini;

#[derive(Debug, Deserialize)]
pub(super) struct CacheMetaRecord {
    pub(super) agent: Option<String>,
    pub(super) key: Option<String>,
    pub(super) real_session_id: Option<String>,
    pub(super) pid: Option<u32>,
    pub(super) cached_at: Option<String>,
}

pub(super) fn is_pid_like(value: &str) -> bool {
    !value.is_empty() && value.chars().all(|ch| ch.is_ascii_digit())
}

pub(super) fn read_cached_reply(agent: &str, cache_path: &Path) -> Option<Result<String, String>> {
    crate::logging::log(&format!(
        "  extract {}: trying cache path={}",
        agent,
        cache_path.display()
    ));
    if cache_path.exists() {
        crate::logging::log(&format!(
            "  extract {}: HIT cache file={} size={}",
            agent,
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

pub(super) fn resolve_cache_path_from_meta(
    agent: &str,
    agent_home: &Path,
    lookup_key: &str,
) -> Option<PathBuf> {
    let cache_dir = agent_home.join("reply_cache");
    let lookup_pid = if is_pid_like(lookup_key) {
        lookup_key.parse::<u32>().ok()
    } else {
        None
    };
    let mut newest_match: Option<(u8, u128, String, PathBuf)> = None;

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
        if meta.agent.as_deref() != Some(agent) {
            continue;
        }

        // Prefer explicit key / real-session matches over pid alias matches.
        // This avoids treating numeric conversation identities as interchangeable
        // with unrelated pid-backed cache records.
        let match_rank = if meta.key.as_deref() == Some(lookup_key)
            || meta.real_session_id.as_deref() == Some(lookup_key)
        {
            2
        } else if lookup_pid
            .zip(meta.pid)
            .is_some_and(|(expected, actual)| expected == actual)
        {
            1
        } else {
            0
        };
        if match_rank == 0 {
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
        let tie_break_key = md_name.to_string();
        let should_replace = match newest_match.as_ref() {
            Some((best_rank, best_ts, best_key, _)) => {
                match_rank > *best_rank
                    || (match_rank == *best_rank && cached_at > *best_ts)
                    || (match_rank == *best_rank
                        && cached_at == *best_ts
                        && tie_break_key > *best_key)
            }
            None => true,
        };
        if should_replace {
            newest_match = Some((match_rank, cached_at, tie_break_key, md_path));
        }
    }

    newest_match.map(|(_, _, _, path)| path)
}

fn parse_cached_at(value: &str) -> Option<u128> {
    value.trim_end_matches('Z').parse::<u128>().ok()
}
