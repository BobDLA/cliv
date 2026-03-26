mod common;

use crate::process::OwnerIdentity;
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
    pub(super) owner_pid: Option<u32>,
    pub(super) owner_started_at: Option<u64>,
    pub(super) cached_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct OwnerCacheLookup {
    pub agent: String,
    pub key: String,
    pub cached_at: u128,
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

pub(crate) fn resolve_agent_lookup_by_owner_identity(
    owner: &OwnerIdentity,
) -> Option<OwnerCacheLookup> {
    let agent_homes = vec![
        (
            "codex",
            common::env_or_default_agent_home("CODEX_HOME", ".codex"),
        ),
        ("claude", common::default_agent_home(".claude")),
        ("gemini", common::default_agent_home(".gemini")),
    ];

    resolve_agent_lookup_by_owner_identity_from(&agent_homes, owner)
}

fn resolve_agent_lookup_by_owner_identity_from(
    agent_homes: &[(&str, PathBuf)],
    owner: &OwnerIdentity,
) -> Option<OwnerCacheLookup> {
    let mut matches = Vec::new();

    for (agent, home) in agent_homes {
        if let Some(found) = newest_owner_match_for_agent(agent, home, owner) {
            matches.push(found);
        }
    }

    if matches.is_empty() {
        crate::logging::debug(&format!(
            "  owner-cache: no metadata match for owner pid={} started_at={}",
            owner.pid, owner.started_at
        ));
        return None;
    }

    let first_agent = matches[0].agent.clone();
    if matches.iter().any(|item| item.agent != first_agent) {
        let agents = matches
            .iter()
            .map(|item| item.agent.as_str())
            .collect::<Vec<_>>()
            .join(", ");
        crate::logging::log(&format!(
            "  owner-cache: ambiguous owner match for pid={} started_at={} across agents [{}]",
            owner.pid, owner.started_at, agents
        ));
        return None;
    }

    matches.into_iter().max_by(|left, right| {
        left.cached_at
            .cmp(&right.cached_at)
            .then_with(|| left.key.cmp(&right.key))
    })
}

fn newest_owner_match_for_agent(
    agent: &str,
    agent_home: &Path,
    owner: &OwnerIdentity,
) -> Option<OwnerCacheLookup> {
    let cache_dir = agent_home.join("reply_cache");
    let mut newest_match: Option<OwnerCacheLookup> = None;

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
        if meta.owner_pid != Some(owner.pid) || meta.owner_started_at != Some(owner.started_at) {
            continue;
        }

        let Some(key) = meta.key.clone() else {
            continue;
        };
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
        let candidate = OwnerCacheLookup {
            agent: agent.to_string(),
            key,
            cached_at,
        };

        let should_replace = match newest_match.as_ref() {
            Some(best) => {
                candidate.cached_at > best.cached_at
                    || (candidate.cached_at == best.cached_at && candidate.key > best.key)
            }
            None => true,
        };
        if should_replace {
            newest_match = Some(candidate);
        }
    }

    newest_match
}

#[cfg(test)]
mod tests {
    use super::{resolve_agent_lookup_by_owner_identity_from, OwnerCacheLookup};
    use crate::process::OwnerIdentity;
    use std::fs;
    use std::path::Path;

    fn write_cache_record(
        home: &Path,
        agent: &str,
        key: &str,
        owner_pid: u32,
        owner_started_at: u64,
        cached_at: &str,
    ) {
        let cache_dir = home.join("reply_cache");
        fs::create_dir_all(&cache_dir).unwrap();
        fs::write(
            cache_dir.join(format!("{}.md", key)),
            format!("reply {}", key),
        )
        .unwrap();
        let meta = serde_json::json!({
            "agent": agent,
            "key": key,
            "owner_pid": owner_pid,
            "owner_started_at": owner_started_at,
            "cached_at": cached_at
        });
        fs::write(
            cache_dir.join(format!("{}.meta.json", key)),
            serde_json::to_string(&meta).unwrap(),
        )
        .unwrap();
    }

    #[test]
    fn owner_identity_match_selects_newest_unique_agent_record() {
        let codex_home = tempfile::tempdir().unwrap();
        let claude_home = tempfile::tempdir().unwrap();
        write_cache_record(codex_home.path(), "codex", "101", 77, 1234, "10Z");
        write_cache_record(codex_home.path(), "codex", "202", 77, 1234, "20Z");
        write_cache_record(claude_home.path(), "claude", "session-a", 88, 5678, "30Z");

        let result = resolve_agent_lookup_by_owner_identity_from(
            &[
                ("codex", codex_home.path().to_path_buf()),
                ("claude", claude_home.path().to_path_buf()),
            ],
            &OwnerIdentity {
                pid: 77,
                started_at: 1234,
            },
        );

        assert_eq!(
            result,
            Some(OwnerCacheLookup {
                agent: "codex".into(),
                key: "202".into(),
                cached_at: 20,
            })
        );
    }

    #[test]
    fn owner_identity_match_fails_closed_when_multiple_agents_match() {
        let codex_home = tempfile::tempdir().unwrap();
        let claude_home = tempfile::tempdir().unwrap();
        write_cache_record(codex_home.path(), "codex", "101", 77, 1234, "10Z");
        write_cache_record(claude_home.path(), "claude", "session-a", 77, 1234, "20Z");

        let result = resolve_agent_lookup_by_owner_identity_from(
            &[
                ("codex", codex_home.path().to_path_buf()),
                ("claude", claude_home.path().to_path_buf()),
            ],
            &OwnerIdentity {
                pid: 77,
                started_at: 1234,
            },
        );

        assert_eq!(result, None);
    }
}
