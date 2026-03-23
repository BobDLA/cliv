use crate::config::{AppConfig, AppConfigState, SaveAppConfigInput};
#[cfg(test)]
use std::path::Path;

#[tauri::command]
pub fn get_app_config(state: tauri::State<'_, AppConfigState>) -> AppConfig {
    state.current()
}

#[tauri::command]
pub fn save_app_config(
    input: SaveAppConfigInput,
    state: tauri::State<'_, AppConfigState>,
) -> Result<AppConfig, String> {
    persist_and_update_state(&state, input)
}

fn persist_and_update_state(
    state: &AppConfigState,
    input: SaveAppConfigInput,
) -> Result<AppConfig, String> {
    state.persist(input)
}

#[cfg(test)]
fn persist_and_update_state_at_path(
    path: &Path,
    state: &AppConfigState,
    input: SaveAppConfigInput,
) -> Result<AppConfig, String> {
    state.persist_at_path(path, input)
}

#[cfg(test)]
mod tests {
    use super::persist_and_update_state_at_path;
    use crate::config::{AppConfig, AppConfigState, SaveAppConfigInput, UiConfig};

    #[test]
    fn persist_updates_shared_state_after_save() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        std::fs::write(&path, "[launch]\nscan_depth = 9\n").unwrap();

        let state = AppConfigState::new(AppConfig::default());
        let mut ui = UiConfig::default();
        ui.theme = "dim".to_string();

        let saved = persist_and_update_state_at_path(
            &path,
            &state,
            SaveAppConfigInput {
                prompts: None,
                ui: Some(ui),
            },
        )
        .unwrap();

        assert_eq!(saved.launch.scan_depth, 9);
        assert_eq!(saved.ui.theme, "dim");
        assert_eq!(state.current().ui.theme, "dim");
        assert_eq!(state.current().launch.scan_depth, 9);
    }
}
