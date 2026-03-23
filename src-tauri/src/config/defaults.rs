use super::normalize::normalize_patterns;
use super::{LaunchConfig, ShortcutConfig, UiConfig};

pub(super) const DEFAULT_SCAN_DEPTH: usize = 5;
pub(super) const DEFAULT_THEME: &str = "light";
pub(super) const DEFAULT_LOCALE: &str = "en";
pub(super) const DEFAULT_SIDEBAR_TAB: &str = "outline";
pub(super) const DEFAULT_CONTENT_WIDTH: &str = "standard";
pub(super) const DEFAULT_PAGE_PADDING: &str = "comfortable";
pub(super) const DEFAULT_READING_DENSITY: &str = "comfortable";
pub(super) const DEFAULT_HIGHLIGHT_STRENGTH: &str = "balanced";
pub(super) const DEFAULT_SHORTCUT_OPEN_FILE: &str = "Mod+O";
pub(super) const DEFAULT_SHORTCUT_SEARCH: &str = "Mod+F";
pub(super) const DEFAULT_SHORTCUT_SUBMIT_RETURN: &str = "Mod+Enter";
pub(super) const DEFAULT_SHORTCUT_SUBMIT_ANNOTATION: &str = "Mod+Enter";
pub(super) const DEFAULT_SHORTCUT_ADD_ANNOTATION: &str = "Mod+Alt+M";
pub(super) const DEFAULT_SHORTCUT_FONT_INCREASE: &str = "Mod+=";
pub(super) const DEFAULT_SHORTCUT_FONT_DECREASE: &str = "Mod+-";
pub(super) const DEFAULT_SHORTCUT_FONT_RESET: &str = "Mod+0";

pub(super) fn default_launch_config() -> LaunchConfig {
    LaunchConfig {
        scan_depth: DEFAULT_SCAN_DEPTH,
        trusted_callers: normalize_patterns(vec![
            "codex".to_string(),
            "claude".to_string(),
            "gemini".to_string(),
        ]),
        ignored_callers: normalize_patterns(vec![
            "bash".to_string(),
            "sh".to_string(),
            "zsh".to_string(),
            "fish".to_string(),
            "tmux".to_string(),
            "open".to_string(),
            "launchd".to_string(),
            "cmd.exe".to_string(),
            "powershell.exe".to_string(),
            "pwsh.exe".to_string(),
            "explorer.exe".to_string(),
        ]),
    }
}

pub(super) fn default_shortcut_config() -> ShortcutConfig {
    ShortcutConfig {
        open_file: DEFAULT_SHORTCUT_OPEN_FILE.to_string(),
        search: DEFAULT_SHORTCUT_SEARCH.to_string(),
        submit_return: DEFAULT_SHORTCUT_SUBMIT_RETURN.to_string(),
        submit_annotation: DEFAULT_SHORTCUT_SUBMIT_ANNOTATION.to_string(),
        add_annotation: DEFAULT_SHORTCUT_ADD_ANNOTATION.to_string(),
        font_increase: DEFAULT_SHORTCUT_FONT_INCREASE.to_string(),
        font_decrease: DEFAULT_SHORTCUT_FONT_DECREASE.to_string(),
        font_reset: DEFAULT_SHORTCUT_FONT_RESET.to_string(),
    }
}

pub(super) fn default_ui_config() -> UiConfig {
    UiConfig {
        theme: DEFAULT_THEME.to_string(),
        font_size: 18,
        locale: DEFAULT_LOCALE.to_string(),
        sidebar_open: true,
        sidebar_tab: DEFAULT_SIDEBAR_TAB.to_string(),
        sidebar_width: 224,
        annotation_margin_width: 256,
        content_width: DEFAULT_CONTENT_WIDTH.to_string(),
        page_padding: DEFAULT_PAGE_PADDING.to_string(),
        reading_density: DEFAULT_READING_DENSITY.to_string(),
        highlight_strength: DEFAULT_HIGHLIGHT_STRENGTH.to_string(),
        shortcuts: default_shortcut_config(),
    }
}
