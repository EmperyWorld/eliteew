use std::io::Write;
use std::os::unix::net::UnixDatagram;
use std::path::Path;
use std::process::{Command, Stdio};

const REPLY_CANDIDATES: &[&str] = &[
    "/usr/lib/systemd/systemd-reply-password",
    "/lib/systemd/systemd-reply-password",
    "/usr/bin/systemd-reply-password",
];

pub fn reply_passphrase(socket: &str, passphrase: &str) -> std::io::Result<()> {
    if let Some(bin) = REPLY_CANDIDATES.iter().find(|p| Path::new(p).is_file()) {
        let mut child = Command::new(bin)
            .arg("1")
            .arg(socket)
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(passphrase.as_bytes())?;
        }
        let status = child.wait()?;
        if status.success() {
            return Ok(());
        }
    }
    send_datagram(socket, format!("+{passphrase}"))
}

pub fn reply_cancel(socket: &str) -> std::io::Result<()> {
    if let Some(bin) = REPLY_CANDIDATES.iter().find(|p| Path::new(p).is_file()) {
        let status = Command::new(bin)
            .arg("0")
            .arg(socket)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()?;
        if status.success() {
            return Ok(());
        }
    }
    send_datagram(socket, "-".to_string())
}

fn send_datagram(socket: &str, payload: String) -> std::io::Result<()> {
    let sock = UnixDatagram::unbound()?;
    sock.send_to(payload.as_bytes(), socket)?;
    Ok(())
}
