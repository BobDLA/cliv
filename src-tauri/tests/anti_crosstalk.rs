//! Anti-crosstalk integration tests.
//!
//! Verify that different agent sessions read only their own cached replies
//! and never silently fall back to another session's data.

use std::fs;
use std::process::{Command, Stdio};
use tempfile::TempDir;

/// Helper: create a cache file under `{home}/reply_cache/{id}.md`.
fn write_cache(home: &std::path::Path, id: &str, content: &str) {
    let cache_dir = home.join("reply_cache");
    fs::create_dir_all(&cache_dir).unwrap();
    fs::write(cache_dir.join(format!("{}.md", id)), content).unwrap();
}

/// Helper: create a metadata file under `{home}/reply_cache/{id}.meta.json`.
fn write_cache_meta_with_pid(
    home: &std::path::Path,
    id: &str,
    agent: &str,
    real_session_id: Option<&str>,
    pid: Option<u32>,
    cached_at: &str,
) {
    let cache_dir = home.join("reply_cache");
    fs::create_dir_all(&cache_dir).unwrap();
    let real_session = real_session_id
        .map(|value| format!("\"{}\"", value))
        .unwrap_or_else(|| "null".to_string());
    let pid_json = pid
        .map(|value| value.to_string())
        .unwrap_or_else(|| "null".to_string());
    let source = if pid.is_some() { "pid" } else { "real_id" };
    let json = format!(
        concat!(
            "{{\n",
            "  \"source\": \"{source}\",\n",
            "  \"key\": \"{id}\",\n",
            "  \"agent\": \"{agent}\",\n",
            "  \"real_session_id\": {real_session},\n",
            "  \"pid\": {pid},\n",
            "  \"cached_at\": \"{cached_at}\",\n",
            "  \"size_bytes\": 0\n",
            "}}\n"
        ),
        source = source,
        id = id,
        agent = agent,
        real_session = real_session,
        pid = pid_json,
        cached_at = cached_at,
    );
    fs::write(cache_dir.join(format!("{}.meta.json", id)), json).unwrap();
}

fn write_cache_meta(
    home: &std::path::Path,
    id: &str,
    agent: &str,
    real_session_id: Option<&str>,
    cached_at: &str,
) {
    write_cache_meta_with_pid(
        home,
        id,
        agent,
        real_session_id,
        id.parse::<u32>().ok(),
        cached_at,
    );
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

#[test]
fn codex_thread_lookup_is_stable_when_cached_at_ties() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();

    write_cache(home, "2001", "Tie reply A");
    write_cache_meta(home, "2001", "codex", Some("thread-tie"), "100Z");
    write_cache(home, "2002", "Tie reply B");
    write_cache_meta(home, "2002", "codex", Some("thread-tie"), "100Z");

    let result =
        cliv_lib::extract::codex::extract_codex_reply_from(home, Some("thread-tie".to_string()));
    assert_eq!(result.unwrap(), "Tie reply B");
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
        claude_err.unwrap_err().contains("No Claude cache key"),
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
    assert!(
        err.is_err(),
        "Gemini should not fall back to another cache file"
    );
    assert!(err.unwrap_err().contains("missing-key"));
}

#[test]
fn claude_session_id_can_resolve_pid_keyed_cache_via_metadata() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();

    write_cache(home, "3001", "Reply from Claude pid-keyed cache");
    write_cache_meta(home, "3001", "claude", Some("claude-session-1"), "300Z");

    let result = cliv_lib::extract::claude::extract_claude_reply_from(
        home,
        Some("claude-session-1".to_string()),
    );
    assert_eq!(result.unwrap(), "Reply from Claude pid-keyed cache");
}

#[test]
fn gemini_session_id_can_resolve_pid_keyed_cache_via_metadata() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();

    write_cache(home, "4001", "Reply from Gemini pid-keyed cache");
    write_cache_meta(home, "4001", "gemini", Some("gemini-session-1"), "400Z");

    let result = cliv_lib::extract::gemini::extract_gemini_reply_from(
        home,
        Some("gemini-session-1".to_string()),
    );
    assert_eq!(result.unwrap(), "Reply from Gemini pid-keyed cache");
}

#[test]
fn mixed_agent_same_lookup_key_does_not_cross_talk() {
    let claude_tmp = TempDir::new().unwrap();
    let gemini_tmp = TempDir::new().unwrap();
    let codex_tmp = TempDir::new().unwrap();

    write_cache(claude_tmp.path(), "shared-key", "Claude shared-key reply");
    write_cache(gemini_tmp.path(), "shared-key", "Gemini shared-key reply");
    write_cache(codex_tmp.path(), "5001", "Codex shared-key reply");
    write_cache_meta(
        codex_tmp.path(),
        "5001",
        "codex",
        Some("shared-key"),
        "500Z",
    );

    let claude = cliv_lib::extract::claude::extract_claude_reply_from(
        claude_tmp.path(),
        Some("shared-key".to_string()),
    )
    .unwrap();
    let gemini = cliv_lib::extract::gemini::extract_gemini_reply_from(
        gemini_tmp.path(),
        Some("shared-key".to_string()),
    )
    .unwrap();
    let codex = cliv_lib::extract::codex::extract_codex_reply_from(
        codex_tmp.path(),
        Some("shared-key".to_string()),
    )
    .unwrap();

    assert_eq!(claude, "Claude shared-key reply");
    assert_eq!(gemini, "Gemini shared-key reply");
    assert_eq!(codex, "Codex shared-key reply");
}

#[test]
fn numeric_real_session_id_does_not_alias_to_unrelated_pid_cache() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();

    write_cache(home, "2001", "Reply for numeric real session id 7777");
    write_cache_meta_with_pid(home, "2001", "codex", Some("7777"), Some(2001), "700Z");

    write_cache(home, "2002", "Reply for unrelated pid 7777");
    write_cache_meta_with_pid(
        home,
        "2002",
        "codex",
        Some("thread-other"),
        Some(7777),
        "800Z",
    );

    let result = cliv_lib::extract::codex::extract_codex_reply_from(home, Some("7777".to_string()));
    assert_eq!(result.unwrap(), "Reply for numeric real session id 7777");
}

#[cfg(target_os = "linux")]
#[test]
fn cache_gemini_pid_hook_writes_pid_keyed_cache() {
    let tmp = TempDir::new().unwrap();
    let fake_home = tmp.path().join("home");
    let wrapper_path = tmp.path().join("gemini");
    let payload = serde_json::json!({
        "prompt_response": "# Gemini Hook Fixture\n\nFrom real cache-gemini integration test.\n"
    })
    .to_string();
    let script = format!(
        "#!/usr/bin/env bash\nset -euo pipefail\nexport HOME={home}\nprintf '%s' '{payload}' | \"{cliv}\" cache-gemini\n",
        home = fake_home.display(),
        payload = payload,
        cliv = env!("CARGO_BIN_EXE_cliv"),
    );

    fs::create_dir_all(&fake_home).unwrap();
    fs::write(&wrapper_path, script).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&wrapper_path).unwrap().permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&wrapper_path, perms).unwrap();
    }

    let status = Command::new(&wrapper_path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .unwrap();
    assert!(status.success());

    let cache_dir = fake_home.join(".gemini").join("reply_cache");
    let entries = fs::read_dir(&cache_dir)
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    assert_eq!(entries.len(), 2, "expected md + meta artifacts");

    let md_path = entries
        .iter()
        .map(|entry| entry.path())
        .find(|path| path.extension().and_then(|ext| ext.to_str()) == Some("md"))
        .expect("expected pid-keyed markdown cache file");
    let meta_path = md_path.with_extension("meta.json");

    let md_content = fs::read_to_string(&md_path).unwrap();
    assert!(md_content.contains("Gemini Hook Fixture"));

    let meta_content = fs::read_to_string(&meta_path).unwrap();
    assert!(meta_content.contains("\"agent\": \"gemini\""));
    assert!(meta_content.contains("\"source\": \"pid\""));
    assert!(meta_content.contains("\"real_session_id\": null"));

    let file_stem = md_path.file_stem().unwrap().to_string_lossy().to_string();
    assert!(meta_content.contains(&format!("\"key\": \"{}\"", file_stem)));
    assert!(meta_content.contains(&format!("\"pid\": {}", file_stem)));

    let extracted = cliv_lib::extract::gemini::extract_gemini_reply_from(
        &fake_home.join(".gemini"),
        Some(file_stem),
    );
    assert_eq!(extracted.unwrap(), md_content);
}

#[cfg(target_os = "linux")]
#[test]
fn cache_claude_prefers_outermost_matching_ancestor_pid() {
    let tmp = TempDir::new().unwrap();
    let fake_home = tmp.path().join("home");
    let outer_wrapper_path = tmp.path().join("claude-outer");
    let inner_wrapper_path = tmp.path().join("claude-inner");
    let outer_script_path = tmp.path().join("outer.sh");
    let inner_script_path = tmp.path().join("inner.sh");
    let outer_pid_path = tmp.path().join("claude-outer.pid");
    let inner_pid_path = tmp.path().join("claude-inner.pid");
    let payload = serde_json::json!({
        "hook_event_name": "Stop",
        "session_id": "fixture-session",
        "last_assistant_message": "# Claude Hook Fixture\n\nFrom outermost PID regression test.\n"
    })
    .to_string();
    let inner_script = format!(
        "#!/usr/bin/env bash\nset -euo pipefail\necho $$ > \"{inner_pid}\"\nprintf '%s' '{payload}' | \"{cliv}\" cache-claude\n",
        inner_pid = inner_pid_path.display(),
        payload = payload,
        cliv = env!("CARGO_BIN_EXE_cliv"),
    );
    let outer_script = format!(
        "#!/usr/bin/env bash\nset -euo pipefail\necho $$ > \"{outer_pid}\"\n\"{inner}\" \"{inner_script}\"\n",
        outer_pid = outer_pid_path.display(),
        inner = inner_wrapper_path.display(),
        inner_script = inner_script_path.display(),
    );

    fs::create_dir_all(&fake_home).unwrap();
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink("/bin/bash", &inner_wrapper_path).unwrap();
        std::os::unix::fs::symlink("/bin/bash", &outer_wrapper_path).unwrap();
    }
    fs::write(&inner_script_path, inner_script).unwrap();
    fs::write(&outer_script_path, outer_script).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        for path in [&inner_script_path, &outer_script_path] {
            let mut perms = fs::metadata(path).unwrap().permissions();
            perms.set_mode(0o755);
            fs::set_permissions(path, perms).unwrap();
        }
    }

    let status = Command::new(&outer_wrapper_path)
        .arg(&outer_script_path)
        .env("HOME", &fake_home)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .unwrap();
    assert!(status.success());

    let outer_pid = fs::read_to_string(&outer_pid_path)
        .unwrap()
        .trim()
        .to_string();
    let inner_pid = fs::read_to_string(&inner_pid_path)
        .unwrap()
        .trim()
        .to_string();
    assert_ne!(
        outer_pid, inner_pid,
        "test setup requires distinct helper PIDs"
    );

    let cache_dir = fake_home.join(".claude").join("reply_cache");
    let outer_pid_path = cache_dir.join(format!("{}.md", outer_pid));
    let inner_pid_path = cache_dir.join(format!("{}.md", inner_pid));
    let session_path = cache_dir.join("fixture-session.md");

    assert!(
        session_path.exists(),
        "session-keyed cache file should always exist"
    );
    assert!(
        outer_pid_path.exists(),
        "expected outermost helper PID cache file"
    );
    assert!(
        !inner_pid_path.exists(),
        "should not key Claude cache by the nearest helper PID"
    );

    let meta_content =
        fs::read_to_string(cache_dir.join(format!("{}.meta.json", outer_pid))).unwrap();
    assert!(meta_content.contains("\"agent\": \"claude\""));
    assert!(meta_content.contains("\"real_session_id\": \"fixture-session\""));
    assert!(meta_content.contains(&format!("\"pid\": {}", outer_pid)));
}
