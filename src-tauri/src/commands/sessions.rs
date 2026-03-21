use serde::Serialize;
use std::fs;
use std::path::PathBuf;

// ─── Session Persistence ──────────────────────────────────

fn get_data_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".cliv")
}

/// Generate a unique temporary file path for atomic writes.
pub fn tmp_path(target: &PathBuf) -> PathBuf {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    target.with_extension(format!("tmp.{}", timestamp))
}

/// Helper: atomic write (write to .tmp then rename).
fn atomic_write(path: &PathBuf, data: &str) -> Result<(), String> {
    let tmp = tmp_path(path);

    fs::write(&tmp, data).map_err(|e| format!("Failed to write: {}", e))?;

    if let Err(e) = fs::rename(&tmp, path) {
        let _ = fs::remove_file(&tmp);
        return Err(format!("Failed to save: {}", e));
    }

    Ok(())
}

#[tauri::command]
pub fn save_session(session_id: String, turn_id: String, data: String) -> Result<(), String> {
    let dir = get_data_dir()
        .join("sessions")
        .join(&session_id)
        .join("turns")
        .join(&turn_id);

    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create session dir: {}", e))?;

    let path = dir.join("annotations.json");
    atomic_write(&path, &data)
}

#[tauri::command]
pub fn save_return_record(session_id: String, turn_id: String, data: String) -> Result<(), String> {
    let dir = get_data_dir()
        .join("sessions")
        .join(&session_id)
        .join("turns")
        .join(&turn_id);

    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create session dir: {}", e))?;

    let path = dir.join("returns.json");
    atomic_write(&path, &data)
}

#[tauri::command]
pub fn load_session_data(session_id: String, turn_id: String) -> Result<String, String> {
    let path = get_data_dir()
        .join("sessions")
        .join(&session_id)
        .join("turns")
        .join(&turn_id)
        .join("annotations.json");

    fs::read_to_string(&path).map_err(|e| format!("Failed to read session data: {}", e))
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionListItem {
    pub id: String,
    pub modified_at: String,
    pub turn_count: usize,
}

#[tauri::command]
pub fn list_sessions() -> Vec<SessionListItem> {
    let sessions_dir = get_data_dir().join("sessions");
    let mut items = Vec::new();

    if let Ok(entries) = fs::read_dir(&sessions_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let id = entry.file_name().to_string_lossy().to_string();
                let turns_dir = entry.path().join("turns");
                let turn_count = fs::read_dir(&turns_dir).map(|e| e.count()).unwrap_or(0);
                let modified_at = entry
                    .metadata()
                    .and_then(|m| m.modified())
                    .map(|t| {
                        let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                        format!("{}", duration.as_secs())
                    })
                    .unwrap_or_default();

                items.push(SessionListItem {
                    id,
                    modified_at,
                    turn_count,
                });
            }
        }
    }

    items.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    items
}
