// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// P-256 DPoP JWK thumbprint (RFC 7638) and compact ES256 DPoP JWT (RFC 9449).
// Invariants:
// - Private scalar never serialized into JWK/JWT header.
// - JKT is SHA-256 of canonical JWK members crv/kty/x/y only.
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §Wave 2
// ---

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use p256::ecdsa::signature::Signer;
use p256::ecdsa::{Signature, SigningKey};
use sha2::{Digest, Sha256};

/// Prefix for Ed25519 device-identity binding over the DPoP JKT.
pub const DPOP_JKT_BIND_PREFIX: &[u8] = b"eliteew-dpop-jkt-v1|";

fn b64url(data: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(data)
}

fn signing_key_from_secret(secret: &[u8; 32]) -> Result<SigningKey, String> {
    SigningKey::from_slice(secret).map_err(|e| format!("dpop_key: {e}"))
}

fn public_xy(secret: &[u8; 32]) -> Result<(String, String), String> {
    let sk = signing_key_from_secret(secret)?;
    let encoded = sk.verifying_key().to_encoded_point(false);
    let x = encoded.x().ok_or_else(|| "dpop_x".to_string())?;
    let y = encoded.y().ok_or_else(|| "dpop_y".to_string())?;
    Ok((b64url(x.as_slice()), b64url(y.as_slice())))
}

/// RFC 7638 JWK thumbprint for the P-256 public key (base64url, no pad).
pub fn jkt_from_secret(secret: &[u8; 32]) -> Result<String, String> {
    let (x, y) = public_xy(secret)?;
    let canonical = format!(r#"{{"crv":"P-256","kty":"EC","x":"{x}","y":"{y}"}}"#);
    let digest = Sha256::digest(canonical.as_bytes());
    Ok(b64url(&digest))
}

pub fn public_jwk(secret: &[u8; 32]) -> Result<serde_json::Value, String> {
    let (x, y) = public_xy(secret)?;
    Ok(serde_json::json!({
        "kty": "EC",
        "crv": "P-256",
        "x": x,
        "y": y,
    }))
}

/// Compact DPoP proof for one HTTP method + exact token/PAR URL (no query/fragment).
pub fn sign_dpop_proof(
    secret: &[u8; 32],
    htm: &str,
    htu: &str,
    iat: u64,
    jti: &str,
) -> Result<String, String> {
    let method = htm.trim().to_ascii_uppercase();
    if method != "POST" && method != "GET" {
        return Err("dpop_htm".into());
    }
    let htu_n = htu.trim();
    if htu_n.is_empty() || htu_n.contains('?') || htu_n.contains('#') {
        return Err("dpop_htu".into());
    }
    let jwk = public_jwk(secret)?;
    let header = serde_json::json!({
        "typ": "dpop+jwt",
        "alg": "ES256",
        "jwk": jwk,
    });
    let payload = serde_json::json!({
        "jti": jti,
        "htm": method,
        "htu": htu_n,
        "iat": iat,
    });
    let header_b64 = b64url(header.to_string().as_bytes());
    let payload_b64 = b64url(payload.to_string().as_bytes());
    let signing_input = format!("{header_b64}.{payload_b64}");
    let sk = signing_key_from_secret(secret)?;
    let sig: Signature = sk.sign(signing_input.as_bytes());
    Ok(format!("{signing_input}.{}", b64url(&sig.to_bytes())))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// NIST P-256 sample scalar (in-range, not a device secret).
    fn sample_secret() -> [u8; 32] {
        let hex = "c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721";
        let bytes = hex::decode(hex).unwrap();
        let mut out = [0u8; 32];
        out.copy_from_slice(&bytes);
        out
    }

    #[test]
    fn jkt_is_stable_base64url() {
        let a = jkt_from_secret(&sample_secret()).unwrap();
        let b = jkt_from_secret(&sample_secret()).unwrap();
        assert_eq!(a, b);
        assert!(a.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
        assert!(!a.contains('='));
        assert!(a.len() >= 32);
    }

    #[test]
    fn public_jwk_has_no_private_d() {
        let jwk = public_jwk(&sample_secret()).unwrap();
        assert_eq!(jwk.get("d"), None);
        assert_eq!(jwk["kty"], "EC");
        assert_eq!(jwk["crv"], "P-256");
    }

    #[test]
    fn dpop_proof_is_three_segments_and_rejects_query_htu() {
        let proof = sign_dpop_proof(
            &sample_secret(),
            "POST",
            "https://auth.eliteew.ru/realms/empery/protocol/openid-connect/token",
            1_700_000_000,
            "jti-1",
        )
        .unwrap();
        assert_eq!(proof.split('.').count(), 3);
        assert!(sign_dpop_proof(
            &sample_secret(),
            "POST",
            "https://auth.eliteew.ru/token?x=1",
            1,
            "j"
        )
        .is_err());
    }
}
