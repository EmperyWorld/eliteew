// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Extract allowlisted Desktop Client binary from a verified OTA RPM without rpm(8).
// Trusted Substrate bake uses the same rpm2cpio|cpio shape on the factory host;
// metal has no rpm/dnf — OTA must extract in userspace then elevate install only.
// Invariants:
// - Callers must already verify VerifiedUpdatePlan (minisign + sha256 + package_id).
// - Binary name allowlist matches bake-desktop-client-into-target.sh.
// Related:
// - commands/updater_recovery.rs
// - pack-organization/trusted-substrate/scripts/bake-desktop-client-into-target.sh
// ---

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tempfile::{Builder, TempDir};

const RPM2CPIO_SH: &str = include_str!("../../packaging/ota/rpm2cpio.sh");

const BINARY_NAMES: &[&str] = &[
    "eliteew-desktop-client",
    "desktop-client",
    "eliteew-fofline",
];

/// Host can elevate via Polkit and install with the system package manager.
pub fn linux_pkexec_pkg_available() -> bool {
    which_ok("pkexec") && (which_ok("dnf") || which_ok("rpm"))
}

/// Host can run passwordless sudo (Trusted Substrate `%wheel NOPASSWD`).
pub fn linux_sudo_n_available() -> bool {
    Command::new("sudo")
        .args(["-n", "true"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn which_ok(bin: &str) -> bool {
    Command::new("sh")
        .args(["-c", &format!("command -v {bin} >/dev/null 2>&1")])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Extract OTA RPM into a temp dir; return (tempdir, path to allowlisted binary).
pub fn extract_desktop_client_binary(rpm_path: &Path) -> Result<(TempDir, PathBuf), String> {
    if !rpm_path.is_file() {
        return Err("rpm path missing".into());
    }
    for tool in ["cpio", "dd", "sh"] {
        if !which_ok(tool) {
            return Err(format!("missing tool for rpm extract: {tool}"));
        }
    }

    let work = Builder::new()
        .prefix("eliteew-ota-rpm-")
        .tempdir()
        .map_err(|e| format!("ota extract tempdir: {e}"))?;

    let script_path = work.path().join("rpm2cpio.sh");
    fs::write(&script_path, RPM2CPIO_SH).map_err(|e| format!("write rpm2cpio: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path)
            .map_err(|e| format!("rpm2cpio meta: {e}"))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&script_path, perms).map_err(|e| format!("rpm2cpio chmod: {e}"))?;
    }

    let extract_root = work.path().join("root");
    fs::create_dir_all(&extract_root).map_err(|e| format!("extract root: {e}"))?;

    let script_s = script_path
        .to_str()
        .ok_or_else(|| "rpm2cpio path not utf-8".to_string())?;
    let rpm_s = rpm_path
        .to_str()
        .ok_or_else(|| "rpm path not utf-8".to_string())?;
    let root_s = extract_root
        .to_str()
        .ok_or_else(|| "extract root not utf-8".to_string())?;

    let status = Command::new("sh")
        .args([
            "-c",
            "cd \"$3\" && \"$1\" \"$2\" | cpio -idmu --quiet",
            "eliteew-rpm-extract",
            script_s,
            rpm_s,
            root_s,
        ])
        .status()
        .map_err(|e| format!("rpm extract spawn: {e}"))?;
    if !status.success() {
        return Err(format!("rpm2cpio|cpio failed status={status}"));
    }

    let bin = find_allowlisted_binary(&extract_root)
        .ok_or_else(|| "RPM payload missing eliteew-desktop-client binary".to_string())?;
    Ok((work, bin))
}

fn find_allowlisted_binary(root: &Path) -> Option<PathBuf> {
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = fs::read_dir(&dir).ok()?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            let name = path.file_name()?.to_string_lossy();
            if BINARY_NAMES.iter().any(|n| *n == name) {
                return Some(path);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn binary_names_match_bake_contract() {
        assert!(BINARY_NAMES.contains(&"eliteew-desktop-client"));
        assert!(BINARY_NAMES.contains(&"eliteew-fofline"));
    }

    #[test]
    fn extract_real_ota_rpm_when_present() {
        let mut candidates: Vec<PathBuf> = Vec::new();
        candidates.push(
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(
                "../../../docker/data/desktop-client-updates/artifacts/EliteEW_Desktop_Client-0.5.24-1.x86_64.rpm",
            ),
        );
        let rpm = candidates.into_iter().find(|p| p.is_file());
        let Some(rpm) = rpm else {
            eprintln!("skip extract_real_ota_rpm_when_present: RPM fixture absent");
            return;
        };
        let (_dir, bin) = extract_desktop_client_binary(&rpm).expect("extract");
        assert_eq!(
            bin.file_name().and_then(|s| s.to_str()),
            Some("eliteew-desktop-client")
        );
        assert!(bin.metadata().map(|m| m.len() > 1_000_000).unwrap_or(false));
    }
}
