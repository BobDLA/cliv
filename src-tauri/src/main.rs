fn main() {
    let parsed = cliv_lib::CliParsed::from_env();

    match parsed.mode {
        cliv_lib::CliMode::Gui => cliv_lib::run_gui(parsed.args),
        cliv_lib::CliMode::CacheCodex(ref json) => cliv_lib::cache::cache_codex(json),
        cliv_lib::CliMode::CacheClaude => cliv_lib::cache::cache_claude(),
        cliv_lib::CliMode::CacheGemini => cliv_lib::cache::cache_gemini(),
    }
}
