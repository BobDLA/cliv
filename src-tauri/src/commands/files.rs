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
    pub compose: Option<String>,
    pub reply: Option<String>,
    pub metadata: Option<Metadata>,
    pub compose_path: Option<String>,
    pub reply_path: Option<String>,
    pub error: Option<String>,
}

// ─── Tauri Commands ───────────────────────────────────────

#[tauri::command]
pub fn get_cli_args(state: tauri::State<'_, CliArgs>) -> CliArgs {
    state.inner().clone()
}

#[tauri::command]
pub fn load_files(compose_path: Option<String>, metadata_path: Option<String>) -> LoadResult {
    let mut result = LoadResult {
        compose: None,
        reply: None,
        metadata: None,
        compose_path: None,
        reply_path: None,
        error: None,
    };

    if let Some(ref cp) = compose_path {
        let path = PathBuf::from(cp);
        match fs::read_to_string(&path) {
            Ok(content) => {
                result.compose = Some(content);
                result.compose_path = Some(cp.clone());
            }
            Err(e) => {
                eprintln!("[load_files] compose read error: {}", e);
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

    // Fallback: treat compose as reply for standalone viewing
    if result.reply.is_none() && result.compose.is_none() {
        if let Some(ref cp) = compose_path {
            let path = PathBuf::from(cp);
            if path.extension().map_or(false, |ext| ext == "md") {
                match fs::read_to_string(&path) {
                    Ok(content) => {
                        result.reply = Some(content);
                        result.reply_path = Some(cp.clone());
                    }
                    Err(e) => {
                        result.error = Some(format!("File not found: {}", e));
                    }
                }
            }
        }
    }

    result
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
