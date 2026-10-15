// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Ops wg-portal bring-up via root-owned helper (no bash / no user text on argv).
// Invariants:
// - Conf is typed-parsed and canonicalized before elevation.
// - Linux: pkexec → /usr/libexec/eliteew-wg-portal-helper with fixed subcommands.
// - Windows: stage canonical conf for manual WireGuard GUI import (ops installer).
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-02
// ---

use std::path::{Path, PathBuf};

use serde::Serialize;
use w_transport_core::conf_validate::{
    parse_typed_portal_conf, render_canonical_conf, validate_portal_handoff_conf,
};

/// Packaged helper path (RPM/ops). Dev override: ELITEEW_WG_PORTAL_HELPER.
pub const HELPER_PATH: &str = "/usr/libexec/eliteew-wg-portal-helper";

#[cfg(unix)]
pub const SYSTEM_CONF: &str = "/etc/wireguard/wg-portal.conf";

#[derive(Debug, Clone, Serialize)]
pub struct WgPortalStatus {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub unit_active: bool,
    pub conf_present: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub staged_path: Option<String>,
}

pub fn app_wg_staging_dir(app_data: PathBuf) -> PathBuf {
    app_data.join("wg-portal")
}

fn helper_bin() -> PathBuf {
    if let Ok(p) = std::env::var("ELITEEW_WG_PORTAL_HELPER") {
        let trimmed = p.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }
    PathBuf::from(HELPER_PATH)
}

#[cfg(unix)]
mod unix_impl {
    use super::*;
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use std::process::Command;

    pub fn probe_status() -> WgPortalStatus {
        let conf_present = Path::new(SYSTEM_CONF).is_file();
        if conf_present {
            if let Ok(conf) = fs::read_to_string(SYSTEM_CONF) {
                if let Err(e) = validate_portal_handoff_conf(&conf) {
                    return WgPortalStatus {
                        ok: false,
                        code: e.code.into(),
                        message: format!(
                            "{} — installed conf failed typed check; reinstall handoff",
                            e.message
                        ),
                        unit_active: helper_unit_active(),
                        conf_present: true,
                        staged_path: None,
                    };
                }
            }
        }
        let unit_active = helper_unit_active();
        if unit_active {
            return WgPortalStatus {
                ok: true,
                code: "up".into(),
                message: "wg-portal unit is active; API traffic should use the portal tunnel"
                    .into(),
                unit_active,
                conf_present,
                staged_path: None,
            };
        }
        if conf_present {
            return WgPortalStatus {
                ok: false,
                code: "installed_down".into(),
                message: format!("{SYSTEM_CONF} present but unit inactive — use Bring up"),
                unit_active,
                conf_present,
                staged_path: None,
            };
        }
        WgPortalStatus {
            ok: false,
            code: "missing".into(),
            message: "wg-portal not installed — paste portalctl handoff conf and Install".into(),
            unit_active,
            conf_present,
            staged_path: None,
        }
    }

    pub fn install_handoff_conf(conf: &str, staging_dir: &Path) -> Result<WgPortalStatus, String> {
        let typed = parse_typed_portal_conf(conf)
            .map_err(|e| format!("{}: {}", e.code, e.message))?;
        let canonical = render_canonical_conf(&typed);
        fs::create_dir_all(staging_dir).map_err(|e| format!("staging dir: {e}"))?;
        let staged = staging_dir.join("wg-portal.conf");
        fs::write(&staged, &canonical).map_err(|e| format!("write staged conf: {e}"))?;
        fs::set_permissions(&staged, fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("chmod staged conf: {e}"))?;
        let staged_str = staged
            .to_str()
            .ok_or_else(|| "staged path not utf-8".to_string())?;
        run_helper(&["install", staged_str])?;
        Ok(probe_status())
    }

    pub fn bring_up() -> Result<WgPortalStatus, String> {
        if !Path::new(SYSTEM_CONF).is_file() {
            return Err(format!("missing {SYSTEM_CONF} — Install handoff conf first"));
        }
        let conf = fs::read_to_string(SYSTEM_CONF).map_err(|e| {
            format!("cannot read {SYSTEM_CONF} for typed re-check: {e}")
        })?;
        validate_portal_handoff_conf(&conf).map_err(|e| {
            format!(
                "{}: {} — conf failed typed re-check; reinstall handoff",
                e.code, e.message
            )
        })?;
        run_helper(&["start"])?;
        Ok(probe_status())
    }

    pub fn bring_down() -> Result<WgPortalStatus, String> {
        let _ = run_helper(&["stop"]);
        Ok(probe_status())
    }

    fn helper_unit_active() -> bool {
        // Non-elevated status probe via systemctl (read-only).
        Command::new("systemctl")
            .args(["is-active", "--quiet", "wg-quick@wg-portal.service"])
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }

    fn run_helper(args: &[&str]) -> Result<(), String> {
        let helper = helper_bin();
        if !helper.is_file() {
            return Err(format!(
                "ops helper missing at {} — install eliteew-wg-portal-helper (ops package)",
                helper.display()
            ));
        }
        let mut cmd = Command::new("pkexec");
        cmd.arg(&helper);
        for a in args {
            cmd.arg(a);
        }
        let out = cmd
            .output()
            .map_err(|e| format!("pkexec helper failed to spawn: {e}"))?;
        if out.status.success() {
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&out.stderr);
        let stdout = String::from_utf8_lossy(&out.stdout);
        Err(format!(
            "elevated helper failed: {} {}",
            stderr.trim(),
            stdout.trim()
        ))
    }
}

#[cfg(windows)]
mod windows_impl {
    use super::*;
    use std::fs;

    pub fn probe_status(staging_dir: &Path) -> WgPortalStatus {
        let staged = staging_dir.join("wg-portal.conf");
        let conf_present = staged.is_file();
        let staged_path = conf_present.then(|| staged.display().to_string());
        if conf_present {
            return WgPortalStatus {
                ok: false,
                code: "windows_conf_staged".into(),
                message: format!(
                    "Конфиг сохранён: {} — импортируйте в WireGuard (ops installer) и Activate",
                    staged.display()
                ),
                unit_active: false,
                conf_present: true,
                staged_path,
            };
        }
        WgPortalStatus {
            ok: false,
            code: "windows_manual_wg".into(),
            message: "На Windows ops: сохраните конфиг и импортируйте в WireGuard for Windows"
                .into(),
            unit_active: false,
            conf_present: false,
            staged_path: None,
        }
    }

    pub fn install_handoff_conf(conf: &str, staging_dir: &Path) -> Result<WgPortalStatus, String> {
        let typed = parse_typed_portal_conf(conf)
            .map_err(|e| format!("{}: {}", e.code, e.message))?;
        let canonical = render_canonical_conf(&typed);
        fs::create_dir_all(staging_dir).map_err(|e| format!("staging dir: {e}"))?;
        let staged = staging_dir.join("wg-portal.conf");
        fs::write(&staged, canonical).map_err(|e| format!("write staged conf: {e}"))?;
        Ok(WgPortalStatus {
            ok: false,
            code: "windows_conf_staged".into(),
            message: format!(
                "Конфиг проверен и сохранён: {} — Import tunnel(s) from file в WireGuard",
                staged.display()
            ),
            unit_active: false,
            conf_present: true,
            staged_path: Some(staged.display().to_string()),
        })
    }

    pub fn bring_up() -> Result<WgPortalStatus, String> {
        Err(
            "windows_manual_wg: активируйте туннель в WireGuard for Windows после импорта"
                .into(),
        )
    }

    pub fn bring_down() -> Result<WgPortalStatus, String> {
        Err("windows_manual_wg: отключите туннель в WireGuard for Windows".into())
    }
}

#[cfg(unix)]
pub use unix_impl::{bring_down, bring_up, install_handoff_conf, probe_status};

#[cfg(windows)]
pub use windows_impl::{bring_down, bring_up, install_handoff_conf, probe_status};

#[cfg(not(any(unix, windows)))]
compile_error!("ops portal requires unix or windows");
