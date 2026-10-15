// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Wave 7 / F-11 — opaque TTL file grants (relative under Import/staging).
// Invariants:
// - JS never passes absolute host paths for privileged ops; only grant ids.
// - Grants expire; consume re-validates path under allowlisted roots.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §Wave 7
// ---

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use crate::fs_bridge::{self, FsBridgeError};
use crate::resource_policy::{FILE_GRANT_MAX_ACTIVE, FILE_GRANT_TTL_SECS};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileGrantPurpose {
    EntitlementImport,
    AudioPlay,
    FsRead,
}

#[derive(Debug, Clone)]
struct GrantRecord {
    purpose: FileGrantPurpose,
    /// Relative path under the chosen root (never absolute).
    relative: String,
    root_kind: GrantRoot,
    expires_at: Instant,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GrantRoot {
    Import,
    Staging,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FileGrantView {
    pub grant_id: String,
    pub purpose: String,
    pub expires_in_secs: u64,
}

struct GrantStore {
    map: HashMap<String, GrantRecord>,
}

fn store() -> &'static Mutex<GrantStore> {
    static STORE: OnceLock<Mutex<GrantStore>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(GrantStore { map: HashMap::new() }))
}

fn purpose_label(p: FileGrantPurpose) -> &'static str {
    match p {
        FileGrantPurpose::EntitlementImport => "entitlement_import",
        FileGrantPurpose::AudioPlay => "audio_play",
        FileGrantPurpose::FsRead => "fs_read",
    }
}

fn parse_purpose(raw: &str) -> Result<FileGrantPurpose, String> {
    match raw.trim() {
        "entitlement_import" => Ok(FileGrantPurpose::EntitlementImport),
        "audio_play" => Ok(FileGrantPurpose::AudioPlay),
        "fs_read" => Ok(FileGrantPurpose::FsRead),
        other => Err(format!("unknown_grant_purpose:{other}")),
    }
}

fn parse_root(raw: &str) -> Result<GrantRoot, String> {
    match raw.trim() {
        "import" => Ok(GrantRoot::Import),
        "staging" => Ok(GrantRoot::Staging),
        other => Err(format!("unknown_grant_root:{other}")),
    }
}

fn purge_expired(map: &mut HashMap<String, GrantRecord>) {
    let now = Instant::now();
    map.retain(|_, g| g.expires_at > now);
}

/// Issue a short-lived grant for a relative path under Import or staging.
pub fn issue(
    app_data: &Path,
    root: &str,
    relative: &str,
    purpose: &str,
) -> Result<FileGrantView, String> {
    let purpose = parse_purpose(purpose)?;
    let root_kind = parse_root(root)?;
    let rel = relative.trim();
    if rel.is_empty() {
        return Err("grant_relative_empty".into());
    }
    if Path::new(rel).is_absolute() {
        return Err("grant_absolute_path_denied".into());
    }
    // Resolve once to prove the path is under the allowlist (no symlink escape).
    let resolved = resolve_relative(app_data, root_kind, rel)
        .map_err(|e| e.message())?;
    if !resolved.is_file() && purpose != FileGrantPurpose::FsRead {
        // FsRead may target a directory listing later; import/audio need a file.
        if purpose == FileGrantPurpose::EntitlementImport || purpose == FileGrantPurpose::AudioPlay
        {
            return Err("grant_target_not_file".into());
        }
    }

    let mut guard = store()
        .lock()
        .map_err(|_| "grant_store_lock".to_string())?;
    purge_expired(&mut guard.map);
    if guard.map.len() >= FILE_GRANT_MAX_ACTIVE {
        return Err("grant_capacity".into());
    }

    let mut id_bytes = [0u8; 16];
    getrandom::fill(&mut id_bytes).map_err(|e| format!("grant_id_entropy: {e}"))?;
    let id = hex::encode(id_bytes);
    let expires_at = Instant::now() + Duration::from_secs(FILE_GRANT_TTL_SECS);
    guard.map.insert(
        id.clone(),
        GrantRecord {
            purpose,
            relative: rel.to_string(),
            root_kind,
            expires_at,
        },
    );

    eprintln!(
        "[STEP] file_grant_issue id={} purpose={} root={root} rel={rel}",
        &id[..8.min(id.len())],
        purpose_label(purpose)
    );

    Ok(FileGrantView {
        grant_id: id,
        purpose: purpose_label(purpose).into(),
        expires_in_secs: FILE_GRANT_TTL_SECS,
    })
}

/// Consume a grant (one-shot): re-resolve path and remove the grant.
pub fn consume(
    app_data: &Path,
    grant_id: &str,
    expected: FileGrantPurpose,
) -> Result<PathBuf, String> {
    let mut guard = store()
        .lock()
        .map_err(|_| "grant_store_lock".to_string())?;
    purge_expired(&mut guard.map);
    let rec = guard
        .map
        .remove(grant_id.trim())
        .ok_or_else(|| "grant_missing_or_expired".to_string())?;
    if rec.purpose != expected {
        return Err(format!(
            "grant_purpose_mismatch:expected={:?}:got={:?}",
            expected, rec.purpose
        ));
    }
    if Instant::now() > rec.expires_at {
        return Err("grant_expired".into());
    }
    resolve_relative(app_data, rec.root_kind, &rec.relative).map_err(|e| e.message())
}

fn resolve_relative(
    app_data: &Path,
    root_kind: GrantRoot,
    relative: &str,
) -> Result<PathBuf, FsBridgeError> {
    // Force relative-only resolution under the chosen root.
    fs_bridge::resolve_relative_under_root(app_data, root_kind_label(root_kind), relative)
}

fn root_kind_label(k: GrantRoot) -> &'static str {
    match k {
        GrantRoot::Import => "import",
        GrantRoot::Staging => "staging",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_absolute_relative_field() {
        let tmp = std::env::temp_dir().join(format!("eliteew-grant-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&tmp);
        let err = issue(&tmp, "import", "/etc/passwd", "entitlement_import").unwrap_err();
        assert!(err.contains("grant_absolute_path_denied"), "{err}");
    }
}
