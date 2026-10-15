// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Parse and validate the versioned one-code Air enrollment wire contract (Rust mirror).
// Invariants:
// - Port must fall in the dedicated Air range only.
// - Selector/secret are Crockford-canonical; checksum binds all fields.
// - Callers must scrub AccessCode after use (zeroize on drop).
// Related:
// - shared/api/services/desktop_client/air_enroll_code.py
// - documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md
// ---

use sha2::{Digest, Sha256};
use zeroize::{Zeroize, ZeroizeOnDrop};

pub const PREFIX: &str = "EWAE1";
pub const PORT_MIN: u16 = 62200;
pub const PORT_MAX: u16 = 63200;
pub const SELECTOR_BYTES: usize = 10;
pub const SELECTOR_CHARS: usize = 16;
pub const SECRET_BYTES: usize = 16;
pub const SECRET_CHARS: usize = 26;
pub const CHECKSUM_CHARS: usize = 4;
const CROCKFORD_ALPHABET: &[u8] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct AccessCode {
    pub port: u16,
    pub selector: String,
    pub secret: String,
    pub checksum: String,
}

fn crockford_value(ch: u8) -> Option<u8> {
    CROCKFORD_ALPHABET
        .iter()
        .position(|&c| c == ch)
        .map(|i| i as u8)
}

fn encode_value_fixed(mut value: u128, characters: usize) -> Result<String, String> {
    let mut encoded = vec![b'0'; characters];
    for index in (0..characters).rev() {
        encoded[index] = CROCKFORD_ALPHABET[(value & 31) as usize];
        value >>= 5;
    }
    if value != 0 {
        return Err("crockford_output_too_short".into());
    }
    String::from_utf8(encoded).map_err(|_| "crockford_utf8".into())
}

fn encode_fixed(raw: &[u8], characters: usize) -> Result<String, String> {
    let mut value: u128 = 0;
    for byte in raw {
        value = (value << 8) | u128::from(*byte);
    }
    encode_value_fixed(value, characters)
}

fn decode_fixed(value: &str, byte_length: usize, characters: usize) -> Result<Vec<u8>, String> {
    let canonical = value.trim().to_ascii_uppercase();
    if canonical.len() != characters {
        return Err("crockford_length".into());
    }
    if byte_length == 0 || byte_length > 16 {
        return Err("crockford_byte_length".into());
    }
    let mut decoded: u128 = 0;
    for ch in canonical.bytes() {
        let number = crockford_value(ch).ok_or_else(|| "crockford_character".to_string())?;
        decoded = (decoded << 5) | u128::from(number);
    }
    // Values that need more than `byte_length` bytes are padding/overflow.
    // For 16 bytes the domain is the full u128; rely on canonical re-encode.
    if byte_length < 16 {
        let max = 1u128
            .checked_shl((byte_length * 8) as u32)
            .ok_or_else(|| "crockford_padding".to_string())?;
        if decoded >= max {
            return Err("crockford_padding".into());
        }
    }
    let mut raw = vec![0u8; byte_length];
    let mut remaining = decoded;
    for slot in raw.iter_mut().rev() {
        *slot = (remaining & 0xff) as u8;
        remaining >>= 8;
    }
    if remaining != 0 {
        return Err("crockford_padding".into());
    }
    let reencoded = encode_fixed(&raw, characters)?;
    if reencoded != canonical {
        return Err("crockford_noncanonical".into());
    }
    Ok(raw)
}

pub fn checksum_for(port: u16, selector: &str, secret: &str) -> Result<String, String> {
    let transcript = format!("{PREFIX}|{port:05}|{selector}|{secret}");
    let digest = Sha256::digest(transcript.as_bytes());
    let checksum_bits = (u32::from(digest[0]) << 16 | u32::from(digest[1]) << 8 | u32::from(digest[2]))
        >> 4;
    encode_value_fixed(u128::from(checksum_bits), CHECKSUM_CHARS)
}

/// Parse grouped or compact Air access code. Does not log secrets.
pub fn parse_access_code(raw: &str) -> Result<AccessCode, String> {
    let compact: String = raw
        .chars()
        .filter(|c| *c != ' ' && *c != '-')
        .map(|c| c.to_ascii_uppercase())
        .collect();
    let expected_length =
        PREFIX.len() + 5 + SELECTOR_CHARS + SECRET_CHARS + CHECKSUM_CHARS;
    if compact.len() != expected_length || !compact.starts_with(PREFIX) {
        return Err("air_code_structure".into());
    }
    let mut offset = PREFIX.len();
    let port_text = &compact[offset..offset + 5];
    offset += 5;
    if !port_text.chars().all(|c| c.is_ascii_digit()) {
        return Err("air_code_port".into());
    }
    let port: u16 = port_text
        .parse()
        .map_err(|_| "air_code_port".to_string())?;
    if !(PORT_MIN..=PORT_MAX).contains(&port) {
        return Err("air_code_port_range".into());
    }
    let selector = compact[offset..offset + SELECTOR_CHARS].to_string();
    offset += SELECTOR_CHARS;
    let secret = compact[offset..offset + SECRET_CHARS].to_string();
    offset += SECRET_CHARS;
    let checksum = compact[offset..].to_string();
    let _ = decode_fixed(&selector, SELECTOR_BYTES, SELECTOR_CHARS)?;
    let _ = decode_fixed(&secret, SECRET_BYTES, SECRET_CHARS)?;
    let expected = checksum_for(port, &selector, &secret)?;
    if !constant_time_eq(checksum.as_bytes(), expected.as_bytes()) {
        return Err("air_code_checksum".into());
    }
    Ok(AccessCode {
        port,
        selector,
        secret,
        checksum,
    })
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_code() -> AccessCode {
        // Deterministic fixture: fixed selector/secret bytes → known checksum path.
        let selector = encode_fixed(&[0x11; SELECTOR_BYTES], SELECTOR_CHARS).unwrap();
        let secret = encode_fixed(&[0x22; SECRET_BYTES], SECRET_CHARS).unwrap();
        let port = 62200u16;
        let checksum = checksum_for(port, &selector, &secret).unwrap();
        AccessCode {
            port,
            selector,
            secret,
            checksum,
        }
    }

    #[test]
    fn round_trip_compact_and_grouped() {
        let code = sample_code();
        let compact = format!(
            "{PREFIX}{:05}{}{}{}",
            code.port, code.selector, code.secret, code.checksum
        );
        let parsed = parse_access_code(&compact).unwrap();
        assert_eq!(parsed.port, code.port);
        assert_eq!(parsed.selector, code.selector);
        assert_eq!(parsed.secret, code.secret);

        let grouped = format!(
            "{}-{:05}-{}-{}-{}",
            PREFIX, code.port, code.selector, code.secret, code.checksum
        );
        let parsed2 = parse_access_code(&grouped).unwrap();
        assert_eq!(parsed2.port, code.port);
    }

    #[test]
    fn rejects_port_outside_range_and_bad_checksum() {
        let mut code = sample_code();
        code.port = 1;
        let bad_port = format!(
            "{PREFIX}{:05}{}{}{}",
            1u16, code.selector, code.secret, code.checksum
        );
        assert!(
            matches!(
                parse_access_code(&bad_port),
                Err(ref e) if e == "air_code_port_range"
            ),
            "expected air_code_port_range"
        );

        let mut code = sample_code();
        code.checksum = "0000".into();
        let bad = format!(
            "{PREFIX}{:05}{}{}{}",
            code.port, code.selector, code.secret, code.checksum
        );
        assert!(
            matches!(
                parse_access_code(&bad),
                Err(ref e) if e == "air_code_checksum"
            ),
            "expected air_code_checksum"
        );
    }

    #[test]
    fn parses_python_generated_vector() {
        // Generated by shared/api air_enroll_code.generate_access_code(62555).
        let raw = "EWAE1-62555-GY0BVC277PJ1H8PV-5QWG9B35VYHVXRR6XHSD1TH7YM-8VSE";
        let parsed = parse_access_code(raw).expect("python vector");
        assert_eq!(parsed.port, 62555);
        assert_eq!(parsed.selector, "GY0BVC277PJ1H8PV");
        assert_eq!(parsed.secret, "5QWG9B35VYHVXRR6XHSD1TH7YM");
        assert_eq!(parsed.checksum, "8VSE");
    }
}
