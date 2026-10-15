// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Local hardware bind for seat/license + sealed peer (bind-at-first-import).
// Invariants:
// - First successful bind stamps fingerprint; later mismatch is fail-closed.
// - Bound value is authoritative for upgrades (v1→v2): match saved, not rehash.
// - Schema is validated and state replacement is atomic with 0600 Unix permissions.
// Related:
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §device bind
// - crate::device_identity
// ---

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tempfile::NamedTempFile;

use crate::device_identity;

pub const BIND_REL_PATH: &str = "device_bind.v1.json";
pub const SCHEMA: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceBind {
    pub schema_version: u32,
    pub license_id: String,
    pub machine_fingerprint: String,
    pub bound_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BindAssert {
    Unbound,
    Matched,
    Mismatch,
}

pub fn bind_path(app_data: &Path) -> PathBuf {
    app_data.join(BIND_REL_PATH)
}

pub fn load(app_data: &Path) -> Result<Option<DeviceBind>, String> {
    let path = bind_path(app_data);
    if !path.is_file() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("read_device_bind: {e}"))?;
    let parsed: DeviceBind =
        serde_json::from_str(&raw).map_err(|e| format!("parse_device_bind: {e}"))?;
    validate(&parsed)?;
    Ok(Some(parsed))
}

pub fn clear(app_data: &Path) -> Result<(), String> {
    let path = bind_path(app_data);
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("clear_device_bind: {e}")),
    }
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn persist(app_data: &Path, bind: &DeviceBind) -> Result<(), String> {
    validate(bind)?;
    fs::create_dir_all(app_data).map_err(|e| format!("app data: {e}"))?;
    let path = bind_path(app_data);
    let json = serde_json::to_string_pretty(bind).map_err(|e| e.to_string())?;
    let mut temp = NamedTempFile::new_in(app_data)
        .map_err(|e| format!("create_device_bind_temp: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(temp.path(), fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("chmod_device_bind_temp: {e}"))?;
    }
    temp.write_all(json.as_bytes())
        .map_err(|e| format!("write_device_bind: {e}"))?;
    temp.flush()
        .map_err(|e| format!("flush_device_bind: {e}"))?;
    temp.as_file()
        .sync_all()
        .map_err(|e| format!("sync_device_bind: {e}"))?;
    temp.persist(&path)
        .map_err(|e| format!("replace_device_bind: {}", e.error))?;
    #[cfg(unix)]
    {
        fs::File::open(app_data)
            .and_then(|directory| directory.sync_all())
            .map_err(|e| format!("sync_device_bind_dir: {e}"))?;
    }
    Ok(())
}

fn validate(bind: &DeviceBind) -> Result<(), String> {
    if bind.schema_version != SCHEMA {
        return Err(format!(
            "device_bind_schema_unsupported: {}",
            bind.schema_version
        ));
    }
    if bind.license_id.trim().is_empty() || bind.machine_fingerprint.trim().is_empty() {
        return Err("device_bind_shape_invalid".into());
    }
    Ok(())
}

/// True when local live fingerprint matches the bound value (incl. v1 migration).
pub fn fingerprint_matches_bound(bound_fp: &str) -> bool {
    let bound = bound_fp.trim();
    if bound.is_empty() {
        return false;
    }
    let live = device_identity::current_machine_fingerprint();
    if live == bound {
        return true;
    }
    // Upgrade seat: bind stamped with v1 before fp_v2 existed.
    if bound.starts_with("fp_") && !bound.starts_with("fp_v2_") {
        return device_identity::machine_fingerprint_v1() == bound;
    }
    false
}

pub fn assert_local(app_data: &Path) -> Result<BindAssert, String> {
    match load(app_data)? {
        None => Ok(BindAssert::Unbound),
        Some(b) if fingerprint_matches_bound(&b.machine_fingerprint) => Ok(BindAssert::Matched),
        Some(_) => Ok(BindAssert::Mismatch),
    }
}

/// Bind-at-first-import: create bind with live fp, or require match.
pub fn ensure_bind(app_data: &Path, license_id: &str) -> Result<DeviceBind, String> {
    let lid = license_id.trim();
    if lid.is_empty() {
        return Err("license_id_required".into());
    }
    let live = device_identity::current_machine_fingerprint();
    match load(app_data)? {
        None => {
            let bind = DeviceBind {
                schema_version: SCHEMA,
                license_id: lid.to_string(),
                machine_fingerprint: live,
                bound_at: now_unix(),
            };
            persist(app_data, &bind)?;
            Ok(bind)
        }
        Some(existing) => {
            if !fingerprint_matches_bound(&existing.machine_fingerprint) {
                return Err("fingerprint_mismatch".into());
            }
            // Same device — allow license_id refresh if empty mismatch only when same fp.
            if existing.license_id != lid {
                let mut next = existing.clone();
                next.license_id = lid.to_string();
                persist(app_data, &next)?;
                return Ok(next);
            }
            Ok(existing)
        }
    }
}

/// First boot after upgrade with legacy peer but no bind file → stamp current device.
pub fn bind_legacy_peer_if_needed(app_data: &Path, license_id: Option<&str>) -> Result<(), String> {
    if load(app_data)?.is_some() {
        return Ok(());
    }
    let lid = license_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("legacy");
    let _ = ensure_bind(app_data, lid)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn bind_at_first_then_mismatch() {
        let dir = env::temp_dir().join(format!(
            "eliteew-bind-test-{}-{}",
            std::process::id(),
            now_unix()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let b = ensure_bind(&dir, "lic-1").unwrap();
        assert!(!b.machine_fingerprint.is_empty());
        assert_eq!(assert_local(&dir).unwrap(), BindAssert::Matched);
        // Corrupt bind fingerprint → mismatch
        let mut bad = b.clone();
        bad.machine_fingerprint = "fp_v2_deadbeefdeadbeef".into();
        persist(&dir, &bad).unwrap();
        assert_eq!(assert_local(&dir).unwrap(), BindAssert::Mismatch);
        assert!(ensure_bind(&dir, "lic-1").is_err());
        clear(&dir).unwrap();
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn unsupported_schema_fails_closed() {
        let dir = env::temp_dir().join(format!(
            "eliteew-bind-schema-test-{}-{}",
            std::process::id(),
            now_unix()
        ));
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            bind_path(&dir),
            r#"{"schema_version":2,"license_id":"lic-1","machine_fingerprint":"fp_v2_x","bound_at":1}"#,
        )
        .unwrap();
        assert!(load(&dir)
            .unwrap_err()
            .contains("device_bind_schema_unsupported"));
        let _ = fs::remove_dir_all(&dir);
    }
}
