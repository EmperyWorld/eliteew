// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Wave 8 / F-12 — single trust path for OTA check + recovery install.
// Parse/verify signed `latest.v2` before any field drives download or elevation.
// Invariants:
// - Metadata Ed25519 verified with baked current/next key before field use.
// - product_id / channel / package_id / artifact_key_id bind to this bake.
// - Monotonic sequence blocks rollback; expired metadata blocks update only.
// - Artifact minisign + exact size + SHA-256 checked after stream (callers).
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §8
// ---

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use semver::Version;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use url::Url;

use crate::entitlement::{self, sort_value};

pub const LATEST_V2_SCHEMA: &str = "eliteew.ota.latest.v2";
pub const SEQUENCE_REL: &str = "update_trust/highest_sequence.v1.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SequenceState {
    pub highest_sequence: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_version: Option<String>,
    /// SHA-256 of last successfully installed OTA artifact (lowercase hex).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_artifact_sha256: Option<String>,
}

/// Persisted sequence + artifact trust consumed by `verify_latest_v2`.
#[derive(Debug, Clone, Default)]
pub struct SequenceTrust {
    pub highest_sequence: u64,
    pub last_artifact_sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatestV2Platform {
    pub url: String,
    pub size: u64,
    pub sha256: String,
    pub signature: String,
    pub artifact_key_id: String,
    pub package_id: String,
    pub package_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatestV2Document {
    pub schema: String,
    pub product_id: String,
    pub channel: String,
    pub sequence: u64,
    pub version: String,
    /// RFC3339 / ISO-8601 expiry; expired → update blocked, app still runs.
    pub expires_at: String,
    pub platforms: HashMap<String, LatestV2Platform>,
    pub metadata_key_id: String,
    pub metadata_signature: String,
}

/// Baked trust roots for one retail product bake (Connected or FoFline).
#[derive(Debug, Clone)]
pub struct UpdateTrustRoots {
    pub product_id: String,
    pub channel: String,
    pub package_id: String,
    pub expected_package_type: String,
    pub artifact_pubkey: String,
    pub artifact_key_id: String,
    pub next_artifact_key_id: Option<String>,
    pub next_artifact_pubkey: Option<String>,
    pub metadata_key_id: String,
    pub metadata_pubkey_hex: String,
    pub next_metadata_key_id: Option<String>,
    pub next_metadata_pubkey_hex: Option<String>,
}

/// Plan consumed by stock check UX and recovery install after full verify.
#[derive(Debug, Clone)]
pub struct VerifiedUpdatePlan {
    #[allow(dead_code)] // retained for cross-checks / future install helpers
    pub product_id: String,
    #[allow(dead_code)]
    pub channel: String,
    pub sequence: u64,
    pub version: String,
    #[allow(dead_code)]
    pub platform: String,
    pub artifact_url: Url,
    pub size: u64,
    pub sha256: String,
    pub artifact_signature: String,
    #[allow(dead_code)]
    pub artifact_key_id: String,
    pub artifact_pubkey: String,
    pub package_id: String,
    #[allow(dead_code)]
    pub package_type: String,
}

#[derive(Debug, Clone)]
pub enum PlanError {
    Schema,
    MetadataSignature,
    MetadataKeyUnknown,
    ProductMismatch,
    ChannelMismatch,
    SequenceRollback,
    Expired,
    VersionInvalid,
    NotNewer,
    PlatformMissing,
    PackageMismatch,
    ArtifactKeyUnknown,
    ArtifactUrlInvalid,
    SizeInvalid,
    Sha256Invalid,
    SignatureMissing,
    Parse(String),
}

impl PlanError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Schema => "ota_metadata_schema",
            Self::MetadataSignature => "ota_metadata_signature_invalid",
            Self::MetadataKeyUnknown => "ota_metadata_key_unknown",
            Self::ProductMismatch => "ota_product_mismatch",
            Self::ChannelMismatch => "ota_channel_mismatch",
            Self::SequenceRollback => "ota_sequence_rollback",
            Self::Expired => "ota_metadata_expired",
            Self::VersionInvalid => "ota_manifest_version_invalid",
            Self::NotNewer => "up_to_date",
            Self::PlatformMissing => "ota_manifest_platform_missing",
            Self::PackageMismatch => "ota_package_mismatch",
            Self::ArtifactKeyUnknown => "ota_artifact_key_unknown",
            Self::ArtifactUrlInvalid => "artifact_url_invalid",
            Self::SizeInvalid => "ota_artifact_size_invalid",
            Self::Sha256Invalid => "ota_artifact_sha256_invalid",
            Self::SignatureMissing => "signature_missing",
            Self::Parse(_) => "ota_manifest_parse",
        }
    }

    pub fn message(&self) -> String {
        match self {
            Self::Parse(e) => e.clone(),
            Self::NotNewer => "Already on latest".into(),
            Self::Expired => "Update metadata expired — installed app still runs".into(),
            Self::SequenceRollback => "Update sequence would roll back — blocked".into(),
            Self::ProductMismatch => "Update metadata product does not match this install".into(),
            Self::ChannelMismatch => "Update metadata channel does not match this install".into(),
            Self::PackageMismatch => "Update package id/type does not match this install".into(),
            other => format!("Update trust check failed ({})", other.code()),
        }
    }
}

pub fn platform_key_for_host() -> Result<&'static str, PlanError> {
    if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        return Ok("linux-x86_64-rpm");
    }
    if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        return Ok("windows-x86_64");
    }
    Err(PlanError::PlatformMissing)
}

pub fn expected_package_type_for_platform(platform: &str) -> &'static str {
    match platform {
        "windows-x86_64" => "nsis",
        "linux-x86_64" | "linux-x86_64-appimage" => "appimage",
        _ => "rpm",
    }
}

pub fn sequence_store_path(app_data: &Path) -> PathBuf {
    app_data.join(SEQUENCE_REL)
}

pub fn load_sequence_state(app_data: &Path) -> SequenceState {
    let path = sequence_store_path(app_data);
    let Ok(raw) = fs::read_to_string(&path) else {
        return SequenceState::default();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

pub fn load_sequence_trust(app_data: &Path) -> SequenceTrust {
    let state = load_sequence_state(app_data);
    SequenceTrust {
        highest_sequence: state.highest_sequence,
        last_artifact_sha256: state.last_artifact_sha256,
    }
}

pub fn load_highest_sequence(app_data: &Path) -> u64 {
    load_sequence_state(app_data).highest_sequence
}

pub fn persist_highest_sequence(
    app_data: &Path,
    sequence: u64,
    version: &str,
    artifact_sha256: &str,
) -> Result<(), String> {
    let path = sequence_store_path(app_data);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("sequence_dir: {e}"))?;
    }
    let prev_state = load_sequence_state(app_data);
    let sha = artifact_sha256.trim().to_ascii_lowercase();
    if sha.len() != 64 || !sha.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("invalid artifact_sha256 for sequence persist".into());
    }
    let state = SequenceState {
        highest_sequence: sequence.max(prev_state.highest_sequence),
        last_version: Some(version.trim().to_string()),
        last_artifact_sha256: Some(sha),
    };
    let body = serde_json::to_vec_pretty(&state).map_err(|e| format!("sequence_json: {e}"))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, &body).map_err(|e| format!("sequence_write: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("sequence_rename: {e}"))?;
    Ok(())
}

fn canonical_sign_bytes(doc: &LatestV2Document) -> Result<Vec<u8>, PlanError> {
    let mut value = serde_json::to_value(doc).map_err(|e| PlanError::Parse(e.to_string()))?;
    if let Value::Object(ref mut map) = value {
        map.remove("metadata_signature");
    }
    let sorted = sort_value(value);
    serde_json::to_vec(&sorted).map_err(|e| PlanError::Parse(e.to_string()))
}

fn resolve_metadata_pubkey<'a>(
    roots: &'a UpdateTrustRoots,
    key_id: &str,
) -> Result<&'a str, PlanError> {
    if key_id == roots.metadata_key_id {
        return Ok(roots.metadata_pubkey_hex.as_str());
    }
    if roots
        .next_metadata_key_id
        .as_deref()
        .is_some_and(|id| id == key_id)
    {
        return roots
            .next_metadata_pubkey_hex
            .as_deref()
            .ok_or(PlanError::MetadataKeyUnknown);
    }
    Err(PlanError::MetadataKeyUnknown)
}

fn resolve_artifact_pubkey(
    roots: &UpdateTrustRoots,
    key_id: &str,
) -> Result<String, PlanError> {
    if key_id == roots.artifact_key_id {
        return Ok(roots.artifact_pubkey.clone());
    }
    if roots
        .next_artifact_key_id
        .as_deref()
        .is_some_and(|id| id == key_id)
    {
        return roots
            .next_artifact_pubkey
            .clone()
            .ok_or(PlanError::ArtifactKeyUnknown);
    }
    Err(PlanError::ArtifactKeyUnknown)
}

fn verify_metadata_signature(
    doc: &LatestV2Document,
    pubkey_hex: &str,
) -> Result<(), PlanError> {
    let pk_bytes = entitlement::parse_pubkey_hex(pubkey_hex).map_err(|_| PlanError::MetadataKeyUnknown)?;
    let verifying =
        VerifyingKey::from_bytes(&pk_bytes).map_err(|_| PlanError::MetadataKeyUnknown)?;
    let msg = canonical_sign_bytes(doc)?;
    let sig_bytes =
        hex::decode(doc.metadata_signature.trim()).map_err(|_| PlanError::MetadataSignature)?;
    if sig_bytes.len() != 64 {
        return Err(PlanError::MetadataSignature);
    }
    let mut sig_arr = [0u8; 64];
    sig_arr.copy_from_slice(&sig_bytes);
    let signature = Signature::from_bytes(&sig_arr);
    verifying
        .verify(&msg, &signature)
        .map_err(|_| PlanError::MetadataSignature)
}

fn parse_expiry_unix(expires_at: &str) -> Result<i64, PlanError> {
    let trimmed = expires_at.trim();
    if trimmed.chars().all(|c| c.is_ascii_digit()) {
        return trimmed
            .parse::<i64>()
            .map_err(|_| PlanError::Parse("expires_at_invalid".into()));
    }
    // Publish script emits UTC `YYYY-MM-DDTHH:MM:SSZ` (no fractional / offset).
    parse_rfc3339_z(trimmed).ok_or_else(|| PlanError::Parse("expires_at_invalid".into()))
}

fn parse_rfc3339_z(s: &str) -> Option<i64> {
    let s = s.strip_suffix('Z').or_else(|| s.strip_suffix('z'))?;
    let (date, time) = s.split_once('T').or_else(|| s.split_once('t'))?;
    let mut d = date.split('-');
    let year: i32 = d.next()?.parse().ok()?;
    let month: u32 = d.next()?.parse().ok()?;
    let day: u32 = d.next()?.parse().ok()?;
    if d.next().is_some() {
        return None;
    }
    let time = time.split('.').next()?;
    let mut t = time.split(':');
    let hour: u32 = t.next()?.parse().ok()?;
    let minute: u32 = t.next()?.parse().ok()?;
    let second: u32 = t.next()?.parse().ok()?;
    if t.next().is_some() {
        return None;
    }
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) || hour > 23 || minute > 59 || second > 59
    {
        return None;
    }
    // Civil → unix via days from Unix epoch (algorithm from Howard Hinnant).
    let y = if month <= 2 { year - 1 } else { year };
    let era = y.div_euclid(400);
    let yoe = (y - era * 400) as u32;
    let mp = if month > 2 { month - 3 } else { month + 9 };
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = (era * 146097) as i64 + doe as i64 - 719468;
    Some(days * 86400 + i64::from(hour) * 3600 + i64::from(minute) * 60 + i64::from(second))
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// After `verify_latest_v2` returns `NotNewer`, persist live sequence/sha when
/// the running binary already matches metadata version. Manual `dnf`/`rpm`
/// does not write `highest_sequence.v1.json`; offering same-version reinstall
/// is redundant. Broken bits need a semver bump (TREE policy), not NCR-002 UI.
pub fn adopt_live_sequence_when_current(
    app_data: &Path,
    body: &str,
    platform: &str,
    current_version: &str,
    trust: &SequenceTrust,
) {
    let Ok(doc) = serde_json::from_str::<LatestV2Document>(body) else {
        return;
    };
    if doc.version.trim() != current_version.trim() {
        return;
    }
    let Some(plat) = doc.platforms.get(platform) else {
        return;
    };
    let sha = plat.sha256.trim().to_ascii_lowercase();
    if sha.len() != 64 || !sha.bytes().all(|b| b.is_ascii_hexdigit()) {
        return;
    }
    let seq_stale = doc.sequence > trust.highest_sequence;
    let sha_stale = trust
        .last_artifact_sha256
        .as_deref()
        .is_none_or(|stored| !stored.eq_ignore_ascii_case(&sha));
    if !seq_stale && !sha_stale {
        return;
    }
    match persist_highest_sequence(app_data, doc.sequence, doc.version.trim(), &sha) {
        Ok(()) => eprintln!(
            "[STEP] ota_sequence_adopt version={} sequence={} previous_highest={} sha_adopt={}",
            doc.version.trim(),
            doc.sequence,
            trust.highest_sequence,
            sha_stale
        ),
        Err(e) => eprintln!("[STEP] ota_sequence_adopt_fail err={e}"),
    }
}

/// Verify signed body and produce an install/check plan for `platform`.
pub fn verify_latest_v2(
    body: &str,
    roots: &UpdateTrustRoots,
    platform: &str,
    current_version: &str,
    trust: &SequenceTrust,
) -> Result<VerifiedUpdatePlan, PlanError> {
    let doc: LatestV2Document =
        serde_json::from_str(body).map_err(|e| PlanError::Parse(e.to_string()))?;
    if doc.schema.trim() != LATEST_V2_SCHEMA {
        return Err(PlanError::Schema);
    }
    let meta_pk = resolve_metadata_pubkey(roots, doc.metadata_key_id.trim())?;
    verify_metadata_signature(&doc, meta_pk)?;

    if doc.product_id.trim() != roots.product_id {
        return Err(PlanError::ProductMismatch);
    }
    if doc.channel.trim() != roots.channel {
        return Err(PlanError::ChannelMismatch);
    }
    if doc.sequence == 0 || doc.sequence < trust.highest_sequence {
        return Err(PlanError::SequenceRollback);
    }

    let expires = parse_expiry_unix(&doc.expires_at)?;
    if now_unix() > expires {
        return Err(PlanError::Expired);
    }

    let plat = doc
        .platforms
        .get(platform)
        .ok_or(PlanError::PlatformMissing)?;
    if plat.package_id.trim() != roots.package_id {
        return Err(PlanError::PackageMismatch);
    }
    if plat.package_type.trim() != roots.expected_package_type {
        return Err(PlanError::PackageMismatch);
    }
    if plat.size == 0 {
        return Err(PlanError::SizeInvalid);
    }
    let sha = plat.sha256.trim().to_ascii_lowercase();
    if sha.len() != 64 || !sha.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(PlanError::Sha256Invalid);
    }

    let current = Version::parse(current_version.trim()).map_err(|_| PlanError::VersionInvalid)?;
    let remote = Version::parse(doc.version.trim()).map_err(|_| PlanError::VersionInvalid)?;
    if remote <= current {
        return Err(PlanError::NotNewer);
    }
    let sig = plat.signature.trim();
    if sig.is_empty() {
        return Err(PlanError::SignatureMissing);
    }
    let artifact_pubkey = resolve_artifact_pubkey(roots, plat.artifact_key_id.trim())?;
    let artifact_url = match Url::parse(plat.url.trim()) {
        Ok(url) if url.scheme() == "https" => url,
        _ => return Err(PlanError::ArtifactUrlInvalid),
    };

    Ok(VerifiedUpdatePlan {
        product_id: doc.product_id.trim().to_string(),
        channel: doc.channel.trim().to_string(),
        sequence: doc.sequence,
        version: doc.version.trim().to_string(),
        platform: platform.to_string(),
        artifact_url,
        size: plat.size,
        sha256: sha,
        artifact_signature: sig.to_string(),
        artifact_key_id: plat.artifact_key_id.trim().to_string(),
        artifact_pubkey,
        package_id: plat.package_id.trim().to_string(),
        package_type: plat.package_type.trim().to_string(),
    })
}

/// Derive `…/latest.v2.json` from a channel endpoint or legacy latest.json URL.
pub fn latest_v2_url_from_update_endpoint(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.contains("latest.v2.json") {
        return trimmed.to_string();
    }
    if let Some(base) = trimmed.strip_suffix("/latest.json") {
        return format!("{base}/latest.v2.json");
    }
    let base = trimmed
        .split("{{")
        .next()
        .unwrap_or(trimmed)
        .trim_end_matches('/');
    if base.ends_with("desktop-client-updates") || base.ends_with("fofline-updates") {
        return format!("{base}/latest.v2.json");
    }
    if let Some(idx) = base.find("/desktop-client-updates") {
        let end = idx + "/desktop-client-updates".len();
        return format!("{}/latest.v2.json", &base[..end]);
    }
    if let Some(idx) = base.find("/fofline-updates") {
        let end = idx + "/fofline-updates".len();
        return format!("{}/latest.v2.json", &base[..end]);
    }
    format!("{base}/latest.v2.json")
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    fn trust(seq: u64, sha: Option<&str>) -> SequenceTrust {
        SequenceTrust {
            highest_sequence: seq,
            last_artifact_sha256: sha.map(str::to_string),
        }
    }

    fn test_roots(meta_seed: &[u8; 32], meta_key_id: &str) -> (UpdateTrustRoots, SigningKey) {
        let sk = SigningKey::from_bytes(meta_seed);
        let pk = hex::encode(sk.verifying_key().as_bytes());
        let roots = UpdateTrustRoots {
            product_id: "world.empery.desktop.client".into(),
            channel: "connected".into(),
            package_id: "elite-ew-desktop-client".into(),
            expected_package_type: "rpm".into(),
            artifact_pubkey: "dW50cnVzdGVkIGNvbW1lbnQ6IHRlc3QK".into(),
            artifact_key_id: "connected-artifact-1".into(),
            next_artifact_key_id: None,
            next_artifact_pubkey: None,
            metadata_key_id: meta_key_id.into(),
            metadata_pubkey_hex: pk,
            next_metadata_key_id: None,
            next_metadata_pubkey_hex: None,
        };
        (roots, sk)
    }

    fn sign_doc(mut doc: LatestV2Document, sk: &SigningKey) -> LatestV2Document {
        let bytes = canonical_sign_bytes(&doc).expect("canonical");
        let sig = sk.sign(&bytes);
        doc.metadata_signature = hex::encode(sig.to_bytes());
        doc
    }

    fn sample_doc() -> LatestV2Document {
        let mut platforms = HashMap::new();
        platforms.insert(
            "linux-x86_64-rpm".into(),
            LatestV2Platform {
                url: "https://app.eliteew.ru/desktop-client-updates/artifacts/x.rpm".into(),
                size: 12,
                sha256: "a".repeat(64),
                signature: "sig-bytes".into(),
                artifact_key_id: "connected-artifact-1".into(),
                package_id: "elite-ew-desktop-client".into(),
                package_type: "rpm".into(),
            },
        );
        LatestV2Document {
            schema: LATEST_V2_SCHEMA.into(),
            product_id: "world.empery.desktop.client".into(),
            channel: "connected".into(),
            sequence: 10,
            version: "0.4.50".into(),
            expires_at: "2099-01-01T00:00:00Z".into(),
            platforms,
            metadata_key_id: "connected-meta-1".into(),
            metadata_signature: String::new(),
        }
    }

    #[test]
    fn accepts_valid_signed_v2() {
        let seed = [7u8; 32];
        let (roots, sk) = test_roots(&seed, "connected-meta-1");
        let doc = sign_doc(sample_doc(), &sk);
        let body = serde_json::to_string(&doc).unwrap();
        let plan = verify_latest_v2(&body, &roots, "linux-x86_64-rpm", "0.4.46", &trust(5, None)).unwrap();
        assert_eq!(plan.version, "0.4.50");
        assert_eq!(plan.sequence, 10);
        assert_eq!(plan.package_id, "elite-ew-desktop-client");
    }

    #[test]
    fn rejects_tampered_version_after_sign() {
        let seed = [8u8; 32];
        let (roots, sk) = test_roots(&seed, "connected-meta-1");
        let mut doc = sign_doc(sample_doc(), &sk);
        doc.version = "9.9.9".into();
        let body = serde_json::to_string(&doc).unwrap();
        let err = verify_latest_v2(&body, &roots, "linux-x86_64-rpm", "0.4.46", &trust(5, None)).unwrap_err();
        assert_eq!(err.code(), "ota_metadata_signature_invalid");
    }

    #[test]
    fn rejects_cross_product() {
        let seed = [9u8; 32];
        let (mut roots, sk) = test_roots(&seed, "connected-meta-1");
        roots.product_id = "world.empery.fofline".into();
        let doc = sign_doc(sample_doc(), &sk);
        let body = serde_json::to_string(&doc).unwrap();
        let err = verify_latest_v2(&body, &roots, "linux-x86_64-rpm", "0.4.46", &trust(5, None)).unwrap_err();
        assert_eq!(err.code(), "ota_product_mismatch");
    }

    #[test]
    fn rejects_sequence_rollback() {
        let seed = [10u8; 32];
        let (roots, sk) = test_roots(&seed, "connected-meta-1");
        let doc = sign_doc(sample_doc(), &sk);
        let body = serde_json::to_string(&doc).unwrap();
        let err = verify_latest_v2(&body, &roots, "linux-x86_64-rpm", "0.4.46", &trust(11, None)).unwrap_err();
        assert_eq!(err.code(), "ota_sequence_rollback");
    }

    #[test]
    fn rejects_expired_metadata() {
        let seed = [11u8; 32];
        let (roots, sk) = test_roots(&seed, "connected-meta-1");
        let mut doc = sample_doc();
        doc.expires_at = "2020-01-01T00:00:00Z".into();
        let doc = sign_doc(doc, &sk);
        let body = serde_json::to_string(&doc).unwrap();
        let err = verify_latest_v2(&body, &roots, "linux-x86_64-rpm", "0.4.46", &trust(5, None)).unwrap_err();
        assert_eq!(err.code(), "ota_metadata_expired");
    }

    #[test]
    fn rejects_same_version_when_sequence_bumps() {
        let seed = [12u8; 32];
        let (roots, sk) = test_roots(&seed, "connected-meta-1");
        let mut doc = sample_doc();
        doc.sequence = 11;
        let doc = sign_doc(doc, &sk);
        let body = serde_json::to_string(&doc).unwrap();
        let err =
            verify_latest_v2(&body, &roots, "linux-x86_64-rpm", "0.4.50", &trust(10, None))
                .unwrap_err();
        assert_eq!(err.code(), "up_to_date");
    }

    #[test]
    fn rejects_same_version_when_artifact_sha_changes() {
        let seed = [13u8; 32];
        let (roots, sk) = test_roots(&seed, "connected-meta-1");
        let old_sha = "b".repeat(64);
        let mut doc = sample_doc();
        doc.sequence = 10;
        let doc = sign_doc(doc, &sk);
        let body = serde_json::to_string(&doc).unwrap();
        let err = verify_latest_v2(
            &body,
            &roots,
            "linux-x86_64-rpm",
            "0.4.50",
            &trust(10, Some(&old_sha)),
        )
        .unwrap_err();
        assert_eq!(err.code(), "up_to_date");
    }

    #[test]
    fn adopts_sequence_when_already_on_same_version() {
        let seed = [15u8; 32];
        let (roots, sk) = test_roots(&seed, "connected-meta-1");
        let mut doc = sample_doc();
        doc.sequence = 11;
        let doc = sign_doc(doc, &sk);
        let body = serde_json::to_string(&doc).unwrap();
        let trust_state = trust(10, None);
        let err = verify_latest_v2(
            &body,
            &roots,
            "linux-x86_64-rpm",
            "0.4.50",
            &trust_state,
        )
        .unwrap_err();
        assert_eq!(err.code(), "up_to_date");
        let dir = tempfile::tempdir().unwrap();
        adopt_live_sequence_when_current(
            dir.path(),
            &body,
            "linux-x86_64-rpm",
            "0.4.50",
            &trust_state,
        );
        let loaded = load_sequence_trust(dir.path());
        assert_eq!(loaded.highest_sequence, 11);
        assert_eq!(loaded.last_artifact_sha256.as_deref(), Some("a".repeat(64).as_str()));
    }

    #[test]
    fn rejects_same_version_same_sequence_same_artifact() {
        let seed = [14u8; 32];
        let (roots, sk) = test_roots(&seed, "connected-meta-1");
        let sha = "a".repeat(64);
        let doc = sign_doc(sample_doc(), &sk);
        let body = serde_json::to_string(&doc).unwrap();
        let err = verify_latest_v2(
            &body,
            &roots,
            "linux-x86_64-rpm",
            "0.4.50",
            &trust(10, Some(&sha)),
        )
        .unwrap_err();
        assert_eq!(err.code(), "up_to_date");
    }

    #[test]
    fn latest_v2_url_derivation() {
        assert_eq!(
            latest_v2_url_from_update_endpoint(
                "https://app.eliteew.ru/desktop-client-updates/latest.json"
            ),
            "https://app.eliteew.ru/desktop-client-updates/latest.v2.json"
        );
        assert_eq!(
            latest_v2_url_from_update_endpoint("https://app.eliteew.ru/fofline-updates"),
            "https://app.eliteew.ru/fofline-updates/latest.v2.json"
        );
    }
}
