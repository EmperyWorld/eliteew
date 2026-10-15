// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// FoFline optional SPA asset groups: channel parse, local hash completeness,
// disk-spool download helpers, merge extract into ready core current/ (A2).
// Invariants:
// - Group sync never blocks core Start readiness.
// - Skip group when archive sha256 + per-file hashes already match.
// - Group archives verified (sha256 + minisign); merge must not wipe core files.
// - Forbidden: hold entire multi-GiB group archive in RAM.
// Related:
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §17.3 / §17.4
// - crate::spa_pack
// ---

use crate::resource_policy::GROUP_ARCHIVE_MAX_BYTES;
use crate::spa_pack::{current_dir, pack_root, verify_tauri_minisign};
use memmap2::Mmap;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

pub const KIND_FOFLINE_SPA_ASSETS: &str = "fofline-spa-assets";
pub const KIND_FOFLINE_SPA_FILES: &str = "fofline-spa-files";

/// Soft cap for a single group pack on disk (Wave 7 measured headroom).
pub const MAX_GROUP_BYTES: u64 = GROUP_ARCHIVE_MAX_BYTES;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaAssetsGroupEntry {
    pub id: String,
    pub url: String,
    pub sha256: String,
    pub signature: String,
    #[serde(default)]
    pub artifact: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaAssetsLatestManifest {
    pub schema_version: u32,
    pub kind: String,
    pub app_build_id: String,
    #[serde(default)]
    pub groups: Vec<SpaAssetsGroupEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilesEntry {
    pub path: String,
    pub sha256: String,
    #[serde(default)]
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilesManifest {
    pub schema_version: u32,
    pub kind: String,
    #[serde(default)]
    pub group_id: String,
    #[serde(default)]
    pub files: Vec<FilesEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupLocalRecord {
    pub archive_sha256: String,
    pub ready: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AssetsLocalState {
    pub schema_version: u32,
    #[serde(default)]
    pub app_build_id: Option<String>,
    #[serde(default)]
    pub groups: HashMap<String, GroupLocalRecord>,
}

pub fn assets_state_path(app_data: &Path) -> PathBuf {
    pack_root(app_data).join("assets-state.json")
}

pub fn group_meta_dir(app_data: &Path, group_id: &str) -> Result<PathBuf, String> {
    crate::update_spool::validate_group_id(group_id)?;
    Ok(current_dir(app_data)
        .join(".fofline-group-meta")
        .join(group_id))
}

pub fn group_staging_dir(app_data: &Path, group_id: &str) -> Result<PathBuf, String> {
    crate::update_spool::validate_group_id(group_id)?;
    Ok(pack_root(app_data).join("group-staging").join(group_id))
}

pub fn load_assets_state(app_data: &Path) -> AssetsLocalState {
    let path = assets_state_path(app_data);
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => AssetsLocalState {
            schema_version: 1,
            ..Default::default()
        },
    }
}

pub fn save_assets_state(app_data: &Path, state: &AssetsLocalState) -> Result<(), String> {
    let root = pack_root(app_data);
    fs::create_dir_all(&root).map_err(|e| format!("mkdir fofline-spa: {e}"))?;
    let path = assets_state_path(app_data);
    let tmp = root.join("assets-state.json.tmp");
    let raw = serde_json::to_string_pretty(state).map_err(|e| format!("assets state: {e}"))?;
    fs::write(&tmp, raw).map_err(|e| format!("write assets state tmp: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("rename assets state: {e}"))?;
    Ok(())
}

pub fn parse_spa_assets_latest(raw: &str) -> Result<SpaAssetsLatestManifest, String> {
    let m: SpaAssetsLatestManifest =
        serde_json::from_str(raw).map_err(|e| format!("spa-assets-latest.json parse: {e}"))?;
    if m.kind != KIND_FOFLINE_SPA_ASSETS {
        return Err(format!("unexpected kind: {}", m.kind));
    }
    if m.schema_version < 1 {
        return Err("schema_version must be >= 1".into());
    }
    crate::update_spool::validate_id(&m.app_build_id)?;
    for g in &m.groups {
        crate::update_spool::validate_group_id(&g.id)?;
        if g.url.trim().is_empty() {
            return Err(format!("group {} url required", g.id));
        }
        if g.sha256.trim().len() != 64 {
            return Err(format!("group {} sha256 must be 64 hex", g.id));
        }
        if g.signature.trim().is_empty() {
            return Err(format!("group {} signature_required", g.id));
        }
    }
    Ok(m)
}

pub fn parse_files_manifest(raw: &str) -> Result<FilesManifest, String> {
    let m: FilesManifest =
        serde_json::from_str(raw).map_err(|e| format!("files.json parse: {e}"))?;
    if m.kind != KIND_FOFLINE_SPA_FILES {
        return Err(format!("unexpected files kind: {}", m.kind));
    }
    Ok(m)
}

pub fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| format!("open {}: {e}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 1024 * 1024];
    loop {
        let n = file
            .read(&mut buf)
            .map_err(|e| format!("read {}: {e}", path.display()))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

/// True when every files.json entry exists under `current/` with matching sha256.
pub fn local_files_complete(current: &Path, files: &FilesManifest) -> bool {
    if files.files.is_empty() {
        return false;
    }
    for entry in &files.files {
        let rel = entry.path.trim().trim_start_matches('/');
        if rel.is_empty() || rel.contains("..") {
            return false;
        }
        // Meta files live inside the group pack; completeness is about product paths.
        if rel == "files.json" || rel == "group-manifest.json" {
            continue;
        }
        let path = current.join(rel);
        match sha256_file(&path) {
            Ok(got) if got.eq_ignore_ascii_case(entry.sha256.trim()) => {}
            _ => return false,
        }
    }
    true
}

/// Skip download when recorded archive hash matches and local files still verify.
pub fn group_skip_download(
    app_data: &Path,
    group_id: &str,
    remote_archive_sha: &str,
    state: &AssetsLocalState,
) -> bool {
    let Some(rec) = state.groups.get(group_id) else {
        return false;
    };
    if !rec.ready
        || !rec
            .archive_sha256
            .eq_ignore_ascii_case(remote_archive_sha.trim())
    {
        return false;
    }
    let Ok(meta) = group_meta_dir(app_data, group_id) else {
        return false;
    };
    let meta = meta.join("files.json");
    let Ok(raw) = fs::read_to_string(&meta) else {
        return false;
    };
    let Ok(files) = parse_files_manifest(&raw) else {
        return false;
    };
    local_files_complete(&current_dir(app_data), &files)
}

pub fn extract_group_tar_zst_file(archive: &Path, dest: &Path) -> Result<(), String> {
    crate::safe_archive::extract_tar_zst_file(archive, dest)?;
    if !dest.join("files.json").is_file() && !dest.join("group-manifest.json").is_file() {
        return Err("group pack missing files.json / group-manifest.json".into());
    }
    Ok(())
}

/// Copy product files from extracted group into `current/` (sparse merge).
pub fn merge_group_into_current(staging: &Path, current: &Path) -> Result<(), String> {
    fs::create_dir_all(current).map_err(|e| format!("mkdir current: {e}"))?;
    for entry in walkdir_files(staging)? {
        let rel = entry
            .strip_prefix(staging)
            .map_err(|e| format!("strip prefix: {e}"))?;
        let rel_s = rel.to_string_lossy().replace('\\', "/");
        if rel_s == "files.json" || rel_s == "group-manifest.json" {
            continue;
        }
        if rel_s.contains("..") {
            return Err(format!("unsafe path in group: {rel_s}"));
        }
        let dest = current.join(rel);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("mkdir {}: {e}", parent.display()))?;
        }
        fs::copy(&entry, &dest).map_err(|e| format!("copy {}: {e}", rel_s))?;
    }
    Ok(())
}

fn walkdir_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut out = Vec::new();
    fn walk(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), String> {
        let rd = fs::read_dir(dir).map_err(|e| format!("read_dir {}: {e}", dir.display()))?;
        for ent in rd {
            let ent = ent.map_err(|e| format!("dirent: {e}"))?;
            let path = ent.path();
            let ft = ent.file_type().map_err(|e| format!("file_type: {e}"))?;
            if ft.is_dir() {
                walk(&path, out)?;
            } else if ft.is_file() {
                out.push(path);
            }
        }
        Ok(())
    }
    walk(root, &mut out)?;
    out.sort();
    Ok(out)
}

pub fn persist_group_meta(
    app_data: &Path,
    group_id: &str,
    staging: &Path,
    archive_sha: &str,
) -> Result<(), String> {
    let meta = group_meta_dir(app_data, group_id)?;
    fs::create_dir_all(&meta).map_err(|e| format!("mkdir group meta: {e}"))?;
    for name in ["files.json", "group-manifest.json"] {
        let src = staging.join(name);
        if src.is_file() {
            fs::copy(&src, meta.join(name)).map_err(|e| format!("copy {name}: {e}"))?;
        }
    }
    let mut state = load_assets_state(app_data);
    state.schema_version = 1;
    state.groups.insert(
        group_id.to_string(),
        GroupLocalRecord {
            archive_sha256: archive_sha.to_string(),
            ready: true,
        },
    );
    save_assets_state(app_data, &state)
}

pub fn count_ready_groups(state: &AssetsLocalState, catalog_ids: &[String]) -> (u32, u32) {
    let total = catalog_ids.len() as u32;
    let ready = catalog_ids
        .iter()
        .filter(|id| state.groups.get(*id).map(|r| r.ready).unwrap_or(false))
        .count() as u32;
    (ready, total)
}

pub fn verify_group_archive(
    archive: &Path,
    expected_sha: &str,
    signature_b64: &str,
    pubkey_b64: &str,
) -> Result<(), String> {
    let got = sha256_file(archive)?;
    if !got.eq_ignore_ascii_case(expected_sha.trim()) {
        return Err("sha256_mismatch".into());
    }
    let meta = archive
        .metadata()
        .map_err(|e| format!("stat archive: {e}"))?;
    if meta.len() > MAX_GROUP_BYTES {
        return Err("pack_too_large".into());
    }
    // mmap avoids a second multi-GiB heap copy after disk spool download.
    let file = File::open(archive).map_err(|e| format!("open archive verify: {e}"))?;
    // SAFETY: file is read-only and not truncated while mapped.
    let mmap = unsafe { Mmap::map(&file) }.map_err(|e| format!("mmap archive: {e}"))?;
    verify_tauri_minisign(&mmap, signature_b64, pubkey_b64)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn parse_assets_rejects_empty_group_signature() {
        let raw = r#"{
          "schema_version": 1,
          "kind": "fofline-spa-assets",
          "app_build_id": "1",
          "groups": [{
            "id": "audio-guides",
            "url": "https://example.test/g.tar.zst",
            "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "signature": ""
          }]
        }"#;
        let err = parse_spa_assets_latest(raw).unwrap_err();
        assert!(err.contains("signature"), "{err}");
    }

    #[test]
    fn local_files_complete_hash_skip() {
        let dir = env::temp_dir().join(format!(
            "eliteew-spa-assets-hash-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        let current = dir.join("current");
        fs::create_dir_all(current.join("audio")).unwrap();
        let path = current.join("audio/a.ogg");
        fs::write(&path, b"hello-audio").unwrap();
        let sha = sha256_file(&path).unwrap();
        let files = FilesManifest {
            schema_version: 1,
            kind: KIND_FOFLINE_SPA_FILES.into(),
            group_id: "audio-guides".into(),
            files: vec![FilesEntry {
                path: "audio/a.ogg".into(),
                sha256: sha.clone(),
                size: 11,
            }],
        };
        assert!(local_files_complete(&current, &files));
        fs::write(&path, b"changed").unwrap();
        assert!(!local_files_complete(&current, &files));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn group_skip_requires_meta_and_record() {
        let dir = env::temp_dir().join(format!(
            "eliteew-spa-assets-skip-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(current_dir(&dir).join("audio")).unwrap();
        let path = current_dir(&dir).join("audio/a.ogg");
        fs::write(&path, b"hello-audio").unwrap();
        let sha = sha256_file(&path).unwrap();
        let meta = group_meta_dir(&dir, "audio-guides").unwrap();
        fs::create_dir_all(&meta).unwrap();
        let files = FilesManifest {
            schema_version: 1,
            kind: KIND_FOFLINE_SPA_FILES.into(),
            group_id: "audio-guides".into(),
            files: vec![FilesEntry {
                path: "audio/a.ogg".into(),
                sha256: sha,
                size: 11,
            }],
        };
        fs::write(
            meta.join("files.json"),
            serde_json::to_string(&files).unwrap(),
        )
        .unwrap();
        let mut state = AssetsLocalState {
            schema_version: 1,
            app_build_id: Some("1".into()),
            groups: HashMap::new(),
        };
        assert!(!group_skip_download(
            &dir,
            "audio-guides",
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            &state
        ));
        state.groups.insert(
            "audio-guides".into(),
            GroupLocalRecord {
                archive_sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                    .into(),
                ready: true,
            },
        );
        assert!(group_skip_download(
            &dir,
            "audio-guides",
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            &state
        ));
        let _ = fs::remove_dir_all(&dir);
    }
}
