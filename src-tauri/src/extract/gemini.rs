use super::{common, read_cached_reply, resolve_cache_path_from_meta};
use crate::logging;
use std::path::Path;

/// Read the cached Gemini CLI reply for a given lookup key.
/// The cache is populated by `cliv cache-gemini` (called from Gemini AfterAgent hook).
/// Returns an explicit error if no lookup key is available or cache file cannot be resolved.
#[tauri::command]
pub fn extract_gemini_reply(session_id: Option<String>) -> Result<String, String> {
    logging::timing("extract_gemini_reply: start");

    let gemini_home = common::default_agent_home(".gemini");
    let (resolved_session_id, source) =
        common::resolve_lookup_key("extract gemini", session_id, "GEMINI_SESSION_ID", "env_var");

    logging::log(&format!(
        "  extract gemini: resolved_key={:?} source={}",
        resolved_session_id, source
    ));

    let result = extract_gemini_reply_from(&gemini_home, resolved_session_id);
    logging::timing("extract_gemini_reply: done");
    result
}

/// Testable inner function: reads Gemini reply cache from a given home directory.
///
/// Lookup chain:
/// 1. Direct key hit — try `{lookup_key}.md`
/// 2. Metadata alias hit — resolve lookup_key via metadata
pub fn extract_gemini_reply_from(
    gemini_home: &Path,
    lookup_key: Option<String>,
) -> Result<String, String> {
    let lookup_key = match lookup_key {
        Some(key) => key,
        None => {
            return Err(format!(
                "Gemini reply cache key not found. lookup_key={:?}, cache_dir={}",
                lookup_key,
                gemini_home.join("reply_cache").display()
            ))
        }
    };

    let cache_path = gemini_home
        .join("reply_cache")
        .join(format!("{}.md", lookup_key));
    if let Some(reply) = read_cached_reply("gemini", &cache_path) {
        return reply;
    }

    if let Some(cache_path) = resolve_cache_path_from_meta("gemini", gemini_home, &lookup_key) {
        logging::log(&format!(
            "  extract gemini: metadata matched key='{}' → {}",
            lookup_key,
            cache_path.display()
        ));
        if let Some(reply) = read_cached_reply("gemini", &cache_path) {
            return reply;
        }
    }

    Err(format!(
        "Gemini reply cache not found. lookup_key='{}', cache_dir={}",
        lookup_key,
        gemini_home.join("reply_cache").display()
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
    fn pid_cache_hit() {
        let home = setup_temp_home();
        let cache_path = home.path().join("reply_cache").join("12345.md");
        fs::write(&cache_path, "Hello from Gemini").unwrap();

        let result = extract_gemini_reply_from(home.path(), Some("12345".into()));
        assert_eq!(result.unwrap(), "Hello from Gemini");
    }

    #[test]
    fn session_id_cache_hit() {
        let home = setup_temp_home();
        let cache_path = home.path().join("reply_cache").join("session-abc.md");
        fs::write(&cache_path, "Session reply").unwrap();

        let result = extract_gemini_reply_from(home.path(), Some("session-abc".into()));
        assert_eq!(result.unwrap(), "Session reply");
    }

    #[test]
    fn no_cache_returns_error() {
        let home = setup_temp_home();
        let result = extract_gemini_reply_from(home.path(), None);
        assert!(result.is_err());
    }

    #[test]
    fn no_key_does_not_fall_back_to_unrelated_cache() {
        let home = setup_temp_home();
        let cache_path = home.path().join("reply_cache").join("other-session.md");
        fs::write(&cache_path, "Other session reply").unwrap();

        let result = extract_gemini_reply_from(home.path(), None);
        let err = result.expect_err("expected missing Gemini key to fail");
        assert!(err.contains("key not found"));
    }

    #[test]
    fn no_cache_with_session_id_returns_error() {
        let home = setup_temp_home();
        let result = extract_gemini_reply_from(home.path(), Some("nonexistent".into()));
        assert!(result.is_err());
    }

    #[test]
    fn requested_session_miss_does_not_fall_back_to_newest_file() {
        let home = setup_temp_home();
        let cache_path = home.path().join("reply_cache").join("other-session.md");
        fs::write(&cache_path, "Other session reply").unwrap();

        let result = extract_gemini_reply_from(home.path(), Some("missing-session".into()));
        let err = result.expect_err("expected a cache miss for the requested session");

        assert!(err.contains("missing-session"));
    }

    #[test]
    fn metadata_match_hit_from_session_id_to_pid_keyed_file() {
        let home = setup_temp_home();
        let cache_dir = home.path().join("reply_cache");
        fs::write(cache_dir.join("12345.md"), "Gemini pid-keyed reply").unwrap();
        let meta = serde_json::json!({
            "agent": "gemini",
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

        let result = extract_gemini_reply_from(home.path(), Some("session-abc".into()));
        assert_eq!(result.unwrap(), "Gemini pid-keyed reply");
    }

    #[test]
    fn metadata_match_hit_from_pid_to_session_keyed_file() {
        let home = setup_temp_home();
        let cache_dir = home.path().join("reply_cache");
        fs::write(
            cache_dir.join("session-abc.md"),
            "Gemini session-keyed reply",
        )
        .unwrap();
        let meta = serde_json::json!({
            "agent": "gemini",
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

        let result = extract_gemini_reply_from(home.path(), Some("12345".into()));
        assert_eq!(result.unwrap(), "Gemini session-keyed reply");
    }
}
