mod allowlist;
mod ask;
mod reply;
mod tty;

use allowlist::is_state_luks_ask;
use ask::{is_expired, pid_dead, read_ask_path};
use inotify::{EventMask, Inotify, WatchDescriptor, WatchMask};
use std::collections::HashSet;
use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
const ASK_DIR: &str = "/run/systemd/ask-password";

fn main() {
    if let Err(err) = run() {
        eprintln!("empiieros-state-unlock-agent: {err}");
        std::process::exit(1);
    }
}

fn run() -> io::Result<()> {
    let watch = env::args().any(|a| a == "--watch");
    if watch {
        watch_loop()
    } else {
        process_pending_asks()
    }
}

fn watch_loop() -> io::Result<()> {
    fs::create_dir_all(ASK_DIR)?;
    let mut ino = Inotify::init()?;
    let wd: WatchDescriptor = ino.watches().add(
        ASK_DIR,
        WatchMask::CREATE
            | WatchMask::CLOSE_WRITE
            | WatchMask::MOVED_TO
            | WatchMask::DELETE
            | WatchMask::MOVED_FROM,
    )?;

    loop {
        process_dir()?;
        let mut buffer = [0u8; 4096];
        let events = ino.read_events_blocking(&mut buffer)?;
        for event in events {
            if event.wd != wd {
                continue;
            }
            if event.mask.contains(EventMask::ISDIR) {
                continue;
            }
            process_dir()?;
        }
    }
}

fn process_pending_asks() -> io::Result<()> {
    process_dir()
}

fn process_dir() -> io::Result<()> {
    let dir = Path::new(ASK_DIR);
    if !dir.is_dir() {
        return Ok(());
    }
    let mut paths: Vec<PathBuf> = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with("ask.") {
            paths.push(entry.path());
        }
    }
    paths.sort();
    let mut handled: HashSet<String> = HashSet::new();
    for path in paths {
        let key = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        if handled.contains(&key) {
            continue;
        }
        if try_handle_one(&path)? {
            handled.insert(key);
        }
    }
    Ok(())
}

fn try_handle_one(path: &Path) -> io::Result<bool> {
    let Some(req) = read_ask_path(path) else {
        return Ok(false);
    };
    if is_expired(&req) {
        return Ok(false);
    }
    if let Some(pid) = req.pid {
        if pid_dead(pid) {
            return Ok(false);
        }
    }
    if !is_state_luks_ask(&req) {
        return Ok(false);
    }
    if req.silent {
        return Ok(false);
    }

    let passphrase = tty::read_passphrase_masked()?;

    if passphrase.is_empty() {
        reply::reply_cancel(&req.socket)?;
        return Ok(true);
    }

    reply::reply_passphrase(&req.socket, &passphrase)?;
    Ok(true)
}
