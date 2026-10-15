// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---

//! Temporary install log — path removable later by ops policy.

use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

static LOG: Mutex<Option<std::fs::File>> = Mutex::new(None);

pub fn default_log_path() -> PathBuf {
    std::env::var_os("ELITEEW_TS_INSTALL_LOG")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/var/log/eliteew-ts-install.log"))
}

pub fn init() {
    let path = default_log_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    match OpenOptions::new().create(true).append(true).open(&path) {
        Ok(f) => {
            if let Ok(mut g) = LOG.lock() {
                *g = Some(f);
            }
            info(&format!("log opened at {}", path.display()));
        }
        Err(e) => {
            eprintln!("eliteew-ts-installer: cannot open log {}: {e}", path.display());
        }
    }
}

pub fn info(msg: &str) {
    write_line("INFO", msg);
}

pub fn warn(msg: &str) {
    write_line("WARN", msg);
}

pub fn error(msg: &str) {
    write_line("ERROR", msg);
}

fn write_line(level: &str, msg: &str) {
    let line = format!(
        "{} [{level}] {msg}\n",
        chrono_like_now()
    );
    eprint!("{line}");
    if let Ok(mut g) = LOG.lock() {
        if let Some(f) = g.as_mut() {
            let _ = f.write_all(line.as_bytes());
            let _ = f.flush();
        }
    }
}

fn chrono_like_now() -> String {
    // Avoid extra chrono dep — UTC-ish wall clock from system time.
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("unix={secs}")
}
