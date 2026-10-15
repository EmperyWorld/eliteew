// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Local Ed25519 entitlement verify + opaque AEAD seal at rest (offline cold start).
// Invariants:
// - Client never holds signing private key; verify pubkey is baked conf only
//   (Root of Trust). Runtime DESKTOP_CLIENT_ENTITLEMENT_PUBKEY is ignored.
// - Canonical sign bytes = UTF-8 JSON of payload with sorted keys (compact).
// - On-disk store is EEENT1 ChaCha20-Poly1305 (KEK in edition keyring); plaintext
//   entitlement/v1.json is migrated then deleted.
// - Clock watermark rejects large backward jumps (code clock_rollback).
// - allow_fofline / allow_online on status view are Option: omitted blob bit → None
//   (FE may restore persist); never coerce missing → false (0.4.23 wiped FoFline CTA).
// Related:
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §4.2
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md
// ---

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use zeroize::{Zeroize, ZeroizeOnDrop};

use crate::device_keys;

pub const ENTITLEMENT_REL_PATH: &str = "entitlement/v1.json";
pub const ENTITLEMENT_SEALED_REL: &str = "entitlement/v1.sealed";

const ENTITLEMENT_SEAL_MAGIC: &[u8; 8] = b"EEENT1\0\0";
const ACCOUNT_SEAL_KEK: &str = "entitlement.seal.kek.v1";
const ACCOUNT_CLOCK_WATERMARK: &str = "entitlement.clock.watermark.v1";
const CLOCK_SKEW_SECS: i64 = 120;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntitlementPayload {
    pub license_id: String,
    pub edition: String,
    #[serde(default)]
    pub profile_id: Option<String>,
    #[serde(default)]
    pub apps: Vec<String>,
    #[serde(default)]
    pub machine_fingerprint: Option<String>,
    #[serde(default)]
    pub device_id: Option<String>,
    pub iat: i64,
    #[serde(default)]
    pub exp: Option<i64>,
    #[serde(default)]
    pub issuer: Option<String>,
    /// FoFline W2 — absent on older blobs → None (omit from canonical JSON).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allow_fofline: Option<bool>,
    /// Cloud channel — absent on older blobs → None (omit from canonical JSON).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allow_online: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntitlementDocument {
    pub v: u32,
    pub payload: EntitlementPayload,
    pub sig: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct EntitlementStatusView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub license_id: Option<String>,
    /// Server device UUID from signed blob (for Start URL / session assert).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edition: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub apps: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exp: Option<i64>,
    /// Present when signed blob carries FoFline bit (cold boot restore).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_fofline: Option<bool>,
    /// Present when signed blob carries cloud channel bit.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_online: Option<bool>,
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[derive(Zeroize, ZeroizeOnDrop)]
struct KekBytes([u8; 32]);

#[cfg(test)]
thread_local! {
    static TEST_KEK_OVERRIDE: std::cell::RefCell<Option<[u8; 32]>> = const { std::cell::RefCell::new(None) };
    static TEST_WATERMARK_OVERRIDE: std::cell::RefCell<Option<i64>> = const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
pub fn test_set_kek_override(kek: Option<[u8; 32]>) {
    TEST_KEK_OVERRIDE.with(|c| *c.borrow_mut() = kek);
}

#[cfg(test)]
pub fn test_set_watermark_override(wm: Option<i64>) {
    TEST_WATERMARK_OVERRIDE.with(|c| *c.borrow_mut() = wm);
}

fn fp_aad_bytes(local_fingerprint: Option<&str>) -> Vec<u8> {
    local_fingerprint
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.as_bytes().to_vec())
        .unwrap_or_default()
}

fn canonical_document_bytes(doc: &EntitlementDocument) -> Result<Vec<u8>, String> {
    let value = serde_json::to_value(doc).map_err(|e| format!("doc_json: {e}"))?;
    let sorted = sort_value(value);
    serde_json::to_vec(&sorted).map_err(|e| format!("canonical_doc_json: {e}"))
}

/// AEAD-seal entitlement document (magic || nonce || ciphertext). AAD = magic||fp.
pub fn seal_document_aead(
    doc: &EntitlementDocument,
    kek: &[u8; 32],
    fp_bytes: &[u8],
) -> Result<Vec<u8>, String> {
    let plaintext = canonical_document_bytes(doc)?;
    let mut nonce = [0u8; 12];
    getrandom::fill(&mut nonce).map_err(|e| format!("nonce: {e}"))?;
    let mut aad = Vec::with_capacity(8 + fp_bytes.len());
    aad.extend_from_slice(ENTITLEMENT_SEAL_MAGIC);
    aad.extend_from_slice(fp_bytes);
    let cipher = ChaCha20Poly1305::new(Key::from_slice(kek));
    let ct = cipher
        .encrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: plaintext.as_ref(),
                aad: &aad,
            },
        )
        .map_err(|_| "entitlement_seal_fail".to_string())?;
    let mut out = Vec::with_capacity(8 + 12 + ct.len());
    out.extend_from_slice(ENTITLEMENT_SEAL_MAGIC);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ct);
    Ok(out)
}

/// Open sealed entitlement blob with explicit KEK (tests / migrate helpers).
pub fn open_document_aead(
    blob: &[u8],
    kek: &[u8; 32],
    fp_bytes: &[u8],
) -> Result<EntitlementDocument, String> {
    if blob.len() < 8 + 12 + 16 {
        return Err("entitlement_sealed_short".into());
    }
    if !blob.starts_with(ENTITLEMENT_SEAL_MAGIC) {
        return Err("entitlement_sealed_magic".into());
    }
    let nonce = &blob[8..20];
    let ct = &blob[20..];
    let mut aad = Vec::with_capacity(8 + fp_bytes.len());
    aad.extend_from_slice(ENTITLEMENT_SEAL_MAGIC);
    aad.extend_from_slice(fp_bytes);
    let cipher = ChaCha20Poly1305::new(Key::from_slice(kek));
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(nonce),
            Payload {
                msg: ct,
                aad: &aad,
            },
        )
        .map_err(|_| "entitlement_unseal_fail".to_string())?;
    let doc: EntitlementDocument =
        serde_json::from_slice(&plaintext).map_err(|e| format!("parse_entitlement: {e}"))?;
    Ok(doc)
}

fn load_or_create_kek(app_identifier: Option<&str>) -> Result<KekBytes, String> {
    #[cfg(test)]
    {
        if let Some(k) = TEST_KEK_OVERRIDE.with(|c| *c.borrow()) {
            return Ok(KekBytes(k));
        }
    }
    let service = device_keys::keyring_service(app_identifier);
    let entry = Entry::new(&service, ACCOUNT_SEAL_KEK)
        .map_err(|e| format!("keyring_entry: {e}"))?;
    match entry.get_password() {
        Ok(hex_raw) => {
            let bytes = hex::decode(hex_raw.trim()).map_err(|_| "kek_invalid_hex".to_string())?;
            if bytes.len() != 32 {
                return Err("kek_bad_length".into());
            }
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&bytes);
            Ok(KekBytes(arr))
        }
        Err(_) => {
            let mut buf = [0u8; 32];
            getrandom::fill(&mut buf).map_err(|e| format!("kek_gen: {e}"))?;
            entry
                .set_password(&hex::encode(buf))
                .map_err(|e| format!("keyring_set: {e}"))?;
            Ok(KekBytes(buf))
        }
    }
}

fn load_watermark(app_identifier: Option<&str>) -> Result<i64, String> {
    #[cfg(test)]
    {
        if let Some(wm) = TEST_WATERMARK_OVERRIDE.with(|c| *c.borrow()) {
            return Ok(wm);
        }
    }
    let service = device_keys::keyring_service(app_identifier);
    let entry = Entry::new(&service, ACCOUNT_CLOCK_WATERMARK)
        .map_err(|e| format!("keyring_entry: {e}"))?;
    match entry.get_password() {
        Ok(raw) => raw
            .trim()
            .parse::<i64>()
            .map_err(|_| "watermark_invalid".to_string()),
        Err(_) => Ok(0),
    }
}

fn store_watermark(app_identifier: Option<&str>, value: i64) -> Result<(), String> {
    #[cfg(test)]
    {
        let use_tls = TEST_KEK_OVERRIDE.with(|c| c.borrow().is_some());
        if use_tls {
            TEST_WATERMARK_OVERRIDE.with(|c| *c.borrow_mut() = Some(value));
            return Ok(());
        }
    }
    let service = device_keys::keyring_service(app_identifier);
    let entry = Entry::new(&service, ACCOUNT_CLOCK_WATERMARK)
        .map_err(|e| format!("keyring_entry: {e}"))?;
    entry
        .set_password(&value.to_string())
        .map_err(|e| format!("keyring_set: {e}"))
}

/// After successful verify: reject large clock rollback; else advance watermark.
pub fn apply_clock_watermark(
    app_identifier: Option<&str>,
    now: i64,
) -> Result<(), String> {
    let watermark = load_watermark(app_identifier)?;
    if watermark > 0 && now < watermark.saturating_sub(CLOCK_SKEW_SECS) {
        eprintln!(
            "[STEP] entitlement_clock_rollback now={} watermark={}",
            now, watermark
        );
        return Err("clock_rollback".into());
    }
    let next = now.max(watermark);
    store_watermark(app_identifier, next)?;
    Ok(())
}

/// Compact JSON with sorted object keys — must match Python `json.dumps(..., sort_keys=True, separators=(',', ':'))`.
pub fn canonical_payload_bytes(payload: &EntitlementPayload) -> Result<Vec<u8>, String> {
    let value = serde_json::to_value(payload).map_err(|e| format!("payload_json: {e}"))?;
    let sorted = sort_value(value);
    serde_json::to_vec(&sorted).map_err(|e| format!("canonical_json: {e}"))
}

pub(crate) fn sort_value(value: Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut keys: Vec<String> = map.keys().cloned().collect();
            keys.sort();
            let mut out = serde_json::Map::new();
            for k in keys {
                if let Some(v) = map.get(&k) {
                    out.insert(k, sort_value(v.clone()));
                }
            }
            Value::Object(out)
        }
        Value::Array(items) => Value::Array(items.into_iter().map(sort_value).collect()),
        other => other,
    }
}

pub fn parse_pubkey_hex(raw: &str) -> Result<[u8; 32], String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.contains("REPLACE_WITH") {
        return Err("pubkey_missing".into());
    }
    let bytes = hex::decode(trimmed).map_err(|_| "pubkey_invalid_hex".to_string())?;
    if bytes.len() != 32 {
        return Err("pubkey_bad_length".into());
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}

/// Resolve verify key from baked conf / explicit override only — never process env.
pub fn resolve_pubkey_hex(baked_hex: Option<&str>) -> Result<[u8; 32], String> {
    match baked_hex {
        Some(raw) => parse_pubkey_hex(raw),
        None => Err("pubkey_missing".into()),
    }
}

/// `pubkey_hex_override`: required for verify — baked conf or test key. Env is not consulted.
pub fn verify_document(
    doc: &EntitlementDocument,
    local_fingerprint: Option<&str>,
    now: i64,
    pubkey_hex_override: Option<&str>,
) -> Result<EntitlementPayload, String> {
    if doc.v != 1 {
        return Err("unsupported_version".into());
    }
    let pk_bytes = match pubkey_hex_override {
        Some(raw) => parse_pubkey_hex(raw)?,
        None => return Err("pubkey_missing".into()),
    };
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

    if let Some(exp) = doc.payload.exp {
        if exp <= now {
            return Err("expired".into());
        }
    }

    if let Some(bound_fp) = doc
        .payload
        .machine_fingerprint
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        match local_fingerprint.map(str::trim).filter(|s| !s.is_empty()) {
            Some(local) if local == bound_fp => {}
            Some(_) => return Err("fingerprint_mismatch".into()),
            None => return Err("fingerprint_required".into()),
        }
    }

    if doc.payload.license_id.trim().is_empty() {
        return Err("payload_incomplete".into());
    }
    Ok(doc.payload.clone())
}

pub fn store_path(app_data: &Path) -> PathBuf {
    app_data.join(ENTITLEMENT_REL_PATH)
}

pub fn sealed_store_path(app_data: &Path) -> PathBuf {
    app_data.join(ENTITLEMENT_SEALED_REL)
}

pub fn load_document(
    app_data: &Path,
    app_identifier: Option<&str>,
    local_fingerprint: Option<&str>,
) -> Result<Option<EntitlementDocument>, String> {
    let sealed = sealed_store_path(app_data);
    let plaintext = store_path(app_data);
    let fp = fp_aad_bytes(local_fingerprint);

    if sealed.is_file() {
        let blob = fs::read(&sealed).map_err(|e| format!("read_entitlement_sealed: {e}"))?;
        let kek = load_or_create_kek(app_identifier)?;
        let doc = open_document_aead(&blob, &kek.0, &fp)?;
        return Ok(Some(doc));
    }

    if plaintext.is_file() {
        let raw = fs::read_to_string(&plaintext).map_err(|e| format!("read_entitlement: {e}"))?;
        let doc: EntitlementDocument =
            serde_json::from_str(&raw).map_err(|e| format!("parse_entitlement: {e}"))?;
        // Migrate plaintext → sealed on load.
        if let Err(e) = persist_document(app_data, &doc, app_identifier, local_fingerprint) {
            eprintln!("[STEP] entitlement_migrate_seal_skip reason={e}");
            return Ok(Some(doc));
        }
        eprintln!("[STEP] entitlement_migrated_to_sealed");
        return Ok(Some(doc));
    }

    Ok(None)
}

pub fn persist_document(
    app_data: &Path,
    doc: &EntitlementDocument,
    app_identifier: Option<&str>,
    local_fingerprint: Option<&str>,
) -> Result<(), String> {
    let sealed = sealed_store_path(app_data);
    if let Some(parent) = sealed.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("entitlement_dir: {e}"))?;
    }
    let kek = load_or_create_kek(app_identifier)?;
    let fp = fp_aad_bytes(local_fingerprint);
    let blob = seal_document_aead(doc, &kek.0, &fp)?;
    let mut f = fs::File::create(&sealed).map_err(|e| format!("create_entitlement_sealed: {e}"))?;
    f.write_all(&blob)
        .map_err(|e| format!("write_entitlement_sealed: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&sealed, fs::Permissions::from_mode(0o600));
    }
    // Delete legacy plaintext after successful seal.
    let plaintext = store_path(app_data);
    if plaintext.is_file() {
        match fs::remove_file(&plaintext) {
            Ok(()) => eprintln!("[STEP] entitlement_plaintext_removed"),
            Err(e) => eprintln!("[STEP] entitlement_plaintext_remove_skip reason={e}"),
        }
    }
    Ok(())
}

/// Delete local entitlement document (sealed + legacy plaintext). Idempotent.
pub fn delete_document(app_data: &Path) -> Result<(), String> {
    for path in [sealed_store_path(app_data), store_path(app_data)] {
        match fs::remove_file(&path) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(format!("delete_entitlement: {e}")),
        }
    }
    Ok(())
}

pub fn parse_document_json(raw: &str) -> Result<EntitlementDocument, String> {
    serde_json::from_str(raw.trim()).map_err(|e| format!("parse_entitlement: {e}"))
}

pub fn status_from_app_data(
    app_data: &Path,
    local_fingerprint: Option<&str>,
    baked_pubkey_hex: Option<&str>,
    app_identifier: Option<&str>,
) -> EntitlementStatusView {
    match load_document(app_data, app_identifier, local_fingerprint) {
        Ok(None) => EntitlementStatusView {
            ok: false,
            code: "missing".into(),
            message: "No local entitlement file — import USB or redeem with server-signed blob"
                .into(),
            license_id: None,
            device_id: None,
            edition: None,
            profile_id: None,
            apps: None,
            exp: None,
            allow_fofline: None,
            allow_online: None,
        },
        Ok(Some(doc)) => {
            let key = resolve_pubkey_hex(baked_pubkey_hex);
            match key.and_then(|pk| {
                let hex = hex::encode(pk);
                let payload = verify_document(&doc, local_fingerprint, now_unix(), Some(&hex))?;
                apply_clock_watermark(app_identifier, now_unix())?;
                Ok(payload)
            }) {
                Ok(payload) => EntitlementStatusView {
                    ok: true,
                    code: "ok".into(),
                    message: "Local entitlement verified".into(),
                    license_id: Some(payload.license_id),
                    device_id: payload.device_id,
                    edition: Some(payload.edition),
                    profile_id: payload.profile_id,
                    apps: Some(payload.apps),
                    exp: payload.exp,
                    // Pass through Option: older blobs omit the bit → None so FE can
                    // restore from last redeem localStorage. Never coerce missing → false
                    // (that wiped allowFofline persist and hid FoFline CTA on cold boot).
                    allow_fofline: payload.allow_fofline,
                    allow_online: payload.allow_online,
                },
                Err(code) => EntitlementStatusView {
                    ok: false,
                    code: code.clone(),
                    message: format!("Entitlement verify failed: {code}"),
                    license_id: Some(doc.payload.license_id),
                    device_id: doc.payload.device_id.clone(),
                    edition: Some(doc.payload.edition),
                    profile_id: doc.payload.profile_id,
                    apps: Some(doc.payload.apps),
                    exp: doc.payload.exp,
                    allow_fofline: doc.payload.allow_fofline,
                    allow_online: doc.payload.allow_online,
                },
            }
        }
        Err(msg) => EntitlementStatusView {
            ok: false,
            code: "store_error".into(),
            message: msg,
            license_id: None,
            device_id: None,
            edition: None,
            profile_id: None,
            apps: None,
            exp: None,
            allow_fofline: None,
            allow_online: None,
        },
    }
}

pub fn import_and_store(
    app_data: &Path,
    raw_json: &str,
    local_fingerprint: Option<&str>,
    baked_pubkey_hex: Option<&str>,
    app_identifier: Option<&str>,
) -> Result<EntitlementStatusView, String> {
    let doc = parse_document_json(raw_json)?;
    let pk = resolve_pubkey_hex(baked_pubkey_hex)?;
    let hex = hex::encode(pk);
    verify_document(&doc, local_fingerprint, now_unix(), Some(&hex))?;
    apply_clock_watermark(app_identifier, now_unix())?;
    persist_document(app_data, &doc, app_identifier, local_fingerprint)?;
    Ok(status_from_app_data(
        app_data,
        local_fingerprint,
        baked_pubkey_hex,
        app_identifier,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use std::env;

    fn test_keypair() -> (SigningKey, [u8; 32]) {
        let seed = [7u8; 32];
        let sk = SigningKey::from_bytes(&seed);
        let pk = sk.verifying_key().to_bytes();
        (sk, pk)
    }

    fn sign_payload(sk: &SigningKey, payload: &EntitlementPayload) -> EntitlementDocument {
        let msg = canonical_payload_bytes(payload).expect("canon");
        let sig = sk.sign(&msg);
        EntitlementDocument {
            v: 1,
            payload: payload.clone(),
            sig: hex::encode(sig.to_bytes()),
        }
    }

    fn sample_payload(fp: Option<&str>, exp: Option<i64>) -> EntitlementPayload {
        EntitlementPayload {
            license_id: "11111111-1111-1111-1111-111111111111".into(),
            edition: "client".into(),
            profile_id: Some("client-offline-ai".into()),
            apps: vec![
                "NotificationsApp".into(),
                "ProjectAboutApp".into(),
                "ClipboardManager".into(),
                "MusicPlayer".into(),
            ],
            machine_fingerprint: fp.map(str::to_string),
            device_id: None,
            iat: 1_700_000_000,
            exp,
            issuer: Some("eliteew-ops".into()),
            allow_fofline: None,
            allow_online: None,
        }
    }

    #[test]
    fn verify_valid_signature() {
        let (sk, pk) = test_keypair();
        let pk_hex = hex::encode(pk);
        let doc = sign_payload(&sk, &sample_payload(None, Some(now_unix() + 3600)));
        let out = verify_document(&doc, None, now_unix(), Some(&pk_hex)).expect("ok");
        assert_eq!(out.edition, "client");
        assert_eq!(out.apps.len(), 4);
    }

    #[test]
    fn reject_bad_signature() {
        let (sk, pk) = test_keypair();
        let pk_hex = hex::encode(pk);
        let mut doc = sign_payload(&sk, &sample_payload(None, Some(now_unix() + 3600)));
        doc.sig = hex::encode([0u8; 64]);
        let err = verify_document(&doc, None, now_unix(), Some(&pk_hex)).unwrap_err();
        assert_eq!(err, "sig_bad");
    }

    #[test]
    fn reject_expired() {
        let (sk, pk) = test_keypair();
        let pk_hex = hex::encode(pk);
        let doc = sign_payload(&sk, &sample_payload(None, Some(now_unix() - 10)));
        let err = verify_document(&doc, None, now_unix(), Some(&pk_hex)).unwrap_err();
        assert_eq!(err, "expired");
    }

    #[test]
    fn reject_fingerprint_mismatch() {
        let (sk, pk) = test_keypair();
        let pk_hex = hex::encode(pk);
        let doc = sign_payload(
            &sk,
            &sample_payload(Some("fp_aaaa"), Some(now_unix() + 3600)),
        );
        let err =
            verify_document(&doc, Some("fp_bbbb"), now_unix(), Some(&pk_hex)).unwrap_err();
        assert_eq!(err, "fingerprint_mismatch");
    }

    #[test]
    fn reject_missing_pubkey() {
        let (sk, _) = test_keypair();
        let doc = sign_payload(&sk, &sample_payload(None, Some(now_unix() + 3600)));
        let err = verify_document(&doc, None, now_unix(), Some("")).unwrap_err();
        assert_eq!(err, "pubkey_missing");
    }

    #[test]
    fn roundtrip_store() {
        let (sk, pk) = test_keypair();
        let pk_hex = hex::encode(pk);
        let dir = std::env::temp_dir().join(format!(
            "eliteew-entitlement-test-{}",
            now_unix()
        ));
        let _ = fs::remove_dir_all(&dir);
        test_set_kek_override(Some([42u8; 32]));
        test_set_watermark_override(Some(0));
        let doc = sign_payload(&sk, &sample_payload(None, Some(now_unix() + 3600)));
        persist_document(&dir, &doc, None, None).expect("persist");
        let sealed = sealed_store_path(&dir);
        assert!(sealed.is_file());
        let blob = fs::read(&sealed).expect("read sealed");
        assert!(
            !blob.windows(b"license_id".len()).any(|w| w == b"license_id"),
            "sealed file must not contain ASCII license_id"
        );
        assert!(!store_path(&dir).is_file(), "plaintext must be absent");
        let status = status_from_app_data(&dir, None, Some(&pk_hex), None);
        assert!(status.ok, "{}", status.message);
        test_set_kek_override(None);
        test_set_watermark_override(None);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn aead_seal_open_with_in_memory_kek() {
        let (sk, _) = test_keypair();
        let doc = sign_payload(&sk, &sample_payload(Some("fp_test"), Some(now_unix() + 3600)));
        let kek = [9u8; 32];
        let fp = b"fp_test";
        let blob = seal_document_aead(&doc, &kek, fp).expect("seal");
        assert!(blob.starts_with(b"EEENT1\0\0"));
        assert!(!blob.windows(b"license_id".len()).any(|w| w == b"license_id"));
        let opened = open_document_aead(&blob, &kek, fp).expect("open");
        assert_eq!(opened.payload.license_id, doc.payload.license_id);
        assert!(open_document_aead(&blob, &kek, b"other").is_err());
    }

    #[test]
    fn clock_rollback_rejected() {
        test_set_kek_override(Some([1u8; 32]));
        test_set_watermark_override(Some(now_unix() + 10_000));
        let err = apply_clock_watermark(None, now_unix()).unwrap_err();
        assert_eq!(err, "clock_rollback");
        test_set_kek_override(None);
        test_set_watermark_override(None);
    }

    #[test]
    fn migrate_plaintext_to_sealed_on_load() {
        let (sk, pk) = test_keypair();
        let pk_hex = hex::encode(pk);
        let dir = std::env::temp_dir().join(format!(
            "eliteew-entitlement-migrate-{}",
            now_unix()
        ));
        let _ = fs::remove_dir_all(&dir);
        test_set_kek_override(Some([77u8; 32]));
        test_set_watermark_override(Some(0));
        let doc = sign_payload(&sk, &sample_payload(None, Some(now_unix() + 3600)));
        let plain = store_path(&dir);
        if let Some(parent) = plain.parent() {
            fs::create_dir_all(parent).expect("dir");
        }
        fs::write(&plain, serde_json::to_string_pretty(&doc).unwrap()).expect("write plain");
        let loaded = load_document(&dir, None, None).expect("load").expect("doc");
        assert_eq!(loaded.payload.license_id, doc.payload.license_id);
        assert!(sealed_store_path(&dir).is_file());
        assert!(!plain.is_file());
        let status = status_from_app_data(&dir, None, Some(&pk_hex), None);
        assert!(status.ok, "{}", status.message);
        test_set_kek_override(None);
        test_set_watermark_override(None);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn verify_python_signed_fixture() {
        // Fixed seed 0x07… (same as test_keypair) — fixture minted by entitlement_sign.py
        let (_, pk) = test_keypair();
        let pk_hex = hex::encode(pk);
        let raw = include_str!("../tests/fixtures/entitlement_python_v1.json");
        let doc = parse_document_json(raw).expect("parse fixture");
        let out = verify_document(&doc, None, now_unix(), Some(&pk_hex)).expect("python blob");
        assert_eq!(out.edition, "client");
        assert_eq!(out.apps.len(), 4);
        assert_eq!(out.profile_id.as_deref(), Some("client-offline-ai"));
        // Older blobs omit allow_fofline → None (not rewritten into canonical JSON).
        assert_eq!(out.allow_fofline, None);
    }

    #[test]
    fn allow_fofline_roundtrip_in_status() {
        let (sk, pk) = test_keypair();
        let pk_hex = hex::encode(pk);
        let dir = std::env::temp_dir().join(format!(
            "eliteew-entitlement-fofline-{}",
            now_unix()
        ));
        let _ = fs::remove_dir_all(&dir);
        test_set_kek_override(Some([55u8; 32]));
        test_set_watermark_override(Some(0));
        let mut payload = sample_payload(None, Some(now_unix() + 3600));
        payload.allow_fofline = Some(true);
        let doc = sign_payload(&sk, &payload);
        persist_document(&dir, &doc, None, None).expect("persist");
        let status = status_from_app_data(&dir, None, Some(&pk_hex), None);
        assert!(status.ok, "{}", status.message);
        assert_eq!(status.allow_fofline, Some(true));
        test_set_kek_override(None);
        test_set_watermark_override(None);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn allow_online_roundtrip_in_status() {
        let (sk, pk) = test_keypair();
        let pk_hex = hex::encode(pk);
        let dir = std::env::temp_dir().join(format!(
            "eliteew-entitlement-online-{}",
            now_unix()
        ));
        let _ = fs::remove_dir_all(&dir);
        test_set_kek_override(Some([57u8; 32]));
        test_set_watermark_override(Some(0));
        let mut payload = sample_payload(None, Some(now_unix() + 3600));
        payload.allow_online = Some(false);
        let doc = sign_payload(&sk, &payload);
        persist_document(&dir, &doc, None, None).expect("persist");
        let status = status_from_app_data(&dir, None, Some(&pk_hex), None);
        assert!(status.ok, "{}", status.message);
        assert_eq!(status.allow_online, Some(false));
        test_set_kek_override(None);
        test_set_watermark_override(None);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn status_omits_allow_fofline_when_blob_lacks_bit() {
        let (sk, pk) = test_keypair();
        let pk_hex = hex::encode(pk);
        let dir = std::env::temp_dir().join(format!(
            "eliteew-entitlement-fofline-omit-{}",
            now_unix()
        ));
        let _ = fs::remove_dir_all(&dir);
        test_set_kek_override(Some([56u8; 32]));
        test_set_watermark_override(Some(0));
        let mut payload = sample_payload(None, Some(now_unix() + 3600));
        payload.allow_fofline = None;
        let doc = sign_payload(&sk, &payload);
        persist_document(&dir, &doc, None, None).expect("persist");
        let status = status_from_app_data(&dir, None, Some(&pk_hex), None);
        assert!(status.ok, "{}", status.message);
        assert_eq!(
            status.allow_fofline, None,
            "missing bit must stay None so FE can use licenseCapabilities persist"
        );
        test_set_kek_override(None);
        test_set_watermark_override(None);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn env_entitlement_pubkey_is_ignored_for_resolve() {
        let (_, pk) = test_keypair();
        let baked = hex::encode(pk);
        let attacker = "aa".repeat(32);
        // Historical env name — must not affect baked resolve (Root of Trust).
        // SAFETY: test-only env mutation under entitlement module tests.
        unsafe {
            env::set_var("DESKTOP_CLIENT_ENTITLEMENT_PUBKEY", &attacker);
        }
        let resolved = resolve_pubkey_hex(Some(&baked)).expect("baked must resolve");
        assert_eq!(hex::encode(resolved), baked);
        assert!(
            resolve_pubkey_hex(None).is_err(),
            "missing bake must not fall back to env"
        );
        unsafe {
            let _ = env::remove_var("DESKTOP_CLIENT_ENTITLEMENT_PUBKEY");
        }
    }

    #[test]
    fn delete_document_is_idempotent() {
        let dir = std::env::temp_dir().join(format!(
            "eliteew-entitlement-delete-{}",
            now_unix()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("mkdir");
        delete_document(&dir).expect("absent ok");
        let sealed = sealed_store_path(&dir);
        if let Some(parent) = sealed.parent() {
            fs::create_dir_all(parent).expect("entitlement dir");
        }
        fs::write(&sealed, b"EEENT1\0\0fake").expect("seed sealed");
        let plain = store_path(&dir);
        fs::write(&plain, b"{}").expect("seed plain");
        assert!(sealed.is_file());
        assert!(plain.is_file());
        delete_document(&dir).expect("delete");
        assert!(!sealed.is_file());
        assert!(!plain.is_file());
        delete_document(&dir).expect("already gone");
        let _ = fs::remove_dir_all(&dir);
    }
}
