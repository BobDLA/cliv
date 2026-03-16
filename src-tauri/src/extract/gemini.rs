use std::fs;
use std::path::Path;
use std::path::PathBuf;

/// Read the cached Gemini CLI reply for a given session-id.
/// The cache is populated by `cliv cache-gemini` (called from Gemini AfterAgent hook).
/// Returns an explicit error if no session ID is available or cache file is missing.
#[tauri::command]
pub fn extract_gemini_reply(session_id: Option<String>) -> Result<String, String> {
    let gemini_home = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".gemini");

    let resolved_session_id = session_id
        .or_else(|| std::env::var("GEMINI_SESSION_ID").ok().filter(|s| !s.is_empty()));

    extract_gemini_reply_from(&gemini_home, resolved_session_id)
}

/// Testable inner function: reads Gemini reply cache from a given home directory.
pub fn extract_gemini_reply_from(
    gemini_home: &Path,
    session_id: Option<String>,
) -> Result<String, String> {
    let session_id = match session_id {
        Some(sid) => sid,
        None => return Err(
            "No Gemini session ID found. Set GEMINI_SESSION_ID or ensure the AfterAgent hook provides it.".to_string()
        ),
    };

    let cache_path = gemini_home.join("reply_cache").join(format!("{}.md", session_id));
    if cache_path.exists() {
        return fs::read_to_string(&cache_path)
            .map_err(|e| format!("Failed to read Gemini reply cache: {}", e));
    }

    Err(format!(
        "Gemini reply cache not found for session '{}'. Cache file expected at: {}",
        session_id,
        cache_path.display()
    ))
}
