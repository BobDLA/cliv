use crate::config::{canonicalize_process_name, AppConfig};
use crate::extract::resolve_agent_lookup_by_owner_identity;
use crate::logging;
use crate::process::{collect_parent_processes, resolve_owner_identity, ParentProcess};
use serde::Serialize;

/// How cliV was invoked.
#[derive(Debug, Clone)]
pub enum CliMode {
    /// Launch the Tauri GUI (default).
    Gui,
    /// Cache a Codex reply from notify hook: `cliv cache-codex '<json>'`
    CacheCodex(String),
    /// Cache a Claude reply from Stop hook (stdin): `cliv cache-claude`
    CacheClaude,
    /// Cache a Gemini reply from AfterAgent hook (stdin): `cliv cache-gemini`
    CacheGemini,
}

/// CLI arguments parsed from `std::env::args()` and environment variables.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliArgs {
    pub review_path: Option<String>,
    pub target_path: Option<String>,
    pub metadata_path: Option<String>,
    pub file_path: Option<String>,
    pub workspace_path: Option<String>,
    /// Which agent triggered the launch: "codex", "claude", "gemini", or "unknown".
    /// Auto-detected from environment variables.
    pub agent: Option<String>,
    /// Which trusted caller matched the parent process chain, if any.
    pub trusted_caller: Option<String>,
}

/// Full CLI parse result containing both mode and GUI args.
pub struct CliParsed {
    pub mode: CliMode,
    pub args: CliArgs,
}

#[derive(Debug, Clone)]
struct OwnerCacheAgentMatch {
    agent: String,
}

impl CliParsed {
    pub fn from_env(config: &AppConfig) -> Self {
        let argv: Vec<String> = std::env::args().collect();

        logging::log("═══════════════════════════════════════════════════");
        logging::log(&format!("cliV started  PID={}", std::process::id()));
        logging::log(&format!("  argv={:?}", argv));
        logging::debug(&format!(
            "  CWD={}",
            std::env::current_dir()
                .map(|p| p.display().to_string())
                .unwrap_or_default()
        ));
        logging::debug(&format!(
            "  CLIV_AGENT={}",
            std::env::var("CLIV_AGENT").unwrap_or_default()
        ));
        logging::debug(&format!(
            "  CODEX_THREAD_ID={}",
            std::env::var("CODEX_THREAD_ID").unwrap_or_default()
        ));
        logging::debug(&format!(
            "  CLAUDE_SESSION_ID={}",
            std::env::var("CLAUDE_SESSION_ID").unwrap_or_default()
        ));
        logging::debug(&format!(
            "  GEMINI_SESSION_ID={}",
            std::env::var("GEMINI_SESSION_ID").unwrap_or_default()
        ));

        // Check for subcommand first
        if argv.len() >= 2 {
            match argv[1].as_str() {
                "cache-codex" => {
                    let json = argv.get(2).cloned().unwrap_or_default();
                    logging::log(&format!("  mode=cache-codex  json_len={}", json.len()));
                    return CliParsed {
                        mode: CliMode::CacheCodex(json),
                        args: CliArgs::default(),
                    };
                }
                "cache-claude" => {
                    logging::log("  mode=cache-claude (stdin)");
                    return CliParsed {
                        mode: CliMode::CacheClaude,
                        args: CliArgs::default(),
                    };
                }
                "cache-gemini" => {
                    logging::log("  mode=cache-gemini (stdin)");
                    return CliParsed {
                        mode: CliMode::CacheGemini,
                        args: CliArgs::default(),
                    };
                }
                _ => {}
            }
        }

        let process_chain = collect_parent_processes(config.launch.scan_depth);
        let direct_agent = detect_agent_from_env_or_process(&process_chain);
        let owner_cache_match = if direct_agent.is_none() {
            detect_agent_from_owner_cache(config, &process_chain)
        } else {
            None
        };
        let agent =
            direct_agent.or_else(|| owner_cache_match.as_ref().map(|item| item.agent.clone()));
        if agent.is_none() {
            logging::log("  detect: no agent detected");
        }
        let trusted_caller = detect_trusted_caller(config, &process_chain)
            .or_else(|| owner_cache_match.as_ref().map(|item| item.agent.clone()));

        logging::log(&format!(
            "  mode=gui  detected_agent={:?} trusted_caller={:?}",
            agent, trusted_caller
        ));

        let workspace_path = std::env::current_dir()
            .ok()
            .map(|path| std::fs::canonicalize(&path).unwrap_or(path))
            .map(|path| path.to_string_lossy().to_string());

        let args = parse_gui_args(&argv[1..], workspace_path, agent, trusted_caller);

        logging::log(&format!(
            "  review_path={:?} target_path={:?} file_path={:?}",
            args.review_path, args.target_path, args.file_path
        ));

        CliParsed {
            mode: CliMode::Gui,
            args,
        }
    }
}

/// Parse GUI-mode arguments from an argv slice (excluding the binary name).
fn parse_gui_args(
    argv: &[String],
    workspace_path: Option<String>,
    agent: Option<String>,
    trusted_caller: Option<String>,
) -> CliArgs {
    let mut metadata_path = None;
    let mut explicit_target = None;
    let mut positional_path = None;

    let mut i = 0;
    while i < argv.len() {
        match argv[i].as_str() {
            "--metadata" => {
                if i + 1 < argv.len() {
                    metadata_path = Some(argv[i + 1].clone());
                    i += 2;
                } else {
                    i += 1;
                }
            }
            "--compose" | "--target" | "-t" => {
                if i + 1 < argv.len() {
                    explicit_target = Some(argv[i + 1].clone());
                    i += 2;
                } else {
                    i += 1;
                }
            }
            arg if arg.starts_with('-') => {
                i += 1;
            }
            arg => {
                if positional_path.is_none() {
                    positional_path = Some(arg.to_string());
                }
                i += 1;
            }
        }
    }

    let (review_path, target_path) = resolve_launch_paths(
        positional_path.clone(),
        explicit_target,
        trusted_caller.clone(),
    );

    CliArgs {
        review_path,
        target_path,
        metadata_path,
        file_path: positional_path,
        workspace_path,
        agent,
        trusted_caller,
    }
}

fn resolve_launch_paths(
    positional_path: Option<String>,
    explicit_target: Option<String>,
    trusted_caller: Option<String>,
) -> (Option<String>, Option<String>) {
    // Compatibility-only path for wrappers that still launch `cliv <file>`.
    // This is not the default Claude/Gemini/Codex UX: a lone positional file
    // becomes the write target only when the caller is explicitly trusted.
    match (positional_path, explicit_target, trusted_caller) {
        (review_path, Some(target_path), _) => (review_path, Some(target_path)),
        (Some(target_path), None, Some(_)) => (None, Some(target_path)),
        (Some(review_path), None, None) => (Some(review_path), None),
        (None, None, _) => (None, None),
    }
}

fn detect_agent_from_env_or_process(process_chain: &[ParentProcess]) -> Option<String> {
    if let Ok(agent) = std::env::var("CLIV_AGENT") {
        if !agent.is_empty() {
            logging::log(&format!("  detect: CLIV_AGENT={} → using override", agent));
            return Some(agent);
        }
    }

    if std::env::var("CODEX_THREAD_ID")
        .ok()
        .filter(|s| !s.is_empty())
        .is_some()
    {
        logging::log("  detect: CODEX_THREAD_ID set → codex");
        return Some("codex".to_string());
    }

    if std::env::var("CLAUDE_SESSION_ID")
        .ok()
        .filter(|s| !s.is_empty())
        .is_some()
    {
        logging::log("  detect: CLAUDE_SESSION_ID set → claude");
        return Some("claude".to_string());
    }

    if std::env::var("GEMINI_SESSION_ID")
        .ok()
        .filter(|s| !s.is_empty())
        .is_some()
    {
        logging::log("  detect: GEMINI_SESSION_ID set → gemini");
        return Some("gemini".to_string());
    }

    logging::debug("  detect: no lookup-key env vars found, trying parent process...");

    if let Some((agent, pid, level)) = find_agent_process(process_chain) {
        return handle_agent_match(agent, pid, level);
    }

    None
}

fn detect_agent_from_owner_cache(
    config: &AppConfig,
    process_chain: &[ParentProcess],
) -> Option<OwnerCacheAgentMatch> {
    let (owner, level, canonical_name) =
        resolve_owner_identity(process_chain, &config.launch.ignored_callers)?;
    let matched = resolve_agent_lookup_by_owner_identity(&owner)?;

    logging::log(&format!(
        "  owner[{}]: matched cached agent {} via owner identity canonical='{}' pid={} started_at={} key={}",
        level,
        matched.agent,
        canonical_name,
        owner.pid,
        owner.started_at,
        matched.key
    ));
    set_agent_lookup_env(&matched.agent, &matched.key, level, "owner_cache_identity");

    Some(OwnerCacheAgentMatch {
        agent: matched.agent,
    })
}

fn find_agent_process(process_chain: &[ParentProcess]) -> Option<(&'static str, u32, usize)> {
    let mut matched_by_name = None;
    let mut matched_by_cmdline = None;

    for process in process_chain {
        if let Some(agent) = match_agent_name(&process.name) {
            matched_by_name = Some((agent, process.pid, process.level));
            continue;
        }

        if let Some(agent) = process.cmdline.as_deref().and_then(match_agent_name) {
            matched_by_cmdline = Some((agent, process.pid, process.level));
        }
    }

    matched_by_name.or(matched_by_cmdline)
}

fn detect_trusted_caller(config: &AppConfig, process_chain: &[ParentProcess]) -> Option<String> {
    for process in process_chain {
        let canonical_name = canonicalize_process_name(&process.name);

        if matches_any(&canonical_name, &config.launch.ignored_callers) {
            logging::debug(&format!(
                "  trust[{}]: skipping ignored caller '{}' (canonical='{}')",
                process.level, process.name, canonical_name
            ));
            continue;
        }

        if matches_any(&canonical_name, &config.launch.trusted_callers) {
            logging::log(&format!(
                "  trust[{}]: matched trusted caller '{}' (canonical='{}') at pid={}",
                process.level, process.name, canonical_name, process.pid
            ));
            return Some(canonical_name);
        }

        // Fallback: when comm is a generic interpreter (e.g. "node"), check
        // the invoked executable token from cmdline which contains the full
        // command plus its arguments.
        if let Some(ref cmdline) = process.cmdline {
            let canonical_cmdline = match canonicalize_cmdline_executable(cmdline) {
                Some(name) => name,
                None => {
                    logging::debug(&format!(
                        "  trust[{}]: cmdline present but no executable token parsed from '{}'",
                        process.level, cmdline
                    ));
                    continue;
                }
            };
            if matches_any(&canonical_cmdline, &config.launch.trusted_callers) {
                logging::log(&format!(
                    "  trust[{}]: matched trusted caller via cmdline '{}' (canonical='{}') at pid={}",
                    process.level, cmdline, canonical_cmdline, process.pid
                ));
                return Some(canonical_cmdline);
            }
        }

        logging::debug(&format!(
            "  trust[{}]: first non-wrapper caller '{}' (canonical='{}') is not trusted",
            process.level, process.name, canonical_name
        ));
        return None;
    }

    logging::debug("  trust: no trusted caller matched");
    None
}

fn canonicalize_cmdline_executable(cmdline: &str) -> Option<String> {
    let mut tokens = cmdline
        .split_whitespace()
        .map(|token| token.trim_matches(|ch| ch == '"' || ch == '\''))
        .filter(|token| !token.is_empty());

    let first = tokens.next()?;
    let canonical_first = canonicalize_process_name(first);
    if !is_generic_interpreter(&canonical_first) {
        return Some(canonical_first);
    }

    for token in tokens {
        if token.starts_with('-') {
            continue;
        }

        let canonical = canonicalize_process_name(token);
        if !canonical.is_empty() {
            return Some(canonical);
        }
    }

    None
}

fn is_generic_interpreter(name: &str) -> bool {
    matches!(
        name,
        "node"
            | "bun"
            | "deno"
            | "python"
            | "python3"
            | "ruby"
            | "bash"
            | "sh"
            | "zsh"
            | "fish"
            | "pwsh"
    )
}

/// Given a matched agent and its PID, set the appropriate compatibility env var.
///
/// Important: these env vars are treated by cliV as reply-cache lookup-key carriers
/// during GUI extraction. Their names are historical and do not guarantee that the
/// runtime value is the agent's semantic conversation identity.
fn handle_agent_match(agent_name: &str, agent_pid: u32, level: usize) -> Option<String> {
    logging::log(&format!(
        "  walk[{}]: matched {} at pid={}",
        level, agent_name, agent_pid
    ));

    set_agent_lookup_env(
        agent_name,
        &agent_pid.to_string(),
        level,
        "parent_process_pid",
    );

    Some(agent_name.to_string())
}

fn set_agent_lookup_env(agent_name: &str, lookup_key: &str, level: usize, source: &str) {
    let env_var = match agent_name {
        "codex" => "CODEX_THREAD_ID",
        "claude" => "CLAUDE_SESSION_ID",
        "gemini" => "GEMINI_SESSION_ID",
        _ => return,
    };

    if std::env::var(env_var)
        .ok()
        .filter(|s| !s.is_empty())
        .is_none()
    {
        logging::log(&format!(
            "  walk[{}]: set {}={} (source={})",
            level, env_var, lookup_key, source
        ));
        std::env::set_var(env_var, lookup_key);
    }
}

fn matches_any(name: &str, patterns: &[String]) -> bool {
    patterns.iter().any(|pattern| name == pattern)
}

/// Check if a process name matches a known agent.
fn match_agent_name(comm: &str) -> Option<&'static str> {
    if comm.contains("codex") {
        Some("codex")
    } else if comm.contains("claude") {
        Some("claude")
    } else if comm.contains("gemini") {
        Some("gemini")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::{
        detect_trusted_caller, find_agent_process, match_agent_name, parse_gui_args,
        resolve_launch_paths, ParentProcess,
    };
    use crate::config::{AppConfig, LaunchConfig};

    fn test_config() -> AppConfig {
        let mut config = AppConfig::default();
        config.launch = LaunchConfig {
            scan_depth: 5,
            trusted_callers: vec!["codex".into(), "mycli".into()],
            ignored_callers: vec!["bash".into(), "sh".into()],
        };
        config
    }

    #[test]
    fn explicit_target_keeps_positional_as_review_path() {
        let argv = vec![
            "--target".to_string(),
            "draft.md".to_string(),
            "review.md".to_string(),
        ];
        let args = parse_gui_args(&argv, None, None, None);

        assert_eq!(args.review_path.as_deref(), Some("review.md"));
        assert_eq!(args.target_path.as_deref(), Some("draft.md"));
    }

    #[test]
    fn trusted_caller_turns_lone_positional_into_target() {
        let argv = vec!["draft.md".to_string()];
        let args = parse_gui_args(&argv, None, None, Some("codex".to_string()));

        assert_eq!(args.review_path, None);
        assert_eq!(args.target_path.as_deref(), Some("draft.md"));
    }

    #[test]
    fn explicit_target_beats_trusted_caller_fallback() {
        let argv = vec![
            "--target".to_string(),
            "draft.md".to_string(),
            "review.md".to_string(),
        ];
        let args = parse_gui_args(&argv, None, None, Some("codex".to_string()));

        assert_eq!(args.review_path.as_deref(), Some("review.md"));
        assert_eq!(args.target_path.as_deref(), Some("draft.md"));
    }

    #[test]
    fn compose_alias_sets_target_path() {
        let argv = vec![
            "--compose".to_string(),
            "draft.md".to_string(),
            "review.md".to_string(),
        ];
        let args = parse_gui_args(&argv, None, None, None);

        assert_eq!(args.review_path.as_deref(), Some("review.md"));
        assert_eq!(args.target_path.as_deref(), Some("draft.md"));
    }

    #[test]
    fn short_target_alias_sets_target_path() {
        let argv = vec![
            "-t".to_string(),
            "draft.md".to_string(),
            "review.md".to_string(),
        ];
        let args = parse_gui_args(&argv, None, None, None);

        assert_eq!(args.review_path.as_deref(), Some("review.md"));
        assert_eq!(args.target_path.as_deref(), Some("draft.md"));
    }

    #[test]
    fn standalone_lone_positional_stays_review_only() {
        let (review_path, target_path) = resolve_launch_paths(Some("note.md".into()), None, None);

        assert_eq!(review_path.as_deref(), Some("note.md"));
        assert_eq!(target_path, None);
    }

    #[test]
    fn trusted_caller_skips_ignored_wrappers() {
        let caller = detect_trusted_caller(
            &test_config(),
            &[
                ParentProcess {
                    pid: 10,
                    name: "bash".into(),
                    cmdline: None,
                    level: 0,
                    started_at: None,
                },
                ParentProcess {
                    pid: 11,
                    name: "codex".into(),
                    cmdline: None,
                    level: 1,
                    started_at: None,
                },
            ],
        );

        assert_eq!(caller.as_deref(), Some("codex"));
    }

    #[test]
    fn trusted_caller_matches_canonical_exact_name_only() {
        let caller = detect_trusted_caller(
            &test_config(),
            &[ParentProcess {
                pid: 13,
                name: "/Applications/Codex.exe".into(),
                cmdline: None,
                level: 0,
                started_at: None,
            }],
        );

        assert_eq!(caller.as_deref(), Some("codex"));
    }

    #[test]
    fn trusted_caller_does_not_match_substrings() {
        let caller = detect_trusted_caller(
            &test_config(),
            &[ParentProcess {
                pid: 14,
                name: "my-codex-wrapper".into(),
                cmdline: None,
                level: 0,
                started_at: None,
            }],
        );

        assert_eq!(caller, None);
    }

    #[test]
    fn trusted_caller_matches_executable_token_from_interpreter_cmdline() {
        let caller = detect_trusted_caller(
            &test_config(),
            &[ParentProcess {
                pid: 18,
                name: "node".into(),
                cmdline: Some("node --no-warnings /usr/local/bin/mycli /tmp/file.md".into()),
                level: 0,
                started_at: None,
            }],
        );

        assert_eq!(caller.as_deref(), Some("mycli"));
    }

    #[test]
    fn untrusted_first_non_wrapper_stops_trust_walk() {
        let caller = detect_trusted_caller(
            &test_config(),
            &[
                ParentProcess {
                    pid: 15,
                    name: "bash".into(),
                    cmdline: None,
                    level: 0,
                    started_at: None,
                },
                ParentProcess {
                    pid: 16,
                    name: "neovim".into(),
                    cmdline: None,
                    level: 1,
                    started_at: None,
                },
                ParentProcess {
                    pid: 17,
                    name: "codex".into(),
                    cmdline: None,
                    level: 2,
                    started_at: None,
                },
            ],
        );

        assert_eq!(caller, None);
    }

    #[test]
    fn untrusted_caller_does_not_enable_target_fallback() {
        let caller = detect_trusted_caller(
            &test_config(),
            &[ParentProcess {
                pid: 12,
                name: "neovim".into(),
                cmdline: None,
                level: 0,
                started_at: None,
            }],
        );

        assert_eq!(caller, None);
    }

    #[test]
    fn find_agent_process_prefers_outermost_agent_match() {
        let matched = find_agent_process(&[
            ParentProcess {
                pid: 101,
                name: "node".into(),
                cmdline: Some("/tmp/claude-inner /tmp/buffer.md".into()),
                level: 0,
                started_at: None,
            },
            ParentProcess {
                pid: 202,
                name: "node".into(),
                cmdline: Some("/tmp/claude-outer".into()),
                level: 1,
                started_at: None,
            },
        ]);

        assert_eq!(matched, Some(("claude", 202, 1)));
    }

    #[test]
    fn match_agent_name_detects_from_comm() {
        assert_eq!(match_agent_name("codex"), Some("codex"));
        assert_eq!(match_agent_name("claude"), Some("claude"));
        assert_eq!(match_agent_name("gemini"), Some("gemini"));
        assert_eq!(match_agent_name("node"), None);
        assert_eq!(match_agent_name("python"), None);
    }

    #[test]
    fn match_agent_name_detects_from_cmdline_path() {
        // Simulates Gemini CLI: comm is "node", but cmdline contains the gemini path
        let cmdline = "node --no-warnings=dep0040 /home/user/.nvm/versions/node/v22/bin/gemini";
        assert_eq!(match_agent_name(cmdline), Some("gemini"));

        // Claude via cmdline
        let cmdline = "node /home/user/.nvm/versions/node/v22/bin/claude --help";
        assert_eq!(match_agent_name(cmdline), Some("claude"));

        // Plain node process — no match
        let cmdline = "node /home/user/my-app/index.js";
        assert_eq!(match_agent_name(cmdline), None);
    }
}
