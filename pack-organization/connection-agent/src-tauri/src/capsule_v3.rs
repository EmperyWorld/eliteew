// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Open Capsule v3 opaque binary (EECAP3) — X25519/HKDF/ChaCha20-Poly1305 + Ed25519.
// Invariants:
// - Outer bytes must not expose license meta as ASCII (meta lives inside AEAD).
// - Decrypt uses only an explicit per-device recipient_sk from the caller (keyring).
// - Signing PK from bake/env only — never a shared recipient SK.
// - open returns inner capsule_payload_v2 JSON string (same shape as open_v2).
// Related:
// - api/services/desktop_client/capsule_seal.py
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §4 / §12g
// ---

use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use hkdf::Hkdf;
use serde_json::Value;
use sha2::{Digest, Sha256};
use x25519_dalek::{PublicKey, StaticSecret};

const CAPSULE_V3_MAGIC: &[u8; 8] = b"EECAP3\0\0";
const CAPSULE_V3_VER: u8 = 3;
const CAPSULE_V3_ALG: u8 = 1;
const HKDF_INFO_V3: &[u8] = b"eliteew-desktop-capsule-v3";
const PAYLOAD_KIND: &str = "eliteew_desktop_capsule_payload";
const ENCODING_ECAP_V3: &str = "ecap_v3";
const EXPIRY_SKEW_SECS: u64 = 5 * 60;
const MIN_BLOB_LEN: usize = 8 + 1 + 1 + 32 + 12 + 4 + 64;

const DEV_SIGNING_PK_HEX: &str =
    "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0";

fn capsule_dev_keys_allowed() -> bool {
    if !cfg!(debug_assertions) {
        return false;
    }
    match std::env::var("ELITEEW_CAPSULE_DEV_KEYS") {
        Ok(v) => matches!(
            v.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        Err(_) => false,
    }
}

fn decode_key32(raw: &str) -> Result<[u8; 32], String> {
    let bytes = hex::decode(raw.trim()).map_err(|_| "Файл недействителен".to_string())?;
    if bytes.len() != 32 {
        return Err("Файл недействителен".into());
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes);
    Ok(out)
}

fn load_signing_pk() -> Result<[u8; 32], String> {
    if cfg!(debug_assertions) {
        if let Ok(raw) = std::env::var("ELITEEW_DESKTOP_CAPSULE_SIGNING_PK") {
            let t = raw.trim();
            if !t.is_empty() && !t.contains("REPLACE_WITH") {
                return decode_key32(t);
            }
        }
    }
    if let Some(raw) = option_env!("ELITEEW_DESKTOP_CAPSULE_SIGNING_PK") {
        let t = raw.trim();
        if !t.is_empty() && !t.contains("REPLACE_WITH") {
            return decode_key32(t);
        }
    }
    if capsule_dev_keys_allowed() {
        return decode_key32(DEV_SIGNING_PK_HEX);
    }
    Err("capsule_keys_missing".into())
}

fn join_null(parts: &[&[u8]]) -> Vec<u8> {
    let mut out: Vec<u8> = Vec::new();
    for (i, part) in parts.iter().enumerate() {
        if i > 0 {
            out.push(0);
        }
        out.extend_from_slice(part);
    }
    out
}

fn aad_encrypt_v3(ephemeral_pk: &[u8], nonce: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(8 + 2 + 32 + 12);
    out.extend_from_slice(CAPSULE_V3_MAGIC);
    out.push(CAPSULE_V3_VER);
    out.push(CAPSULE_V3_ALG);
    out.extend_from_slice(ephemeral_pk);
    out.extend_from_slice(nonce);
    out
}

fn signature_transcript_v3(
    ephemeral_pk: &[u8],
    nonce: &[u8],
    ciphertext_sha256: &[u8],
    ciphertext: &[u8],
) -> Vec<u8> {
    let ver_alg = [CAPSULE_V3_VER, CAPSULE_V3_ALG];
    join_null(&[
        b"capsule_v3",
        CAPSULE_V3_MAGIC,
        &ver_alg,
        ephemeral_pk,
        nonce,
        ciphertext_sha256,
        ciphertext,
    ])
}

/// Parse `YYYY-MM-DDTHH:MM:SSZ` / `…+00:00` → Unix seconds (UTC).
fn parse_rfc3339_utc_secs(raw: &str) -> Result<u64, String> {
    let t = raw.trim();
    let core = if let Some(stripped) = t.strip_suffix('Z') {
        stripped
    } else if let Some(stripped) = t.strip_suffix("+00:00") {
        stripped
    } else {
        return Err("Файл недействителен".into());
    };
    let core = core.split('.').next().unwrap_or(core);
    let (date, time) = core
        .split_once('T')
        .ok_or_else(|| "Файл недействителен".to_string())?;
    let mut dparts = date.split('-');
    let y: i64 = dparts
        .next()
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| "Файл недействителен".to_string())?;
    let m: u32 = dparts
        .next()
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| "Файл недействителен".to_string())?;
    let d: u32 = dparts
        .next()
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| "Файл недействителен".to_string())?;
    if dparts.next().is_some() || !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return Err("Файл недействителен".into());
    }
    let mut tparts = time.split(':');
    let hh: u64 = tparts
        .next()
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| "Файл недействителен".to_string())?;
    let mm: u64 = tparts
        .next()
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| "Файл недействителен".to_string())?;
    let ss: u64 = tparts
        .next()
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| "Файл недействителен".to_string())?;
    if tparts.next().is_some() || hh > 23 || mm > 59 || ss > 60 {
        return Err("Файл недействителен".into());
    }
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as u64;
    let mp = if m > 2 { m - 3 } else { m + 9 };
    let doy = (153 * mp as u64 + 2) / 5 + d as u64 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = (era * 146_097 + doe as i64 - 719_468) as i64;
    if days < 0 {
        return Err("Файл недействителен".into());
    }
    Ok(days as u64 * 86_400 + hh * 3600 + mm * 60 + ss)
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Wrap raw Capsule v3 bytes as JSON transport for `capsule_import_channel`.
pub fn bytes_to_ecap_v3_transport(bytes: &[u8]) -> Result<String, String> {
    if !looks_like_capsule_v3_bytes(bytes) {
        return Err("Файл недействителен".into());
    }
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(serde_json::json!({
        "encoding": ENCODING_ECAP_V3,
        "package_b64": b64,
    })
    .to_string())
}

/// True when bytes start with Capsule v3 magic.
pub fn looks_like_capsule_v3_bytes(raw: &[u8]) -> bool {
    raw.len() >= CAPSULE_V3_MAGIC.len() && raw.starts_with(CAPSULE_V3_MAGIC)
}

/// True for JSON `{"encoding":"ecap_v3","package_b64":...}` or raw base64 of EECAP3 blob.
pub fn looks_like_capsule_v3_transport(raw: &str) -> bool {
    decode_transport_bytes(raw.trim())
        .map(|b| looks_like_capsule_v3_bytes(&b))
        .unwrap_or(false)
}

fn decode_transport_bytes(raw: &str) -> Result<Vec<u8>, String> {
    let t = raw.trim();
    if t.starts_with('{') {
        let v: Value =
            serde_json::from_str(t).map_err(|_| "Файл недействителен".to_string())?;
        if v.get("encoding").and_then(|e| e.as_str()) != Some(ENCODING_ECAP_V3) {
            return Err("Файл недействителен".into());
        }
        let b64 = v
            .get("package_b64")
            .and_then(|x| x.as_str())
            .ok_or_else(|| "Файл недействителен".to_string())?;
        return base64::engine::general_purpose::STANDARD
            .decode(b64.trim())
            .map_err(|_| "Файл недействителен".to_string());
    }
    base64::engine::general_purpose::STANDARD
        .decode(t)
        .map_err(|_| "Файл недействителен".to_string())
}

/// Verify + decrypt Capsule v3 transport → inner payload JSON string (v2 shape).
pub fn open_v3_with_recipient_sk(
    raw: &str,
    recipient_sk_bytes: [u8; 32],
) -> Result<String, String> {
    let blob = decode_transport_bytes(raw)?;
    open_v3_bytes(&blob, recipient_sk_bytes)
}

fn open_v3_bytes(blob: &[u8], recipient_sk_bytes: [u8; 32]) -> Result<String, String> {
    if blob.len() < MIN_BLOB_LEN {
        return Err("Файл недействителен".into());
    }
    if !blob.starts_with(CAPSULE_V3_MAGIC) {
        return Err("Файл недействителен".into());
    }
    let ver = blob[8];
    let alg = blob[9];
    if ver != CAPSULE_V3_VER {
        return Err(
            "Пакет устарел или не поддерживается. Подготовьте запрос устройства и получите новый пакет доступа."
                .into(),
        );
    }
    if alg != CAPSULE_V3_ALG {
        return Err("Файл недействителен".into());
    }
    let eph_pk = &blob[10..42];
    let nonce = &blob[42..54];
    let ct_len = u32::from_be_bytes([blob[54], blob[55], blob[56], blob[57]]) as usize;
    let ct_end = 58 + ct_len;
    if ct_end + 64 != blob.len() {
        return Err("Файл недействителен".into());
    }
    let ciphertext = &blob[58..ct_end];
    let sig_bytes = &blob[ct_end..];
    let ct_hash = Sha256::digest(ciphertext);

    let msg = signature_transcript_v3(eph_pk, nonce, ct_hash.as_slice(), ciphertext);
    let signing_pk = load_signing_pk().map_err(|e| {
        if e == "capsule_keys_missing" {
            e
        } else {
            "Файл недействителен".into()
        }
    })?;
    let verifying =
        VerifyingKey::from_bytes(&signing_pk).map_err(|_| "Файл недействителен".to_string())?;
    let signature =
        Signature::from_slice(sig_bytes).map_err(|_| "Файл недействителен".to_string())?;
    verifying
        .verify(&msg, &signature)
        .map_err(|_| "Файл недействителен".to_string())?;

    let aad = aad_encrypt_v3(eph_pk, nonce);
    let mut eph_arr = [0u8; 32];
    eph_arr.copy_from_slice(eph_pk);
    let recipient_sk = StaticSecret::from(recipient_sk_bytes);
    let shared = recipient_sk.diffie_hellman(&PublicKey::from(eph_arr));
    let hk = Hkdf::<Sha256>::new(None, shared.as_bytes());
    let mut key_bytes = [0u8; 32];
    hk.expand(HKDF_INFO_V3, &mut key_bytes)
        .map_err(|_| "Файл недействителен".to_string())?;
    let cipher = ChaCha20Poly1305::new(Key::from_slice(&key_bytes));
    key_bytes.fill(0);
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(nonce),
            Payload {
                msg: ciphertext,
                aad: &aad,
            },
        )
        .map_err(|_| "Файл недействителен".to_string())?;
    let text = String::from_utf8(plaintext).map_err(|_| "Файл недействителен".to_string())?;
    let inner: Value =
        serde_json::from_str(&text).map_err(|_| "Файл недействителен".to_string())?;
    let obj = inner
        .as_object()
        .ok_or_else(|| "Файл недействителен".to_string())?;

    if let Some(expires_at) = obj.get("expires_at").and_then(|v| v.as_str()) {
        if !expires_at.is_empty() {
            let expires_secs = parse_rfc3339_utc_secs(expires_at)?;
            if now_unix() > expires_secs.saturating_add(EXPIRY_SKEW_SECS) {
                return Err(
                    "Срок действия пакета истёк. Подготовьте запрос устройства и получите новый пакет."
                        .into(),
                );
            }
        }
    }

    let payload = obj
        .get("payload")
        .ok_or_else(|| "Файл недействителен".to_string())?;
    let payload_obj = payload
        .as_object()
        .ok_or_else(|| "Файл недействителен".to_string())?;
    if payload_obj.get("kind").and_then(|k| k.as_str()) != Some(PAYLOAD_KIND) {
        return Err("Файл недействителен".into());
    }
    if payload_obj.contains_key("license_key") {
        return Err("Файл недействителен".into());
    }
    serde_json::to_string(payload).map_err(|_| "Файл недействителен".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chacha20poly1305::aead::{Aead, KeyInit, Payload};
    use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
    use ed25519_dalek::{Signer, SigningKey};
    use hkdf::Hkdf;
    use sha2::{Digest, Sha256};
    use x25519_dalek::{PublicKey, StaticSecret};

    const DEV_SIGNING_SK_HEX: &str = "2222222222222222222222222222222222222222222222222222222222222222";
    const DEV_RECIPIENT_SK_HEX: &str =
        "1111111111111111111111111111111111111111111111111111111111111111";

    fn seal_v3_for_test(
        payload: &Value,
        recipient_sk: [u8; 32],
        signing_sk: [u8; 32],
        expires_at: &str,
    ) -> Vec<u8> {
        let recipient_pk = PublicKey::from(&StaticSecret::from(recipient_sk));
        let inner = serde_json::json!({
            "product_id": "eliteew-desktop-connected",
            "channel": "connected",
            "request_id": "dr1_test",
            "recipient_key_id": "rk1_test",
            "created_at": "2026-08-12T00:00:00Z",
            "expires_at": expires_at,
            "payload": payload,
        });
        let plaintext = serde_json::to_vec(&inner).expect("json");
        let eph_sk = StaticSecret::from([9u8; 32]);
        let eph_pk = PublicKey::from(&eph_sk);
        let shared = eph_sk.diffie_hellman(&recipient_pk);
        let hk = Hkdf::<Sha256>::new(None, shared.as_bytes());
        let mut key_bytes = [0u8; 32];
        hk.expand(HKDF_INFO_V3, &mut key_bytes).expect("hkdf");
        let nonce = [7u8; 12];
        let aad = aad_encrypt_v3(eph_pk.as_bytes(), &nonce);
        let cipher = ChaCha20Poly1305::new(Key::from_slice(&key_bytes));
        let ct = cipher
            .encrypt(
                Nonce::from_slice(&nonce),
                Payload {
                    msg: plaintext.as_ref(),
                    aad: &aad,
                },
            )
            .expect("encrypt");
        let ct_hash = Sha256::digest(&ct);
        let msg = signature_transcript_v3(eph_pk.as_bytes(), &nonce, ct_hash.as_slice(), &ct);
        let sk = SigningKey::from_bytes(&signing_sk);
        let sig = sk.sign(&msg);
        let mut blob = Vec::new();
        blob.extend_from_slice(CAPSULE_V3_MAGIC);
        blob.push(CAPSULE_V3_VER);
        blob.push(CAPSULE_V3_ALG);
        blob.extend_from_slice(eph_pk.as_bytes());
        blob.extend_from_slice(&nonce);
        blob.extend_from_slice(&(ct.len() as u32).to_be_bytes());
        blob.extend_from_slice(&ct);
        blob.extend_from_slice(&sig.to_bytes());
        blob
    }

    #[test]
    fn looks_like_magic_and_transport() {
        let mut blob = CAPSULE_V3_MAGIC.to_vec();
        blob.extend_from_slice(&[0u8; 20]);
        assert!(looks_like_capsule_v3_bytes(&blob));
        assert!(!looks_like_capsule_v3_bytes(b"EECAP2\0\0"));
        let b64 = base64::engine::general_purpose::STANDARD.encode(&blob);
        let wrap = serde_json::json!({
            "encoding": "ecap_v3",
            "package_b64": b64,
        })
        .to_string();
        assert!(looks_like_capsule_v3_transport(&wrap));
        assert!(looks_like_capsule_v3_transport(&b64));
        assert!(!looks_like_capsule_v3_transport(r#"{"kind":"eliteew_desktop_capsule","v":2}"#));
    }

    #[test]
    fn open_v3_roundtrip_with_dev_keys() {
        // Prefer explicit DEV PK over ambient bake/env signing PK (host shells often export prod PK).
        let prev_dev = std::env::var("ELITEEW_CAPSULE_DEV_KEYS").ok();
        let prev_pk = std::env::var("ELITEEW_DESKTOP_CAPSULE_SIGNING_PK").ok();
        // SAFETY: test-only env isolation for DEV signing verify path.
        unsafe {
            std::env::set_var("ELITEEW_CAPSULE_DEV_KEYS", "1");
            std::env::set_var("ELITEEW_DESKTOP_CAPSULE_SIGNING_PK", DEV_SIGNING_PK_HEX);
        }
        let recipient_sk = decode_key32(DEV_RECIPIENT_SK_HEX).unwrap();
        let signing_sk = decode_key32(DEV_SIGNING_SK_HEX).unwrap();
        let payload = serde_json::json!({
            "v": 2,
            "kind": PAYLOAD_KIND,
            "mode": "connected",
            "allow_offline": true,
            "allow_online": true,
            "allow_fofline": false,
            "request_id": "dr1_test",
            "recipient_key_id": "rk1_test",
            "product_id": "eliteew-desktop-connected",
            "activation_token": "tok_test_not_for_ipc",
            "entitlement": {"v": 1, "payload": {"license_id": "lic"}, "sig": "00"},
        });
        let far = "2099-01-01T00:00:00Z";
        let blob = seal_v3_for_test(&payload, recipient_sk, signing_sk, far);
        assert!(looks_like_capsule_v3_bytes(&blob));
        for needle in [b"expires_at".as_slice(), b"product_id", b"request_id", b"license_id"] {
            assert!(
                !blob.windows(needle.len()).any(|w| w == needle),
                "outer must not contain {:?}",
                std::str::from_utf8(needle)
            );
        }
        let wrap = serde_json::json!({
            "encoding": "ecap_v3",
            "package_b64": base64::engine::general_purpose::STANDARD.encode(&blob),
        })
        .to_string();
        let opened = open_v3_with_recipient_sk(&wrap, recipient_sk).expect("open");
        let got: Value = serde_json::from_str(&opened).expect("payload json");
        assert_eq!(got.get("kind").and_then(|k| k.as_str()), Some(PAYLOAD_KIND));
        assert_eq!(
            got.get("activation_token").and_then(|k| k.as_str()),
            Some("tok_test_not_for_ipc")
        );
        unsafe {
            match prev_dev {
                Some(v) => std::env::set_var("ELITEEW_CAPSULE_DEV_KEYS", v),
                None => {
                    let _ = std::env::remove_var("ELITEEW_CAPSULE_DEV_KEYS");
                }
            }
            match prev_pk {
                Some(v) => std::env::set_var("ELITEEW_DESKTOP_CAPSULE_SIGNING_PK", v),
                None => {
                    let _ = std::env::remove_var("ELITEEW_DESKTOP_CAPSULE_SIGNING_PK");
                }
            }
        }
    }

    #[test]
    fn transcript_prefix_is_capsule_v3() {
        let msg = signature_transcript_v3(&[1u8; 32], &[2u8; 12], &[3u8; 32], &[4u8; 8]);
        assert!(msg.starts_with(b"capsule_v3\0"));
        let aad = aad_encrypt_v3(&[1u8; 32], &[2u8; 12]);
        assert!(aad.starts_with(CAPSULE_V3_MAGIC));
        assert_eq!(aad[8], CAPSULE_V3_VER);
        assert_eq!(aad[9], CAPSULE_V3_ALG);
    }
}
