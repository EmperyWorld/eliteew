// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// In-process native OIDC transaction store (PKCE/state/ticket). Not durable.
// Invariants:
// - Ticket plaintext and PKCE verifier never serialized to IPC.
// - One live transaction per client_id; complete consumes it.
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §Wave 2
// ---

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

const TTL_SECS: u64 = 900;

#[derive(Clone)]
pub struct NativeOidcTransaction {
    pub id: String,
    pub client_id: String,
    pub channel: String,
    pub redirect_uri: String,
    pub state: String,
    pub nonce: String,
    pub pkce_verifier: String,
    pub pkce_challenge: String,
    pub dpop_jkt: String,
    pub ticket: Option<String>,
    pub created_unix: u64,
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn store() -> &'static Mutex<HashMap<String, NativeOidcTransaction>> {
    static STORE: OnceLock<Mutex<HashMap<String, NativeOidcTransaction>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn is_fresh(tx: &NativeOidcTransaction, now: u64) -> bool {
    now.saturating_sub(tx.created_unix) <= TTL_SECS
}

pub fn put(tx: NativeOidcTransaction) -> Result<(), String> {
    let now = now_unix();
    let mut map = store()
        .lock()
        .map_err(|_| "oidc_tx_lock".to_string())?;
    map.retain(|_, existing| is_fresh(existing, now));
    map.retain(|_, existing| existing.client_id != tx.client_id);
    map.insert(tx.id.clone(), tx);
    Ok(())
}

/// Peek without consume (Hub interactive needs state for nav intercept).
pub fn get(id: &str) -> Option<NativeOidcTransaction> {
    let now = now_unix();
    store().lock().ok().and_then(|map| {
        map.get(id)
            .filter(|tx| is_fresh(tx, now))
            .cloned()
    })
}

pub fn take(id: &str) -> Option<NativeOidcTransaction> {
    let now = now_unix();
    let mut map = store().lock().ok()?;
    let tx = map.remove(id)?;
    if is_fresh(&tx, now) {
        Some(tx)
    } else {
        None
    }
}

pub fn clear_client(client_id: &str) {
    if let Ok(mut map) = store().lock() {
        map.retain(|_, tx| tx.client_id != client_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(id: &str, client: &str) -> NativeOidcTransaction {
        NativeOidcTransaction {
            id: id.into(),
            client_id: client.into(),
            channel: "desktop".into(),
            redirect_uri: "https://app.eliteew.ru/".into(),
            state: "st".into(),
            nonce: "nn".into(),
            pkce_verifier: "ver".into(),
            pkce_challenge: "ch".into(),
            dpop_jkt: "jkt".into(),
            ticket: Some("secret-ticket".into()),
            created_unix: now_unix(),
        }
    }

    #[test]
    fn put_replaces_same_client_and_take_consumes() {
        put(sample("tx-a", "empery-desktop-test-store")).expect("put a");
        put(sample("tx-b", "empery-desktop-test-store")).expect("put b");
        assert!(get("tx-a").is_none());
        let taken = take("tx-b").expect("tx-b");
        assert_eq!(taken.id, "tx-b");
        assert!(get("tx-b").is_none());
    }
}
