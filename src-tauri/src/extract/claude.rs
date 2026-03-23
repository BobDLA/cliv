use super::common;
use crate::logging;
use std::path::Path;

/// Read the cached Claude Code reply for a given session-id.
/// The cache is populated by `cliv cache-claude` (called from Claude Stop hook).
/// Returns an explicit error if no session ID is available or cache file is missing.
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
    session_id: Option<String>,
) -> Result<String, String> {
    let session_id = match session_id {
        Some(sid) => sid,
        None => return Err(
            "No Claude session ID found. Set CLAUDE_SESSION_ID or ensure the Stop hook provides it.".to_string()
        ),
    };

    let cache_path = claude_home
        .join("reply_cache")
        .join(format!("{}.md", session_id));
    if let Some(reply) = common::read_cached_reply(
        "extract claude",
        &cache_path,
        "Failed to read Claude reply cache",
    ) {
        return reply;
    }

    Err(format!(
        "Claude reply cache not found for session '{}'. Cache file expected at: {}",
        session_id,
        cache_path.display()
    ))
}
