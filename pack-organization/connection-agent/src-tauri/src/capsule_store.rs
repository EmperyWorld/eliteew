// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// At-rest peer conf for Sealed Capsule — OS keyring only (No System Footprint).
// Invariants:
// - Never write WG conf under /etc or OS WireGuard dirs.
// - Never log conf material.
// - Envelope binds conf to machine fingerprint; SERVICE follows app identifier.
// - Keyring wire format is single-line base64 (gnome-keyring text files treat
//   bare `[Interface]`/`[Peer]` lines as section headers and corrupt login.keyring).
// - Edition-specific writes/clears never delete another edition's keyring entry.
// - Legacy shared entries are copied once, never moved or deleted on normal clear.
// - Factory-reset may wipe all edition services via clear_peer_conf_all_editions only.
// Related:
// - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §Sealed Capsule / device bind
// - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.3
// ---

use base64::Engine;
use keyring::Entry;

use crate::device_identity;

const ACCOUNT: &str = "sealed.peer_conf.v1";
const ENVELOPE_MAGIC: &str = "eliteew_sealed_peer_v1";
/// Prefix for keyring password value — must stay one line (no raw WG INI brackets).
const KEYRING_B64_MAGIC: &str = "eliteew_peer_keyring_b64_v1:";
const LEGACY_SERVICE: &str = "world.empery.desktop.client";
const CONNECTED_SERVICE: &str = "world.empery.desktop.connected.v1";
const FOFLINE_SERVICE: &str = "world.empery.fofline";

fn entry_for(service: &str) -> Result<Entry, String> {
    Entry::new(service, ACCOUNT).map_err(|e| format!("keyring_entry: {e}"))
}

fn resolve_service(app_identifier: Option<&str>) -> String {
    let id = app_identifier.map(str::trim).filter(|s| !s.is_empty());
    match id {
        Some(s) if s.contains("fofline") => FOFLINE_SERVICE.into(),
        Some(_) => CONNECTED_SERVICE.into(),
        None => LEGACY_SERVICE.into(),
    }
}

fn wrap_envelope(fingerprint: &str, conf: &str) -> String {
    format!("{ENVELOPE_MAGIC}\n{fingerprint}\n{conf}")
}

fn encode_for_keyring(payload: &str) -> String {
    format!(
        "{KEYRING_B64_MAGIC}{}",
        base64::engine::general_purpose::STANDARD.encode(payload.as_bytes())
    )
}

fn decode_from_keyring(raw: &str) -> Result<(String, bool), String> {
    let trimmed = raw.trim();
    if let Some(b64) = trimmed.strip_prefix(KEYRING_B64_MAGIC) {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(b64.trim())
            .map_err(|_| "peer_keyring_b64_decode".to_string())?;
        let text = String::from_utf8(bytes).map_err(|_| "peer_keyring_b64_utf8".to_string())?;
        return Ok((text, true));
    }
    Ok((trimmed.to_string(), false))
}

fn parse_envelope(raw: &str) -> Result<(Option<String>, String), String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("empty_peer_conf".into());
    }
    if let Some(rest) = trimmed.strip_prefix(ENVELOPE_MAGIC) {
        let rest = rest.trim_start_matches(['\r', '\n']);
        let mut lines = rest.splitn(2, '\n');
        let fp = lines
            .next()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| "envelope_fingerprint_missing".to_string())?
            .to_string();
        let body = lines.next().unwrap_or("").trim_start_matches('\r').to_string();
        if body.trim().is_empty() {
            return Err("envelope_conf_missing".into());
        }
        return Ok((Some(fp), body));
    }
    // Legacy plaintext WireGuard conf
    Ok((None, trimmed.to_string()))
}

pub fn store_peer_conf(conf: &str, app_identifier: Option<&str>) -> Result<(), String> {
    let trimmed = conf.trim();
    if trimmed.is_empty() {
        return Err("empty_peer_conf".into());
    }
    let fp = device_identity::current_machine_fingerprint();
    let payload = wrap_envelope(&fp, trimmed);
    let service = resolve_service(app_identifier);
    entry_for(&service)?
        .set_password(&encode_for_keyring(&payload))
        .map_err(|e| format!("keyring_set: {e}"))?;
    Ok(())
}

/// Load conf; verify envelope fingerprint against live/bound hardware.
/// Returns Ok(None) when missing; Err(`fingerprint_mismatch`) when bound to other device.
pub fn load_peer_conf(app_identifier: Option<&str>) -> Result<Option<String>, String> {
    let service = resolve_service(app_identifier);
    let (raw, from_legacy) = match read_raw(&service)? {
        Some(v) => (v, false),
        None if service != LEGACY_SERVICE => match read_raw(LEGACY_SERVICE)? {
            Some(v) => (v, true),
            None => return Ok(None),
        },
        None => return Ok(None),
    };
    let (decoded, already_b64) = decode_from_keyring(&raw)?;
    let (fp_opt, body) = parse_envelope(&decoded)?;
    if let Some(fp) = fp_opt {
        let live = device_identity::current_machine_fingerprint();
        let v1 = device_identity::machine_fingerprint_v1();
        if fp != live && fp != v1 {
            return Err("fingerprint_mismatch".into());
        }
    }
    // Migrate legacy service and/or pre-b64 wire format so reboot cannot corrupt login.keyring.
    if from_legacy || !already_b64 {
        let migrated = wrap_envelope(&device_identity::current_machine_fingerprint(), &body);
        entry_for(&service)?
            .set_password(&encode_for_keyring(&migrated))
            .map_err(|e| format!("keyring_migrate_set: {e}"))?;
    }
    Ok(Some(body))
}

fn read_raw(service: &str) -> Result<Option<String>, String> {
    match entry_for(service)?.get_password() {
        Ok(p) if !p.trim().is_empty() => Ok(Some(p)),
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("keyring_get: {e}")),
    }
}

pub fn clear_peer_conf(app_identifier: Option<&str>) -> Result<(), String> {
    let service = resolve_service(app_identifier);
    clear_peer_conf_service(&service)
}

/// Local factory-reset: wipe sealed peer for FoFline, Connected, and legacy keyrings.
/// Idempotent (missing entries are OK). Not used by edition-scoped `clear_peer_conf`.
pub fn clear_peer_conf_all_editions() -> Result<(), String> {
    clear_peer_conf_service(FOFLINE_SERVICE)?;
    clear_peer_conf_service(CONNECTED_SERVICE)?;
    clear_peer_conf_service(LEGACY_SERVICE)?;
    Ok(())
}

fn clear_peer_conf_service(service: &str) -> Result<(), String> {
    match entry_for(service)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("keyring_delete: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn envelope_roundtrip_parse() {
        let wrapped = wrap_envelope("fp_v2_abc", "[Interface]\nPrivateKey = x\n");
        let (fp, body) = parse_envelope(&wrapped).unwrap();
        assert_eq!(fp.as_deref(), Some("fp_v2_abc"));
        assert!(body.contains("[Interface]"));
    }

    #[test]
    fn legacy_plain_conf_parses() {
        let (fp, body) = parse_envelope("[Interface]\nPrivateKey = x\n").unwrap();
        assert!(fp.is_none());
        assert!(body.starts_with("[Interface]"));
    }

    #[test]
    fn keyring_b64_roundtrip_hides_ini_brackets() {
        let wrapped = wrap_envelope("fp", "[Interface]\nPrivateKey = x\n[Peer]\n");
        let wire = encode_for_keyring(&wrapped);
        assert!(wire.starts_with(KEYRING_B64_MAGIC));
        assert!(!wire.contains("[Interface]"));
        assert!(!wire.contains('\n'));
        let (decoded, was_b64) = decode_from_keyring(&wire).unwrap();
        assert!(was_b64);
        let (fp, body) = parse_envelope(&decoded).unwrap();
        assert_eq!(fp.as_deref(), Some("fp"));
        assert!(body.contains("[Peer]"));
    }

    #[test]
    fn edition_services_are_isolated() {
        assert_eq!(
            resolve_service(Some("world.empery.fofline")),
            FOFLINE_SERVICE
        );
        assert_eq!(
            resolve_service(Some("world.empery.desktop.client")),
            CONNECTED_SERVICE
        );
        assert_ne!(CONNECTED_SERVICE, LEGACY_SERVICE);
    }
}
