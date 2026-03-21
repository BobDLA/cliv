use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::cli::CliArgs;

// ─── Data Types ───────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionMeta {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TurnMeta {
    pub id: String,
    pub agent: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReplyMeta {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TargetMeta {
    pub mode: String,
    pub compose_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Metadata {
    pub version: String,
    pub session: SessionMeta,
    pub turn: TurnMeta,
    pub reply: ReplyMeta,
    pub target: TargetMeta,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LoadResult {
    pub target: Option<String>,
    pub reply: Option<String>,
    pub metadata: Option<Metadata>,
    pub target_path: Option<String>,
    pub review_path: Option<String>,
    pub reply_path: Option<String>,
    pub error: Option<String>,
}

// ─── Tauri Commands ───────────────────────────────────────

#[tauri::command]
pub fn get_cli_args(state: tauri::State<'_, CliArgs>) -> CliArgs {
    state.inner().clone()
}

#[tauri::command]
pub fn load_files(
    review_path: Option<String>,
    target_path: Option<String>,
    metadata_path: Option<String>,
) -> LoadResult {
    let mut result = LoadResult {
        target: None,
        reply: None,
        metadata: None,
        target_path: None,
        review_path: None,
        reply_path: None,
        error: None,
    };

    if let Some(ref tp) = target_path {
        let path = PathBuf::from(tp);
        match fs::read_to_string(&path) {
            Ok(content) => {
                result.target = Some(content);
                result.target_path = Some(tp.clone());
            }
            Err(e) => {
                eprintln!("[load_files] target read error: {}", e);
            }
        }
    }

    if let Some(ref rp) = review_path {
        let path = PathBuf::from(rp);
        if is_standalone_view_path(&path) {
            match fs::read_to_string(&path) {
                Ok(content) => {
                    result.reply = Some(content);
                    result.reply_path = Some(rp.clone());
                    result.review_path = Some(rp.clone());
                }
                Err(e) => {
                    result.error = Some(format!("File not found: {}", e));
                }
            }
        }
    }

    if let Some(ref mp) = metadata_path {
        let path = PathBuf::from(mp);
        match fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str::<Metadata>(&content) {
                Ok(meta) => {
                    let reply_path = PathBuf::from(&meta.reply.path);
                    match fs::read_to_string(&reply_path) {
                        Ok(reply_content) => {
                            result.reply = Some(reply_content);
                            result.reply_path = Some(meta.reply.path.clone());
                        }
                        Err(e) => {
                            eprintln!("[load_files] reply read error: {}", e);
                            result.error =
                                Some(format!("Reply file not found: {}", meta.reply.path));
                        }
                    }
                    result.metadata = Some(meta);
                }
                Err(e) => {
                    eprintln!("[load_files] metadata parse error: {}", e);
                    result.error = Some(format!("Metadata parse error: {}", e));
                }
            },
            Err(e) => {
                eprintln!("[load_files] metadata read error: {}", e);
            }
        }
    }

    result
}

fn is_standalone_view_path(path: &PathBuf) -> bool {
    path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| matches!(ext, "md" | "markdown" | "txt"))
        .unwrap_or(false)
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

/// Atomically write content (write to .tmp then rename).
#[tauri::command]
pub fn write_back(path: String, content: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    let tmp_path = crate::commands::sessions::tmp_path(&target);

    fs::write(&tmp_path, &content)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    if let Err(e) = fs::rename(&tmp_path, &target) {
        let _ = fs::remove_file(&tmp_path);
        return Err(format!("Failed to rename temp file: {}", e));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::load_files;

    #[test]
    fn standalone_markdown_file_is_loaded_as_reply() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("note.md");
        std::fs::write(&file, "# hello\n\nworld\n").unwrap();

        let result = load_files(Some(file.display().to_string()), None, None);

        assert_eq!(result.reply.as_deref(), Some("# hello\n\nworld\n"));
        assert_eq!(
            result.reply_path.as_deref(),
            Some(file.to_string_lossy().as_ref())
        );
        assert_eq!(
            result.review_path.as_deref(),
            Some(file.to_string_lossy().as_ref())
        );
        assert!(result.target.is_none());
        assert!(result.error.is_none());
    }

    #[test]
    fn metadata_mode_does_not_fallback_to_target_as_reply() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("compose.md");
        let metadata = dir.path().join("meta.json");
        std::fs::write(&target, "compose only").unwrap();
        std::fs::write(
            &metadata,
            r#"{
              "version":"1",
              "session":{"id":"s1","name":"s1"},
              "turn":{"id":"t1","agent":"codex","created_at":"now"},
              "reply":{"path":"/tmp/does-not-exist.md"},
              "target":{"mode":"compose","compose_path":"compose.md"}
            }"#,
        )
        .unwrap();

        let result = load_files(None, Some(target.display().to_string()), Some(metadata.display().to_string()));

        assert!(result.reply.is_none());
        assert_eq!(result.target.as_deref(), Some("compose only"));
        assert!(result.error.is_some());
    }

    #[test]
    fn explicit_target_and_review_paths_are_loaded_separately() {
        let dir = tempfile::tempdir().unwrap();
        let review = dir.path().join("review.md");
        let target = dir.path().join("target.md");
        std::fs::write(&review, "# review").unwrap();
        std::fs::write(&target, "draft target").unwrap();

        let result = load_files(
            Some(review.display().to_string()),
            Some(target.display().to_string()),
            None,
        );

        assert_eq!(result.reply.as_deref(), Some("# review"));
        assert_eq!(result.target.as_deref(), Some("draft target"));
        assert_eq!(
            result.review_path.as_deref(),
            Some(review.to_string_lossy().as_ref())
        );
        assert_eq!(
            result.target_path.as_deref(),
            Some(target.to_string_lossy().as_ref())
        );
    }
}
