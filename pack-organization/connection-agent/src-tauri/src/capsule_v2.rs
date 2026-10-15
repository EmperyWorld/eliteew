// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Open Capsule v2 envelopes (Ed25519 transcript + X25519/HKDF/ChaCha20-Poly1305 AAD).
// Invariants:
// - Decrypt uses only an explicit per-device recipient_sk from the caller (keyring).
// - Signing PK from bake/env only — never a shared recipient SK.
// - Reject unknown fields, v!=2, bad hash/sig/expiry, inner license_key.
// Related:
// - api/services/desktop_client/capsule_seal.py
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §4
// ---

use std::collections::BTreeSet;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use hkdf::Hkdf;
use serde_json::Value;
use sha2::{Digest, Sha256};
use x25519_dalek::{PublicKey, StaticSecret};

const CAPSULE_KIND: &str = "eliteew_desktop_capsule";
const CAPSULE_V: u64 = 2;
const CAPSULE_ALG: &str = "x25519-chacha20poly1305-ed25519";
const HKDF_INFO: &[u8] = b"eliteew-desktop-capsule-v2";
const PAYLOAD_KIND: &str = "eliteew_desktop_capsule_payload";
const EXPIRY_SKEW_SECS: u64 = 5 * 60;

const DEV_SIGNING_PK_HEX: &str =
    "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0";

const ALLOWED_ENVELOPE_FIELDS: &[&str] = &[
    "kind",
    "v",
    "alg",
    "product_id",
    "channel",
    "request_id",
    "recipient_key_id",
    "ephemeral_pk",
    "created_at",
    "expires_at",
    "nonce",
    "ciphertext_sha256",
    "ciphertext",
    "sig",
];

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

fn require_str<'a>(envelope: &'a Value, key: &str) -> Result<&'a str, String> {
    envelope
        .get(key)
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Файл недействителен".to_string())
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

fn aad_encrypt_v2(
    product_id: &str,
    channel: &str,
    request_id: &str,
    recipient_key_id: &str,
    ephemeral_pk: &[u8],
    created_at: &str,
    expires_at: &str,
    nonce: &[u8],
) -> Vec<u8> {
    join_null(&[
        b"capsule_v2_aad",
        product_id.as_bytes(),
        channel.as_bytes(),
        request_id.as_bytes(),
        recipient_key_id.as_bytes(),
        ephemeral_pk,
        created_at.as_bytes(),
        expires_at.as_bytes(),
        nonce,
    ])
}

fn signature_transcript_v2(
    product_id: &str,
    channel: &str,
    request_id: &str,
    recipient_key_id: &str,
    ephemeral_pk: &[u8],
    created_at: &str,
    expires_at: &str,
    nonce: &[u8],
    ciphertext_sha256: &[u8],
    ciphertext: &[u8],
) -> Vec<u8> {
    join_null(&[
        b"capsule_v2",
        product_id.as_bytes(),
        channel.as_bytes(),
        request_id.as_bytes(),
        recipient_key_id.as_bytes(),
        ephemeral_pk,
        created_at.as_bytes(),
        expires_at.as_bytes(),
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
    // Drop fractional seconds if present.
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
    // Civil → Unix days (Howard Hinnant).
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

fn reject_unknown_fields(envelope: &Value) -> Result<(), String> {
    let obj = envelope
        .as_object()
        .ok_or_else(|| "Файл недействителен".to_string())?;
    let allowed: BTreeSet<&str> = ALLOWED_ENVELOPE_FIELDS.iter().copied().collect();
    let unknown: Vec<&str> = obj
        .keys()
        .map(String::as_str)
        .filter(|k| !allowed.contains(k))
        .collect();
    if !unknown.is_empty() {
        return Err("Файл недействителен".into());
    }
    Ok(())
}

/// True when JSON looks like Capsule kind with schema v=2.
pub fn looks_like_capsule_v2(raw: &str) -> bool {
    let t = raw.trim();
    if !t.starts_with('{') {
        return false;
    }
    let Ok(v) = serde_json::from_str::<Value>(t) else {
        return false;
    };
    v.get("kind").and_then(|k| k.as_str()) == Some(CAPSULE_KIND)
        && v.get("v").and_then(|x| x.as_u64()) == Some(CAPSULE_V)
}

/// True when JSON is Capsule kind with legacy schema v=1.
pub fn is_legacy_capsule_v1(raw: &str) -> bool {
    let t = raw.trim();
    if !t.starts_with('{') {
        return false;
    }
    let Ok(v) = serde_json::from_str::<Value>(t) else {
        return false;
    };
    v.get("kind").and_then(|k| k.as_str()) == Some(CAPSULE_KIND)
        && v.get("v").and_then(|x| x.as_u64()) == Some(1)
}

/// Build redacted channel-bring-up JSON from Capsule v2 payload (Rust-only).
/// Omits `license_key` and `activation_token`; keeps transport/mode fields for userspace start.
pub fn channel_material_json_from_payload(package: &Value) -> Result<String, String> {
    let mut seat = serde_json::Map::new();
    seat.insert(
        "kind".into(),
        Value::String("eliteew_desktop_seat".into()),
    );
    for key in [
        "mode",
        "mode_label_ru",
        "mode_hint_ru",
        "allow_offline",
        "allow_online",
        "allow_fofline",
        "wg_conf",
        "peer",
        "label",
        "license_id",
        "edition",
        "profile_id",
        "apps",
        "notes_ru",
        "issued_at",
    ] {
        if let Some(v) = package.get(key) {
            seat.insert(key.into(), v.clone());
        }
    }
    serde_json::to_string(&Value::Object(seat)).map_err(|e| e.to_string())
}

/// Verify + decrypt Capsule v2 → inner JSON string (payload object).
pub fn open_v2_with_recipient_sk(
    raw: &str,
    recipient_sk_bytes: [u8; 32],
) -> Result<String, String> {
    let envelope: Value =
        serde_json::from_str(raw.trim()).map_err(|_| "Файл недействителен".to_string())?;
    reject_unknown_fields(&envelope)?;
    if envelope.get("kind").and_then(|v| v.as_str()) != Some(CAPSULE_KIND) {
        return Err("Файл недействителен".into());
    }
    let v = envelope.get("v").and_then(|x| x.as_u64()).unwrap_or(0);
    if v != CAPSULE_V {
        return Err(
            "Пакет устарел или не поддерживается. Подготовьте запрос устройства и получите новый пакет доступа."
                .into(),
        );
    }
    if envelope.get("alg").and_then(|x| x.as_str()) != Some(CAPSULE_ALG) {
        return Err("Файл недействителен".into());
    }

    let product_id = require_str(&envelope, "product_id")?;
    let channel = require_str(&envelope, "channel")?;
    let request_id = require_str(&envelope, "request_id")?;
    let recipient_key_id = require_str(&envelope, "recipient_key_id")?;
    let created_at = require_str(&envelope, "created_at")?;
    let expires_at = require_str(&envelope, "expires_at")?;
    let eph_hex = require_str(&envelope, "ephemeral_pk")?;
    let nonce_hex = require_str(&envelope, "nonce")?;
    let ct_hash_hex = require_str(&envelope, "ciphertext_sha256")?;
    let ct_b64 = require_str(&envelope, "ciphertext")?;
    let sig_hex = require_str(&envelope, "sig")?;

    let eph_pk = hex::decode(eph_hex).map_err(|_| "Файл недействителен".to_string())?;
    let nonce = hex::decode(nonce_hex).map_err(|_| "Файл недействителен".to_string())?;
    let ct_hash = hex::decode(ct_hash_hex).map_err(|_| "Файл недействителен".to_string())?;
    let ciphertext = base64::engine::general_purpose::STANDARD
        .decode(ct_b64)
        .map_err(|_| "Файл недействителен".to_string())?;
    let sig_bytes = hex::decode(sig_hex).map_err(|_| "Файл недействителен".to_string())?;

    if eph_pk.len() != 32 || nonce.len() != 12 || ct_hash.len() != 32 {
        return Err("Файл недействителен".into());
    }
    let digest = Sha256::digest(&ciphertext);
    if digest.as_slice() != ct_hash.as_slice() {
        return Err("Файл недействителен".into());
    }

    let expires_secs = parse_rfc3339_utc_secs(expires_at)?;
    if now_unix() > expires_secs.saturating_add(EXPIRY_SKEW_SECS) {
        return Err("Срок действия пакета истёк. Подготовьте запрос устройства и получите новый пакет.".into());
    }

    let msg = signature_transcript_v2(
        product_id,
        channel,
        request_id,
        recipient_key_id,
        &eph_pk,
        created_at,
        expires_at,
        &nonce,
        &ct_hash,
        &ciphertext,
    );
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
        Signature::from_slice(&sig_bytes).map_err(|_| "Файл недействителен".to_string())?;
    verifying
        .verify(&msg, &signature)
        .map_err(|_| "Файл недействителен".to_string())?;

    let aad = aad_encrypt_v2(
        product_id,
        channel,
        request_id,
        recipient_key_id,
        &eph_pk,
        created_at,
        expires_at,
        &nonce,
    );
    let mut eph_arr = [0u8; 32];
    eph_arr.copy_from_slice(&eph_pk);
    let recipient_sk = StaticSecret::from(recipient_sk_bytes);
    let shared = recipient_sk.diffie_hellman(&PublicKey::from(eph_arr));
    let hk = Hkdf::<Sha256>::new(None, shared.as_bytes());
    let mut key_bytes = [0u8; 32];
    hk.expand(HKDF_INFO, &mut key_bytes)
        .map_err(|_| "Файл недействителен".to_string())?;
    let cipher = ChaCha20Poly1305::new(Key::from_slice(&key_bytes));
    key_bytes.fill(0);
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: ciphertext.as_ref(),
                aad: &aad,
            },
        )
        .map_err(|_| "Файл недействителен".to_string())?;
    let text = String::from_utf8(plaintext).map_err(|_| "Файл недействителен".to_string())?;
    let payload: Value =
        serde_json::from_str(&text).map_err(|_| "Файл недействителен".to_string())?;
    let obj = payload
        .as_object()
        .ok_or_else(|| "Файл недействителен".to_string())?;
    if obj.get("kind").and_then(|k| k.as_str()) != Some(PAYLOAD_KIND) {
        return Err("Файл недействителен".into());
    }
    if obj.contains_key("license_key") {
        return Err("Файл недействителен".into());
    }
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transcript_prefix_is_capsule_v2() {
        let msg = signature_transcript_v2(
            "eliteew-desktop-connected",
            "connected",
            "dr1_ab",
            "rk1_cd",
            &[1u8; 32],
            "2026-08-12T00:00:00Z",
            "2026-08-19T00:00:00Z",
            &[2u8; 12],
            &[3u8; 32],
            &[4u8; 8],
        );
        assert!(msg.starts_with(b"capsule_v2\0"));
        let aad = aad_encrypt_v2(
            "eliteew-desktop-connected",
            "connected",
            "dr1_ab",
            "rk1_cd",
            &[1u8; 32],
            "2026-08-12T00:00:00Z",
            "2026-08-19T00:00:00Z",
            &[2u8; 12],
        );
        assert!(aad.starts_with(b"capsule_v2_aad\0"));
    }

    #[test]
    fn looks_like_v2_and_legacy_v1() {
        let v2 = r#"{"kind":"eliteew_desktop_capsule","v":2}"#;
        let v1 = r#"{"kind":"eliteew_desktop_capsule","v":1}"#;
        assert!(looks_like_capsule_v2(v2));
        assert!(!looks_like_capsule_v2(v1));
        assert!(is_legacy_capsule_v1(v1));
        assert!(!is_legacy_capsule_v1(v2));
    }
}
