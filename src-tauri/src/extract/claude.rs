use crate::logging;
use std::fs;
use std::path::Path;
use std::path::PathBuf;

/// Read the cached Claude Code reply for a given session-id.
/// The cache is populated by `cliv cache-claude` (called from Claude Stop hook).
/// Returns an explicit error if no session ID is available or cache file is missing.
#[tauri::command]
pub fn extract_claude_reply(session_id: Option<String>) -> Result<String, String> {
    logging::timing("extract_claude_reply: start");

    let claude_home = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".claude");

    let param_source = if session_id.is_some() { "parameter" } else { "none" };

    let resolved_session_id = session_id
        .or_else(|| {
            let env_val = std::env::var("CLAUDE_SESSION_ID").ok().filter(|s| !s.is_empty());
            if env_val.is_some() {
                logging::log("  extract claude: resolved key from CLAUDE_SESSION_ID env var");
            }
            env_val
        });

    let source = if param_source == "parameter" { "parameter" }
        else if resolved_session_id.is_some() { "env_var" }
        else { "none" };

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

    let cache_path = claude_home.join("reply_cache").join(format!("{}.md", session_id));
    logging::log(&format!("  extract claude: trying cache path={}", cache_path.display()));
    if cache_path.exists() {
        logging::log(&format!(
            "  extract claude: HIT cache file={} size={}",
            cache_path.display(),
            fs::metadata(&cache_path).map(|m| m.len()).unwrap_or(0)
        ));
        return fs::read_to_string(&cache_path)
            .map_err(|e| format!("Failed to read Claude reply cache: {}", e));
    }

    Err(format!(
        "Claude reply cache not found for session '{}'. Cache file expected at: {}",
        session_id,
        cache_path.display()
    ))
}
