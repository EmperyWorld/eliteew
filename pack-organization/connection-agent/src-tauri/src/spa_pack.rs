// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// FoFline SPA pack local store + minisign/sha256 verify (L2) + L4 remote
// skew fields on status views. Download/sync lives in commands::spa_pack.
// Invariants:
// - Unsigned / empty signature → fail-closed (never install).
// - Bad verify keeps previous ready pack when present.
// - State values: pack_missing | downloading | ready | error | denied.
// - Ready local pack stays Start-eligible while update_available is true (L4).
// Related:
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §11 / L2 / L4 / §17
// ---

use base64::Engine;
use minisign_verify::{PublicKey, Signature};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

pub const STATE_PACK_MISSING: &str = "pack_missing";
pub const STATE_DOWNLOADING: &str = "downloading";
pub const STATE_READY: &str = "ready";
pub const STATE_ERROR: &str = "error";
pub const STATE_DENIED: &str = "denied";

pub const KIND_FOFLINE_SPA: &str = "fofline-spa";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaLatestManifest {
    pub schema_version: u32,
    pub kind: String,
    pub version: String,
    pub app_build_id: String,
    #[serde(default)]
    pub deploy_id: Option<String>,
    pub url: String,
    #[serde(default)]
    pub signature: String,
    pub sha256: String,
    #[serde(default)]
    pub include_audio: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalSpaPackState {
    pub schema_version: u32,
    pub state: String,
    pub app_build_id: Option<String>,
    pub install_path: Option<String>,
    #[serde(default)]
    pub last_error_code: Option<String>,
    #[serde(default)]
    pub last_error_message: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpaPackStatusView {
    pub ok: bool,
    pub state: String,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_build_id: Option<String>,
    /// Remote spa-latest app_build_id when checked (L4); None if not checked.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_app_build_id: Option<String>,
    /// True when local ready pack differs from spa-latest (L4). Start still allowed.
    #[serde(default)]
    pub update_available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress_total: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install_path: Option<String>,
    /// Optional asset groups ready (A2 honesty axis).
    #[serde(default)]
    pub groups_ready: u32,
    #[serde(default)]
    pub groups_total: u32,
    #[serde(default)]
    pub groups_syncing: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_group_id: Option<String>,
}

impl SpaPackStatusView {
    pub fn denied() -> Self {
        Self {
            ok: false,
            state: STATE_DENIED.into(),
            code: "allow_fofline_required".into(),
            message: "FoFline SPA pack sync requires allow_fofline".into(),
            app_build_id: None,
            remote_app_build_id: None,
            update_available: false,
            progress_bytes: None,
            progress_total: None,
            install_path: None,
            groups_ready: 0,
            groups_total: 0,
            groups_syncing: false,
            active_group_id: None,
        }
    }

    /// Attach L4 remote compare result without changing ready Start eligibility.
    pub fn with_remote_compare(mut self, remote_id: Option<String>, update: bool) -> Self {
        self.remote_app_build_id = remote_id;
        self.update_available = update;
        if update {
            self.code = "update_available".into();
            let local = self.app_build_id.as_deref().unwrap_or("?");
            let remote = self.remote_app_build_id.as_deref().unwrap_or("?");
            self.message = format!(
                "FoFline workspace update available (local {local} → remote {remote})"
            );
        }
        self
    }

    pub fn with_groups(
        mut self,
        ready: u32,
        total: u32,
        syncing: bool,
        active: Option<String>,
    ) -> Self {
        self.groups_ready = ready;
        self.groups_total = total;
        self.groups_syncing = syncing;
        self.active_group_id = active;
        self
    }
}

/// Runtime overlay while a sync is in flight (not persisted).
#[derive(Debug, Default, Clone)]
pub struct SpaPackRuntime {
    pub downloading: bool,
    pub progress_bytes: u64,
    pub progress_total: Option<u64>,
    pub last_view: Option<SpaPackStatusView>,
    pub groups_syncing: bool,
    pub groups_ready: u32,
    pub groups_total: u32,
    pub active_group_id: Option<String>,
    /// Cooperative cancel between groups (A2).
    pub cancel_groups: bool,
}

pub fn pack_root(app_data: &Path) -> PathBuf {
    app_data.join("fofline-spa")
}

/// Local factory-reset (W5b): remove entire FoFline SPA tree under app_data.
/// Idempotent when the directory is already absent.
pub fn remove_pack_tree(app_data: &Path) -> Result<(), String> {
    let root = pack_root(app_data);
    match fs::remove_dir_all(&root) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("remove_fofline_spa: {e}")),
    }
}

pub fn current_dir(app_data: &Path) -> PathBuf {
    pack_root(app_data).join("current")
}

pub fn staging_dir(app_data: &Path) -> PathBuf {
    pack_root(app_data).join("staging")
}

pub fn state_path(app_data: &Path) -> PathBuf {
    pack_root(app_data).join("state.json")
}

pub fn load_local_state(app_data: &Path) -> LocalSpaPackState {
    let path = state_path(app_data);
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_else(|_| default_missing_state()),
        Err(_) => default_missing_state(),
    }
}

fn default_missing_state() -> LocalSpaPackState {
    LocalSpaPackState {
        schema_version: 1,
        state: STATE_PACK_MISSING.into(),
        app_build_id: None,
        install_path: None,
        last_error_code: None,
        last_error_message: None,
        updated_at: None,
    }
}

pub fn save_local_state(app_data: &Path, state: &LocalSpaPackState) -> Result<(), String> {
    let root = pack_root(app_data);
    fs::create_dir_all(&root).map_err(|e| format!("mkdir fofline-spa: {e}"))?;
    let path = state_path(app_data);
    let tmp = root.join("state.json.tmp");
    let raw = serde_json::to_string_pretty(state).map_err(|e| format!("state serialize: {e}"))?;
    fs::write(&tmp, raw).map_err(|e| format!("write state tmp: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("rename state: {e}"))?;
    Ok(())
}

pub fn is_ready_install(app_data: &Path, expected_id: Option<&str>) -> bool {
    let cur = current_dir(app_data);
    if !(cur.join("index.html").is_file() && cur.join("pack-manifest.json").is_file()) {
        return false;
    }
    if let Some(want) = expected_id {
        if let Ok(raw) = fs::read_to_string(cur.join("pack-manifest.json")) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(id) = v.get("app_build_id").and_then(|x| x.as_str()) {
                    return id == want;
                }
            }
        }
        return false;
    }
    true
}

fn attach_group_runtime(view: SpaPackStatusView, runtime: &SpaPackRuntime) -> SpaPackStatusView {
    view.with_groups(
        runtime.groups_ready,
        runtime.groups_total,
        runtime.groups_syncing,
        runtime.active_group_id.clone(),
    )
}

pub fn status_from_disk(app_data: &Path, runtime: &SpaPackRuntime) -> SpaPackStatusView {
    if runtime.downloading {
        let local = load_local_state(app_data);
        return attach_group_runtime(
            SpaPackStatusView {
                ok: true,
                state: STATE_DOWNLOADING.into(),
                code: "downloading".into(),
                message: "Downloading FoFline workspace pack".into(),
                app_build_id: local.app_build_id,
                remote_app_build_id: None,
                update_available: false,
                progress_bytes: Some(runtime.progress_bytes),
                progress_total: runtime.progress_total,
                install_path: local.install_path,
                groups_ready: 0,
                groups_total: 0,
                groups_syncing: false,
                active_group_id: None,
            },
            runtime,
        );
    }
    if let Some(view) = &runtime.last_view {
        if view.state == STATE_ERROR || view.state == STATE_DOWNLOADING {
            return attach_group_runtime(view.clone(), runtime);
        }
    }
    let local = load_local_state(app_data);
    if local.state == STATE_READY && is_ready_install(app_data, local.app_build_id.as_deref()) {
        return attach_group_runtime(
            SpaPackStatusView {
                ok: true,
                state: STATE_READY.into(),
                code: "ready".into(),
                message: format!(
                    "FoFline workspace ready ({})",
                    local.app_build_id.as_deref().unwrap_or("?")
                ),
                app_build_id: local.app_build_id.clone(),
                remote_app_build_id: None,
                update_available: false,
                progress_bytes: None,
                progress_total: None,
                install_path: Some(current_dir(app_data).display().to_string()),
                groups_ready: 0,
                groups_total: 0,
                groups_syncing: false,
                active_group_id: None,
            },
            runtime,
        );
    }
    if local.state == STATE_ERROR {
        return attach_group_runtime(
            SpaPackStatusView {
                ok: false,
                state: STATE_ERROR.into(),
                code: local
                    .last_error_code
                    .clone()
                    .unwrap_or_else(|| "error".into()),
                message: local
                    .last_error_message
                    .clone()
                    .unwrap_or_else(|| "FoFline workspace pack error".into()),
                app_build_id: local.app_build_id.clone(),
                remote_app_build_id: None,
                update_available: false,
                progress_bytes: None,
                progress_total: None,
                install_path: if is_ready_install(app_data, None) {
                    Some(current_dir(app_data).display().to_string())
                } else {
                    None
                },
                groups_ready: 0,
                groups_total: 0,
                groups_syncing: false,
                active_group_id: None,
            },
            runtime,
        );
    }
    attach_group_runtime(
        SpaPackStatusView {
            ok: false,
            state: STATE_PACK_MISSING.into(),
            code: "pack_missing".into(),
            message: "FoFline workspace pack not installed yet".into(),
            app_build_id: None,
            remote_app_build_id: None,
            update_available: false,
            progress_bytes: None,
            progress_total: None,
            install_path: None,
            groups_ready: 0,
            groups_total: 0,
            groups_syncing: false,
            active_group_id: None,
        },
        runtime,
    )
}

pub fn parse_spa_latest(raw: &str) -> Result<SpaLatestManifest, String> {
    let m: SpaLatestManifest =
        serde_json::from_str(raw).map_err(|e| format!("spa-latest.json parse: {e}"))?;
    if m.kind != KIND_FOFLINE_SPA {
        return Err(format!("unexpected kind: {}", m.kind));
    }
    if m.schema_version < 1 {
        return Err("schema_version must be >= 1".into());
    }
    crate::update_spool::validate_id(&m.app_build_id)?;
    if m.version.trim().is_empty() {
        return Err("app_build_id/version required".into());
    }
    if m.url.trim().is_empty() {
        return Err("url required".into());
    }
    if m.sha256.trim().len() != 64 {
        return Err("sha256 must be 64 hex chars".into());
    }
    if m.signature.trim().is_empty() {
        return Err("signature_required".into());
    }
    Ok(m)
}

/// Same algorithm as tauri-plugin-updater verify_signature (minisign over file bytes).
pub fn verify_tauri_minisign(data: &[u8], signature_b64: &str, pubkey_b64: &str) -> Result<(), String> {
    let pub_key_decoded = base64_to_utf8(pubkey_b64)?;
    let public_key =
        PublicKey::decode(&pub_key_decoded).map_err(|e| format!("pubkey decode: {e}"))?;
    let sig_decoded = base64_to_utf8(signature_b64)?;
    let signature = Signature::decode(&sig_decoded).map_err(|e| format!("signature decode: {e}"))?;
    public_key
        .verify(data, &signature, true)
        .map_err(|e| format!("signature_invalid: {e}"))?;
    Ok(())
}

fn base64_to_utf8(b64: &str) -> Result<String, String> {
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .map_err(|e| format!("base64 decode: {e}"))?;
    String::from_utf8(decoded).map_err(|e| format!("utf8: {e}"))
}

pub fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

pub fn extract_tar_zst(archive_bytes: &[u8], dest: &Path) -> Result<(), String> {
    crate::safe_archive::extract_tar_zst_bytes(archive_bytes, dest)?;
    if !dest.join("index.html").is_file() {
        return Err("pack missing index.html after extract".into());
    }
    if !dest.join("pack-manifest.json").is_file() {
        return Err("pack missing pack-manifest.json after extract".into());
    }
    Ok(())
}

pub fn extract_tar_zst_file(archive: &Path, dest: &Path) -> Result<(), String> {
    crate::safe_archive::extract_tar_zst_file(archive, dest)?;
    if !dest.join("index.html").is_file() {
        return Err("pack missing index.html after extract".into());
    }
    if !dest.join("pack-manifest.json").is_file() {
        return Err("pack missing pack-manifest.json after extract".into());
    }
    Ok(())
}

pub fn promote_staging(app_data: &Path) -> Result<PathBuf, String> {
    let staging = staging_dir(app_data);
    let current = current_dir(app_data);
    let root = pack_root(app_data);
    fs::create_dir_all(&root).map_err(|e| format!("mkdir fofline-spa: {e}"))?;

    let backup = root.join("previous");
    if backup.exists() {
        let _ = fs::remove_dir_all(&backup);
    }
    if current.exists() {
        fs::rename(&current, &backup).map_err(|e| format!("backup current: {e}"))?;
    }
    fs::rename(&staging, &current).map_err(|e| {
        // Best-effort restore previous current.
        if backup.exists() && !current.exists() {
            let _ = fs::rename(&backup, &current);
        }
        format!("promote staging: {e}")
    })?;
    if backup.exists() {
        let _ = fs::remove_dir_all(&backup);
    }
    Ok(current)
}

pub fn write_ready_state(app_data: &Path, app_build_id: &str) -> Result<(), String> {
    let now = chrono_like_utc_now();
    save_local_state(
        app_data,
        &LocalSpaPackState {
            schema_version: 1,
            state: STATE_READY.into(),
            app_build_id: Some(app_build_id.to_string()),
            install_path: Some(current_dir(app_data).display().to_string()),
            last_error_code: None,
            last_error_message: None,
            updated_at: Some(now),
        },
    )
}

pub fn write_error_state(
    app_data: &Path,
    code: &str,
    message: &str,
    keep_ready_id: Option<String>,
) -> Result<(), String> {
    let keep_ready = keep_ready_id
        .as_deref()
        .map(|id| is_ready_install(app_data, Some(id)))
        .unwrap_or_else(|| is_ready_install(app_data, None));
    let prior = load_local_state(app_data);
    let now = chrono_like_utc_now();
    save_local_state(
        app_data,
        &LocalSpaPackState {
            schema_version: 1,
            // Persist ready when previous good pack remains; FE still sees error via command view.
            state: if keep_ready {
                STATE_READY.into()
            } else {
                STATE_ERROR.into()
            },
            app_build_id: if keep_ready {
                keep_ready_id.or(prior.app_build_id)
            } else {
                None
            },
            install_path: if keep_ready {
                Some(current_dir(app_data).display().to_string())
            } else {
                None
            },
            last_error_code: Some(code.into()),
            last_error_message: Some(message.into()),
            updated_at: Some(now),
        },
    )
}

fn chrono_like_utc_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("unix:{secs}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn parse_rejects_empty_signature() {
        let raw = r#"{
          "schema_version": 1,
          "kind": "fofline-spa",
          "version": "1",
          "app_build_id": "1",
          "url": "https://example.test/a.tar.zst",
          "signature": "",
          "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }"#;
        let err = parse_spa_latest(raw).unwrap_err();
        assert!(err.contains("signature"), "{err}");
    }

    #[test]
    fn parse_rejects_wrong_kind() {
        let raw = r#"{
          "schema_version": 1,
          "kind": "shell",
          "version": "1",
          "app_build_id": "1",
          "url": "https://example.test/a.tar.zst",
          "signature": "dGVzdA==",
          "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }"#;
        assert!(parse_spa_latest(raw).unwrap_err().contains("kind"));
    }

    #[test]
    fn parse_ok_minimal() {
        let raw = r#"{
          "schema_version": 1,
          "kind": "fofline-spa",
          "version": "1786214589850-9fdkgx9f8j",
          "app_build_id": "1786214589850-9fdkgx9f8j",
          "url": "https://app.eliteew.ru/fofline-updates/artifacts/x.tar.zst",
          "signature": "dW50cnVzdGVk",
          "sha256": "f3e1138425937c4f2aae5dc44da9b046e69980147d1e2199c3ef4ed96b1495e8"
        }"#;
        let m = parse_spa_latest(raw).unwrap();
        assert_eq!(m.kind, KIND_FOFLINE_SPA);
        assert_eq!(m.app_build_id, "1786214589850-9fdkgx9f8j");
    }

    #[test]
    fn sha256_known() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn with_remote_compare_keeps_ready_state() {
        let view = SpaPackStatusView {
            ok: true,
            state: STATE_READY.into(),
            code: "ready".into(),
            message: "ready".into(),
            app_build_id: Some("old".into()),
            remote_app_build_id: None,
            update_available: false,
            progress_bytes: None,
            progress_total: None,
            install_path: Some("/tmp".into()),
            groups_ready: 0,
            groups_total: 0,
            groups_syncing: false,
            active_group_id: None,
        }
        .with_remote_compare(Some("new".into()), true);
        assert_eq!(view.state, STATE_READY);
        assert!(view.update_available);
        assert_eq!(view.code, "update_available");
        assert_eq!(view.remote_app_build_id.as_deref(), Some("new"));
        assert_eq!(view.app_build_id.as_deref(), Some("old"));
    }

    #[test]
    fn ready_detects_index_and_manifest() {
        let dir = env::temp_dir().join(format!(
            "eliteew-spa-pack-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(current_dir(&dir)).unwrap();
        fs::write(current_dir(&dir).join("index.html"), b"<html></html>").unwrap();
        fs::write(
            current_dir(&dir).join("pack-manifest.json"),
            r#"{"app_build_id":"abc"}"#,
        )
        .unwrap();
        assert!(is_ready_install(&dir, Some("abc")));
        assert!(!is_ready_install(&dir, Some("other")));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn extract_roundtrip_tiny_tar_zst() {
        // Build a tiny tar in memory via std Command if tar+zstd available — skip otherwise.
        let dir = env::temp_dir().join(format!(
            "eliteew-spa-pack-extract-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        let src = dir.join("src");
        fs::create_dir_all(&src).unwrap();
        fs::write(src.join("index.html"), b"<html>ok</html>").unwrap();
        fs::write(src.join("pack-manifest.json"), b"{\"app_build_id\":\"t\"}").unwrap();
        let archive = dir.join("p.tar.zst");
        let status = std::process::Command::new("bash")
            .arg("-lc")
            .arg(format!(
                "cd '{}' && tar -cf - . | zstd -q -o '{}'",
                src.display(),
                archive.display()
            ))
            .status();
        match status {
            Ok(s) if s.success() => {
                let bytes = fs::read(&archive).unwrap();
                let dest = dir.join("out");
                extract_tar_zst(&bytes, &dest).unwrap();
                assert!(dest.join("index.html").is_file());
                assert!(dest.join("pack-manifest.json").is_file());
            }
            _ => {
                // Host without tar/zstd — unit still covers parse/sha/ready.
            }
        }
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn remove_pack_tree_is_idempotent() {
        let dir = env::temp_dir().join(format!(
            "eliteew-spa-pack-wipe-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        remove_pack_tree(&dir).expect("absent ok");
        let current = current_dir(&dir);
        fs::create_dir_all(&current).unwrap();
        fs::write(current.join("index.html"), b"<html></html>").unwrap();
        assert!(pack_root(&dir).is_dir());
        remove_pack_tree(&dir).expect("delete");
        assert!(!pack_root(&dir).exists());
        remove_pack_tree(&dir).expect("already gone");
        let _ = fs::remove_dir_all(&dir);
    }
}
