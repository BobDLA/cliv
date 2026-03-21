use crate::logging;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const DEFAULT_SCAN_DEPTH: usize = 5;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub launch: LaunchConfig,
    pub prompts: PromptConfig,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchConfig {
    pub scan_depth: usize,
    pub trusted_callers: Vec<String>,
    pub ignored_callers: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptConfig {
    pub reply_header_zh: Option<String>,
    pub reply_header_en: Option<String>,
    pub iterate_header_zh: Option<String>,
    pub iterate_header_en: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct FileAppConfig {
    launch: Option<FileLaunchConfig>,
    prompts: Option<FilePromptConfig>,
}

#[derive(Debug, Default, Deserialize)]
struct FileLaunchConfig {
    scan_depth: Option<usize>,
    trusted_callers: Option<Vec<String>>,
    ignored_callers: Option<Vec<String>>,
}

#[derive(Debug, Default, Deserialize)]
struct FilePromptConfig {
    reply_header_zh: Option<String>,
    reply_header_en: Option<String>,
    iterate_header_zh: Option<String>,
    iterate_header_en: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            launch: LaunchConfig {
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
            },
            prompts: PromptConfig::default(),
        }
    }
}

impl AppConfig {
    fn from_file(file: FileAppConfig) -> Self {
        let defaults = Self::default();
        let launch = file.launch.unwrap_or_default();
        let prompts = file.prompts.unwrap_or_default();

        Self {
            launch: LaunchConfig {
                scan_depth: launch.scan_depth.unwrap_or(defaults.launch.scan_depth).max(1),
                trusted_callers: launch
                    .trusted_callers
                    .map(normalize_patterns)
                    .filter(|items| !items.is_empty())
                    .unwrap_or(defaults.launch.trusted_callers),
                ignored_callers: launch
                    .ignored_callers
                    .map(normalize_patterns)
                    .unwrap_or(defaults.launch.ignored_callers),
            },
            prompts: PromptConfig {
                reply_header_zh: normalize_text(prompts.reply_header_zh),
                reply_header_en: normalize_text(prompts.reply_header_en),
                iterate_header_zh: normalize_text(prompts.iterate_header_zh),
                iterate_header_en: normalize_text(prompts.iterate_header_en),
            },
        }
    }
}

pub fn canonicalize_process_name(name: &str) -> String {
    let trimmed = name.trim();
    let basename = trimmed
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(trimmed)
        .trim();
    let lowercase = basename.to_lowercase();
    lowercase
        .strip_suffix(".exe")
        .unwrap_or(&lowercase)
        .to_string()
}

fn normalize_patterns(items: Vec<String>) -> Vec<String> {
    items
        .into_iter()
        .map(|item| canonicalize_process_name(&item))
        .filter(|item| !item.is_empty())
        .collect()
}

fn normalize_text(value: Option<String>) -> Option<String> {
    value.map(|item| item.trim().to_string()).filter(|item| !item.is_empty())
}

pub fn config_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".cliv")
        .join("config.toml")
}

pub fn load() -> AppConfig {
    let path = config_path();
    match fs::read_to_string(&path) {
        Ok(content) => match toml::from_str::<FileAppConfig>(&content) {
            Ok(file) => {
                logging::log(&format!("  config: loaded {}", path.display()));
                AppConfig::from_file(file)
            }
            Err(err) => {
                logging::log(&format!(
                    "  config: failed to parse {}: {}. Using defaults.",
                    path.display(),
                    err
                ));
                AppConfig::default()
            }
        },
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => AppConfig::default(),
        Err(err) => {
            logging::log(&format!(
                "  config: failed to read {}: {}. Using defaults.",
                path.display(),
                err
            ));
            AppConfig::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        canonicalize_process_name, AppConfig, FileAppConfig, FileLaunchConfig,
        FilePromptConfig,
    };

    #[test]
    fn defaults_include_known_trusted_callers() {
        let config = AppConfig::default();
        assert!(config.launch.trusted_callers.contains(&"codex".to_string()));
        assert!(config.launch.trusted_callers.contains(&"claude".to_string()));
        assert!(config.launch.trusted_callers.contains(&"gemini".to_string()));
    }

    #[test]
    fn file_config_overrides_launch_and_prompts() {
        let config = AppConfig::from_file(FileAppConfig {
            launch: Some(FileLaunchConfig {
                scan_depth: Some(7),
                trusted_callers: Some(vec!["MyCLI".into()]),
                ignored_callers: Some(vec!["Wrapper".into()]),
            }),
            prompts: Some(FilePromptConfig {
                reply_header_zh: Some(" 自定义回复 ".into()),
                reply_header_en: None,
                iterate_header_zh: None,
                iterate_header_en: Some(" custom iterate ".into()),
            }),
        });

        assert_eq!(config.launch.scan_depth, 7);
        assert_eq!(config.launch.trusted_callers, vec!["mycli"]);
        assert_eq!(config.launch.ignored_callers, vec!["wrapper"]);
        assert_eq!(config.prompts.reply_header_zh.as_deref(), Some("自定义回复"));
        assert_eq!(
            config.prompts.iterate_header_en.as_deref(),
            Some("custom iterate")
        );
    }

    #[test]
    fn empty_trusted_callers_fall_back_to_defaults() {
        let config = AppConfig::from_file(FileAppConfig {
            launch: Some(FileLaunchConfig {
                scan_depth: None,
                trusted_callers: Some(vec!["   ".into()]),
                ignored_callers: None,
            }),
            prompts: None,
        });

        assert!(config.launch.trusted_callers.contains(&"codex".to_string()));
        assert!(config.launch.trusted_callers.contains(&"claude".to_string()));
        assert!(config.launch.trusted_callers.contains(&"gemini".to_string()));
    }

    #[test]
    fn scan_depth_is_clamped_and_blank_prompt_headers_are_ignored() {
        let config = AppConfig::from_file(FileAppConfig {
            launch: Some(FileLaunchConfig {
                scan_depth: Some(0),
                trusted_callers: None,
                ignored_callers: None,
            }),
            prompts: Some(FilePromptConfig {
                reply_header_zh: Some("   ".into()),
                reply_header_en: Some(" Custom reply ".into()),
                iterate_header_zh: Some("\n\t ".into()),
                iterate_header_en: None,
            }),
        });

        assert_eq!(config.launch.scan_depth, 1);
        assert_eq!(config.prompts.reply_header_zh, None);
        assert_eq!(config.prompts.reply_header_en.as_deref(), Some("Custom reply"));
        assert_eq!(config.prompts.iterate_header_zh, None);
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
