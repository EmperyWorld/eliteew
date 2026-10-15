// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Process-memory access/id cache for product WebView host inject.
// Invariants:
// - Refresh token never stored here (keyring only).
// - Last product_open client is Rust-owned — product IPC cannot pick edition.
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §9.4
// ---

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::native_oidc::NativeOidcClient;

const EXPIRY_SKEW_SECS: u64 = 30;

#[derive(Debug, Clone)]
pub struct AccessCache {
    pub client: NativeOidcClient,
    pub access: String,
    pub id_token: Option<String>,
    pub expires_at_unix: u64,
}

static ACCESS_CACHE: Mutex<Option<AccessCache>> = Mutex::new(None);
static LAST_PRODUCT_CLIENT: Mutex<Option<NativeOidcClient>> = Mutex::new(None);

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn lock_access() -> std::sync::MutexGuard<'static, Option<AccessCache>> {
    ACCESS_CACHE.lock().unwrap_or_else(|e| e.into_inner())
}

fn lock_client() -> std::sync::MutexGuard<'static, Option<NativeOidcClient>> {
    LAST_PRODUCT_CLIENT
        .lock()
        .unwrap_or_else(|e| e.into_inner())
}

pub fn set_last_product_client(client: NativeOidcClient) {
    *lock_client() = Some(client);
}

pub fn last_product_client() -> Option<NativeOidcClient> {
    *lock_client()
}

pub fn remember_access(
    client: NativeOidcClient,
    access: &str,
    id_token: Option<&str>,
    expires_in: u64,
) {
    let trimmed = access.trim();
    if trimmed.is_empty() {
        return;
    }
    let ttl = expires_in.max(1);
    *lock_access() = Some(AccessCache {
        client,
        access: trimmed.to_string(),
        id_token: id_token
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string),
        expires_at_unix: now_unix().saturating_add(ttl),
    });
}

pub fn clear_client(client: NativeOidcClient) {
    let mut guard = lock_access();
    if guard.as_ref().is_some_and(|c| c.client == client) {
        *guard = None;
    }
}

pub fn unexpired(client: NativeOidcClient) -> Option<AccessCache> {
    let guard = lock_access();
    let cached = guard.as_ref()?;
    if cached.client != client {
        return None;
    }
    let until = cached.expires_at_unix.saturating_sub(EXPIRY_SKEW_SECS);
    if now_unix() >= until {
        return None;
    }
    Some(cached.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    static TEST_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn remember_and_unexpired_roundtrip() {
        let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        remember_access(
            NativeOidcClient::EmperyDesktop,
            " access-1 ",
            Some(" id-1 "),
            600,
        );
        let cached = unexpired(NativeOidcClient::EmperyDesktop).expect("cached");
        assert_eq!(cached.access, "access-1");
        assert_eq!(cached.id_token.as_deref(), Some("id-1"));
        assert!(unexpired(NativeOidcClient::EmperyFofline).is_none());
        clear_client(NativeOidcClient::EmperyDesktop);
        assert!(unexpired(NativeOidcClient::EmperyDesktop).is_none());
    }

    #[test]
    fn empty_access_is_ignored() {
        let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_client(NativeOidcClient::EmperyDesktop);
        remember_access(NativeOidcClient::EmperyDesktop, "   ", None, 600);
        assert!(unexpired(NativeOidcClient::EmperyDesktop).is_none());
    }
}
