// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Wave 5 typed native egress policy — validate destinations; gate retail env overrides.
// Invariants:
// - Retail resolution ignores process-env channel/AI/key overrides (ops/debug only).
// - User-approved third-party AI: HTTPS (or loopback http), no userinfo/fragment,
//   no EliteEW product hosts; origin hash binds keyring accounts.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §5 / F-05..F-07
// ---

use sha2::{Digest, Sha256};
use url::Url;

/// Typed native HTTP destination classes (SoT §5).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum NativeEgressDestination {
    EliteewApi,
    EliteewAuth,
    UpdateMetadata,
    SignedArtifact,
    LocalAi,
    UserApprovedThirdPartyAi,
}

/// True when process-env may override baked channel/AI endpoints or AI keys.
/// Retail release: false. Ops profile or debug builds: true (dev/ops only).
#[allow(dead_code)]
pub fn env_overrides_allowed() -> bool {
    cfg!(feature = "ops-system-wg") || cfg!(debug_assertions)
}

/// Normalize to `scheme://host[:port]` (lowercase host, no path/query/fragment).
#[allow(dead_code)]
pub fn normalize_origin(raw: &str) -> Result<String, String> {
    let parsed = Url::parse(raw.trim()).map_err(|e| format!("origin_url_invalid:{e}"))?;
    origin_from_url(&parsed)
}

fn origin_from_url(parsed: &Url) -> Result<String, String> {
    if parsed.username() != "" || parsed.password().is_some() {
        return Err("origin_userinfo_forbidden".into());
    }
    if parsed.fragment().is_some() {
        return Err("origin_fragment_forbidden".into());
    }
    let scheme = parsed.scheme();
    let Some(host) = parsed.host_str() else {
        return Err("origin_host_missing".into());
    };
    let host_l = host.trim_end_matches('.').to_ascii_lowercase();
    let origin = match parsed.port() {
        Some(port) => format!("{scheme}://{host_l}:{port}"),
        None => format!("{scheme}://{host_l}"),
    };
    Ok(origin)
}

/// Stable keyring account suffix for an approved third-party origin.
pub fn third_party_origin_key_id(normalized_origin: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"eliteew-ai-third-party-v1\0");
    hasher.update(normalized_origin.as_bytes());
    hex::encode(&hasher.finalize()[..16])
}

fn is_loopback_host(host: &str) -> bool {
    let h = host.trim_end_matches('.').to_ascii_lowercase();
    h == "localhost"
        || h == "127.0.0.1"
        || h == "::1"
        || h == "[::1]"
        || h == "ai.local"
}

fn is_eliteew_product_host(host: &str) -> bool {
    let h = host.trim_end_matches('.').to_ascii_lowercase();
    h == "eliteew.ru"
        || h.ends_with(".eliteew.ru")
        || h == "empery.world"
        || h.ends_with(".empery.world")
}

/// Validate and normalize a user-approved third-party AI base URL.
pub fn validate_user_approved_third_party_ai_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("third_party_url_empty".into());
    }
    if trimmed.len() > 2048 {
        return Err("third_party_url_too_long".into());
    }
    let parsed = Url::parse(trimmed).map_err(|e| format!("third_party_url_invalid:{e}"))?;
    if parsed.username() != "" || parsed.password().is_some() {
        return Err("third_party_userinfo_forbidden".into());
    }
    if parsed.fragment().is_some() {
        return Err("third_party_fragment_forbidden".into());
    }
    let scheme = parsed.scheme();
    let Some(host) = parsed.host_str() else {
        return Err("third_party_host_missing".into());
    };
    let host_l = host.trim_end_matches('.').to_ascii_lowercase();
    let loopback = is_loopback_host(&host_l);
    match scheme {
        "https" => {}
        "http" if loopback => {}
        "http" => return Err("third_party_https_required".into()),
        "file" | "ftp" | "data" | "blob" | "javascript" => {
            return Err(format!("third_party_scheme_denied:{scheme}"));
        }
        other => return Err(format!("third_party_scheme_denied:{other}")),
    }
    if is_eliteew_product_host(&host_l) {
        return Err(format!(
            "third_party_eliteew_forbidden: use EliteEW AI path for '{host}'"
        ));
    }
    // Reject obvious private/link-local literals beyond loopback (SSRF hygiene).
    if !loopback {
        if host_l.starts_with("10.")
            || host_l.starts_with("192.168.")
            || host_l.starts_with("169.254.")
            || host_l == "0.0.0.0"
            || host_l.starts_with("172.")
                && host_l
                    .split('.')
                    .nth(1)
                    .and_then(|o| o.parse::<u8>().ok())
                    .is_some_and(|o| (16..=31).contains(&o))
        {
            return Err(format!("third_party_private_host_forbidden:{host_l}"));
        }
    }
    origin_from_url(&parsed)
}

/// Require HTTPS EliteEW platform URL (no userinfo/fragment); path may vary.
pub fn assert_eliteew_https_platform_url(raw: &str) -> Result<Url, String> {
    let parsed = Url::parse(raw.trim()).map_err(|e| format!("platform_url_invalid:{e}"))?;
    if parsed.scheme() != "https" {
        return Err(format!("platform_https_required:{}", parsed.scheme()));
    }
    if parsed.username() != "" || parsed.password().is_some() {
        return Err("platform_userinfo_forbidden".into());
    }
    if parsed.fragment().is_some() {
        return Err("platform_fragment_forbidden".into());
    }
    let Some(host) = parsed.host_str() else {
        return Err("platform_host_missing".into());
    };
    if !is_eliteew_product_host(host) {
        return Err(format!("platform_host_not_eliteew:{host}"));
    }
    let _ = NativeEgressDestination::EliteewApi;
    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn third_party_https_ok() {
        let o = validate_user_approved_third_party_ai_url("https://api.openai.com/v1").unwrap();
        assert_eq!(o, "https://api.openai.com");
    }

    #[test]
    fn third_party_rejects_userinfo_and_file() {
        assert!(validate_user_approved_third_party_ai_url("https://u:p@evil.test/").is_err());
        assert!(validate_user_approved_third_party_ai_url("file:///etc/passwd").is_err());
        assert!(validate_user_approved_third_party_ai_url("ftp://evil.test/").is_err());
    }

    #[test]
    fn third_party_rejects_eliteew_and_http_public() {
        assert!(validate_user_approved_third_party_ai_url("https://app.eliteew.ru/v1").is_err());
        assert!(validate_user_approved_third_party_ai_url("http://api.openai.com/v1").is_err());
    }

    #[test]
    fn third_party_allows_loopback_http_and_ai_local() {
        assert_eq!(
            validate_user_approved_third_party_ai_url("http://127.0.0.1:11434").unwrap(),
            "http://127.0.0.1:11434"
        );
        assert_eq!(
            validate_user_approved_third_party_ai_url("http://ai.local:8080/v1").unwrap(),
            "http://ai.local:8080"
        );
    }

    #[test]
    fn third_party_rejects_private_lan() {
        assert!(validate_user_approved_third_party_ai_url("https://10.0.0.5/v1").is_err());
        assert!(validate_user_approved_third_party_ai_url("https://192.168.1.1/v1").is_err());
    }

    #[test]
    fn origin_key_id_stable() {
        let a = third_party_origin_key_id("https://api.openai.com");
        let b = third_party_origin_key_id("https://api.openai.com");
        let c = third_party_origin_key_id("https://other.example");
        assert_eq!(a, b);
        assert_ne!(a, c);
        assert_eq!(a.len(), 32);
    }

    #[test]
    fn platform_https_eliteew_ok() {
        assert!(assert_eliteew_https_platform_url(
            "https://app.eliteew.ru/desktop-client-updates/latest.json"
        )
        .is_ok());
        assert!(assert_eliteew_https_platform_url("http://app.eliteew.ru/x").is_err());
        assert!(assert_eliteew_https_platform_url("https://evil.test/x").is_err());
    }
}
