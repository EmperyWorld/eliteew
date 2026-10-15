// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// PKCE S256 + unguessable state/nonce for native OIDC transactions.
// Invariants:
// - Verifier never returned to JS.
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §Wave 2
// ---

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use sha2::{Digest, Sha256};

pub fn random_b64url_32() -> String {
    let mut buf = [0u8; 32];
    getrandom::fill(&mut buf).expect("getrandom");
    URL_SAFE_NO_PAD.encode(buf)
}

pub fn pkce_challenge_s256(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn challenge_is_deterministic_for_verifier() {
        let v = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let a = pkce_challenge_s256(v);
        let b = pkce_challenge_s256(v);
        assert_eq!(a, b);
        assert!(!a.contains('='));
    }
}
