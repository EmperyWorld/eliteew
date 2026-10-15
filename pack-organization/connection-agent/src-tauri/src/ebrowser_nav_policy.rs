// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Authoritative EBrowser HTTPS navigation policy (open / allowlist / denylist).
// Invariants:
// - Fail-closed when policy missing or TTL expired.
// - HTTPS only (+ about:blank); userinfo and non-443 ports denied.
// - ACTIVE_POLICY is Rust-owned (API fetch), never SPA invoke snapshot.
// Related:
// - documentation/product/desktop/DESKTOP-EBROWSER.md
// - shared/api/services/ebrowser/nav_policy.py
// - ebrowser_policy_fetch.rs
// ---

use serde::{Deserialize, Serialize};
use std::net::{Ipv4Addr, Ipv6Addr};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use url::Url;

pub const POLICY_TTL_SECONDS: u64 = 300;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PolicyMode {
    Open,
    Allowlist,
    Denylist,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicySnapshot {
    pub mode: PolicyMode,
    #[serde(default)]
    pub allow: Vec<String>,
    #[serde(default)]
    pub deny: Vec<String>,
    /// Unix epoch millis when SPA/API fetched the policy.
    pub fetched_at_ms: u64,
    #[serde(default = "default_ttl")]
    pub ttl_seconds: u64,
}

fn default_ttl() -> u64 {
    POLICY_TTL_SECONDS
}

static ACTIVE_POLICY: Mutex<Option<PolicySnapshot>> = Mutex::new(None);

pub fn store_policy(snapshot: Option<PolicySnapshot>) {
    if let Ok(mut g) = ACTIVE_POLICY.lock() {
        *g = snapshot;
    }
}

/// True when ACTIVE_POLICY exists and TTL has not expired (Rust receive clock).
pub fn active_policy_fresh() -> bool {
    let Ok(guard) = ACTIVE_POLICY.lock() else {
        return false;
    };
    let Some(policy) = guard.as_ref() else {
        return false;
    };
    let now_ms = now_epoch_ms();
    let ttl = policy.ttl_seconds.max(1).saturating_mul(1000);
    now_ms <= policy.fetched_at_ms.saturating_add(ttl)
}

pub fn navigation_allowed(url: &Url) -> bool {
    let Ok(guard) = ACTIVE_POLICY.lock() else {
        eprintln!("[STEP] ebrowser_nav_deny reason=policy_lock");
        return false;
    };
    let Some(policy) = guard.as_ref() else {
        eprintln!("[STEP] ebrowser_nav_deny reason=missing_policy");
        return false;
    };
    evaluate(url, policy)
}

pub fn evaluate(url: &Url, policy: &PolicySnapshot) -> bool {
    let now_ms = now_epoch_ms();
    let ttl = policy.ttl_seconds.max(1).saturating_mul(1000);
    if now_ms > policy.fetched_at_ms.saturating_add(ttl) {
        eprintln!("[STEP] ebrowser_nav_deny reason=expired");
        return false;
    }

    let scheme = url.scheme();
    if scheme == "about" {
        let ok = url.as_str() == "about:blank" || url.as_str().starts_with("about:blank?");
        if !ok {
            eprintln!("[STEP] ebrowser_nav_deny scheme=about");
        }
        return ok;
    }
    if scheme == "javascript" || scheme == "data" || scheme == "blob" || scheme == "file" || scheme == "http"
    {
        eprintln!("[STEP] ebrowser_nav_deny scheme={scheme}");
        return false;
    }
    if scheme != "https" {
        eprintln!("[STEP] ebrowser_nav_deny scheme={scheme}");
        return false;
    }
    if !url.username().is_empty() || url.password().is_some() {
        eprintln!("[STEP] ebrowser_nav_deny reason=userinfo");
        return false;
    }
    if let Some(port) = url.port() {
        if port != 443 {
            eprintln!("[STEP] ebrowser_nav_deny port={port}");
            return false;
        }
    }
    let Some(host) = url.host_str() else {
        eprintln!("[STEP] ebrowser_nav_deny reason=missing_host");
        return false;
    };
    let host_l = host.to_ascii_lowercase();

    match policy.mode {
        PolicyMode::Open => true,
        PolicyMode::Allowlist => {
            if policy.allow.is_empty() {
                eprintln!("[STEP] ebrowser_nav_deny reason=allowlist_miss host={host_l}");
                return false;
            }
            let ok = host_matches_any(&host_l, &policy.allow);
            if !ok {
                eprintln!("[STEP] ebrowser_nav_deny reason=allowlist_miss host={host_l}");
            }
            ok
        }
        PolicyMode::Denylist => {
            // Empty deny would otherwise allow all HTTPS — fail closed.
            if policy.deny.is_empty() {
                eprintln!("[STEP] ebrowser_nav_deny reason=denylist_hit host={host_l}");
                return false;
            }
            if host_matches_any(&host_l, &policy.deny) {
                eprintln!("[STEP] ebrowser_nav_deny reason=denylist_hit host={host_l}");
                return false;
            }
            true
        }
    }
}

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn host_matches_any(host: &str, entries: &[String]) -> bool {
    for raw in entries {
        let mut entry = raw.trim().to_ascii_lowercase();
        if entry.is_empty() {
            continue;
        }
        if let Some(stripped) = entry.strip_prefix('.') {
            entry = stripped.to_string();
        }
        if ipv4_in_cidr(host, &entry) || ipv6_in_cidr(host, &entry) {
            return true;
        }
        if host == entry || host.ends_with(&format!(".{entry}")) {
            return true;
        }
    }
    false
}

fn ipv4_in_cidr(host: &str, entry: &str) -> bool {
    let (net_s, prefix) = match entry.split_once('/') {
        Some((n, p)) => match p.parse::<u32>() {
            Ok(v) => (n, v),
            Err(_) => return false,
        },
        None => (entry, 32u32),
    };
    if prefix > 32 {
        return false;
    }
    // IPv4-only path — reject if entry looks like IPv6.
    if net_s.contains(':') {
        return false;
    }
    let Ok(host_ip) = host.parse::<Ipv4Addr>() else {
        return false;
    };
    let Ok(net_ip) = net_s.parse::<Ipv4Addr>() else {
        return false;
    };
    let host_n = u32::from(host_ip);
    let net_n = u32::from(net_ip);
    let mask = if prefix == 0 {
        0u32
    } else {
        (!0u32) << (32 - prefix)
    };
    (host_n & mask) == (net_n & mask)
}

fn ipv6_in_cidr(host: &str, entry: &str) -> bool {
    let (net_s, prefix) = match entry.split_once('/') {
        Some((n, p)) => match p.parse::<u32>() {
            Ok(v) => (n, v),
            Err(_) => return false,
        },
        None => (entry, 128u32),
    };
    if prefix > 128 {
        return false;
    }
    let host_clean = host.trim().trim_start_matches('[').trim_end_matches(']');
    let net_clean = net_s.trim().trim_start_matches('[').trim_end_matches(']');
    if !net_clean.contains(':') {
        return false;
    }
    let Ok(host_ip) = host_clean.parse::<Ipv6Addr>() else {
        return false;
    };
    let Ok(net_ip) = net_clean.parse::<Ipv6Addr>() else {
        return false;
    };
    let host_n = u128::from(host_ip);
    let net_n = u128::from(net_ip);
    let mask = if prefix == 0 {
        0u128
    } else {
        (!0u128) << (128 - prefix)
    };
    (host_n & mask) == (net_n & mask)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snap(mode: PolicyMode, allow: &[&str], deny: &[&str]) -> PolicySnapshot {
        PolicySnapshot {
            mode,
            allow: allow.iter().map(|s| (*s).to_string()).collect(),
            deny: deny.iter().map(|s| (*s).to_string()).collect(),
            fetched_at_ms: now_epoch_ms(),
            ttl_seconds: POLICY_TTL_SECONDS,
        }
    }

    #[test]
    fn open_https_ok_http_denied() {
        let p = snap(PolicyMode::Open, &[], &[]);
        let https = Url::parse("https://example.com/x").unwrap();
        let http = Url::parse("http://example.com/x").unwrap();
        assert!(evaluate(&https, &p));
        assert!(!evaluate(&http, &p));
    }

    #[test]
    fn allowlist_suffix_and_cidr() {
        let p = snap(PolicyMode::Allowlist, &["example.com", "10.0.0.0/8"], &[]);
        assert!(evaluate(
            &Url::parse("https://sub.example.com/").unwrap(),
            &p
        ));
        assert!(!evaluate(&Url::parse("https://evil.com/").unwrap(), &p));
        assert!(evaluate(&Url::parse("https://10.1.2.3/").unwrap(), &p));
    }

    #[test]
    fn allowlist_ipv6_cidr() {
        let p = snap(PolicyMode::Allowlist, &["2001:db8::/32"], &[]);
        assert!(evaluate(
            &Url::parse("https://[2001:db8::1]/").unwrap(),
            &p
        ));
        assert!(!evaluate(
            &Url::parse("https://[2001:db9::1]/").unwrap(),
            &p
        ));
    }

    #[test]
    fn expired_fail_closed() {
        let mut p = snap(PolicyMode::Open, &[], &[]);
        p.fetched_at_ms = now_epoch_ms().saturating_sub(400_000);
        assert!(!evaluate(&Url::parse("https://example.com/").unwrap(), &p));
    }

    #[test]
    fn empty_denylist_fail_closed() {
        let p = snap(PolicyMode::Denylist, &[], &[]);
        assert!(!evaluate(&Url::parse("https://example.com/").unwrap(), &p));
    }

    #[test]
    fn empty_allowlist_fail_closed() {
        let p = snap(PolicyMode::Allowlist, &[], &[]);
        assert!(!evaluate(&Url::parse("https://example.com/").unwrap(), &p));
    }
}
