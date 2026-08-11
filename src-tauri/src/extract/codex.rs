use super::common;
use super::{is_pid_like, read_cached_reply, resolve_cache_path_from_meta};
use crate::logging;
use std::path::Path;

/// Read the cached Codex reply for a given cache key or thread-id.
/// The cache is populated by `cliv cache-codex` from Codex notify or Stop hooks.
/// Returns an explicit error if no lookup key is available or cache is missing.
#[tauri::command]
pub fn extract_codex_reply(
    thread_id: Option<String>,
    _cwd: Option<String>,
) -> Result<String, String> {
    logging::timing("extract_codex_reply: start");

    let codex_home = common::env_or_default_agent_home("CODEX_HOME", ".codex");
    let (resolved_thread_id, source) =
        common::resolve_lookup_key("extract codex", thread_id, "CODEX_THREAD_ID", "env");

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
        if let Some(reply) = read_cached_reply("codex", &cache_path) {
            return reply;
        }
    }

    // Strategy 2: Resolve a pid-keyed cache file by metadata, typically from a thread-id.
    if let Some(cache_path) = resolve_cache_path_from_meta("codex", codex_home, &lookup_key) {
        logging::log(&format!(
            "  extract codex: metadata matched key='{}' → {}",
            lookup_key,
            cache_path.display()
        ));
        if let Some(reply) = read_cached_reply("codex", &cache_path) {
            return reply;
        }
    }

    // Strategy 3: Legacy direct cache hit for older thread-id keyed files.
    let legacy_cache_path = codex_home
        .join("reply_cache")
        .join(format!("{}.md", lookup_key));
    if let Some(reply) = read_cached_reply("codex", &legacy_cache_path) {
        return reply;
    }

    Err(format!(
        "Codex reply not found for key '{}'. Neither cache file nor metadata match found.",
        lookup_key
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
    fn no_lookup_key_returns_error() {
        let home = setup_temp_home();
        let result = extract_codex_reply_from(home.path(), None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No Codex cache key found"));
    }

    #[test]
    fn pid_cache_hit() {
        let home = setup_temp_home();
        let cache_path = home.path().join("reply_cache").join("12345.md");
        fs::write(&cache_path, "Hello from Codex").unwrap();

        let result = extract_codex_reply_from(home.path(), Some("12345".into()));
        assert_eq!(result.unwrap(), "Hello from Codex");
    }

    #[test]
    fn meta_match_hit() {
        let home = setup_temp_home();
        let cache_dir = home.path().join("reply_cache");

        // Write the .md file keyed by PID
        fs::write(cache_dir.join("99999.md"), "Meta matched reply").unwrap();

        // Write the .meta.json that links thread-id → PID file
        let meta = serde_json::json!({
            "agent": "codex",
            "key": "99999",
            "real_session_id": "thread_abc123",
            "cached_at": "1700000000Z"
        });
        fs::write(
            cache_dir.join("99999.meta.json"),
            serde_json::to_string(&meta).unwrap(),
        )
        .unwrap();

        // Look up by thread-id — should resolve via metadata
        let result = extract_codex_reply_from(home.path(), Some("thread_abc123".into()));
        assert_eq!(result.unwrap(), "Meta matched reply");
    }

    #[test]
    fn legacy_cache_hit() {
        let home = setup_temp_home();
        let cache_path = home.path().join("reply_cache").join("thread-old-style.md");
        fs::write(&cache_path, "Legacy reply").unwrap();

        let result = extract_codex_reply_from(home.path(), Some("thread-old-style".into()));
        assert_eq!(result.unwrap(), "Legacy reply");
    }

    #[test]
    fn no_cache_file_returns_error() {
        let home = setup_temp_home();
        let result = extract_codex_reply_from(home.path(), Some("nonexistent-key".into()));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found for key"));
    }

    #[test]
    fn requested_pid_miss_does_not_return_other_pid_cache() {
        let home = setup_temp_home();
        let cache_path = home.path().join("reply_cache").join("12345.md");
        fs::write(&cache_path, "Other pid reply").unwrap();

        let result = extract_codex_reply_from(home.path(), Some("99999".into()));
        let err = result.expect_err("expected missing pid lookup to fail");
        assert!(err.contains("99999"));
    }
}
