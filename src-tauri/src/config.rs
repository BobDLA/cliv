use crate::logging;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use toml::map::Map;
use toml::Value;

const DEFAULT_SCAN_DEPTH: usize = 5;
const DEFAULT_THEME: &str = "light";
const DEFAULT_LOCALE: &str = "en";
const DEFAULT_SIDEBAR_TAB: &str = "outline";
const DEFAULT_CONTENT_WIDTH: &str = "standard";
const DEFAULT_PAGE_PADDING: &str = "comfortable";
const DEFAULT_READING_DENSITY: &str = "comfortable";
const DEFAULT_HIGHLIGHT_STRENGTH: &str = "balanced";
const DEFAULT_SHORTCUT_OPEN_FILE: &str = "Mod+O";
const DEFAULT_SHORTCUT_SEARCH: &str = "Mod+F";
const DEFAULT_SHORTCUT_SUBMIT_RETURN: &str = "Mod+Enter";
const DEFAULT_SHORTCUT_SUBMIT_ANNOTATION: &str = "Mod+Enter";
const DEFAULT_SHORTCUT_ADD_ANNOTATION: &str = "Mod+Alt+M";
const DEFAULT_SHORTCUT_FONT_INCREASE: &str = "Mod+=";
const DEFAULT_SHORTCUT_FONT_DECREASE: &str = "Mod+-";
const DEFAULT_SHORTCUT_FONT_RESET: &str = "Mod+0";

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

    pub fn replace(&self, config: AppConfig) {
        *self.inner.lock().expect("app config mutex poisoned") = config;
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
        Self {
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
}

impl Default for ShortcutConfig {
    fn default() -> Self {
        Self {
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
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
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
            shortcuts: ShortcutConfig::default(),
        }
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
        let defaults = Self::with_status(status.clone());
        let launch = section_table(root, "launch");
        let prompts = section_table(root, "prompts");
        let ui = section_table(root, "ui");
        let shortcuts = ui.and_then(|table| child_table(table, "shortcuts"));

        Self {
            launch: LaunchConfig {
                scan_depth: launch
                    .and_then(|table| usize_value(table, "scan_depth"))
                    .unwrap_or(defaults.launch.scan_depth)
                    .max(1),
                trusted_callers: launch
                    .and_then(|table| string_array_value(table, "trusted_callers"))
                    .map(normalize_patterns)
                    .filter(|items| !items.is_empty())
                    .unwrap_or(defaults.launch.trusted_callers),
                ignored_callers: launch
                    .and_then(|table| string_array_value(table, "ignored_callers"))
                    .map(normalize_patterns)
                    .unwrap_or(defaults.launch.ignored_callers),
            },
            prompts: PromptConfig {
                reply_header_zh: normalize_text(
                    prompts.and_then(|table| string_value(table, "reply_header_zh")),
                ),
                reply_header_en: normalize_text(
                    prompts.and_then(|table| string_value(table, "reply_header_en")),
                ),
                iterate_header_zh: normalize_text(
                    prompts.and_then(|table| string_value(table, "iterate_header_zh")),
                ),
                iterate_header_en: normalize_text(
                    prompts.and_then(|table| string_value(table, "iterate_header_en")),
                ),
            },
            ui: UiConfig {
                theme: normalize_choice(
                    ui.and_then(|table| string_value(table, "theme")),
                    &["dark", "dim", "light"],
                    &defaults.ui.theme,
                ),
                font_size: ui
                    .and_then(|table| usize_value(table, "font_size"))
                    .unwrap_or(defaults.ui.font_size)
                    .clamp(10, 24),
                locale: normalize_choice(
                    ui.and_then(|table| string_value(table, "locale")),
                    &["zh", "en"],
                    &defaults.ui.locale,
                ),
                sidebar_open: ui
                    .and_then(|table| bool_value(table, "sidebar_open"))
                    .unwrap_or(defaults.ui.sidebar_open),
                sidebar_tab: normalize_choice(
                    ui.and_then(|table| string_value(table, "sidebar_tab")),
                    &["outline", "history"],
                    &defaults.ui.sidebar_tab,
                ),
                sidebar_width: ui
                    .and_then(|table| usize_value(table, "sidebar_width"))
                    .unwrap_or(defaults.ui.sidebar_width)
                    .clamp(120, 400),
                annotation_margin_width: ui
                    .and_then(|table| usize_value(table, "annotation_margin_width"))
                    .unwrap_or(defaults.ui.annotation_margin_width)
                    .clamp(150, 500),
                content_width: normalize_choice(
                    ui.and_then(|table| string_value(table, "content_width")),
                    &["narrow", "standard", "wide"],
                    &defaults.ui.content_width,
                ),
                page_padding: normalize_choice(
                    ui.and_then(|table| string_value(table, "page_padding")),
                    &["compact", "comfortable", "airy"],
                    &defaults.ui.page_padding,
                ),
                reading_density: normalize_choice(
                    ui.and_then(|table| string_value(table, "reading_density")),
                    &["compact", "comfortable", "relaxed"],
                    &defaults.ui.reading_density,
                ),
                highlight_strength: normalize_choice(
                    ui.and_then(|table| string_value(table, "highlight_strength")),
                    &["subtle", "balanced", "strong"],
                    &defaults.ui.highlight_strength,
                ),
                shortcuts: ShortcutConfig {
                    open_file: normalize_shortcut_or_default(
                        shortcuts.and_then(|table| string_value(table, "open_file")),
                        DEFAULT_SHORTCUT_OPEN_FILE,
                    ),
                    search: normalize_shortcut_or_default(
                        shortcuts.and_then(|table| string_value(table, "search")),
                        DEFAULT_SHORTCUT_SEARCH,
                    ),
                    submit_return: normalize_shortcut_or_default(
                        shortcuts.and_then(|table| string_value(table, "submit_return")),
                        DEFAULT_SHORTCUT_SUBMIT_RETURN,
                    ),
                    submit_annotation: normalize_shortcut_or_default(
                        shortcuts.and_then(|table| string_value(table, "submit_annotation")),
                        DEFAULT_SHORTCUT_SUBMIT_ANNOTATION,
                    ),
                    add_annotation: normalize_shortcut_or_default(
                        shortcuts.and_then(|table| string_value(table, "add_annotation")),
                        DEFAULT_SHORTCUT_ADD_ANNOTATION,
                    ),
                    font_increase: normalize_shortcut_or_default(
                        shortcuts.and_then(|table| string_value(table, "font_increase")),
                        DEFAULT_SHORTCUT_FONT_INCREASE,
                    ),
                    font_decrease: normalize_shortcut_or_default(
                        shortcuts.and_then(|table| string_value(table, "font_decrease")),
                        DEFAULT_SHORTCUT_FONT_DECREASE,
                    ),
                    font_reset: normalize_shortcut_or_default(
                        shortcuts.and_then(|table| string_value(table, "font_reset")),
                        DEFAULT_SHORTCUT_FONT_RESET,
                    ),
                },
            },
            status,
        }
    }
}

pub fn canonicalize_process_name(name: &str) -> String {
    let trimmed = name.trim();
    let basename = trimmed.rsplit(['/', '\\']).next().unwrap_or(trimmed).trim();
    let lowercase = basename.to_lowercase();
    lowercase
        .strip_suffix(".exe")
        .unwrap_or(&lowercase)
        .to_string()
}

pub fn normalize_shortcut(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut has_mod = false;
    let mut has_alt = false;
    let mut has_shift = false;
    let mut primary: Option<String> = None;

    for raw in trimmed.split('+') {
        let token = raw.trim();
        if token.is_empty() {
            return None;
        }

        match token.to_ascii_lowercase().as_str() {
            "mod" | "cmd" | "command" | "meta" | "ctrl" | "control" => {
                if has_mod {
                    return None;
                }
                has_mod = true;
            }
            "alt" | "option" => {
                if has_alt {
                    return None;
                }
                has_alt = true;
            }
            "shift" => {
                if has_shift {
                    return None;
                }
                has_shift = true;
            }
            _ => {
                if primary.is_some() {
                    return None;
                }
                primary = normalize_primary_shortcut_key(token);
            }
        }
    }

    if !(has_mod || has_alt || has_shift) {
        return None;
    }

    let primary = primary?;
    let mut parts: Vec<&str> = Vec::new();
    if has_mod {
        parts.push("Mod");
    }
    if has_alt {
        parts.push("Alt");
    }
    if has_shift {
        parts.push("Shift");
    }

    let mut output = parts.join("+");
    if !output.is_empty() {
        output.push('+');
    }
    output.push_str(&primary);
    Some(output)
}

fn normalize_primary_shortcut_key(token: &str) -> Option<String> {
    let lower = token.trim().to_ascii_lowercase();
    match lower.as_str() {
        "enter" | "return" => Some("Enter".to_string()),
        "escape" | "esc" => Some("Escape".to_string()),
        "=" | "plus" => Some("=".to_string()),
        "-" | "minus" => Some("-".to_string()),
        "," | "comma" => Some(",".to_string()),
        "." | "period" | "dot" => Some(".".to_string()),
        "/" | "slash" => Some("/".to_string()),
        _ => {
            let mut chars = token.trim().chars();
            match (chars.next(), chars.next()) {
                (Some(ch), None) if ch.is_ascii_alphanumeric() => {
                    Some(ch.to_ascii_uppercase().to_string())
                }
                _ => None,
            }
        }
    }
}

fn normalize_shortcut_or_default(value: Option<String>, fallback: &str) -> String {
    value
        .as_deref()
        .and_then(normalize_shortcut)
        .unwrap_or_else(|| fallback.to_string())
}

fn normalize_patterns(items: Vec<String>) -> Vec<String> {
    items
        .into_iter()
        .map(|item| canonicalize_process_name(&item))
        .filter(|item| !item.is_empty())
        .collect()
}

fn normalize_text(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

fn normalize_choice(value: Option<String>, allowed: &[&str], fallback: &str) -> String {
    let Some(candidate) = value.map(|item| item.trim().to_ascii_lowercase()) else {
        return fallback.to_string();
    };

    if allowed.contains(&candidate.as_str()) {
        candidate
    } else {
        fallback.to_string()
    }
}

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
                AppConfig::with_status(ConfigStatus::for_path(path, true, false, false, false))
            }
        },
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            AppConfig::with_status(ConfigStatus::for_path(path, false, false, false, false))
        }
        Err(err) => {
            logging::log(&format!(
                "  config: failed to read {}: {}. Using defaults.",
                path.display(),
                err
            ));
            AppConfig::with_status(ConfigStatus::for_path(path, false, false, false, false))
        }
    }
}

pub fn save(input: SaveAppConfigInput) -> Result<AppConfig, String> {
    save_to_path(&config_path(), input)
}

pub fn save_to_path(path: &Path, input: SaveAppConfigInput) -> Result<AppConfig, String> {
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

fn load_root_for_save(path: &Path) -> Result<Value, String> {
    match fs::read_to_string(path) {
        Ok(content) => {
            let root = content
                .parse::<Value>()
                .map_err(|err| format!("Failed to parse existing config: {}", err))?;
            if root.as_table().is_none() {
                return Err("Config root must be a TOML table".to_string());
            }
            Ok(root)
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(Value::Table(Map::new())),
        Err(err) => Err(format!("Failed to read existing config: {}", err)),
    }
}

fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create config directory: {}", err))?;
    }

    let tmp = tmp_path(path);
    fs::write(&tmp, content).map_err(|err| format!("Failed to write config: {}", err))?;
    if let Err(err) = fs::rename(&tmp, path) {
        let _ = fs::remove_file(&tmp);
        return Err(format!("Failed to rename config temp file: {}", err));
    }

    Ok(())
}

fn tmp_path(target: &Path) -> PathBuf {
    let mut tmp = target.to_path_buf();
    let ext = target.extension().and_then(|value| value.to_str()).unwrap_or("");
    if ext.is_empty() {
        tmp.set_extension("tmp");
    } else {
        tmp.set_extension(format!("{}.tmp", ext));
    }
    tmp
}

fn merge_prompt_config(root: &mut Value, prompts: &PromptConfig) {
    let root_table = ensure_root_table(root);
    let prompts_table = ensure_child_table(root_table, "prompts");

    set_optional_string(prompts_table, "reply_header_zh", prompts.reply_header_zh.clone());
    set_optional_string(prompts_table, "reply_header_en", prompts.reply_header_en.clone());
    set_optional_string(prompts_table, "iterate_header_zh", prompts.iterate_header_zh.clone());
    set_optional_string(prompts_table, "iterate_header_en", prompts.iterate_header_en.clone());

    if prompts_table.is_empty() {
        root_table.remove("prompts");
    }
}

fn merge_ui_config(root: &mut Value, ui: &UiConfig) {
    let defaults = UiConfig::default();
    let root_table = ensure_root_table(root);
    let ui_table = ensure_child_table(root_table, "ui");

    set_string(
        ui_table,
        "theme",
        normalize_choice(Some(ui.theme.clone()), &["dark", "dim", "light"], &defaults.theme),
    );
    set_integer(ui_table, "font_size", ui.font_size.clamp(10, 24));
    set_string(
        ui_table,
        "locale",
        normalize_choice(Some(ui.locale.clone()), &["zh", "en"], &defaults.locale),
    );
    set_bool(ui_table, "sidebar_open", ui.sidebar_open);
    set_string(
        ui_table,
        "sidebar_tab",
        normalize_choice(
            Some(ui.sidebar_tab.clone()),
            &["outline", "history"],
            &defaults.sidebar_tab,
        ),
    );
    set_integer(ui_table, "sidebar_width", ui.sidebar_width.clamp(120, 400));
    set_integer(
        ui_table,
        "annotation_margin_width",
        ui.annotation_margin_width.clamp(150, 500),
    );
    set_string(
        ui_table,
        "content_width",
        normalize_choice(
            Some(ui.content_width.clone()),
            &["narrow", "standard", "wide"],
            &defaults.content_width,
        ),
    );
    set_string(
        ui_table,
        "page_padding",
        normalize_choice(
            Some(ui.page_padding.clone()),
            &["compact", "comfortable", "airy"],
            &defaults.page_padding,
        ),
    );
    set_string(
        ui_table,
        "reading_density",
        normalize_choice(
            Some(ui.reading_density.clone()),
            &["compact", "comfortable", "relaxed"],
            &defaults.reading_density,
        ),
    );
    set_string(
        ui_table,
        "highlight_strength",
        normalize_choice(
            Some(ui.highlight_strength.clone()),
            &["subtle", "balanced", "strong"],
            &defaults.highlight_strength,
        ),
    );

    let shortcuts_table = ensure_child_table(ui_table, "shortcuts");
    set_string(
        shortcuts_table,
        "open_file",
        normalize_shortcut_or_default(Some(ui.shortcuts.open_file.clone()), DEFAULT_SHORTCUT_OPEN_FILE),
    );
    set_string(
        shortcuts_table,
        "search",
        normalize_shortcut_or_default(Some(ui.shortcuts.search.clone()), DEFAULT_SHORTCUT_SEARCH),
    );
    set_string(
        shortcuts_table,
        "submit_return",
        normalize_shortcut_or_default(
            Some(ui.shortcuts.submit_return.clone()),
            DEFAULT_SHORTCUT_SUBMIT_RETURN,
        ),
    );
    set_string(
        shortcuts_table,
        "submit_annotation",
        normalize_shortcut_or_default(
            Some(ui.shortcuts.submit_annotation.clone()),
            DEFAULT_SHORTCUT_SUBMIT_ANNOTATION,
        ),
    );
    set_string(
        shortcuts_table,
        "add_annotation",
        normalize_shortcut_or_default(
            Some(ui.shortcuts.add_annotation.clone()),
            DEFAULT_SHORTCUT_ADD_ANNOTATION,
        ),
    );
    set_string(
        shortcuts_table,
        "font_increase",
        normalize_shortcut_or_default(
            Some(ui.shortcuts.font_increase.clone()),
            DEFAULT_SHORTCUT_FONT_INCREASE,
        ),
    );
    set_string(
        shortcuts_table,
        "font_decrease",
        normalize_shortcut_or_default(
            Some(ui.shortcuts.font_decrease.clone()),
            DEFAULT_SHORTCUT_FONT_DECREASE,
        ),
    );
    set_string(
        shortcuts_table,
        "font_reset",
        normalize_shortcut_or_default(Some(ui.shortcuts.font_reset.clone()), DEFAULT_SHORTCUT_FONT_RESET),
    );
}

fn config_status_from_root(path: &Path, exists: bool, root: &Value) -> ConfigStatus {
    ConfigStatus::for_path(
        path,
        exists,
        section_table(root, "launch").is_some(),
        section_table(root, "prompts").is_some(),
        section_table(root, "ui").is_some(),
    )
}

fn section_table<'a>(root: &'a Value, key: &str) -> Option<&'a Map<String, Value>> {
    root.as_table()?.get(key)?.as_table()
}

fn child_table<'a>(table: &'a Map<String, Value>, key: &str) -> Option<&'a Map<String, Value>> {
    table.get(key)?.as_table()
}

fn string_value(table: &Map<String, Value>, key: &str) -> Option<String> {
    table.get(key)?.as_str().map(|value| value.to_string())
}

fn bool_value(table: &Map<String, Value>, key: &str) -> Option<bool> {
    table.get(key)?.as_bool()
}

fn usize_value(table: &Map<String, Value>, key: &str) -> Option<usize> {
    let value = table.get(key)?.as_integer()?;
    usize::try_from(value).ok()
}

fn string_array_value(table: &Map<String, Value>, key: &str) -> Option<Vec<String>> {
    let array = table.get(key)?.as_array()?;
    Some(
        array
            .iter()
            .filter_map(|item| item.as_str().map(|value| value.to_string()))
            .collect(),
    )
}

fn ensure_root_table(root: &mut Value) -> &mut Map<String, Value> {
    if !root.is_table() {
        *root = Value::Table(Map::new());
    }
    root.as_table_mut().expect("config root must be a table")
}

fn ensure_child_table<'a>(
    table: &'a mut Map<String, Value>,
    key: &str,
) -> &'a mut Map<String, Value> {
    let value = table
        .entry(key.to_string())
        .or_insert_with(|| Value::Table(Map::new()));
    if !value.is_table() {
        *value = Value::Table(Map::new());
    }
    value
        .as_table_mut()
        .expect("child config section must be a table")
}

fn set_string(table: &mut Map<String, Value>, key: &str, value: String) {
    table.insert(key.to_string(), Value::String(value));
}

fn set_optional_string(table: &mut Map<String, Value>, key: &str, value: Option<String>) {
    match normalize_text(value) {
        Some(value) => {
            table.insert(key.to_string(), Value::String(value));
        }
        None => {
            table.remove(key);
        }
    }
}

fn set_bool(table: &mut Map<String, Value>, key: &str, value: bool) {
    table.insert(key.to_string(), Value::Boolean(value));
}

fn set_integer(table: &mut Map<String, Value>, key: &str, value: usize) {
    table.insert(key.to_string(), Value::Integer(value as i64));
}

#[cfg(test)]
mod tests {
    use super::{
        canonicalize_process_name, config_status_from_root, load_from_path, normalize_shortcut,
        save_to_path, AppConfig, SaveAppConfigInput, UiConfig,
    };
    use std::path::Path;
    use toml::Value;

    #[test]
    fn defaults_include_known_trusted_callers() {
        let config = AppConfig::default();
        assert!(config.launch.trusted_callers.contains(&"codex".to_string()));
        assert!(config.launch.trusted_callers.contains(&"claude".to_string()));
        assert!(config.launch.trusted_callers.contains(&"gemini".to_string()));
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
        assert_eq!(config.prompts.reply_header_zh.as_deref(), Some("自定义回复"));
        assert_eq!(config.prompts.iterate_header_en.as_deref(), Some("custom iterate"));
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
        assert!(config.launch.trusted_callers.contains(&"claude".to_string()));
        assert!(config.launch.trusted_callers.contains(&"gemini".to_string()));
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
        assert_eq!(config.prompts.reply_header_en.as_deref(), Some("Custom reply"));
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
                prompts: Some(super::PromptConfig {
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
                prompts: Some(super::PromptConfig::default()),
                ui: None,
            },
        )
        .unwrap();

        let written = std::fs::read_to_string(&path).unwrap();
        assert!(!written.contains("reply_header_zh"));
        assert!(!written.contains("[prompts]"));
    }

    #[test]
    fn normalize_shortcut_canonicalizes_supported_values() {
        assert_eq!(normalize_shortcut("ctrl+shift+p").as_deref(), Some("Mod+Shift+P"));
        assert_eq!(normalize_shortcut("cmd+enter").as_deref(), Some("Mod+Enter"));
        assert_eq!(normalize_shortcut("mod+alt+m").as_deref(), Some("Mod+Alt+M"));
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
        assert_eq!(canonicalize_process_name("gemini"), "gemini");
    }
}
