// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Local device identity for license redeem/prove (stable pubkey + hardware fingerprint).
// Invariants:
// - Identity persists under app data; fingerprint is live hardware hash (fp_v2).
// - Stored v1 `fp_` identities keep pubkey; fingerprint refreshes to v2 when unbound.
// Related:
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §device bind
// - crate::device_bind
// ---

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceIdentity {
    pub device_pubkey: String,
    pub machine_fingerprint: String,
}

pub fn load_or_create(app_data: &PathBuf) -> Result<DeviceIdentity, String> {
    fs::create_dir_all(app_data).map_err(|e| format!("app data: {e}"))?;
    let path = app_data.join("device_identity.json");
    let live = machine_fingerprint_v2();
    if path.is_file() {
        let raw = fs::read_to_string(&path).map_err(|e| format!("read identity: {e}"))?;
        let mut parsed: DeviceIdentity =
            serde_json::from_str(&raw).map_err(|e| format!("parse identity: {e}"))?;
        if parsed.device_pubkey.len() >= 16 && parsed.machine_fingerprint.len() >= 8 {
            // Refresh soft v1 → v2 when no hardware bind yet (upgrade path).
            let bound = crate::device_bind::load(app_data).ok().flatten();
            if bound.is_none() && parsed.machine_fingerprint != live {
                parsed.machine_fingerprint = live.clone();
                let _ = persist_identity(&path, &parsed);
            }
            return Ok(parsed);
        }
    }
    let identity = DeviceIdentity {
        device_pubkey: format!("dc1_{}", random_hex(32)),
        machine_fingerprint: live,
    };
    persist_identity(&path, &identity)?;
    Ok(identity)
}

/// Live hardware fingerprint (always recomputed — not only from disk).
pub fn current_machine_fingerprint() -> String {
    machine_fingerprint_v2()
}

/// Legacy v1 fingerprint (hostname + machine-id) for bind migration matches.
pub fn machine_fingerprint_v1() -> String {
    let host = hostname_fallback();
    let machine_id = read_machine_id();
    let mut hasher = Sha256::new();
    hasher.update(b"eliteew-desktop-client|");
    hasher.update(host.as_bytes());
    hasher.update(b"|");
    hasher.update(machine_id.as_bytes());
    let digest = hasher.finalize();
    format!("fp_{}", hex::encode(&digest[..16]))
}

fn persist_identity(path: &Path, identity: &DeviceIdentity) -> Result<(), String> {
    let json = serde_json::to_string_pretty(identity).map_err(|e| e.to_string())?;
    let mut f = fs::File::create(path).map_err(|e| format!("create identity: {e}"))?;
    f.write_all(json.as_bytes())
        .map_err(|e| format!("write identity: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

fn random_hex(nbytes: usize) -> String {
    let mut buf = vec![0u8; nbytes];
    getrandom::fill(&mut buf).expect("getrandom");
    buf.iter().map(|b| format!("{b:02x}")).collect()
}

fn machine_fingerprint_v2() -> String {
    let host = hostname_fallback();
    let machine_id = read_machine_id();
    let hw = hardware_uuid();
    let mut hasher = Sha256::new();
    hasher.update(b"eliteew-desktop-client|v2|");
    hasher.update(host.as_bytes());
    hasher.update(b"|");
    hasher.update(machine_id.as_bytes());
    hasher.update(b"|");
    hasher.update(hw.as_bytes());
    let digest = hasher.finalize();
    format!("fp_v2_{}", hex::encode(&digest[..16]))
}

fn hardware_uuid() -> String {
    #[cfg(unix)]
    {
        for candidate in [
            "/sys/class/dmi/id/product_uuid",
            "/sys/class/dmi/id/board_serial",
            "/sys/class/dmi/id/product_serial",
        ] {
            if let Ok(raw) = fs::read_to_string(candidate) {
                let t = raw.trim().to_string();
                if !t.is_empty()
                    && !t.eq_ignore_ascii_case("none")
                    && !t.eq_ignore_ascii_case("unknown")
                    && !t.eq_ignore_ascii_case("to be filled by o.e.m.")
                {
                    return t;
                }
            }
        }
        return "no-hw-uuid".into();
    }
    #[cfg(windows)]
    {
        if let Some(g) = read_windows_machine_guid() {
            return g;
        }
        return "no-hw-uuid".into();
    }
    #[cfg(not(any(unix, windows)))]
    {
        "no-hw-uuid".into()
    }
}

#[cfg(windows)]
fn read_windows_machine_guid() -> Option<String> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key = hklm
        .open_subkey(r"SOFTWARE\Microsoft\Cryptography")
        .ok()?;
    let guid: String = key.get_value("MachineGuid").ok()?;
    let t = guid.trim().to_string();
    if t.is_empty() {
        None
    } else {
        Some(t)
    }
}

fn read_machine_id() -> String {
    #[cfg(unix)]
    {
        return fs::read_to_string("/etc/machine-id")
            .unwrap_or_else(|_| "no-machine-id".into())
            .trim()
            .to_string();
    }
    #[cfg(windows)]
    {
        if let Some(g) = read_windows_machine_guid() {
            return g;
        }
        return std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("USERNAME"))
            .unwrap_or_else(|_| "no-machine-id".into());
    }
    #[cfg(not(any(unix, windows)))]
    {
        "no-machine-id".into()
    }
}

fn hostname_fallback() -> String {
    #[cfg(unix)]
    {
        if let Some(h) = fs::read_to_string("/etc/hostname")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
        {
            return h;
        }
    }
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "unknown-host".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fingerprint_v2_prefix() {
        let fp = machine_fingerprint_v2();
        assert!(fp.starts_with("fp_v2_"), "got {fp}");
        assert!(fp.len() > 10);
    }

    #[test]
    fn fingerprint_v1_prefix() {
        let fp = machine_fingerprint_v1();
        assert!(fp.starts_with("fp_"), "got {fp}");
        assert!(!fp.starts_with("fp_v2_"));
    }
}
