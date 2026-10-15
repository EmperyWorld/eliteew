// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// O4 soft-revoke denylist — verify signed document + local license match.
// Invariants:
// - Same Ed25519 pubkey as entitlement; never holds signing key.
// - Cached denylist honored offline; missing cache → not revoked yet.
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
// ---

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};

use crate::entitlement::{self, sort_value};

const REL: &str = "denylist/v1.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DenylistPayload {
    pub revoked_license_ids: Vec<String>,
    pub iat: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issuer: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DenylistDocument {
    pub v: u32,
    pub payload: DenylistPayload,
    pub sig: String,
}

pub fn store_path(app_data: &Path) -> PathBuf {
    app_data.join(REL)
}

pub fn denylist_url_from_update_base(update_url: &str) -> String {
    let trimmed = update_url.trim();
    let base = trimmed
        .split("{{")
        .next()
        .unwrap_or(trimmed)
        .trim_end_matches('/');
    format!("{base}/denylist.json")
}

fn canonical_payload_bytes(payload: &DenylistPayload) -> Result<Vec<u8>, String> {
    let value = serde_json::to_value(payload).map_err(|e| format!("payload_json: {e}"))?;
    let sorted = sort_value(value);
    serde_json::to_vec(&sorted).map_err(|e| format!("canonical_json: {e}"))
}

pub fn verify_document(
    doc: &DenylistDocument,
    pubkey_hex: &str,
) -> Result<DenylistPayload, String> {
    if doc.v != 1 {
        return Err("unsupported_version".into());
    }
    let pk_bytes = entitlement::parse_pubkey_hex(pubkey_hex)?;
    let verifying =
        VerifyingKey::from_bytes(&pk_bytes).map_err(|_| "pubkey_invalid".to_string())?;
    let msg = canonical_payload_bytes(&doc.payload)?;
    let sig_bytes = hex::decode(doc.sig.trim()).map_err(|_| "sig_invalid_hex".to_string())?;
    if sig_bytes.len() != 64 {
        return Err("sig_bad_length".into());
    }
    let mut sig_arr = [0u8; 64];
    sig_arr.copy_from_slice(&sig_bytes);
    let signature = Signature::from_bytes(&sig_arr);
    verifying
        .verify(&msg, &signature)
        .map_err(|_| "sig_bad".to_string())?;
    Ok(doc.payload.clone())
}

pub fn is_revoked(payload: &DenylistPayload, license_id: &str) -> bool {
    let lid = license_id.trim();
    if lid.is_empty() {
        return false;
    }
    payload
        .revoked_license_ids
        .iter()
        .any(|x| x.trim() == lid)
}

pub fn load_cached(app_data: &Path) -> Result<Option<DenylistDocument>, String> {
    let path = store_path(app_data);
    if !path.is_file() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("read_denylist: {e}"))?;
    let doc: DenylistDocument =
        serde_json::from_str(&raw).map_err(|e| format!("parse_denylist: {e}"))?;
    Ok(Some(doc))
}

pub fn persist(app_data: &Path, doc: &DenylistDocument) -> Result<(), String> {
    let path = store_path(app_data);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("denylist_dir: {e}"))?;
    }
    let json = serde_json::to_string_pretty(doc).map_err(|e| e.to_string())?;
    let mut f = fs::File::create(&path).map_err(|e| format!("create_denylist: {e}"))?;
    f.write_all(json.as_bytes())
        .map_err(|e| format!("write_denylist: {e}"))?;
    Ok(())
}

/// Local factory-reset (W5b): drop cached OTA denylist. Idempotent when absent.
pub fn clear_cache(app_data: &Path) -> Result<(), String> {
    let path = store_path(app_data);
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("clear_denylist: {e}")),
    }
}

pub fn parse_document_json(raw: &str) -> Result<DenylistDocument, String> {
    serde_json::from_str(raw).map_err(|e| format!("parse_denylist: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn denylist_url_strips_template() {
        let u = denylist_url_from_update_base(
            "https://app.eliteew.ru/desktop-client-updates/{{target}}/{{arch}}/{{current_version}}",
        );
        assert_eq!(
            u,
            "https://app.eliteew.ru/desktop-client-updates/denylist.json"
        );
    }

    #[test]
    fn is_revoked_match() {
        let p = DenylistPayload {
            revoked_license_ids: vec!["abc".into(), "def".into()],
            iat: 1,
            issuer: None,
            note: None,
        };
        assert!(is_revoked(&p, "abc"));
        assert!(!is_revoked(&p, "zzz"));
    }

    #[test]
    fn clear_cache_is_idempotent() {
        let dir = std::env::temp_dir().join(format!(
            "eliteew-denylist-wipe-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        clear_cache(&dir).expect("absent ok");
        let path = store_path(&dir);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, b"{}").unwrap();
        assert!(path.is_file());
        clear_cache(&dir).expect("delete");
        assert!(!path.is_file());
        clear_cache(&dir).expect("already gone");
        let _ = fs::remove_dir_all(&dir);
    }
}
