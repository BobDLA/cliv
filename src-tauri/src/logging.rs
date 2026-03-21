use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::Instant;

/// Maximum log file size in bytes (1 MB).
const MAX_LOG_SIZE: u64 = 1_048_576;

/// Application start instant — used for elapsed-time logging.
static APP_START: OnceLock<Instant> = OnceLock::new();

/// Whether debug logging is enabled (cached from CLIV_DEBUG env).
static DEBUG_ENABLED: OnceLock<bool> = OnceLock::new();

/// Initialize the application start time. Call once at the very beginning of main().
pub fn init() {
    APP_START.get_or_init(Instant::now);
    DEBUG_ENABLED.get_or_init(|| {
        std::env::var("CLIV_DEBUG")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
    });
}

fn is_debug() -> bool {
    *DEBUG_ENABLED.get_or_init(|| {
        std::env::var("CLIV_DEBUG")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
    })
}

fn elapsed_ms() -> u64 {
    APP_START.get_or_init(Instant::now).elapsed().as_millis() as u64
}

fn log_path() -> PathBuf {
    // Cross-platform log file path
    #[cfg(windows)]
    {
        let tmp = std::env::var("TEMP").unwrap_or_else(|_| r"C:\TEMP".to_string());
        PathBuf::from(format!(r"{}\cliv.log", tmp))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".cliv")
            .join("cliv.log")
    }
}

/// Truncate the log file if it exceeds MAX_LOG_SIZE.
fn maybe_truncate(path: &PathBuf) {
    if let Ok(meta) = fs::metadata(path) {
        if meta.len() > MAX_LOG_SIZE {
            // Keep the last ~half of the file
            if let Ok(content) = fs::read_to_string(path) {
                let keep_from = content.len() / 2;
                // Find the next newline after the midpoint to avoid splitting a line
                if let Some(newline_pos) = content[keep_from..].find('\n') {
                    let trimmed = &content[keep_from + newline_pos + 1..];
                    let _ = fs::write(path, format!("[...truncated...]\n{}", trimmed));
                }
            }
        }
    }
}

/// Write a log line. Always written (startup info, errors, important events).
pub fn log(msg: &str) {
    let path = log_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    maybe_truncate(&path);
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(f, "[+{}ms] {}", elapsed_ms(), msg);
    }
}

/// Write a debug-level log line. Only written when CLIV_DEBUG=1.
pub fn debug(msg: &str) {
    if is_debug() {
        log(msg);
    }
}

/// Write a timing log line with elapsed time since app start.
pub fn timing(label: &str) {
    log(&format!("⏱ {} at +{}ms", label, elapsed_ms()));
}
