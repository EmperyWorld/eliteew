// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---

//! Optional install chime via `aplay` (ALSA utils). Best-effort — never blocks install.

use std::path::PathBuf;
use std::process::Command;

use crate::logutil;

pub fn chime_path() -> PathBuf {
    if let Some(p) = std::env::var_os("ELITEEW_TS_INSTALL_CHIME") {
        return PathBuf::from(p);
    }
    let candidates = [
        "/usr/local/share/eliteew-ts-installer/chime.wav",
        "/usr/share/eliteew-ts-installer/chime.wav",
    ];
    for c in candidates {
        let p = PathBuf::from(c);
        if p.is_file() {
            return p;
        }
    }
    // Dev tree relative to binary / CARGO_MANIFEST_DIR
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/chime.wav")
}

pub fn play_chime() {
    let path = chime_path();
    if !path.is_file() {
        logutil::warn(&format!("chime missing at {}", path.display()));
        return;
    }
    // Bounded wait: serialize vs session power-on without freezing UI forever on hung ALSA.
    match Command::new("aplay").args(["-q"]).arg(&path).spawn() {
        Ok(mut child) => {
            for _ in 0..25 {
                match child.try_wait() {
                    Ok(Some(st)) if st.success() => {
                        logutil::info(&format!("chime ok {}", path.display()));
                        return;
                    }
                    Ok(Some(st)) => {
                        logutil::warn(&format!("aplay exit {st}; continuing"));
                        return;
                    }
                    Ok(None) => std::thread::sleep(std::time::Duration::from_millis(100)),
                    Err(e) => {
                        logutil::warn(&format!("aplay wait ({e}); continuing"));
                        return;
                    }
                }
            }
            let _ = child.kill();
            let _ = child.wait();
            logutil::warn("aplay hung >2.5s; killed");
        }
        Err(e) => logutil::warn(&format!("aplay unavailable ({e}); continuing silent")),
    }
}
