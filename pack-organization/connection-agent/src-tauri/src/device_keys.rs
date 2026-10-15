// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Per-device Ed25519 signing + X25519 capsule-recipient keys in OS keyring.
// Invariants:
// - Private material never returned to JS; only public IDs in non-secret state.
// - Edition-scoped keyring service (Connected vs FoFline).
// - P-256 DPoP SK stays in keyring; public state holds JKT + Ed25519 bind sig only.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-03
// ---

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use ed25519_dalek::{Signer, SigningKey};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use x25519_dalek::{PublicKey as X25519Public, StaticSecret};

use crate::dpop_crypto::{jkt_from_secret, DPOP_JKT_BIND_PREFIX};

const ACCOUNT_SIGNING: &str = "device.signing.sk.v1";
const ACCOUNT_RECIPIENT: &str = "device.recipient.sk.v1";
const ACCOUNT_DPOP: &str = "device.dpop.p256.sk.v1";
const PUBLIC_STATE: &str = "device_crypto_pub.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCryptoPublic {
    pub device_signing_pubkey: String,
    pub capsule_recipient_pubkey: String,
    pub recipient_key_id: String,
    /// RFC 7638 thumbprint of the device P-256 DPoP public JWK (never the SK).
    #[serde(default)]
    pub dpop_jkt: String,
    /// Ed25519 signature over `eliteew-dpop-jkt-v1|{jkt}` (hex).
    #[serde(default)]
    pub dpop_jkt_device_sig: String,
}

/// Edition-scoped OS keyring service name (Connected / FoFline / generic).
pub(crate) fn keyring_service(app_identifier: Option<&str>) -> String {
    // Reuse capsule_store edition mapping without exporting its private helper.
    let id = app_identifier.map(str::trim).filter(|s| !s.is_empty()).unwrap_or("");
    if id.contains("fofline") {
        "world.empery.fofline".into()
    } else if id.contains("connected") {
        "world.empery.desktop.connected.v1".into()
    } else {
        "world.empery.desktop.client".into()
    }
}

fn entry(service: &str, account: &str) -> Result<Entry, String> {
    Entry::new(service, account).map_err(|e| format!("keyring_entry: {e}"))
}

fn random_32() -> [u8; 32] {
    let mut buf = [0u8; 32];
    getrandom::fill(&mut buf).expect("getrandom");
    buf
}

fn wipe(buf: &mut [u8]) {
    for b in buf.iter_mut() {
        *b = 0;
    }
}

fn recipient_key_id(recipient_pk_hex: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"eliteew-recipient-key-id-v1|");
    hasher.update(recipient_pk_hex.as_bytes());
    let digest = hasher.finalize();
    format!("rk1_{}", hex::encode(&digest[..8]))
}

fn public_state_path(app_data: &Path) -> PathBuf {
    app_data.join(PUBLIC_STATE)
}

fn load_public_state(app_data: &Path) -> Option<DeviceCryptoPublic> {
    let path = public_state_path(app_data);
    if !path.is_file() {
        return None;
    }
    let raw = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn persist_public_state(app_data: &Path, pub_state: &DeviceCryptoPublic) -> Result<(), String> {
    fs::create_dir_all(app_data).map_err(|e| format!("app data: {e}"))?;
    let path = public_state_path(app_data);
    let json = serde_json::to_string_pretty(pub_state).map_err(|e| e.to_string())?;
    let mut f = fs::File::create(&path).map_err(|e| format!("create crypto pub: {e}"))?;
    f.write_all(json.as_bytes())
        .map_err(|e| format!("write crypto pub: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

fn store_sk_hex(service: &str, account: &str, sk: &[u8; 32]) -> Result<(), String> {
    let hex_sk = hex::encode(sk);
    let e = entry(service, account)?;
    let res = e.set_password(&hex_sk);
    // Best-effort wipe of temporary string via drop; hex_sk goes out of scope.
    drop(hex_sk);
    res.map_err(|err| format!("keyring_set: {err}"))
}

fn load_sk_hex(service: &str, account: &str) -> Result<[u8; 32], String> {
    let e = entry(service, account)?;
    let pw = e
        .get_password()
        .map_err(|err| format!("keyring_get: {err}"))?;
    let bytes = hex::decode(pw.trim()).map_err(|_| "device_key_hex".to_string())?;
    if bytes.len() != 32 {
        return Err("device_key_len".into());
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes);
    Ok(out)
}

/// Ensure per-device keys exist; return public material only.
pub fn ensure_device_keys(
    app_data: &Path,
    app_identifier: Option<&str>,
) -> Result<DeviceCryptoPublic, String> {
    let service = keyring_service(app_identifier);
    if let Some(existing) = load_public_state(app_data) {
        // Verify keyring still has matching secrets (headless may lack keyring).
        if load_sk_hex(&service, ACCOUNT_SIGNING).is_ok()
            && load_sk_hex(&service, ACCOUNT_RECIPIENT).is_ok()
        {
            return ensure_dpop_on_existing(app_data, &service, existing);
        }
    }

    let mut signing_bytes = random_32();
    let signing = SigningKey::from_bytes(&signing_bytes);
    let signing_pk = hex::encode(signing.verifying_key().as_bytes());

    let mut recipient_bytes = random_32();
    let recipient_sk = StaticSecret::from(recipient_bytes);
    let recipient_pk = hex::encode(X25519Public::from(&recipient_sk).as_bytes());
    let rk_id = recipient_key_id(&recipient_pk);

    store_sk_hex(&service, ACCOUNT_SIGNING, &signing_bytes)?;
    store_sk_hex(&service, ACCOUNT_RECIPIENT, &recipient_bytes)?;
    wipe(&mut signing_bytes);
    wipe(&mut recipient_bytes);

    let (dpop_jkt, dpop_jkt_device_sig) = mint_dpop_bound_to_signing(&service, &signing)?;

    let pub_state = DeviceCryptoPublic {
        device_signing_pubkey: signing_pk,
        capsule_recipient_pubkey: recipient_pk,
        recipient_key_id: rk_id,
        dpop_jkt,
        dpop_jkt_device_sig,
    };
    persist_public_state(app_data, &pub_state)?;
    Ok(pub_state)
}

fn dpop_public_complete(state: &DeviceCryptoPublic) -> bool {
    !state.dpop_jkt.trim().is_empty() && !state.dpop_jkt_device_sig.trim().is_empty()
}

fn mint_dpop_bound_to_signing(
    service: &str,
    signing: &SigningKey,
) -> Result<(String, String), String> {
    let mut dpop_bytes = random_32();
    let jkt = jkt_from_secret(&dpop_bytes)?;
    store_sk_hex(service, ACCOUNT_DPOP, &dpop_bytes)?;
    wipe(&mut dpop_bytes);
    let mut msg = DPOP_JKT_BIND_PREFIX.to_vec();
    msg.extend_from_slice(jkt.as_bytes());
    let sig = hex::encode(signing.sign(&msg).to_bytes());
    Ok((jkt, sig))
}

fn ensure_dpop_on_existing(
    app_data: &Path,
    service: &str,
    mut existing: DeviceCryptoPublic,
) -> Result<DeviceCryptoPublic, String> {
    if dpop_public_complete(&existing) && load_sk_hex(service, ACCOUNT_DPOP).is_ok() {
        return Ok(existing);
    }
    let signing = {
        let mut bytes = load_sk_hex(service, ACCOUNT_SIGNING)?;
        let key = SigningKey::from_bytes(&bytes);
        wipe(&mut bytes);
        key
    };
    let (dpop_jkt, dpop_jkt_device_sig) = mint_dpop_bound_to_signing(service, &signing)?;
    existing.dpop_jkt = dpop_jkt;
    existing.dpop_jkt_device_sig = dpop_jkt_device_sig;
    persist_public_state(app_data, &existing)?;
    Ok(existing)
}

pub fn load_signing_sk(
    app_data: &Path,
    app_identifier: Option<&str>,
) -> Result<SigningKey, String> {
    let _ = ensure_device_keys(app_data, app_identifier)?;
    let service = keyring_service(app_identifier);
    let mut bytes = load_sk_hex(&service, ACCOUNT_SIGNING)?;
    let key = SigningKey::from_bytes(&bytes);
    wipe(&mut bytes);
    Ok(key)
}

pub fn load_recipient_sk_bytes(
    app_data: &Path,
    app_identifier: Option<&str>,
) -> Result<[u8; 32], String> {
    let _ = ensure_device_keys(app_data, app_identifier)?;
    let service = keyring_service(app_identifier);
    load_sk_hex(&service, ACCOUNT_RECIPIENT)
}

/// P-256 DPoP secret — never returned to JS.
pub fn load_dpop_sk_bytes(
    app_data: &Path,
    app_identifier: Option<&str>,
) -> Result<[u8; 32], String> {
    let _ = ensure_device_keys(app_data, app_identifier)?;
    let service = keyring_service(app_identifier);
    load_sk_hex(&service, ACCOUNT_DPOP)
}

/// Public DPoP JKT after keys are ensured.
pub fn dpop_jkt(app_data: &Path, app_identifier: Option<&str>) -> Result<String, String> {
    let pub_state = ensure_device_keys(app_data, app_identifier)?;
    let jkt = pub_state.dpop_jkt.trim();
    if jkt.is_empty() {
        return Err("dpop_jkt_missing".into());
    }
    Ok(jkt.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recipient_key_id_stable() {
        let a = recipient_key_id("aa".repeat(32).as_str());
        let b = recipient_key_id("aa".repeat(32).as_str());
        assert_eq!(a, b);
        assert!(a.starts_with("rk1_"));
    }

    #[test]
    fn dpop_jkt_bind_message_uses_canon_prefix() {
        assert_eq!(DPOP_JKT_BIND_PREFIX, b"eliteew-dpop-jkt-v1|");
    }
}
