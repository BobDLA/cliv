//! Anti-crosstalk integration tests.
//!
//! Verify that different agent sessions read only their own cached replies
//! and never silently fall back to another session's data.

use std::fs;
use tempfile::TempDir;

/// Helper: create a cache file under `{home}/reply_cache/{id}.md`.
fn write_cache(home: &std::path::Path, id: &str, content: &str) {
    let cache_dir = home.join("reply_cache");
    fs::create_dir_all(&cache_dir).unwrap();
    fs::write(cache_dir.join(format!("{}.md", id)), content).unwrap();
}

/// Helper: create a metadata file under `{home}/reply_cache/{id}.meta.json`.
fn write_cache_meta(
    home: &std::path::Path,
    id: &str,
    agent: &str,
    real_session_id: Option<&str>,
    cached_at: &str,
) {
    let cache_dir = home.join("reply_cache");
    fs::create_dir_all(&cache_dir).unwrap();
    let real_session = real_session_id
        .map(|value| format!("\"{}\"", value))
        .unwrap_or_else(|| "null".to_string());
    let json = format!(
        concat!(
            "{{\n",
            "  \"source\": \"pid\",\n",
            "  \"key\": \"{id}\",\n",
            "  \"agent\": \"{agent}\",\n",
            "  \"real_session_id\": {real_session},\n",
            "  \"pid\": {id},\n",
            "  \"cached_at\": \"{cached_at}\",\n",
            "  \"size_bytes\": 0\n",
            "}}\n"
        ),
        id = id,
        agent = agent,
        real_session = real_session,
        cached_at = cached_at,
    );
    fs::write(cache_dir.join(format!("{}.meta.json", id)), json).unwrap();
}

// ═══════════════════════════════════════════════════════════
// Claude
// ═══════════════════════════════════════════════════════════

#[test]
fn claude_session_isolation() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();

    write_cache(home, "session-aaa", "Reply from Claude session AAA");
    write_cache(home, "session-bbb", "Reply from Claude session BBB");

    let result_a =
        cliv_lib::extract::claude::extract_claude_reply_from(home, Some("session-aaa".to_string()));
    assert_eq!(result_a.unwrap(), "Reply from Claude session AAA");

    let result_b =
        cliv_lib::extract::claude::extract_claude_reply_from(home, Some("session-bbb".to_string()));
    assert_eq!(result_b.unwrap(), "Reply from Claude session BBB");

    // Session AAA must NOT read session BBB's data
    let result_a2 =
        cliv_lib::extract::claude::extract_claude_reply_from(home, Some("session-aaa".to_string()));
    assert!(
        !result_a2.unwrap().contains("BBB"),
        "Crosstalk detected: session-aaa returned session-bbb's reply"
    );
}

// ═══════════════════════════════════════════════════════════
// Gemini
// ═══════════════════════════════════════════════════════════

#[test]
fn gemini_session_isolation() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();

    write_cache(home, "pid-1000", "Reply from Gemini session 1000");
    write_cache(home, "pid-2000", "Reply from Gemini session 2000");

    let result_1 =
        cliv_lib::extract::gemini::extract_gemini_reply_from(home, Some("pid-1000".to_string()));
    assert_eq!(result_1.unwrap(), "Reply from Gemini session 1000");

    let result_2 =
        cliv_lib::extract::gemini::extract_gemini_reply_from(home, Some("pid-2000".to_string()));
    assert_eq!(result_2.unwrap(), "Reply from Gemini session 2000");

    // Cross-check: pid-1000 must not read pid-2000's data
    let result_1b =
        cliv_lib::extract::gemini::extract_gemini_reply_from(home, Some("pid-1000".to_string()));
    assert!(
        !result_1b.unwrap().contains("2000"),
        "Crosstalk detected: pid-1000 returned pid-2000's reply"
    );
}

// ═══════════════════════════════════════════════════════════
// Codex
// ═══════════════════════════════════════════════════════════

#[test]
fn codex_thread_isolation() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();

    write_cache(home, "1001", "Reply from Codex thread XXX");
    write_cache_meta(home, "1001", "codex", Some("thread-xxx"), "100Z");
    write_cache(home, "1002", "Reply from Codex thread YYY");
    write_cache_meta(home, "1002", "codex", Some("thread-yyy"), "200Z");

    let result_x =
        cliv_lib::extract::codex::extract_codex_reply_from(home, Some("thread-xxx".to_string()));
    assert_eq!(result_x.unwrap(), "Reply from Codex thread XXX");

    let result_y =
        cliv_lib::extract::codex::extract_codex_reply_from(home, Some("thread-yyy".to_string()));
    assert_eq!(result_y.unwrap(), "Reply from Codex thread YYY");
}

#[test]
fn codex_thread_lookup_prefers_newest_pid_meta() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();

    write_cache(home, "2001", "Older reply from Codex thread ZZZ");
    write_cache_meta(home, "2001", "codex", Some("thread-zzz"), "100Z");
    write_cache(home, "2002", "Newest reply from Codex thread ZZZ");
    write_cache_meta(home, "2002", "codex", Some("thread-zzz"), "200Z");

    let result =
        cliv_lib::extract::codex::extract_codex_reply_from(home, Some("thread-zzz".to_string()));
    assert_eq!(result.unwrap(), "Newest reply from Codex thread ZZZ");
}

// ═══════════════════════════════════════════════════════════
// Error cases
// ═══════════════════════════════════════════════════════════

#[test]
fn no_session_returns_error_not_random_data() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();

    // Plant some cache files — none should be returned without a session key.
    write_cache(home, "orphan-session", "This should never be returned");

    let claude_err = cliv_lib::extract::claude::extract_claude_reply_from(home, None);
    assert!(
        claude_err.is_err(),
        "Claude should error without session ID"
    );
    assert!(
        claude_err.unwrap_err().contains("No Claude session ID"),
        "Error message should be specific"
    );

    let gemini_result = cliv_lib::extract::gemini::extract_gemini_reply_from(home, None);
    assert!(
        gemini_result.is_err(),
        "Gemini should error without a cache key"
    );

    let codex_err = cliv_lib::extract::codex::extract_codex_reply_from(home, None);
    assert!(codex_err.is_err(), "Codex should error without thread ID");
}

#[test]
fn missing_cache_returns_error_with_path() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();

    // Don't write any cache files

    let err = cliv_lib::extract::claude::extract_claude_reply_from(
        home,
        Some("nonexistent-session".to_string()),
    );
    assert!(err.is_err());
    let msg = err.unwrap_err();
    assert!(
        msg.contains("nonexistent-session"),
        "Error should mention the session ID, got: {}",
        msg
    );
    assert!(
        msg.contains("reply_cache"),
        "Error should mention the expected path, got: {}",
        msg
    );

    let err =
        cliv_lib::extract::gemini::extract_gemini_reply_from(home, Some("ghost-pid".to_string()));
    assert!(err.is_err());
    let msg = err.unwrap_err();
    assert!(msg.contains("ghost-pid"));

    let err = cliv_lib::extract::codex::extract_codex_reply_from(
        home,
        Some("phantom-thread".to_string()),
    );
    assert!(err.is_err());
    let msg = err.unwrap_err();
    assert!(msg.contains("phantom-thread"));
    assert!(msg.contains("metadata match"));
}

#[test]
fn gemini_requested_key_miss_does_not_return_other_session_cache() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();

    write_cache(home, "other-session", "This should not leak");

    let err =
        cliv_lib::extract::gemini::extract_gemini_reply_from(home, Some("missing-key".to_string()));
    assert!(err.is_err(), "Gemini should not fall back to another cache file");
    assert!(err.unwrap_err().contains("missing-key"));
}
