// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Resolve DPoP `iat` against Keycloak server time (HTTP Date).
// Invariants:
// - Keycloak 26.7.1 DPoPIsActiveCheck: DEFAULT_PROOF_LIFETIME=10s,
//   DEFAULT_ALLOWED_CLOCK_SKEW=15s → iat must be in
//   [now-25, now+15] on the IdP clock. Local wall clock alone is not enough.
// - Public `auth.eliteew.ru` Date is edge nginx time and can lag IdP by ~20s;
//   a raw Date iat then ages out of the past window after RTT. Apply a small
//   forward bias still inside the +15s future skew.
// - When Date is already ahead of local, extra bias would exceed the +15s
//   future bound; clamp, never replace a parsed Date with local (that iat is
//   too old on the IdP → invalid_dpop_proof).
// - Probe URL is baked issuer only; never caller-supplied.
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §9.7
// ---

use std::time::{SystemTime, UNIX_EPOCH};

use reqwest::header::DATE;

use crate::native_oidc::urls::{assert_baked_https_url, BAKED_ISSUER};

/// Keycloak `DPoPUtil.DEFAULT_PROOF_LIFETIME` (26.7.1).
pub const KC_DPOP_PROOF_LIFETIME_SECS: i64 = 10;
/// Keycloak `DPoPUtil.DEFAULT_ALLOWED_CLOCK_SKEW` (26.7.1).
pub const KC_DPOP_CLOCK_SKEW_SECS: i64 = 15;
/// Forward bias on HTTP Date iat so edge lag + RTT stay inside the past window.
pub const DPOP_HTTP_DATE_FORWARD_BIAS_SECS: u64 = 8;

fn local_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Parse IMF-fix HTTP `Date` (e.g. `Fri, 14 Aug 2026 05:01:00 GMT`) to unix seconds.
pub fn parse_http_date_to_unix(value: &str) -> Option<u64> {
    let parsed = httpdate::parse_http_date(value.trim()).ok()?;
    Some(
        parsed
            .duration_since(UNIX_EPOCH)
            .ok()?
            .as_secs(),
    )
}

/// Whether `iat` would pass Keycloak `DPoPIsActiveCheck` at server `now`.
pub fn iat_active_on_server(iat: i64, server_now: i64) -> bool {
    let skew = KC_DPOP_CLOCK_SKEW_SECS;
    let lifetime = KC_DPOP_PROOF_LIFETIME_SECS;
    iat <= server_now + skew && iat >= server_now - lifetime - skew
}

/// Pick DPoP `iat` from a parsed HTTP Date vs local unix seconds.
///
/// Date ahead of local → use Date, clamped to local+15s (KC future skew).
/// Date behind local → Date + 8s bias, still clamped to local+15s.
/// Never returns local when Date parsed: local iat fails on an ahead IdP.
pub fn choose_dpop_iat_from_http_date(server: u64, local: u64) -> u64 {
    let future_cap = local.saturating_add(KC_DPOP_CLOCK_SKEW_SECS as u64);
    if server >= local {
        return server.min(future_cap);
    }
    server
        .saturating_add(DPOP_HTTP_DATE_FORWARD_BIAS_SECS)
        .min(future_cap)
}

/// HEAD/GET baked issuer; prefer `Date` header for DPoP `iat`. Falls back to local clock.
pub async fn resolve_dpop_iat(http: &reqwest::Client) -> u64 {
    if let Err(e) = assert_baked_https_url(BAKED_ISSUER, BAKED_ISSUER) {
        eprintln!("[STEP] native_oidc_dpop_iat_fallback reason=issuer_assert err={e}");
        return local_unix();
    }
    let local = local_unix();
    let resp = match http.head(BAKED_ISSUER).send().await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[STEP] native_oidc_dpop_iat_fallback reason=head_fail err={e}");
            return local;
        }
    };
    let Some(raw) = resp.headers().get(DATE).and_then(|v| v.to_str().ok()) else {
        eprintln!("[STEP] native_oidc_dpop_iat_fallback reason=date_header_missing");
        return local;
    };
    let Some(server) = parse_http_date_to_unix(raw) else {
        eprintln!("[STEP] native_oidc_dpop_iat_fallback reason=date_parse");
        return local;
    };
    let skew_vs_local = server as i64 - local as i64;
    let iat = choose_dpop_iat_from_http_date(server, local);
    eprintln!(
        "[STEP] native_oidc_dpop_iat source=http_date skew_vs_local_secs={skew_vs_local} bias_secs={} iat={iat}",
        DPOP_HTTP_DATE_FORWARD_BIAS_SECS
    );
    iat
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_imf_fix_http_date() {
        let unix = parse_http_date_to_unix("Fri, 14 Aug 2026 05:01:00 GMT").unwrap();
        assert_eq!(unix, 1_786_683_660);
    }

    #[test]
    fn rejects_garbage_date() {
        assert!(parse_http_date_to_unix("not-a-date").is_none());
        assert!(parse_http_date_to_unix("").is_none());
    }

    #[test]
    fn kc_active_window_matches_26_7_1() {
        let now = 1_786_683_660_i64;
        assert!(iat_active_on_server(now, now));
        assert!(iat_active_on_server(now + 15, now));
        assert!(!iat_active_on_server(now + 16, now));
        assert!(iat_active_on_server(now - 25, now));
        assert!(!iat_active_on_server(now - 26, now));
    }

    #[test]
    fn http_date_forward_bias_keeps_lagged_edge_inside_past_window() {
        let local = 1_786_683_660_u64;
        let edge_behind = local - 22;
        let iat = choose_dpop_iat_from_http_date(edge_behind, local);
        assert_eq!(iat, edge_behind + DPOP_HTTP_DATE_FORWARD_BIAS_SECS);
        assert!(iat_active_on_server(iat as i64, local as i64));
        assert!(iat_active_on_server(iat as i64, edge_behind as i64));
    }

    #[test]
    fn date_ahead_of_local_keeps_date_not_local_fallback() {
        // Poet seat: Date ≈ local+8; Date+8s bias sat outside local +15 and
        // used to fall back to local → KC invalid_dpop_proof.
        let local = 1_786_683_660_u64;
        let server = local + 8;
        let iat = choose_dpop_iat_from_http_date(server, local);
        assert_eq!(iat, server);
        assert_ne!(iat, local);
        assert!(iat_active_on_server(iat as i64, server as i64));
        assert!(iat_active_on_server(iat as i64, local as i64));
    }

    #[test]
    fn date_far_ahead_clamps_to_local_future_skew() {
        let local = 1_786_683_660_u64;
        let server = local + 20;
        let iat = choose_dpop_iat_from_http_date(server, local);
        assert_eq!(iat, local + KC_DPOP_CLOCK_SKEW_SECS as u64);
        assert!(iat_active_on_server(iat as i64, local as i64));
        assert!(iat_active_on_server(iat as i64, server as i64));
    }
}
