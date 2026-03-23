use serde::{de::DeserializeOwned, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

fn tmp_path(target: &Path) -> PathBuf {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    target.with_extension(format!("tmp.{}", timestamp))
}

pub(super) fn atomic_write(path: &Path, data: &str) -> Result<(), String> {
    let tmp = tmp_path(path);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create history dir: {}", e))?;
    }

    fs::write(&tmp, data).map_err(|e| format!("Failed to write: {}", e))?;

    if let Err(e) = fs::rename(&tmp, path) {
        let _ = fs::remove_file(&tmp);
        return Err(format!("Failed to save: {}", e));
    }

    Ok(())
}

pub(super) fn write_json<T: Serialize>(
    path: &Path,
    value: &T,
    label: &str,
) -> Result<(), String> {
    let encoded = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Failed to encode {}: {}", label, e))?;
    atomic_write(path, &encoded)
}

pub(super) fn read_json<T: DeserializeOwned>(path: &Path, label: &str) -> Result<T, String> {
    serde_json::from_str(
        &fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {}", label, e))?,
    )
    .map_err(|e| format!("Failed to parse {}: {}", label, e))
}

pub(super) fn read_optional_json<T: DeserializeOwned>(
    path: &Path,
    label: &str,
) -> Result<Option<T>, String> {
    if !path.exists() {
        return Ok(None);
    }

    read_json(path, label).map(Some)
}

pub(super) fn read_string(path: &Path, label: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {}", label, e))
}

pub(super) fn is_ascii_digit_dir(path: &Path) -> bool {
    path.is_dir()
        && path
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.chars().all(|ch| ch.is_ascii_digit()))
            .unwrap_or(false)
}
