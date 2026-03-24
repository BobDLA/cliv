use crate::logging;
use std::path::PathBuf;

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
