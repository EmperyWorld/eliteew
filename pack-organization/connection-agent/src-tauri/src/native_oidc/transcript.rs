// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Canonical ticket transcript matching Python `build_ticket_transcript`.
// Invariants:
// - sort_keys + compact separators; JSON null for missing device_id/redirect_uri.
// Related:
// - shared/api/services/desktop_client/auth_binding_crypto.py
// ---

use serde_json::{json, Value};

pub struct TicketTranscriptInput<'a> {
    pub nonce: &'a str,
    pub license_id: &'a str,
    pub device_id: Option<&'a str>,
    pub client_id: &'a str,
    pub channel: &'a str,
    pub dpop_jkt: &'a str,
    pub pkce_challenge: &'a str,
    pub redirect_uri: Option<&'a str>,
    pub jti: &'a str,
    pub issued_at: i64,
}

pub fn build_ticket_transcript(input: TicketTranscriptInput<'_>) -> Vec<u8> {
    let device_id = input
        .device_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map_or(Value::Null, |s| Value::String(s.to_string()));
    let redirect_uri = input
        .redirect_uri
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map_or(Value::Null, |s| Value::String(s.to_string()));
    let mut map = serde_json::Map::new();
    map.insert("channel".into(), json!(input.channel));
    map.insert("client_id".into(), json!(input.client_id));
    map.insert("device_id".into(), device_id);
    map.insert("dpop_jkt".into(), json!(input.dpop_jkt));
    map.insert("issued_at".into(), json!(input.issued_at));
    map.insert("jti".into(), json!(input.jti));
    map.insert("license_id".into(), json!(input.license_id));
    map.insert("nonce".into(), json!(input.nonce));
    map.insert("pkce_challenge".into(), json!(input.pkce_challenge));
    map.insert("redirect_uri".into(), redirect_uri);
    serde_json::to_vec(&Value::Object(map)).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transcript_matches_python_canonical_json() {
        let bytes = build_ticket_transcript(TicketTranscriptInput {
            nonce: "n1",
            license_id: "lic-uuid",
            device_id: None,
            client_id: "empery-desktop",
            channel: "desktop",
            dpop_jkt: "jkt1",
            pkce_challenge: "pkce1",
            redirect_uri: None,
            jti: "jti1",
            issued_at: 1_700_000_000,
        });
        let expected = br#"{"channel":"desktop","client_id":"empery-desktop","device_id":null,"dpop_jkt":"jkt1","issued_at":1700000000,"jti":"jti1","license_id":"lic-uuid","nonce":"n1","pkce_challenge":"pkce1","redirect_uri":null}"#;
        assert_eq!(bytes, expected);
    }
}
