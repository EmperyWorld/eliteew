//! Unsigned update metadata never names a download file. App data is trusted;
//! pre-existing links below it are rejected. Concurrent hostile local mutation
//! of the private app-data tree is outside the remote-manifest threat boundary.
use sha2::{Digest, Sha256};
use std::fs::{self, File, OpenOptions};
use std::path::{Path, PathBuf};

pub fn validate_id(id: &str) -> Result<(), String> {
    let stem = id.split('.').next().unwrap_or("").to_ascii_uppercase();
    let device = matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ["COM", "LPT"].iter().any(|p| {
            stem.strip_prefix(p)
                .is_some_and(|n| n.len() == 1 && matches!(n.as_bytes()[0], b'1'..=b'9'))
        });
    if id.is_empty()
        || id.len() > 128
        || id.starts_with('.')
        || id.ends_with('.')
        || id.contains("..")
        || device
        || !id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.+".contains(&b))
    {
        return Err("invalid_update_identifier".into());
    }
    Ok(())
}

/// Catalog group IDs are lowercase ASCII slugs; reject aliases on Windows too.
pub fn validate_group_id(id: &str) -> Result<(), String> {
    validate_id(id)?;
    if !id
        .bytes()
        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_')
    {
        return Err("invalid_group_identifier".into());
    }
    Ok(())
}

fn real_dir(path: &Path) -> Result<(), String> {
    match fs::create_dir(path) {
        Ok(()) => (),
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => (),
        Err(e) => return Err(format!("mkdir spool: {e}")),
    }
    let meta = fs::symlink_metadata(path).map_err(|e| format!("stat spool: {e}"))?;
    if !meta.is_dir() || meta.file_type().is_symlink() {
        return Err("unsafe_spool_directory".into());
    }
    Ok(())
}

fn root(data: &Path) -> Result<PathBuf, String> {
    // Tauri resolves this trusted base even before the first install creates it.
    fs::create_dir_all(data).map_err(|e| format!("mkdir app data: {e}"))?;
    let pack = crate::spa_pack::pack_root(data);
    real_dir(&pack)?;
    let root = pack.join("verified-downloads-v1");
    real_dir(&root)?;
    Ok(root)
}

/// Core downloads own a private random directory, cleaned on every exit path.
pub fn core_attempt(data: &Path, build: &str) -> Result<tempfile::TempDir, String> {
    validate_id(build)?;
    tempfile::Builder::new()
        .prefix("core-")
        .tempdir_in(root(data)?)
        .map_err(|e| format!("create spool: {e}"))
}

/// Stable opaque content identity preserves Range resume across network failures.
/// Legacy raw-ID archives and partials are never opened, replaced, or deleted.
pub struct GroupSpool {
    pub path: PathBuf,
    pub file: File,
}
impl GroupSpool {
    pub fn open(data: &Path, id: &str, sha: &str, signature: &str) -> Result<Self, String> {
        validate_group_id(id)?;
        if sha.len() != 64
            || !sha.bytes().all(|b| b.is_ascii_hexdigit())
            || signature.trim().is_empty()
        {
            return Err("invalid_group_integrity_metadata".into());
        }
        let identity = serde_json::to_vec(&(id, sha.to_ascii_lowercase(), signature))
            .map_err(|e| e.to_string())?;
        let dir = root(data)?.join(format!("group-{}", hex::encode(Sha256::digest(identity))));
        real_dir(&dir)?;
        let path = dir.join("archive.part");
        let file = match OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(true)
            .open(&path)
        {
            Ok(f) => f,
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                let meta = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
                if !meta.is_file() || meta.file_type().is_symlink() {
                    return Err("unsafe_spool_file".into());
                }
                #[cfg(unix)]
                {
                    use std::os::unix::fs::MetadataExt;
                    if meta.nlink() != 1 {
                        return Err("unsafe_spool_file".into());
                    }
                }
                OpenOptions::new()
                    .read(true)
                    .write(true)
                    .open(&path)
                    .map_err(|e| e.to_string())?
            }
            Err(e) => return Err(format!("open spool: {e}")),
        };
        Ok(Self { path, file })
    }

    /// Consume the handle first so cleanup also works on Windows.
    pub fn discard(self) -> Result<(), String> {
        let Self { path, file } = self;
        drop(file);
        fs::remove_file(&path).map_err(|e| format!("remove spool: {e}"))?;
        fs::remove_dir(path.parent().unwrap()).map_err(|e| format!("remove spool dir: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;
    use std::io::Write;

    fn bad_ids() -> Vec<&'static str> {
        vec![
            "",
            "../escape",
            "/tmp/escape",
            "..\\escape",
            "C:\\escape",
            "C:escape",
            "\\\\server\\share",
            "a/b",
            "a\\b",
            "a:stream",
            "a\0b",
            "a\nb",
            "%2e%2e%2f",
            "CON",
            "nul.txt",
            "COM1",
            "Lpt9.zip",
            "name.",
            "name ",
            "..",
            "a..b",
            "аudio",
        ]
    }
    #[test]
    fn rejects_cross_platform_identifiers_before_creating_spool() {
        let data = tempfile::tempdir().unwrap();
        for id in bad_ids() {
            assert!(validate_id(id).is_err(), "{id:?}");
            assert!(core_attempt(data.path(), id).is_err());
            assert!(GroupSpool::open(data.path(), id, &"a".repeat(64), "sig").is_err());
            assert!(crate::spa_assets::group_meta_dir(data.path(), id).is_err());
            assert!(crate::spa_assets::group_staging_dir(data.path(), id).is_err());
        }
        assert_eq!(fs::read_dir(data.path()).unwrap().count(), 0);
    }
    #[test]
    fn manifest_parsers_enforce_same_boundary() {
        for id in bad_ids() {
            let core = serde_json::json!({"schema_version":1,"kind":"fofline-spa","app_build_id":id,"version":"1","url":"https://example.test/a","sha256":"a".repeat(64),"signature":"sig"});
            assert!(crate::spa_pack::parse_spa_latest(&core.to_string()).is_err());
            let mut groups = serde_json::json!({"schema_version":1,"kind":"fofline-spa-assets","app_build_id":"build-42","groups":[{"id":id,"url":"https://example.test/a","sha256":"a".repeat(64),"signature":"sig"}]});
            assert!(crate::spa_assets::parse_spa_assets_latest(&groups.to_string()).is_err());
            groups["app_build_id"] = serde_json::json!(id);
            groups["groups"][0]["id"] = serde_json::json!("audio-guides");
            assert!(crate::spa_assets::parse_spa_assets_latest(&groups.to_string()).is_err());
        }
    }
    #[test]
    fn valid_build_ids_and_non_aliasing_group_paths() {
        for id in [
            "1786214589850-9fdkgx9f8j",
            "selftest-build-id-42",
            "1.2.3+release",
            "audio-guides",
            "a_b",
        ] {
            validate_id(id).unwrap();
        }
        let data = tempfile::tempdir().unwrap();
        for id in ["a.b", "A_b", "a+b"] {
            assert!(crate::spa_assets::group_meta_dir(data.path(), id).is_err());
        }
        assert!(crate::spa_assets::group_meta_dir(data.path(), "a_b").is_ok());
    }
    #[test]
    fn first_install_creates_missing_app_data() {
        let parent = tempfile::tempdir().unwrap();
        let data = parent.path().join("missing").join("app-data");
        let attempt = core_attempt(&data, "first-build").unwrap();
        assert!(attempt.path().is_dir());
        let group = GroupSpool::open(&data, "audio-guides", &"a".repeat(64), "sig").unwrap();
        group.discard().unwrap();
    }

    #[test]
    fn core_attempt_cleanup_preserves_other_files() {
        let data = tempfile::tempdir().unwrap();
        let sentinel = data.path().join("sentinel");
        fs::write(&sentinel, b"keep").unwrap();
        let attempt = core_attempt(data.path(), "build-42").unwrap();
        let path = attempt.path().to_owned();
        fs::write(path.join("archive.part"), b"bad signature").unwrap();
        let second = core_attempt(data.path(), "build-42").unwrap();
        assert_ne!(second.path(), path);
        drop(attempt);
        assert!(!path.exists());
        assert!(second.path().exists());
        assert_eq!(fs::read(sentinel).unwrap(), b"keep");
    }
    #[test]
    fn resume_is_bound_to_content_and_signature() {
        let data = tempfile::tempdir().unwrap();
        let mut a =
            GroupSpool::open(data.path(), "audio-guides", &"a".repeat(64), "sig-a").unwrap();
        a.file.write_all(b"partial").unwrap();
        let path = a.path.clone();
        drop(a); // network failure retains partial
        let a = GroupSpool::open(data.path(), "audio-guides", &"A".repeat(64), "sig-a").unwrap();
        assert_eq!(a.path, path);
        assert_eq!(a.file.metadata().unwrap().len(), 7);
        let b = GroupSpool::open(data.path(), "audio-guides", &"b".repeat(64), "sig-a").unwrap();
        let c = GroupSpool::open(data.path(), "audio-guides", &"a".repeat(64), "sig-b").unwrap();
        assert_ne!(a.path, b.path);
        assert_ne!(a.path, c.path);
        a.discard().unwrap();
        assert!(!path.exists());
        assert!(b.path.exists());
    }
    #[test]
    fn bad_signature_discards_only_bound_partial_and_valid_signature_passes() {
        // Public test vector from minisign-verify 0.2.5, verify_prehashed.
        let key = base64::engine::general_purpose::STANDARD.encode(
            "untrusted comment: test key\nRWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3",
        );
        let sig = base64::engine::general_purpose::STANDARD.encode("untrusted comment: signature from minisign secret key\nRUQf6LRCGA9i559r3g7V1qNyJDApGip8MfqcadIgT9CuhV3EMhHoN1mGTkUidF/z7SrlQgXdy8ofjb7bNJJylDOocrCo8KLzZwo=\ntrusted comment: timestamp:1556193335\tfile:test\ny/rUw2y8/hOUYjZU71eHp/Wo1KZ40fGy2VJEDl34XMJM+TX48Ss/17u3IvIfbVR1FkZZSNCisQbuQY+bHwhEBg==");
        let data = tempfile::tempdir().unwrap();
        let old = crate::spa_pack::pack_root(data.path()).join("spool");
        fs::create_dir_all(&old).unwrap();
        fs::write(old.join("audio-guides.tar.zst"), b"previous").unwrap();
        fs::write(old.join("audio-guides.tar.zst.part"), b"legacy").unwrap();
        for payload in [b"test".as_slice(), b"tampered"] {
            let sha = hex::encode(Sha256::digest(payload));
            let mut spool = GroupSpool::open(data.path(), "audio-guides", &sha, &sig).unwrap();
            spool.file.write_all(payload).unwrap();
            let result = crate::spa_assets::verify_group_archive(&spool.path, &sha, &sig, &key);
            assert_eq!(result.is_ok(), payload == b"test", "{result:?}");
            spool.discard().unwrap();
            assert_eq!(
                fs::read(old.join("audio-guides.tar.zst")).unwrap(),
                b"previous"
            );
            assert_eq!(
                fs::read(old.join("audio-guides.tar.zst.part")).unwrap(),
                b"legacy"
            );
        }
    }
    #[test]
    fn signed_core_archive_verifies_extracts_and_promotes() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../tests/fixtures/update-spool/signed-core.json"
        ))
        .unwrap();
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(fixture["archive_base64"].as_str().unwrap())
            .unwrap();
        let data = tempfile::tempdir().unwrap();
        let attempt = core_attempt(data.path(), "wave07-fixture").unwrap();
        let archive = attempt.path().join("archive.part");
        fs::write(&archive, &bytes).unwrap();
        crate::spa_assets::verify_group_archive(
            &archive,
            fixture["sha256"].as_str().unwrap(),
            fixture["signature"].as_str().unwrap(),
            fixture["public_key"].as_str().unwrap(),
        )
        .unwrap();
        crate::spa_pack::extract_tar_zst_file(&archive, &crate::spa_pack::staging_dir(data.path()))
            .unwrap();
        crate::spa_pack::promote_staging(data.path()).unwrap();
        crate::spa_pack::write_ready_state(data.path(), "wave07-fixture").unwrap();
        drop(attempt);
        assert!(!archive.exists());
        assert!(crate::spa_pack::is_ready_install(
            data.path(),
            Some("wave07-fixture")
        ));
        assert_eq!(
            fs::read(crate::spa_pack::current_dir(data.path()).join("index.html")).unwrap(),
            b"<html>signed wave07 fixture</html>"
        );
    }

    #[cfg(unix)]
    #[test]
    fn symlink_spool_root_and_partial_cannot_touch_external_sentinel() {
        use std::os::unix::fs::symlink;
        let data = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let sentinel = outside.path().join("sentinel");
        fs::write(&sentinel, b"keep").unwrap();
        symlink(outside.path(), crate::spa_pack::pack_root(data.path())).unwrap();
        assert!(core_attempt(data.path(), "build").is_err());
        fs::remove_file(crate::spa_pack::pack_root(data.path())).unwrap();
        let spool = GroupSpool::open(data.path(), "group", &"a".repeat(64), "sig").unwrap();
        let path = spool.path.clone();
        drop(spool);
        fs::remove_file(&path).unwrap();
        symlink(&sentinel, &path).unwrap();
        assert!(GroupSpool::open(data.path(), "group", &"a".repeat(64), "sig").is_err());
        assert_eq!(fs::read(sentinel).unwrap(), b"keep");
    }
}
