use super::common;
use crate::logging;
use std::path::Path;

/// Read the cached Gemini CLI reply for a given session-id.
/// The cache is populated by `cliv cache-gemini` (called from Gemini AfterAgent hook).
/// Returns an explicit error if no session ID is available or cache file is missing.
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
/// 1. PID cache hit — if session_id looks like a numeric PID, try `{pid}.md`
/// 2. Session-id direct hit — try `{session_id}.md`
pub fn extract_gemini_reply_from(
    gemini_home: &Path,
    session_id: Option<String>,
) -> Result<String, String> {
    let cache_dir = gemini_home.join("reply_cache");

    // Strategy 1: PID cache hit (numeric key → {pid}.md)
    if let Some(ref key) = session_id {
        if is_pid_like(key) {
            let cache_path = cache_dir.join(format!("{}.md", key));
            if let Some(reply) = common::read_cached_reply(
                "extract gemini",
                &cache_path,
                "Failed to read Gemini reply cache",
            ) {
                return reply;
            }
        }
    }

    // Strategy 2: Session-id direct hit ({session_id}.md)
    if let Some(ref key) = session_id {
        let cache_path = cache_dir.join(format!("{}.md", key));
        if let Some(reply) = common::read_cached_reply(
            "extract gemini",
            &cache_path,
            "Failed to read Gemini reply cache",
        ) {
            return reply;
        }
    }

    if session_id.is_none() {
        return Err(format!(
            "Gemini reply cache key not found. session_id={:?}, cache_dir={}",
            session_id,
            cache_dir.display()
        ));
    }

    Err(format!(
        "Gemini reply cache not found. session_id={:?}, cache_dir={}",
        session_id,
        cache_dir.display()
    ))
}

fn is_pid_like(value: &str) -> bool {
    !value.is_empty() && value.chars().all(|ch| ch.is_ascii_digit())
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
}
