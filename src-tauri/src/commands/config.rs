use crate::config::AppConfig;

#[tauri::command]
pub fn get_app_config(state: tauri::State<'_, AppConfig>) -> AppConfig {
    state.inner().clone()
}
