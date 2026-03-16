use std::fs;
use std::path::Path;
use std::path::PathBuf;

/// Read the cached Claude Code reply for a given session-id.
/// The cache is populated by `cliv cache-claude` (called from Claude Stop hook).
/// Returns an explicit error if no session ID is available or cache file is missing.
#[tauri::command]
pub fn extract_claude_reply(session_id: Option<String>) -> Result<String, String> {
    let claude_home = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".claude");

    let resolved_session_id = session_id
        .or_else(|| std::env::var("CLAUDE_SESSION_ID").ok().filter(|s| !s.is_empty()));

    extract_claude_reply_from(&claude_home, resolved_session_id)
}

/// Testable inner function: reads Claude reply cache from a given home directory.
pub fn extract_claude_reply_from(
    claude_home: &Path,
    session_id: Option<String>,
) -> Result<String, String> {
    let session_id = match session_id {
        Some(sid) => sid,
        None => return Err(
            "No Claude session ID found. Set CLAUDE_SESSION_ID or ensure the Stop hook provides it.".to_string()
        ),
    };

    let cache_path = claude_home.join("reply_cache").join(format!("{}.md", session_id));
    if cache_path.exists() {
        return fs::read_to_string(&cache_path)
            .map_err(|e| format!("Failed to read Claude reply cache: {}", e));
    }

    Err(format!(
        "Claude reply cache not found for session '{}'. Cache file expected at: {}",
        session_id,
        cache_path.display()
    ))
}
