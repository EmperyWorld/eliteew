// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Fail-closed JSON body cap for native OIDC ticket/token HTTP (F-13).
// Invariants:
// - Content-Length over cap is rejected before buffering.
// - Streamed bytes are counted; no unbounded `.bytes().await`.
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §Wave 2
// ---

use serde::de::DeserializeOwned;

/// Token and ticket JSON is small; 64 KiB is well above Keycloak token JSON.
pub const OIDC_HTTP_MAX_BYTES: usize = 64 * 1024;

pub fn content_length_allowed(content_length: Option<u64>, max_bytes: usize) -> bool {
    match content_length {
        Some(cl) => cl <= max_bytes as u64,
        None => true,
    }
}

pub async fn json_from_response<T: DeserializeOwned>(
    mut resp: reqwest::Response,
    max_bytes: usize,
) -> Result<T, String> {
    if !content_length_allowed(resp.content_length(), max_bytes) {
        return Err("oidc_http_too_large".into());
    }
    let mut buf = Vec::new();
    loop {
        match resp.chunk().await {
            Ok(Some(chunk)) => {
                let next = buf.len().saturating_add(chunk.len());
                if next > max_bytes {
                    return Err("oidc_http_too_large".into());
                }
                buf.extend_from_slice(&chunk);
            }
            Ok(None) => break,
            Err(_) => return Err("oidc_http_body".into()),
        }
    }
    serde_json::from_slice(&buf).map_err(|_| "oidc_http_json".into())
}

/// Drain a revoke/logout body without parsing (RFC 7009 may return empty 200).
pub async fn discard_body(mut resp: reqwest::Response, max_bytes: usize) -> Result<(), String> {
    if !content_length_allowed(resp.content_length(), max_bytes) {
        return Err("oidc_http_too_large".into());
    }
    let mut n = 0usize;
    loop {
        match resp.chunk().await {
            Ok(Some(chunk)) => {
                n = n.saturating_add(chunk.len());
                if n > max_bytes {
                    return Err("oidc_http_too_large".into());
                }
            }
            Ok(None) => return Ok(()),
            Err(_) => return Err("oidc_http_body".into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_length_over_cap_is_rejected() {
        assert!(!content_length_allowed(Some(OIDC_HTTP_MAX_BYTES as u64 + 1), OIDC_HTTP_MAX_BYTES));
        assert!(content_length_allowed(Some(OIDC_HTTP_MAX_BYTES as u64), OIDC_HTTP_MAX_BYTES));
        assert!(content_length_allowed(None, OIDC_HTTP_MAX_BYTES));
    }
}
