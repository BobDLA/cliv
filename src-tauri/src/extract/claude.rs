use super::{common, read_cached_reply, resolve_cache_path_from_meta};
use crate::logging;
use std::path::Path;

/// Read the cached Claude Code reply for a given lookup key.
/// The cache is populated by `cliv cache-claude` (called from Claude Stop hook).
/// Returns an explicit error if no lookup key is available or cache file cannot be resolved.
#[tauri::command]
pub fn extract_claude_reply(session_id: Option<String>) -> Result<String, String> {
    logging::timing("extract_claude_reply: start");

    let claude_home = common::default_agent_home(".claude");
    let (resolved_session_id, source) =
        common::resolve_lookup_key("extract claude", session_id, "CLAUDE_SESSION_ID", "env_var");

    logging::log(&format!(
        "  extract claude: resolved_key={:?} source={}",
        resolved_session_id, source
    ));

    let result = extract_claude_reply_from(&claude_home, resolved_session_id);
    logging::timing("extract_claude_reply: done");
    result
}

/// Testable inner function: reads Claude reply cache from a given home directory.
pub fn extract_claude_reply_from(
    claude_home: &Path,
    lookup_key: Option<String>,
) -> Result<String, String> {
    let lookup_key = match lookup_key {
        Some(key) => key,
        None => {
            return Err(
                "No Claude cache key found. Set CLAUDE_SESSION_ID or ensure the Stop hook provides it. reply_cache lookup was not attempted."
                    .to_string()
            )
        }
    };

    let cache_path = claude_home
        .join("reply_cache")
        .join(format!("{}.md", lookup_key));
    if let Some(reply) = read_cached_reply("claude", &cache_path) {
        return reply;
    }

    if let Some(cache_path) = resolve_cache_path_from_meta("claude", claude_home, &lookup_key) {
        logging::log(&format!(
            "  extract claude: metadata matched key='{}' → {}",
            lookup_key,
            cache_path.display()
        ));
        if let Some(reply) = read_cached_reply("claude", &cache_path) {
            return reply;
        }
    }

    Err(format!(
        "Claude reply cache not found for key '{}'. Neither cache file nor metadata match found. cache_dir={}",
        lookup_key,
        claude_home.join("reply_cache").display(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_temp_home() -> tempfile::TempDir {
        let dir = tempfile::tempdir().expect("failed to create temp dir");
        fs::create_dir_all(dir.path().join("reply_cache"))
            .expect("failed to create reply_cache dir");
        dir
    }

    #[test]
    fn direct_session_cache_hit() {
        let home = setup_temp_home();
        let cache_path = home.path().join("reply_cache").join("session-abc.md");
        fs::write(&cache_path, "Claude session reply").unwrap();

        let result = extract_claude_reply_from(home.path(), Some("session-abc".into()));
        assert_eq!(result.unwrap(), "Claude session reply");
    }

    #[test]
    fn metadata_match_hit_from_session_id_to_pid_keyed_file() {
        let home = setup_temp_home();
        let cache_dir = home.path().join("reply_cache");
        fs::write(cache_dir.join("12345.md"), "Claude pid-keyed reply").unwrap();
        let meta = serde_json::json!({
            "agent": "claude",
            "key": "12345",
            "real_session_id": "session-abc",
            "pid": 12345,
            "cached_at": "1700000000Z"
        });
        fs::write(
            cache_dir.join("12345.meta.json"),
            serde_json::to_string(&meta).unwrap(),
        )
        .unwrap();

        let result = extract_claude_reply_from(home.path(), Some("session-abc".into()));
        assert_eq!(result.unwrap(), "Claude pid-keyed reply");
    }

    #[test]
    fn metadata_match_hit_from_pid_to_session_keyed_file() {
        let home = setup_temp_home();
        let cache_dir = home.path().join("reply_cache");
        fs::write(
            cache_dir.join("session-abc.md"),
            "Claude session-keyed reply",
        )
        .unwrap();
        let meta = serde_json::json!({
            "agent": "claude",
            "key": "session-abc",
            "real_session_id": "session-abc",
            "pid": 12345,
            "cached_at": "1700000000Z"
        });
        fs::write(
            cache_dir.join("session-abc.meta.json"),
            serde_json::to_string(&meta).unwrap(),
        )
        .unwrap();

        let result = extract_claude_reply_from(home.path(), Some("12345".into()));
        assert_eq!(result.unwrap(), "Claude session-keyed reply");
    }

    #[test]
    fn no_lookup_key_returns_error() {
        let home = setup_temp_home();
        let result = extract_claude_reply_from(home.path(), None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No Claude cache key"));
    }
}
