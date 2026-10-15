use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AskRequest {
    pub id: String,
    pub message: String,
    pub pid: Option<u32>,
    pub socket: String,
    pub echo: bool,
    pub silent: bool,
    pub not_after_us: u64,
}

pub fn parse_ask_file(content: &str) -> Option<AskRequest> {
    let mut section: Option<&str> = None;
    let mut fields: HashMap<String, String> = HashMap::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with(';') {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            section = Some(&line[1..line.len() - 1]);
            continue;
        }
        if section != Some("Ask") {
            continue;
        }
        let (key, value) = line.split_once('=')?;
        fields.insert(key.trim().to_string(), value.trim().to_string());
    }

    let id = fields.get("Id")?.clone();
    let message = fields.get("Message").cloned().unwrap_or_default();
    let socket = fields.get("Socket")?.clone();
    let pid = fields
        .get("PID")
        .and_then(|raw| raw.parse::<u32>().ok());
    let echo = fields
        .get("Echo")
        .map(|v| v != "0")
        .unwrap_or(false);
    let silent = fields.get("Silent").map(|v| v == "1").unwrap_or(false);
    let not_after_us = fields
        .get("NotAfter")
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(0);

    Some(AskRequest {
        id,
        message,
        pid,
        socket,
        echo,
        silent,
        not_after_us,
    })
}

pub fn is_expired(req: &AskRequest) -> bool {
    if req.not_after_us == 0 {
        return false;
    }
    monotonic_now_us() > req.not_after_us
}

fn monotonic_now_us() -> u64 {
    let mut ts = libc::timespec {
        tv_sec: 0,
        tv_nsec: 0,
    };
    // SAFETY: ts is valid; CLOCK_MONOTONIC is defined on Linux.
    unsafe {
        libc::clock_gettime(libc::CLOCK_MONOTONIC, &mut ts);
    }
    (ts.tv_sec as u64)
        .saturating_mul(1_000_000)
        .saturating_add((ts.tv_nsec / 1000) as u64)
}

pub fn pid_dead(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    unsafe { libc::kill(pid as i32, 0) != 0 }
}

pub fn read_ask_path(path: &Path) -> Option<AskRequest> {
    let content = std::fs::read_to_string(path).ok()?;
    parse_ask_file(&content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_cryptsetup_ask() {
        let ini = r#"
[Ask]
Id=cryptsetup:empiieros-state
Message=Please enter passphrase for disk empiieros-state
PID=1234
Socket=/run/systemd/ask-password/sck.abc
Echo=0
NotAfter=0
"#;
        let req = parse_ask_file(ini).expect("parse");
        assert!(req.id.starts_with("cryptsetup:"));
        assert!(req.message.contains("empiieros-state"));
        assert_eq!(req.socket, "/run/systemd/ask-password/sck.abc");
        assert!(!req.echo);
    }

    #[test]
    fn ignores_unknown_ini_keys() {
        let ini = r#"
[Ask]
Id=cryptsetup:UUID=deadbeef
FutureKey=ignored
Socket=/run/systemd/ask-password/sck.x
"#;
        assert!(parse_ask_file(ini).is_some());
    }
}
