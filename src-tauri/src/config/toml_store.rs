use super::defaults::{
    self, DEFAULT_HIGHLIGHT_STRENGTH, DEFAULT_LOCALE, DEFAULT_PAGE_PADDING,
    DEFAULT_READING_DENSITY, DEFAULT_SHORTCUT_ADD_ANNOTATION, DEFAULT_SHORTCUT_FONT_DECREASE,
    DEFAULT_SHORTCUT_FONT_INCREASE, DEFAULT_SHORTCUT_FONT_RESET, DEFAULT_SHORTCUT_OPEN_FILE,
    DEFAULT_SHORTCUT_SEARCH, DEFAULT_SHORTCUT_SUBMIT_ANNOTATION,
    DEFAULT_SHORTCUT_SUBMIT_RETURN, DEFAULT_THEME,
};
use super::normalize::{
    normalize_choice, normalize_patterns, normalize_shortcut_or_default, normalize_text,
};
use super::{AppConfig, ConfigStatus, LaunchConfig, PromptConfig, UiConfig};
use std::fs;
use std::path::Path;
use toml::map::Map;
use toml::Value;

pub(super) fn build_app_config_from_value(root: &Value, status: ConfigStatus) -> AppConfig {
    let defaults = AppConfig {
        launch: defaults::default_launch_config(),
        prompts: PromptConfig::default(),
        ui: defaults::default_ui_config(),
        status: status.clone(),
    };
    let launch = section_table(root, "launch");
    let prompts = section_table(root, "prompts");
    let ui = section_table(root, "ui");
    let shortcuts = ui.and_then(|table| child_table(table, "shortcuts"));

    AppConfig {
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
                DEFAULT_THEME,
            ),
            font_size: ui
                .and_then(|table| usize_value(table, "font_size"))
                .unwrap_or(defaults.ui.font_size)
                .clamp(10, 24),
            locale: normalize_choice(
                ui.and_then(|table| string_value(table, "locale")),
                &["zh", "en"],
                DEFAULT_LOCALE,
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
                DEFAULT_PAGE_PADDING,
            ),
            reading_density: normalize_choice(
                ui.and_then(|table| string_value(table, "reading_density")),
                &["compact", "comfortable", "relaxed"],
                DEFAULT_READING_DENSITY,
            ),
            highlight_strength: normalize_choice(
                ui.and_then(|table| string_value(table, "highlight_strength")),
                &["subtle", "balanced", "strong"],
                DEFAULT_HIGHLIGHT_STRENGTH,
            ),
            shortcuts: super::ShortcutConfig {
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

pub(crate) fn config_status_from_root(path: &Path, exists: bool, root: &Value) -> ConfigStatus {
    ConfigStatus::for_path(
        path,
        exists,
        section_table(root, "launch").is_some(),
        section_table(root, "prompts").is_some(),
        section_table(root, "ui").is_some(),
    )
}

pub(super) fn load_root_for_save(path: &Path) -> Result<Value, String> {
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

pub(super) fn merge_prompt_config(root: &mut Value, prompts: &PromptConfig) {
    let root_table = ensure_root_table(root);
    let prompts_table = ensure_child_table(root_table, "prompts");

    set_optional_string(
        prompts_table,
        "reply_header_zh",
        prompts.reply_header_zh.clone(),
    );
    set_optional_string(
        prompts_table,
        "reply_header_en",
        prompts.reply_header_en.clone(),
    );
    set_optional_string(
        prompts_table,
        "iterate_header_zh",
        prompts.iterate_header_zh.clone(),
    );
    set_optional_string(
        prompts_table,
        "iterate_header_en",
        prompts.iterate_header_en.clone(),
    );

    if prompts_table.is_empty() {
        root_table.remove("prompts");
    }
}

pub(super) fn merge_ui_config(root: &mut Value, ui: &UiConfig) {
    let defaults = UiConfig::default();
    let root_table = ensure_root_table(root);
    let ui_table = ensure_child_table(root_table, "ui");

    set_string(
        ui_table,
        "theme",
        normalize_choice(Some(ui.theme.clone()), &["dark", "dim", "light"], DEFAULT_THEME),
    );
    set_integer(ui_table, "font_size", ui.font_size.clamp(10, 24));
    set_string(
        ui_table,
        "locale",
        normalize_choice(Some(ui.locale.clone()), &["zh", "en"], DEFAULT_LOCALE),
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
            DEFAULT_PAGE_PADDING,
        ),
    );
    set_string(
        ui_table,
        "reading_density",
        normalize_choice(
            Some(ui.reading_density.clone()),
            &["compact", "comfortable", "relaxed"],
            DEFAULT_READING_DENSITY,
        ),
    );
    set_string(
        ui_table,
        "highlight_strength",
        normalize_choice(
            Some(ui.highlight_strength.clone()),
            &["subtle", "balanced", "strong"],
            DEFAULT_HIGHLIGHT_STRENGTH,
        ),
    );

    let shortcuts_table = ensure_child_table(ui_table, "shortcuts");
    set_string(
        shortcuts_table,
        "open_file",
        normalize_shortcut_or_default(
            Some(ui.shortcuts.open_file.clone()),
            DEFAULT_SHORTCUT_OPEN_FILE,
        ),
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
        normalize_shortcut_or_default(
            Some(ui.shortcuts.font_reset.clone()),
            DEFAULT_SHORTCUT_FONT_RESET,
        ),
    );
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
