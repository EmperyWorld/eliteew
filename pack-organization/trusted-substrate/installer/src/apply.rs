// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---

//! Disk discovery + install apply bridge (root helper).
//! Disk list is sourced from `/sys/block` (always present with the block layer).
//! Optional `lsblk` only enriches model/tran — never required for discovery.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::thread;

use crate::logutil;

#[derive(Debug, Clone)]
pub struct DiskInfo {
    pub path: String,
    pub size: String,
    pub model: String,
    pub removable: bool,
    pub serial: String,
    pub firmware: String,
    pub logical_sector: u64,
    pub physical_sector: u64,
    pub rotational: bool,
    pub health: String,
    pub partitions: Vec<String>,
    pub identity: String,
    /// Why this disk cannot be selected (empty = installable).
    pub skip_reason: Option<String>,
}

pub fn list_disks() -> Vec<DiskInfo> {
    let mut disks = Vec::new();
    let Ok(entries) = fs::read_dir("/sys/block") else {
        logutil::error("cannot read /sys/block");
        return disks;
    };
    let live_root = live_root_disk();
    let mounted_prefixes = mounted_block_prefixes();

    for ent in entries.flatten() {
        let name = ent.file_name().to_string_lossy().into_owned();
        if !is_install_candidate_name(&name) {
            continue;
        }
        let sys = ent.path();
        let size_sectors = read_u64(&sys.join("size")).unwrap_or(0);
        // Kernel reports 512-byte sectors in /sys/block/*/size
        let size_b = size_sectors.saturating_mul(512);
        if size_b < 64 * 1024 * 1024 {
            continue;
        }
        let removable = read_u64(&sys.join("removable")).unwrap_or(0) == 1;
        let model = read_trim(&sys.join("device/model"))
            .or_else(|| read_trim(&sys.join("device/name")))
            .unwrap_or_default();
        let tran = transport_hint(&sys, &name);
        let path = format!("/dev/{name}");
        let model_disp = if tran.is_empty() {
            model.clone()
        } else if model.is_empty() {
            tran.clone()
        } else {
            format!("{model} ({tran})")
        };
        let skip_reason = disk_skip_reason(
            &path,
            &name,
            size_b,
            removable,
            &tran,
            live_root.as_deref(),
            &mounted_prefixes,
        );
        if let Some(ref why) = skip_reason {
            logutil::warn(&format!("disk {path} not selectable: {why}"));
        }
        let health = disk_health(&path);
        let partitions = disk_partitions(&sys, &name);
        disks.push(DiskInfo {
            path,
            size: human_bytes(size_b),
            model: model_disp,
            removable,
            serial: read_trim(&sys.join("device/serial")).unwrap_or_else(|| "—".to_string()),
            firmware: read_trim(&sys.join("device/firmware_rev"))
                .or_else(|| read_trim(&sys.join("device/rev")))
                .unwrap_or_else(|| "—".to_string()),
            logical_sector: read_u64(&sys.join("queue/logical_block_size")).unwrap_or(512),
            physical_sector: read_u64(&sys.join("queue/physical_block_size")).unwrap_or(512),
            rotational: read_u64(&sys.join("queue/rotational")).unwrap_or(0) == 1,
            health,
            partitions,
            identity: disk_identity(&sys),
            skip_reason,
        });
    }
    disks.sort_by(|a, b| a.path.cmp(&b.path));
    logutil::info(&format!(
        "disks discovered: {} (selectable {})",
        disks.len(),
        disks.iter().filter(|d| d.skip_reason.is_none()).count()
    ));
    disks
}

fn disk_partitions(sys: &Path, disk_name: &str) -> Vec<String> {
    let Ok(entries) = fs::read_dir(sys) else {
        return Vec::new();
    };
    let mut partitions = entries
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name == disk_name || !name.starts_with(disk_name) || !entry.path().join("partition").is_file() {
                return None;
            }
            let bytes = read_u64(&entry.path().join("size"))
                .unwrap_or(0)
                .saturating_mul(512);
            Some(format!("/dev/{name} · {}", human_bytes(bytes)))
        })
        .collect::<Vec<_>>();
    partitions.sort();
    partitions
}

fn disk_identity(sys: &Path) -> String {
    let dev = read_trim(&sys.join("dev")).unwrap_or_else(|| "unknown".to_string());
    let sectors = read_trim(&sys.join("size")).unwrap_or_else(|| "unknown".to_string());
    let serial = read_trim(&sys.join("device/serial")).unwrap_or_else(|| "none".to_string());
    format!("{dev}|{sectors}|{serial}")
}

fn disk_health(path: &str) -> String {
    let Some(smartctl) = ["/usr/sbin/smartctl", "/usr/bin/smartctl"]
        .into_iter()
        .find(|candidate| Path::new(candidate).is_file())
    else {
        return "SMART unavailable".to_string();
    };
    let Ok(output) = Command::new(smartctl).args(["-H", path]).output() else {
        return "SMART probe failed".to_string();
    };
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    if text.contains("PASSED") || text.contains("OK") {
        "SMART PASSED".to_string()
    } else if text.contains("FAILED") {
        "SMART FAILED".to_string()
    } else {
        "SMART unknown".to_string()
    }
}

fn is_install_candidate_name(name: &str) -> bool {
    if name.starts_with("loop")
        || name.starts_with("ram")
        || name.starts_with("fd")
        || name.starts_with("sr")
        || name.starts_with("dm-")
        || name.starts_with("md")
        || name.starts_with("zram")
    {
        return false;
    }
    name.starts_with("sd")
        || name.starts_with("vd")
        || name.starts_with("hd")
        || (name.starts_with("nvme") && name.contains('n') && !name.contains('p'))
}

fn transport_hint(sys: &Path, name: &str) -> String {
    if let Ok(link) = fs::read_link(sys.join("device")) {
        let s = link.to_string_lossy();
        if s.contains("usb") {
            return "usb".into();
        }
        if s.contains("nvme") || name.starts_with("nvme") {
            return "nvme".into();
        }
        if s.contains("ata") {
            return "sata".into();
        }
    }
    if name.starts_with("nvme") {
        "nvme".into()
    } else if name.starts_with("vd") {
        "virtio".into()
    } else {
        String::new()
    }
}

fn disk_skip_reason(
    path: &str,
    name: &str,
    size_bytes: u64,
    removable: bool,
    _tran: &str,
    live_root: Option<&str>,
    mounted_prefixes: &[String],
) -> Option<String> {
    if let Some(root) = live_root {
        if root == path || root.ends_with(&format!("/{name}")) {
            return Some("это носитель установщика (корневой диск live)".into());
        }
    }
    for pref in mounted_prefixes {
        if device_belongs_to_disk(pref, path) {
            return Some("сейчас смонтирован (живой носитель / уже занят)".into());
        }
    }
    // Metal install targets internal disks only — second USB must not be wipeable.
    if removable {
        return Some("съёмный носитель — установка только на внутренний диск".into());
    }
    if size_bytes < 8 * 1024 * 1024 * 1024 {
        return Some("диск меньше минимальных 8 GiB".into());
    }
    None
}

fn device_belongs_to_disk(mounted: &str, disk: &str) -> bool {
    if mounted == disk {
        return true;
    }
    if disk.starts_with("/dev/nvme") {
        return mounted.starts_with(&(disk.to_string() + "p"));
    }
    // /dev/sda + /dev/sda1
    mounted.starts_with(disk)
        && mounted.len() > disk.len()
        && mounted.as_bytes().get(disk.len()).is_some_and(|c| c.is_ascii_digit())
}

fn live_root_disk() -> Option<String> {
    // Resolve PKNAME of whatever backs /
    let source = Command::new("findmnt")
        .args(["-n", "-o", "SOURCE", "/"])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        })
        .filter(|s| !s.is_empty())
        .or_else(|| {
            // /proc/mounts fallback when findmnt missing
            fs::read_to_string("/proc/mounts").ok().and_then(|t| {
                for line in t.lines() {
                    let mut parts = line.split_whitespace();
                    let src = parts.next().unwrap_or("");
                    let dst = parts.next().unwrap_or("");
                    if dst == "/" && src.starts_with("/dev/") {
                        return Some(src.to_string());
                    }
                }
                None
            })
        })?;

    if let Ok(o) = Command::new("lsblk")
        .args(["-no", "PKNAME", &source])
        .output()
    {
        if o.status.success() {
            let pk = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if !pk.is_empty() {
                return Some(format!("/dev/{pk}"));
            }
        }
    }
    // Heuristic without lsblk: strip partition suffix
    Some(strip_partition_suffix(&source))
}

fn strip_partition_suffix(dev: &str) -> String {
    if let Some(rest) = dev.strip_prefix("/dev/nvme") {
        if let Some(idx) = rest.rfind('p') {
            // nvme0n1p3 → nvme0n1
            return format!("/dev/nvme{}", &rest[..idx]);
        }
        return dev.to_string();
    }
    // sda3 / vda2
    let bytes = dev.as_bytes();
    let mut end = bytes.len();
    while end > 0 && bytes[end - 1].is_ascii_digit() {
        end -= 1;
    }
    if end < bytes.len() && end > "/dev/sd".len() {
        return dev[..end].to_string();
    }
    dev.to_string()
}

fn mounted_block_prefixes() -> Vec<String> {
    let mut out = Vec::new();
    if let Ok(t) = fs::read_to_string("/proc/mounts") {
        for line in t.lines() {
            let src = line.split_whitespace().next().unwrap_or("");
            if src.starts_with("/dev/") {
                out.push(src.to_string());
            }
        }
    }
    out
}

fn read_u64(path: &Path) -> Option<u64> {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| s.trim().parse().ok())
}

fn read_trim(path: &Path) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn human_bytes(n: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;
    const TB: f64 = GB * 1024.0;
    let x = n as f64;
    if x >= TB {
        format!("{:.1} TiB", x / TB)
    } else if x >= GB {
        format!("{:.1} GiB", x / GB)
    } else if x >= MB {
        format!("{:.0} MiB", x / MB)
    } else {
        format!("{n} B")
    }
}

pub enum ApplyEvent {
    Line(String),
    Done(Result<(), String>),
}

fn helper_command(helper: &str) -> Command {
    if is_root_uid() {
        Command::new(helper)
    } else {
        let mut c = Command::new("sudo");
        c.arg("-n").arg(helper);
        c
    }
}

pub(crate) fn installer_helper_command() -> Command {
    let helper = std::env::var("ELITEEW_TS_INSTALL_APPLY")
        .unwrap_or_else(|_| "/usr/local/bin/eliteew-ts-install-apply".into());
    helper_command(&helper)
}

fn is_root_uid() -> bool {
    if let Ok(s) = std::fs::read_to_string("/proc/self/status") {
        for line in s.lines() {
            if let Some(rest) = line.strip_prefix("Uid:") {
                let uid = rest.split_whitespace().next().unwrap_or("1");
                return uid == "0";
            }
        }
    }
    false
}

/// Run helper and return combined stderr/stdout on failure (sudo ownership, etc.).
pub fn run_helper_capture(helper: &str, args: &[&str]) -> Result<(), String> {
    let output = helper_command(helper)
        .args(args)
        .output()
        .map_err(|e| format!("не удалось запустить {helper}: {e}"))?;
    if output.status.success() {
        return Ok(());
    }
    let err = String::from_utf8_lossy(&output.stderr);
    let out = String::from_utf8_lossy(&output.stdout);
    let detail = format!("{err}{out}").trim().to_string();
    if detail.is_empty() {
        Err(format!("{helper} завершился с кодом {}", output.status))
    } else {
        Err(format!("{helper}: {detail}"))
    }
}

pub fn start_apply(disk: &DiskInfo, commit: bool) -> Receiver<ApplyEvent> {
    let (tx, rx) = mpsc::channel();
    let disk_path = disk.path.clone();
    let disk_identity = disk.identity.clone();
    let helper = std::env::var("ELITEEW_TS_INSTALL_APPLY")
        .unwrap_or_else(|_| "/usr/local/bin/eliteew-ts-install-apply".into());
    thread::spawn(move || {
        let mut args = vec![
            "disk-install".to_string(),
            "--disk".into(),
            disk_path.clone(),
            "--expected-identity".into(),
            disk_identity,
        ];
        if commit {
            args.push("--commit".into());
        } else {
            args.push("--dry-run".into());
        }
        logutil::info(&format!("apply start: {helper} {}", args.join(" ")));
        let child = helper_command(&helper)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();
        let mut child = match child {
            Ok(c) => c,
            Err(e) => {
                let _ = tx.send(ApplyEvent::Done(Err(format!("spawn {helper}: {e}"))));
                return;
            }
        };
        use std::io::{BufRead, BufReader};
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let tx_err = tx.clone();
        let err_thread = thread::spawn(move || {
            if let Some(err) = stderr {
                for line in BufReader::new(err).lines().flatten() {
                    logutil::info(&format!("apply.err: {line}"));
                    let _ = tx_err.send(ApplyEvent::Line(format!("stderr: {line}")));
                }
            }
        });
        if let Some(out) = stdout {
            for line in BufReader::new(out).lines().flatten() {
                logutil::info(&format!("apply: {line}"));
                let _ = tx.send(ApplyEvent::Line(line));
            }
        }
        let _ = err_thread.join();
        let status = child.wait();
        match status {
            Ok(s) if s.success() => {
                let _ = tx.send(ApplyEvent::Done(Ok(())));
            }
            Ok(s) => {
                let _ = tx.send(ApplyEvent::Done(Err(format!("apply exit {s}"))));
            }
            Err(e) => {
                let _ = tx.send(ApplyEvent::Done(Err(format!("wait: {e}"))));
            }
        }
    });
    rx
}

fn reveal_helper(arg: &str) -> Result<String, String> {
    let helper = std::env::var("ELITEEW_TS_INSTALL_APPLY")
        .unwrap_or_else(|_| "/usr/local/bin/eliteew-ts-install-apply".into());
    let output = helper_command(&helper)
        .arg(arg)
        .output()
        .map_err(|e| format!("не удалось прочитать {arg}: {e}"))?;
    if !output.status.success() {
        return Err(format!("{arg} was not revealed"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Plaintext PIN lives only on the live installer session. Never log it.
/// Root helper reads the file; the GUI process is uid 105 and cannot.
pub fn read_first_boot_pin() -> Result<String, String> {
    let pin = reveal_helper("pin-reveal")?;
    if pin.len() == 4 && pin.chars().all(|c| c.is_ascii_digit()) {
        Ok(pin)
    } else {
        Err("first-boot PIN reveal is malformed".to_string())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StateRecoveryMode {
    Auto,
    User,
}

pub fn is_auto_state_recovery(recovery: &str) -> bool {
    recovery.len() == 39
        && recovery.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
        && recovery.split('-').count() == 8
        && recovery.split('-').all(|g| g.len() == 4)
}

pub fn validate_user_state_secret(secret: &str) -> Result<(), String> {
    let secret = secret.trim();
    if !(12..=128).contains(&secret.chars().count()) {
        return Err("Ключ диска: 12–128 символов".to_string());
    }
    if secret.chars().any(|c| c.is_control()) {
        return Err("Ключ диска не должен содержать управляющие символы".to_string());
    }
    if secret.chars().all(|c| c.is_ascii_digit()) && secret.len() <= 8 {
        return Err("PIN не может быть ключом диска".to_string());
    }
    Ok(())
}

pub fn stage_state_recovery(mode: StateRecoveryMode, secret: &str) -> Result<(), String> {
    let mut command = installer_helper_command();
    command
        .arg("state-recovery-stage")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|error| format!("не удалось записать выбор ключа диска: {error}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "не удалось открыть канал ключа диска".to_string())?;
    match mode {
        StateRecoveryMode::Auto => {
            stdin
                .write_all(b"auto\n")
                .map_err(|error| format!("не удалось передать режим ключа: {error}"))?;
        }
        StateRecoveryMode::User => {
            validate_user_state_secret(secret)?;
            stdin
                .write_all(format!("user\n{}\n", secret.trim()).as_bytes())
                .map_err(|error| format!("не удалось передать ключ диска: {error}"))?;
        }
    }
    drop(stdin);
    let output = child
        .wait_with_output()
        .map_err(|error| format!("не удалось дождаться записи ключа диска: {error}"))?;
    if output.status.success() {
        logutil::info(&format!(
            "state recovery staged mode={}",
            match mode {
                StateRecoveryMode::Auto => "auto",
                StateRecoveryMode::User => "user",
            }
        ));
        return Ok(());
    }
    let detail = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stderr),
        String::from_utf8_lossy(&output.stdout)
    )
    .trim()
    .to_string();
    if detail.is_empty() {
        Err("state-recovery-stage завершился с ошибкой".to_string())
    } else {
        Err(detail)
    }
}

/// LUKS2 recovery for the state slot. Not the PIN. Live session only.
pub fn read_state_recovery() -> Result<String, String> {
    let recovery = reveal_helper("recovery-reveal")?;
    if is_auto_state_recovery(&recovery) || validate_user_state_secret(&recovery).is_ok() {
        Ok(recovery)
    } else {
        Err("state recovery reveal is malformed".to_string())
    }
}

pub fn reboot_now() {
    logutil::info("ordered reboot: stop compositor then hand off to session");
    // Session (eliteew-ts-installer-session) watches this flag after labwc exits,
    // runs sync + apply reboot. Do NOT systemctl reboot while labwc still holds DRM.
    let runtime = std::env::var_os("XDG_RUNTIME_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/tmp"));
    let flag = runtime.join("eliteew-ts-reboot-requested");
    if let Err(e) = fs::write(&flag, b"1\n") {
        logutil::error(&format!("cannot write reboot flag {}: {e}", flag.display()));
    }
    // Ask labwc to exit cleanly (releases DRM/libseat). Fallback: TERM by name.
    let exit_status = Command::new("labwc").arg("--exit").status();
    match exit_status {
        Ok(s) if s.success() => logutil::info("labwc --exit ok"),
        Ok(s) => logutil::warn(&format!("labwc --exit status {s}; sending SIGTERM")),
        Err(e) => logutil::warn(&format!("labwc --exit spawn failed ({e}); sending SIGTERM")),
    }
    let _ = Command::new("pkill").args(["-TERM", "-x", "labwc"]).status();
    // Exit GUI process; autostart/session will observe flag after compositor dies.
    std::process::exit(0);
}

#[cfg(test)]
mod tests {
    use super::strip_partition_suffix;

    #[test]
    fn strip_sda_partition() {
        assert_eq!(strip_partition_suffix("/dev/sda3"), "/dev/sda");
    }

    #[test]
    fn strip_nvme_partition() {
        assert_eq!(strip_partition_suffix("/dev/nvme0n1p2"), "/dev/nvme0n1");
    }

    #[test]
    fn user_state_secret_rejects_pin_and_accepts_passphrase() {
        assert!(super::validate_user_state_secret("1234").is_err());
        assert!(super::validate_user_state_secret("0000").is_err());
        assert!(super::validate_user_state_secret("short").is_err());
        assert!(super::validate_user_state_secret("operator-disk-key-ok").is_ok());
        assert!(super::is_auto_state_recovery(
            "aaaa-bbbb-cccc-dddd-eeee-ffff-0000-1111"
        ));
        assert!(!super::is_auto_state_recovery("operator-disk-key-ok"));
    }
}
