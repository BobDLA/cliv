mod defaults;
mod io;
mod normalize;
mod toml_store;

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::{Mutex, OnceLock};

pub use io::{config_path, load, load_from_path, save, save_to_path};
pub use normalize::{canonicalize_process_name, normalize_shortcut};
use toml::Value;
use toml_store::build_app_config_from_value;

static CONFIG_SAVE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

#[derive(Debug)]
pub struct AppConfigState {
    inner: Mutex<AppConfig>,
}

impl AppConfigState {
    pub fn new(config: AppConfig) -> Self {
        Self {
            inner: Mutex::new(config),
        }
    }

    pub fn current(&self) -> AppConfig {
        self.inner
            .lock()
            .expect("app config mutex poisoned")
            .clone()
    }

    pub fn persist(&self, input: SaveAppConfigInput) -> Result<AppConfig, String> {
        let mut current = self
            .inner
            .lock()
            .map_err(|_| "app config mutex poisoned".to_string())?;
        let saved = save(input)?;
        *current = saved.clone();
        Ok(saved)
    }

    #[cfg(test)]
    pub fn persist_at_path(
        &self,
        path: &Path,
        input: SaveAppConfigInput,
    ) -> Result<AppConfig, String> {
        let mut current = self
            .inner
            .lock()
            .map_err(|_| "app config mutex poisoned".to_string())?;
        let saved = save_to_path(path, input)?;
        *current = saved.clone();
        Ok(saved)
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub launch: LaunchConfig,
    pub prompts: PromptConfig,
    pub ui: UiConfig,
    pub status: ConfigStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigStatus {
    pub path: String,
    pub exists: bool,
    pub launch_configured: bool,
    pub prompts_configured: bool,
    pub ui_configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LaunchConfig {
    pub scan_depth: usize,
    pub trusted_callers: Vec<String>,
    pub ignored_callers: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PromptConfig {
    pub reply_header_zh: Option<String>,
    pub reply_header_en: Option<String>,
    pub iterate_header_zh: Option<String>,
    pub iterate_header_en: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UiConfig {
    pub theme: String,
    pub font_size: usize,
    pub locale: String,
    pub sidebar_open: bool,
    pub sidebar_tab: String,
    pub sidebar_width: usize,
    pub annotation_margin_width: usize,
    pub content_width: String,
    pub page_padding: String,
    pub reading_density: String,
    pub highlight_strength: String,
    pub shortcuts: ShortcutConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutConfig {
    pub open_file: String,
    pub search: String,
    pub submit_return: String,
    pub submit_annotation: String,
    pub add_annotation: String,
    pub font_increase: String,
    pub font_decrease: String,
    pub font_reset: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAppConfigInput {
    pub prompts: Option<PromptConfig>,
    pub ui: Option<UiConfig>,
}

impl ConfigStatus {
    fn for_path(
        path: &Path,
        exists: bool,
        launch_configured: bool,
        prompts_configured: bool,
        ui_configured: bool,
    ) -> Self {
        Self {
            path: path.display().to_string(),
            exists,
            launch_configured,
            prompts_configured,
            ui_configured,
        }
    }
}

impl Default for LaunchConfig {
    fn default() -> Self {
        defaults::default_launch_config()
    }
}

impl Default for ShortcutConfig {
    fn default() -> Self {
        defaults::default_shortcut_config()
    }
}

impl Default for UiConfig {
    fn default() -> Self {
        defaults::default_ui_config()
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self::with_status(ConfigStatus::for_path(
            &config_path(),
            false,
            false,
            false,
            false,
        ))
    }
}

impl AppConfig {
    fn with_status(status: ConfigStatus) -> Self {
        Self {
            launch: LaunchConfig::default(),
            prompts: PromptConfig::default(),
            ui: UiConfig::default(),
            status,
        }
    }

    fn from_value(root: &Value, status: ConfigStatus) -> Self {
        build_app_config_from_value(root, status)
    }
}

pub(super) fn config_save_lock() -> &'static Mutex<()> {
    CONFIG_SAVE_LOCK.get_or_init(|| Mutex::new(()))
}

#[cfg(test)]
mod tests {
    use super::{
        canonicalize_process_name, load_from_path, normalize_shortcut, save_to_path, AppConfig,
        PromptConfig, SaveAppConfigInput, UiConfig,
    };
    use crate::config::toml_store::config_status_from_root;
    use std::path::Path;
    use std::sync::{Arc, Barrier};
    use toml::Value;

    #[test]
    fn defaults_include_known_trusted_callers() {
        let config = AppConfig::default();
        assert!(config.launch.trusted_callers.contains(&"codex".to_string()));
        assert!(config
            .launch
            .trusted_callers
            .contains(&"claude".to_string()));
        assert!(config
            .launch
            .trusted_callers
            .contains(&"gemini".to_string()));
    }

    #[test]
    fn load_from_path_overrides_launch_prompts_ui_and_shortcuts() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        std::fs::write(
            &path,
            r#"[launch]
scan_depth = 7
trusted_callers = ["MyCLI"]
ignored_callers = ["Wrapper"]

[prompts]
reply_header_zh = " 自定义回复 "
iterate_header_en = " custom iterate "

[ui]
theme = "dim"
font_size = 19
locale = "zh"
sidebar_open = false
sidebar_tab = "history"
sidebar_width = 300
annotation_margin_width = 320
content_width = "wide"
page_padding = "airy"
reading_density = "relaxed"
highlight_strength = "strong"

[ui.shortcuts]
open_file = "ctrl+shift+p"
submit_return = "cmd+enter"
submit_annotation = "ctrl+enter"
"#,
        )
        .unwrap();

        let config = load_from_path(&path);

        assert_eq!(config.launch.scan_depth, 7);
        assert_eq!(config.launch.trusted_callers, vec!["mycli"]);
        assert_eq!(config.launch.ignored_callers, vec!["wrapper"]);
        assert_eq!(
            config.prompts.reply_header_zh.as_deref(),
            Some("自定义回复")
        );
        assert_eq!(
            config.prompts.iterate_header_en.as_deref(),
            Some("custom iterate")
        );
        assert_eq!(config.ui.theme, "dim");
        assert_eq!(config.ui.font_size, 19);
        assert_eq!(config.ui.locale, "zh");
        assert!(!config.ui.sidebar_open);
        assert_eq!(config.ui.sidebar_tab, "history");
        assert_eq!(config.ui.sidebar_width, 300);
        assert_eq!(config.ui.annotation_margin_width, 320);
        assert_eq!(config.ui.content_width, "wide");
        assert_eq!(config.ui.page_padding, "airy");
        assert_eq!(config.ui.reading_density, "relaxed");
        assert_eq!(config.ui.highlight_strength, "strong");
        assert_eq!(config.ui.shortcuts.open_file, "Mod+Shift+P");
        assert_eq!(config.ui.shortcuts.submit_return, "Mod+Enter");
        assert_eq!(config.ui.shortcuts.submit_annotation, "Mod+Enter");
        assert!(config.status.exists);
        assert!(config.status.ui_configured);
    }

    #[test]
    fn empty_trusted_callers_fall_back_to_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        std::fs::write(
            &path,
            r#"[launch]
trusted_callers = ["   "]
"#,
        )
        .unwrap();

        let config = load_from_path(&path);

        assert!(config.launch.trusted_callers.contains(&"codex".to_string()));
        assert!(config
            .launch
            .trusted_callers
            .contains(&"claude".to_string()));
        assert!(config
            .launch
            .trusted_callers
            .contains(&"gemini".to_string()));
    }

    #[test]
    fn scan_depth_is_clamped_and_blank_prompt_headers_are_ignored() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        std::fs::write(
            &path,
            r#"[launch]
scan_depth = 0

[prompts]
reply_header_zh = "   "
reply_header_en = " Custom reply "
iterate_header_zh = "\n\t "
"#,
        )
        .unwrap();

        let config = load_from_path(&path);

        assert_eq!(config.launch.scan_depth, 1);
        assert_eq!(config.prompts.reply_header_zh, None);
        assert_eq!(
            config.prompts.reply_header_en.as_deref(),
            Some("Custom reply")
        );
        assert_eq!(config.prompts.iterate_header_zh, None);
    }

    #[test]
    fn invalid_shortcut_values_fall_back_to_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        std::fs::write(
            &path,
            r#"[ui.shortcuts]
open_file = "totally-invalid"
submit_return = "Enter"
font_increase = "Ctrl++"
"#,
        )
        .unwrap();

        let config = load_from_path(&path);

        assert_eq!(config.ui.shortcuts.open_file, "Mod+O");
        assert_eq!(config.ui.shortcuts.submit_return, "Mod+Enter");
        assert_eq!(config.ui.shortcuts.font_increase, "Mod+=");
    }

    #[test]
    fn save_preserves_unknown_fields_while_updating_known_sections() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        std::fs::write(
            &path,
            r#"[launch]
scan_depth = 9
custom_launch = "keep"

[prompts]
reply_header_en = "old"
custom_prompt = "keep"

[ui]
theme = "dark"
custom_ui = "keep"

[ui.shortcuts]
open_file = "Mod+P"
custom_shortcut = "keep"

[other]
enabled = true
"#,
        )
        .unwrap();

        let mut ui = UiConfig::default();
        ui.theme = "light".to_string();
        ui.locale = "zh".to_string();
        ui.shortcuts.open_file = "ctrl+shift+p".to_string();

        let saved = save_to_path(
            &path,
            SaveAppConfigInput {
                prompts: Some(PromptConfig {
                    reply_header_zh: None,
                    reply_header_en: Some("  Updated  ".to_string()),
                    iterate_header_zh: None,
                    iterate_header_en: None,
                }),
                ui: Some(ui),
            },
        )
        .unwrap();

        let written = std::fs::read_to_string(&path).unwrap();
        assert!(written.contains("custom_launch = \"keep\""));
        assert!(written.contains("custom_prompt = \"keep\""));
        assert!(written.contains("custom_ui = \"keep\""));
        assert!(written.contains("custom_shortcut = \"keep\""));
        assert!(written.contains("[other]"));
        assert!(written.contains("reply_header_en = \"Updated\""));
        assert!(written.contains("theme = \"light\""));
        assert!(written.contains("open_file = \"Mod+Shift+P\""));
        assert_eq!(saved.launch.scan_depth, 9);
        assert_eq!(saved.prompts.reply_header_en.as_deref(), Some("Updated"));
        assert_eq!(saved.ui.shortcuts.open_file, "Mod+Shift+P");
    }

    #[test]
    fn save_removes_prompt_keys_when_reset_to_default() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        std::fs::write(
            &path,
            r#"[prompts]
reply_header_zh = "自定义"
"#,
        )
        .unwrap();

        save_to_path(
            &path,
            SaveAppConfigInput {
                prompts: Some(PromptConfig::default()),
                ui: None,
            },
        )
        .unwrap();

        let written = std::fs::read_to_string(&path).unwrap();
        assert!(!written.contains("reply_header_zh"));
        assert!(!written.contains("[prompts]"));
    }

    #[test]
    fn concurrent_saves_preserve_prompt_and_ui_updates() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");

        for _ in 0..32 {
            std::fs::write(&path, "[launch]\nscan_depth = 9\n").unwrap();

            let barrier = Arc::new(Barrier::new(3));

            let prompt_path = path.clone();
            let prompt_barrier = Arc::clone(&barrier);
            let prompt_save = std::thread::spawn(move || {
                prompt_barrier.wait();
                save_to_path(
                    &prompt_path,
                    SaveAppConfigInput {
                        prompts: Some(PromptConfig {
                            reply_header_en: Some("Updated".to_string()),
                            ..PromptConfig::default()
                        }),
                        ui: None,
                    },
                )
            });

            let ui_path = path.clone();
            let ui_barrier = Arc::clone(&barrier);
            let ui_save = std::thread::spawn(move || {
                let mut ui = UiConfig::default();
                ui.theme = "dim".to_string();

                ui_barrier.wait();
                save_to_path(
                    &ui_path,
                    SaveAppConfigInput {
                        prompts: None,
                        ui: Some(ui),
                    },
                )
            });

            barrier.wait();
            prompt_save.join().unwrap().unwrap();
            ui_save.join().unwrap().unwrap();

            let saved = load_from_path(&path);
            assert_eq!(saved.launch.scan_depth, 9);
            assert_eq!(saved.prompts.reply_header_en.as_deref(), Some("Updated"));
            assert_eq!(saved.ui.theme, "dim");
        }
    }

    #[test]
    fn normalize_shortcut_canonicalizes_supported_values() {
        assert_eq!(
            normalize_shortcut("ctrl+shift+p").as_deref(),
            Some("Mod+Shift+P")
        );
        assert_eq!(
            normalize_shortcut("cmd+enter").as_deref(),
            Some("Mod+Enter")
        );
        assert_eq!(
            normalize_shortcut("mod+alt+m").as_deref(),
            Some("Mod+Alt+M")
        );
        assert_eq!(normalize_shortcut("Enter"), None);
        assert_eq!(normalize_shortcut("Ctrl++"), None);
    }

    #[test]
    fn status_reflects_available_sections() {
        let root = "[ui]\ntheme = \"dark\"\n".parse::<Value>().unwrap();
        let status = config_status_from_root(Path::new("/tmp/test.toml"), true, &root);
        assert!(status.exists);
        assert!(!status.launch_configured);
        assert!(!status.prompts_configured);
        assert!(status.ui_configured);
        assert_eq!(status.path, "/tmp/test.toml");
    }

    #[test]
    fn canonicalize_process_name_uses_basename_casefold_and_strips_exe() {
        assert_eq!(
            canonicalize_process_name("  C:\\Program Files\\Claude.exe  "),
            "claude"
        );
        assert_eq!(canonicalize_process_name("/usr/local/bin/Codex"), "codex");
        assert_eq!(
            canonicalize_process_name("codex-x86_64-pc-windows-msvc.exe"),
            "codex"
        );
        assert_eq!(canonicalize_process_name("gemini"), "gemini");
    }
}
