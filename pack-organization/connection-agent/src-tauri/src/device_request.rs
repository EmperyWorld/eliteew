// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Build and verify hand-to-hand device_request_v1 (signed offline, public only to JS).
// Invariants:
// - Signature produced in Rust with device signing key from keyring.
// - JS never receives private keys; export writes under Import allowlist only.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §4
// ---

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use ed25519_dalek::{Signature, Signer, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::device_identity;
use crate::device_keys::{self, DeviceCryptoPublic};
use crate::fs_bridge;

pub const KIND: &str = "device_request_v1";
pub const PRODUCT_CONNECTED: &str = "eliteew-desktop-connected";
pub const PRODUCT_FOFLINE: &str = "eliteew-fofline";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceRequestV1 {
    pub kind: String,
    pub request_id: String,
    pub product_id: String,
    pub app_identifier: String,
    pub device_signing_pubkey: String,
    pub capsule_recipient_pubkey: String,
    pub recipient_key_id: String,
    pub machine_fingerprint_hash: String,
    pub created_at: String,
    pub nonce: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeviceRequestPrepareView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub display_fingerprint: String,
    pub request: DeviceRequestV1,
    pub request_json: String,
    pub export_path: Option<String>,
}

fn now_rfc3339() -> Result<String, String> {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("clock: {e}"))?
        .as_secs();
    // Fixed UTC without chrono dependency: YYYY-MM-DDTHH:MM:SSZ via simple math.
    // Prefer precise formatting via time crate absent — use unix epoch ISO lite.
    Ok(format_unix_utc(secs))
}

fn format_unix_utc(secs: u64) -> String {
    // Civil date from Unix days (Howard Hinnant algorithm, UTC).
    let z = (secs / 86_400) as i64 + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    let tod = secs % 86_400;
    let hh = tod / 3600;
    let mm = (tod % 3600) / 60;
    let ss = tod % 60;
    format!("{y:04}-{m:02}-{d:02}T{hh:02}:{mm:02}:{ss:02}Z")
}

fn random_hex(nbytes: usize) -> String {
    let mut buf = vec![0u8; nbytes];
    getrandom::fill(&mut buf).expect("getrandom");
    hex::encode(buf)
}

fn fingerprint_hash(machine_fingerprint: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"eliteew-machine-fp-hash-v1|");
    hasher.update(machine_fingerprint.as_bytes());
    format!("mfh1_{}", hex::encode(hasher.finalize()))
}

fn display_fingerprint(request_id: &str, recipient_key_id: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(request_id.as_bytes());
    hasher.update(b"|");
    hasher.update(recipient_key_id.as_bytes());
    let d = hasher.finalize();
    format!(
        "{}-{}",
        hex::encode(&d[..2]).to_uppercase(),
        hex::encode(&d[2..4]).to_uppercase()
    )
}

pub fn signature_transcript(req: &DeviceRequestV1) -> String {
    format!(
        "device_request_v1|{}|{}|{}|{}|{}|{}|{}|{}|{}",
        req.request_id,
        req.product_id,
        req.app_identifier,
        req.device_signing_pubkey,
        req.capsule_recipient_pubkey,
        req.recipient_key_id,
        req.machine_fingerprint_hash,
        req.created_at,
        req.nonce
    )
}

pub fn product_for_app_identifier(app_identifier: &str) -> &'static str {
    if app_identifier.contains("fofline") {
        PRODUCT_FOFLINE
    } else {
        PRODUCT_CONNECTED
    }
}

pub fn build_signed_request(
    app_data: &Path,
    app_identifier: &str,
) -> Result<(DeviceRequestV1, String), String> {
    let crypto: DeviceCryptoPublic = device_keys::ensure_device_keys(app_data, Some(app_identifier))?;
    let identity = device_identity::load_or_create(&app_data.to_path_buf())?;
    let mut req = DeviceRequestV1 {
        kind: KIND.into(),
        request_id: format!("dr1_{}", random_hex(16)),
        product_id: product_for_app_identifier(app_identifier).into(),
        app_identifier: app_identifier.to_string(),
        device_signing_pubkey: crypto.device_signing_pubkey.clone(),
        capsule_recipient_pubkey: crypto.capsule_recipient_pubkey.clone(),
        recipient_key_id: crypto.recipient_key_id.clone(),
        machine_fingerprint_hash: fingerprint_hash(&identity.machine_fingerprint),
        created_at: now_rfc3339()?,
        nonce: random_hex(32),
        signature: String::new(),
    };
    let msg = signature_transcript(&req);
    let signing = device_keys::load_signing_sk(app_data, Some(app_identifier))?;
    let sig = signing.sign(msg.as_bytes());
    req.signature = hex::encode(sig.to_bytes());
    let display = display_fingerprint(&req.request_id, &req.recipient_key_id);
    Ok((req, display))
}

pub fn verify_request(req: &DeviceRequestV1) -> Result<(), String> {
    if req.kind != KIND {
        return Err("device_request_kind".into());
    }
    if req.device_signing_pubkey.len() != 64
        || req.capsule_recipient_pubkey.len() != 64
        || !req.device_signing_pubkey.bytes().all(|b| b.is_ascii_hexdigit())
        || !req
            .capsule_recipient_pubkey
            .bytes()
            .all(|b| b.is_ascii_hexdigit())
    {
        return Err("device_request_key_hex".into());
    }
    if req.nonce.len() < 32 || !req.nonce.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("device_request_nonce".into());
    }
    let pk_bytes = hex::decode(&req.device_signing_pubkey).map_err(|_| "device_request_pk")?;
    let mut pk_arr = [0u8; 32];
    if pk_bytes.len() != 32 {
        return Err("device_request_pk_len".into());
    }
    pk_arr.copy_from_slice(&pk_bytes);
    let verifying = VerifyingKey::from_bytes(&pk_arr).map_err(|_| "device_request_pk")?;
    let sig_bytes = hex::decode(&req.signature).map_err(|_| "device_request_sig")?;
    let signature = Signature::from_slice(&sig_bytes).map_err(|_| "device_request_sig")?;
    let msg = signature_transcript(req);
    verifying
        .verify(msg.as_bytes(), &signature)
        .map_err(|_| "device_request_bad_signature".to_string())?;
    Ok(())
}

pub fn export_to_import(app_data: &Path, req: &DeviceRequestV1) -> Result<PathBuf, String> {
    let _ = fs_bridge::ensure_roots(app_data).map_err(|e| e.message())?;
    let short = req
        .request_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_')
        .take(24)
        .collect::<String>();
    let name = format!("eliteew-device-request-{short}.json");
    // Wave 7 deny absolute IPC paths — resolve by relative name under Import root.
    let path = fs_bridge::resolve_relative_under_root(app_data, "import", &name)
        .map_err(|e| e.message())?;
    let json = serde_json::to_string_pretty(req).map_err(|e| e.to_string())?;
    let mut f = fs::File::create(&path).map_err(|e| format!("create request: {e}"))?;
    f.write_all(json.as_bytes())
        .map_err(|e| format!("write request: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use std::sync::Mutex;

    static HOME_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn export_writes_under_home_import() {
        let _guard = HOME_LOCK.lock().expect("home lock");
        let tmp = tempfile::tempdir().expect("tempdir");
        // SAFETY: serialized by HOME_LOCK; restored below.
        unsafe { std::env::set_var("HOME", tmp.path()) };
        let app_data = tmp.path().join("app-data");
        let _ = fs::create_dir_all(&app_data);
        let mut sk_bytes = [9u8; 32];
        let signing = SigningKey::from_bytes(&sk_bytes);
        sk_bytes = [0u8; 32];
        let pk = hex::encode(signing.verifying_key().as_bytes());
        let mut req = DeviceRequestV1 {
            kind: KIND.into(),
            request_id: "dr1_export_test_abcd".into(),
            product_id: PRODUCT_CONNECTED.into(),
            app_identifier: "world.empery.desktop.client".into(),
            device_signing_pubkey: pk,
            capsule_recipient_pubkey: "aa".repeat(32),
            recipient_key_id: "rk1_export".into(),
            machine_fingerprint_hash: "mfh1_export".into(),
            created_at: "2026-08-11T00:00:00Z".into(),
            nonce: "dd".repeat(16),
            signature: String::new(),
        };
        let t = signature_transcript(&req);
        req.signature = hex::encode(signing.sign(t.as_bytes()).to_bytes());
        let path = export_to_import(&app_data, &req).expect("export");
        assert!(path.ends_with("eliteew-device-request-dr1_export_test_abcd.json"));
        assert!(path.starts_with(tmp.path().join("EliteEW/Import")));
        let raw = fs::read_to_string(&path).expect("read");
        assert!(raw.contains("device_request_v1"));
        unsafe { std::env::remove_var("HOME") };
    }

    #[test]
    fn transcript_and_manual_verify() {
        let mut sk_bytes = [7u8; 32];
        let signing = SigningKey::from_bytes(&sk_bytes);
        sk_bytes = [0u8; 32];
        let pk = hex::encode(signing.verifying_key().as_bytes());
        let mut req = DeviceRequestV1 {
            kind: KIND.into(),
            request_id: "dr1_ab".into(),
            product_id: PRODUCT_CONNECTED.into(),
            app_identifier: "world.empery.desktop.client".into(),
            device_signing_pubkey: pk,
            capsule_recipient_pubkey: "bb".repeat(32),
            recipient_key_id: "rk1_x".into(),
            machine_fingerprint_hash: "mfh1_y".into(),
            created_at: "2026-08-11T00:00:00Z".into(),
            nonce: "cc".repeat(16),
            signature: String::new(),
        };
        let t = signature_transcript(&req);
        assert!(t.starts_with("device_request_v1|dr1_ab|"));
        let sig = signing.sign(t.as_bytes());
        req.signature = hex::encode(sig.to_bytes());
        verify_request(&req).expect("verify ok");
        req.nonce = "00".repeat(16);
        assert!(verify_request(&req).is_err());
    }
}
