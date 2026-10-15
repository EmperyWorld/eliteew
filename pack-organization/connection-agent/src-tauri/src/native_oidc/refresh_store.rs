// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// OS-keyring storage for native OIDC refresh tokens (never JS).
// Invariants:
// - Account is edition-scoped via device_keys::keyring_service.
// - Refresh plaintext is wiped from temporary strings after set.
// Related:
// - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §Wave 2
// ---

use keyring::Entry;

use crate::device_keys::keyring_service;

fn account(client_id: &str) -> String {
    format!("oidc.refresh.{client_id}.v1")
}

pub fn store_refresh(
    app_identifier: Option<&str>,
    client_id: &str,
    refresh: &str,
) -> Result<(), String> {
    let trimmed = refresh.trim();
    if trimmed.is_empty() || trimmed.len() > 8192 {
        return Err("refresh_token".into());
    }
    if client_id != "empery-desktop" && client_id != "empery-fofline" {
        return Err("refresh_client".into());
    }
    let service = keyring_service(app_identifier);
    let entry = Entry::new(&service, &account(client_id)).map_err(|e| format!("keyring_entry: {e}"))?;
    entry
        .set_password(trimmed)
        .map_err(|e| format!("keyring_set: {e}"))
}

pub fn load_refresh(app_identifier: Option<&str>, client_id: &str) -> Result<String, String> {
    if client_id != "empery-desktop" && client_id != "empery-fofline" {
        return Err("refresh_client".into());
    }
    let service = keyring_service(app_identifier);
    let entry = Entry::new(&service, &account(client_id)).map_err(|e| format!("keyring_entry: {e}"))?;
    let pw = entry
        .get_password()
        .map_err(|e| format!("keyring_get: {e}"))?;
    let trimmed = pw.trim().to_string();
    if trimmed.is_empty() {
        return Err("refresh_empty".into());
    }
    Ok(trimmed)
}

pub fn clear_refresh(app_identifier: Option<&str>, client_id: &str) {
    if client_id != "empery-desktop" && client_id != "empery-fofline" {
        return;
    }
    let service = keyring_service(app_identifier);
    if let Ok(entry) = Entry::new(&service, &account(client_id)) {
        let _ = entry.delete_credential();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_is_client_scoped() {
        assert_eq!(account("empery-desktop"), "oidc.refresh.empery-desktop.v1");
        assert_eq!(account("empery-fofline"), "oidc.refresh.empery-fofline.v1");
    }
}
