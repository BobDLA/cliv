use crate::logging;
use std::fs;
use std::path::{Path, PathBuf};

pub fn default_agent_home(hidden_dir: &str) -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(hidden_dir)
}

pub fn env_or_default_agent_home(env_var: &str, hidden_dir: &str) -> PathBuf {
    std::env::var(env_var)
        .map(PathBuf::from)
        .unwrap_or_else(|_| default_agent_home(hidden_dir))
}

pub fn resolve_lookup_key(
    log_prefix: &str,
    provided: Option<String>,
    env_var: &str,
    env_source_label: &'static str,
) -> (Option<String>, &'static str) {
    if provided.is_some() {
        return (provided, "parameter");
    }

    let env_value = std::env::var(env_var)
        .ok()
        .filter(|value| !value.is_empty());
    if env_value.is_some() {
        logging::log(&format!(
            "  {}: resolved key from {} env var",
            log_prefix, env_var
        ));
        (env_value, env_source_label)
    } else {
        (None, "none")
    }
}

pub fn read_cached_reply(
    log_prefix: &str,
    cache_path: &Path,
    read_error_prefix: &str,
) -> Option<Result<String, String>> {
    logging::log(&format!(
        "  {}: trying cache path={}",
        log_prefix,
        cache_path.display()
    ));
    if cache_path.exists() {
        logging::log(&format!(
            "  {}: HIT cache file={} size={}",
            log_prefix,
            cache_path.display(),
            fs::metadata(cache_path).map(|meta| meta.len()).unwrap_or(0)
        ));
        return Some(
            fs::read_to_string(cache_path).map_err(|err| format!("{}: {}", read_error_prefix, err)),
        );
    }
    None
}
