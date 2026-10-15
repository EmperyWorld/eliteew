// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Resolve / store ai.third_party API key via OS keyring bound to approved origin.
// Invariants:
// - Never return key material to FE; never log secrets.
// - Keyring only — no process-env credential fallback (Wave 5 / F-05 / F-07).
// - Account includes origin hash; origin change clears prior binding.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §3 / F-05
// - documentation/platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md §5
// ---

use keyring::Entry;

use crate::native_egress_policy::{
    third_party_origin_key_id, validate_user_approved_third_party_ai_url,
};

const SERVICE: &str = "world.empery.desktop.client";
/// Pre–Wave 5 unbound account — migrated once into origin-bound account.
const LEGACY_ACCOUNT: &str = "ai.third_party.api_key";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeySource {
    Keyring,
    None,
}

fn account_for_origin(normalized_origin: &str) -> String {
    format!(
        "ai.third_party.api_key.v1.{}",
        third_party_origin_key_id(normalized_origin)
    )
}

fn entry_for(account: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, account).map_err(|e| format!("keyring_entry: {e}"))
}

fn read_password(account: &str) -> Option<String> {
    let Ok(e) = entry_for(account) else {
        return None;
    };
    match e.get_password() {
        Ok(p) if !p.trim().is_empty() => Some(p),
        _ => None,
    }
}

fn delete_account(account: &str) -> Result<(), String> {
    let e = entry_for(account)?;
    match e.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(format!("keyring_delete: {err}")),
    }
}

/// Resolve approved origin from stored base URL (must already pass policy).
#[allow(dead_code)]
pub fn origin_from_settings_base(base_url: &str) -> Result<String, String> {
    validate_user_approved_third_party_ai_url(base_url)
}

/// Peek whether a key is available for this origin (no secret returned).
pub fn probe_key_source_for_origin(normalized_origin: &str) -> KeySource {
    let account = account_for_origin(normalized_origin);
    if read_password(&account).is_some() || read_password(LEGACY_ACCOUNT).is_some() {
        KeySource::Keyring
    } else {
        KeySource::None
    }
}

/// Load key for outbound HTTP only. Prefer origin-bound keyring, then one-shot legacy migrate.
pub fn load_api_key_for_origin(normalized_origin: &str) -> Result<(String, KeySource), String> {
    let account = account_for_origin(normalized_origin);
    if let Some(p) = read_password(&account) {
        return Ok((p, KeySource::Keyring));
    }
    if let Some(legacy) = read_password(LEGACY_ACCOUNT) {
        let _ = store_api_key_for_origin(normalized_origin, &legacy);
        let _ = delete_account(LEGACY_ACCOUNT);
        return Ok((legacy, KeySource::Keyring));
    }
    Err("API key missing — сохраните ключ в OS keyring для подтверждённого адреса API".into())
}

pub fn store_api_key_for_origin(normalized_origin: &str, secret: &str) -> Result<(), String> {
    let trimmed = secret.trim();
    if trimmed.is_empty() {
        return Err("empty_api_key".into());
    }
    let account = account_for_origin(normalized_origin);
    let e = entry_for(&account)?;
    e.set_password(trimmed)
        .map_err(|err| format!("keyring_set: {err}"))?;
    let _ = delete_account(LEGACY_ACCOUNT);
    Ok(())
}

pub fn clear_legacy_unbound_api_key() -> Result<(), String> {
    delete_account(LEGACY_ACCOUNT)
}

pub fn clear_api_key_for_origin(normalized_origin: &str) -> Result<(), String> {
    delete_account(&account_for_origin(normalized_origin))?;
    delete_account(LEGACY_ACCOUNT)
}

/// Clear key when origin changes (old binding must not apply to the new origin).
pub fn clear_api_key_on_origin_change(
    previous_origin: Option<&str>,
    next_origin: &str,
) -> Result<(), String> {
    if let Some(prev) = previous_origin {
        if prev != next_origin {
            clear_api_key_for_origin(prev)?;
        }
    }
    Ok(())
}

pub fn key_source_label(src: KeySource) -> &'static str {
    match src {
        KeySource::Keyring => "keyring",
        KeySource::None => "none",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_source_label_stable() {
        assert_eq!(key_source_label(KeySource::None), "none");
        assert_eq!(key_source_label(KeySource::Keyring), "keyring");
    }

    #[test]
    fn account_includes_origin_hash() {
        let a = account_for_origin("https://api.openai.com");
        let b = account_for_origin("https://other.example");
        assert!(a.starts_with("ai.third_party.api_key.v1."));
        assert_ne!(a, b);
    }
}
