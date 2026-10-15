// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Root-owned ops helper for wg-portal: re-validate typed conf, no-follow install,
// systemctl start/stop of a fixed unit. Never executes shell or user text argv.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-02
// ---

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::os::unix::io::AsRawFd;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};

use w_transport_core::conf_validate::{parse_typed_portal_conf, render_canonical_conf};

const IFACE: &str = "wg-portal";
const SYSTEM_CONF: &str = "/etc/wireguard/wg-portal.conf";
const UNIT: &str = "wg-quick@wg-portal.service";
const WG_DIR: &str = "/etc/wireguard";
const MAX_CONF_BYTES: u64 = 16 * 1024;

fn main() -> ExitCode {
    let mut args = std::env::args().skip(1);
    let Some(cmd) = args.next() else {
        eprintln!("usage: eliteew-wg-portal-helper <install <conf>|start|stop|status>");
        return ExitCode::from(2);
    };
    let result = match cmd.as_str() {
        "install" => {
            let Some(path) = args.next() else {
                eprintln!("usage: install <canonical-conf-path>");
                return ExitCode::from(2);
            };
            if args.next().is_some() {
                eprintln!("too many arguments");
                return ExitCode::from(2);
            }
            install_conf(Path::new(&path))
        }
        "start" => {
            if args.next().is_some() {
                eprintln!("too many arguments");
                return ExitCode::from(2);
            }
            systemctl(&["start", UNIT])
        }
        "stop" => {
            if args.next().is_some() {
                eprintln!("too many arguments");
                return ExitCode::from(2);
            }
            systemctl(&["stop", UNIT])
        }
        "status" => {
            if args.next().is_some() {
                eprintln!("too many arguments");
                return ExitCode::from(2);
            }
            status()
        }
        _ => {
            eprintln!("unknown command: {cmd}");
            return ExitCode::from(2);
        }
    };
    match result {
        Ok(msg) => {
            println!("{msg}");
            ExitCode::SUCCESS
        }
        Err(err) => {
            eprintln!("{err}");
            ExitCode::FAILURE
        }
    }
}

fn install_conf(src: &Path) -> Result<String, String> {
    require_root()?;
    if !src.is_absolute() {
        return Err("conf path must be absolute".into());
    }
    // Refuse symlink source (TOCTOU-resistant open).
    let mut opts = OpenOptions::new();
    opts.read(true);
    #[cfg(target_os = "linux")]
    opts.custom_flags(libc::O_NOFOLLOW);
    let mut file = opts
        .open(src)
        .map_err(|e| format!("open source conf: {e}"))?;
    let meta = file.metadata().map_err(|e| format!("stat source: {e}"))?;
    if !meta.is_file() {
        return Err("source is not a regular file".into());
    }
    if meta.len() == 0 || meta.len() > MAX_CONF_BYTES {
        return Err(format!(
            "source conf size {} out of bounds (1..{MAX_CONF_BYTES})",
            meta.len()
        ));
    }
    let mut raw = String::new();
    file.read_to_string(&mut raw)
        .map_err(|e| format!("read source: {e}"))?;
    let typed = parse_typed_portal_conf(&raw).map_err(|e| format!("{}: {}", e.code, e.message))?;
    let canonical = render_canonical_conf(&typed);
    // Re-parse canonical (defense in depth).
    let typed2 =
        parse_typed_portal_conf(&canonical).map_err(|e| format!("canonical recheck {}: {}", e.code, e.message))?;
    if typed2 != typed {
        return Err("canonical recheck mismatch".into());
    }

    ensure_wg_dir()?;
    atomic_write_nofollow(Path::new(SYSTEM_CONF), canonical.as_bytes())?;
    // Fixed unit name only — never user text.
    systemctl(&["enable", UNIT])?;
    systemctl(&["restart", UNIT])?;
    Ok(format!("OK: installed {SYSTEM_CONF} and restarted {UNIT}"))
}

fn status() -> Result<String, String> {
    let active = Command::new("systemctl")
        .args(["is-active", "--quiet", UNIT])
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    let present = Path::new(SYSTEM_CONF).is_file();
    Ok(format!(
        "iface={IFACE} conf_present={present} unit_active={active}"
    ))
}

fn systemctl(args: &[&str]) -> Result<String, String> {
    require_root()?;
    // Ensure no unexpected args: only fixed tokens from this binary.
    for a in args {
        if a.chars().any(|c| !(c.is_ascii_alphanumeric() || c == '@' || c == '-' || c == '.' || c == '_')) {
            return Err("internal: refused systemctl argument".into());
        }
    }
    let out = Command::new("systemctl")
        .args(args)
        .output()
        .map_err(|e| format!("systemctl spawn failed: {e}"))?;
    if out.status.success() {
        return Ok("OK".into());
    }
    Err(format!(
        "systemctl {:?} failed: {}",
        args,
        String::from_utf8_lossy(&out.stderr).trim()
    ))
}

fn require_root() -> Result<(), String> {
    if unsafe { libc::geteuid() } != 0 {
        return Err("helper must run as root (via polkit/pkexec)".into());
    }
    Ok(())
}

fn ensure_wg_dir() -> Result<(), String> {
    let dir = Path::new(WG_DIR);
    if !dir.exists() {
        fs::create_dir_all(dir).map_err(|e| format!("mkdir {WG_DIR}: {e}"))?;
        fs::set_permissions(dir, fs::Permissions::from_mode(0o700))
            .map_err(|e| format!("chmod {WG_DIR}: {e}"))?;
    }
    let meta = fs::symlink_metadata(dir).map_err(|e| format!("stat {WG_DIR}: {e}"))?;
    if meta.file_type().is_symlink() {
        return Err(format!("{WG_DIR} must not be a symlink"));
    }
    if !meta.is_dir() {
        return Err(format!("{WG_DIR} is not a directory"));
    }
    Ok(())
}

fn atomic_write_nofollow(dest: &Path, bytes: &[u8]) -> Result<(), String> {
    let dir = dest
        .parent()
        .ok_or_else(|| "destination has no parent".to_string())?;
    let mut tmp_name = dest
        .file_name()
        .ok_or_else(|| "destination has no file name".to_string())?
        .to_os_string();
    tmp_name.push(".eliteew.tmp");
    let tmp_path = dir.join(tmp_name);

    // Remove stale tmp if present (must not be a symlink).
    if tmp_path.exists() {
        let meta = fs::symlink_metadata(&tmp_path).map_err(|e| format!("stat tmp: {e}"))?;
        if meta.file_type().is_symlink() {
            return Err("refusing to overwrite symlink tmp".into());
        }
        fs::remove_file(&tmp_path).map_err(|e| format!("remove tmp: {e}"))?;
    }

    let mut opts = OpenOptions::new();
    opts.write(true).create_new(true).mode(0o600);
    #[cfg(target_os = "linux")]
    opts.custom_flags(libc::O_NOFOLLOW);
    let mut tmp = opts
        .open(&tmp_path)
        .map_err(|e| format!("create tmp: {e}"))?;
    tmp.write_all(bytes).map_err(|e| format!("write tmp: {e}"))?;
    tmp.sync_all().map_err(|e| format!("fsync tmp: {e}"))?;

    // If destination exists as symlink, refuse.
    if dest.exists() {
        let meta = fs::symlink_metadata(dest).map_err(|e| format!("stat dest: {e}"))?;
        if meta.file_type().is_symlink() {
            let _ = fs::remove_file(&tmp_path);
            return Err("refusing to replace symlink destination".into());
        }
    }
    fs::rename(&tmp_path, dest).map_err(|e| format!("rename into place: {e}"))?;
    // Best-effort sync dir.
    if let Ok(dirf) = File::open(dir) {
        let _ = unsafe { libc::fsync(dirf.as_raw_fd()) };
    }
    let _ = PathBuf::from(dest);
    Ok(())
}
