pub mod cache;
mod cli;
mod commands;
pub mod config;
pub mod extract;
pub mod logging;

pub use cli::{CliArgs, CliMode, CliParsed};
pub use config::{AppConfig, AppConfigState};

// ─── GUI Entry ────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run_gui(cli_args: CliArgs, app_config: AppConfig) {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(cli_args)
        .manage(AppConfigState::new(app_config))
        .invoke_handler(tauri::generate_handler![
            commands::config::get_app_config,
            commands::config::save_app_config,
            // File operations
            commands::files::load_files,
            commands::files::read_file,
            commands::files::write_back,
            commands::files::get_cli_args,
            // Review history
            commands::history::save_review_archive,
            commands::history::list_review_history,
            commands::history::load_review_archive,
            // Session persistence
            commands::sessions::save_session,
            commands::sessions::save_return_record,
            commands::sessions::load_session_data,
            commands::sessions::list_sessions,
            // Agent reply extraction
            extract::codex::extract_codex_reply,
            extract::claude::extract_claude_reply,
            extract::gemini::extract_gemini_reply,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
