pub fn canonicalize_process_name(name: &str) -> String {
    let trimmed = name.trim();
    let basename = trimmed.rsplit(['/', '\\']).next().unwrap_or(trimmed).trim();
    let lowercase = basename.to_lowercase();
    let canonical = lowercase
        .strip_suffix(".exe")
        .unwrap_or(&lowercase)
        .to_string();

    canonicalize_known_agent_binary(&canonical)
}

fn canonicalize_known_agent_binary(name: &str) -> String {
    for agent in ["codex", "claude", "gemini"] {
        if let Some(suffix) = name.strip_prefix(&format!("{agent}-")) {
            if looks_like_target_triple(suffix) {
                return agent.to_string();
            }
        }
    }

    name.to_string()
}

fn looks_like_target_triple(value: &str) -> bool {
    let parts: Vec<&str> = value.split('-').collect();
    if parts.len() < 3 {
        return false;
    }

    let has_arch = parts
        .first()
        .map(|part| matches!(*part, "x86_64" | "aarch64" | "arm64" | "i686"))
        .unwrap_or(false);
    let has_os = parts
        .iter()
        .any(|part| matches!(*part, "windows" | "linux" | "darwin" | "macos"));

    has_arch && has_os
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

pub(super) fn normalize_shortcut_or_default(value: Option<String>, fallback: &str) -> String {
    value
        .as_deref()
        .and_then(normalize_shortcut)
        .unwrap_or_else(|| fallback.to_string())
}

pub(super) fn normalize_patterns(items: Vec<String>) -> Vec<String> {
    items
        .into_iter()
        .map(|item| canonicalize_process_name(&item))
        .filter(|item| !item.is_empty())
        .collect()
}

pub(super) fn normalize_text(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

pub(super) fn normalize_choice(value: Option<String>, allowed: &[&str], fallback: &str) -> String {
    let Some(candidate) = value.map(|item| item.trim().to_ascii_lowercase()) else {
        return fallback.to_string();
    };

    if allowed.contains(&candidate.as_str()) {
        candidate
    } else {
        fallback.to_string()
    }
}
