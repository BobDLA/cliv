use super::toml_store::{
    config_status_from_root, load_root_for_save, merge_prompt_config, merge_ui_config,
};
use super::{config_save_lock, AppConfig, SaveAppConfigInput};
use crate::logging;
use std::fs;
use std::path::{Path, PathBuf};
use toml::Value;

pub fn config_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".cliv")
        .join("config.toml")
}

pub fn load() -> AppConfig {
    load_from_path(&config_path())
}

pub fn load_from_path(path: &Path) -> AppConfig {
    match fs::read_to_string(path) {
        Ok(content) => match content.parse::<Value>() {
            Ok(root) => {
                logging::log(&format!("  config: loaded {}", path.display()));
                AppConfig::from_value(&root, config_status_from_root(path, true, &root))
            }
            Err(err) => {
                logging::log(&format!(
                    "  config: failed to parse {}: {}. Using defaults.",
                    path.display(),
                    err
                ));
                AppConfig::with_status(super::ConfigStatus::for_path(
                    path, true, false, false, false,
                ))
            }
        },
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            AppConfig::with_status(super::ConfigStatus::for_path(
                path, false, false, false, false,
            ))
        }
        Err(err) => {
            logging::log(&format!(
                "  config: failed to read {}: {}. Using defaults.",
                path.display(),
                err
            ));
            AppConfig::with_status(super::ConfigStatus::for_path(
                path, false, false, false, false,
            ))
        }
    }
}

pub fn save(input: SaveAppConfigInput) -> Result<AppConfig, String> {
    save_to_path(&config_path(), input)
}

pub fn save_to_path(path: &Path, input: SaveAppConfigInput) -> Result<AppConfig, String> {
    let _save_guard = config_save_lock()
        .lock()
        .map_err(|_| "config save mutex poisoned".to_string())?;
    let mut root = load_root_for_save(path)?;

    if let Some(prompts) = input.prompts {
        merge_prompt_config(&mut root, &prompts);
    }
    if let Some(ui) = input.ui {
        merge_ui_config(&mut root, &ui);
    }

    let serialized = toml::to_string_pretty(&root)
        .map_err(|err| format!("Failed to serialize config: {}", err))?;
    atomic_write(path, &serialized)?;

    let config = AppConfig::from_value(&root, config_status_from_root(path, true, &root));
    logging::log(&format!("  config: saved {}", path.display()));
    Ok(config)
}

fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create config directory: {}", err))?;
    }

    let tmp = tmp_path(path);
    fs::write(&tmp, content).map_err(|err| format!("Failed to write config: {}", err))?;
    if let Err(err) = replace_existing_file(&tmp, path) {
        let _ = fs::remove_file(&tmp);
        return Err(format!("Failed to replace config temp file: {}", err));
    }

    Ok(())
}

#[cfg(not(windows))]
fn replace_existing_file(tmp: &Path, path: &Path) -> std::io::Result<()> {
    fs::rename(tmp, path)
}

#[cfg(windows)]
fn replace_existing_file(tmp: &Path, path: &Path) -> std::io::Result<()> {
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    fn to_wide(path: &Path) -> Vec<u16> {
        path.as_os_str().encode_wide().chain(once(0)).collect()
    }

    let tmp = to_wide(tmp);
    let path = to_wide(path);
    let flags = MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH;
    let result = unsafe { MoveFileExW(tmp.as_ptr(), path.as_ptr(), flags) };
    if result == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

fn tmp_path(target: &Path) -> PathBuf {
    let mut tmp = target.to_path_buf();
    let ext = target
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    if ext.is_empty() {
        tmp.set_extension("tmp");
    } else {
        tmp.set_extension(format!("{}.tmp", ext));
    }
    tmp
}
