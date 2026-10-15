// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Wave 7 / F-11 — entry-by-entry tar.zst extraction with bomb / link guards.
// Invariants:
// - Reject absolute paths, `..`, symlink/hardlink/device/FIFO entries.
// - Enforce entry count, per-file size, total decompressed, compression ratio.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §Wave 7
// ---

use std::fs::{self, File};
use std::io::{copy, Read};
use std::path::{Component, Path, PathBuf};

use tar::{Archive, EntryType};

use crate::resource_policy::{
    ARCHIVE_MAX_COMPRESSION_RATIO, ARCHIVE_MAX_ENTRIES, ARCHIVE_MAX_FILE_BYTES,
    ARCHIVE_MAX_TOTAL_BYTES,
};

fn path_is_unsafe(path: &Path) -> bool {
    if path.is_absolute() {
        return true;
    }
    path.components().any(|c| matches!(c, Component::ParentDir | Component::RootDir))
}

/// Extract a zstd-compressed tar from an in-memory buffer into `dest`.
pub fn extract_tar_zst_bytes(archive_bytes: &[u8], dest: &Path) -> Result<(), String> {
    let compressed_len = archive_bytes.len() as u64;
    let decoder = zstd::stream::read::Decoder::new(archive_bytes)
        .map_err(|e| format!("zstd open: {e}"))?;
    extract_tar_reader(decoder, compressed_len, dest)
}

/// Extract a zstd-compressed tar from a file into `dest`.
pub fn extract_tar_zst_file(archive: &Path, dest: &Path) -> Result<(), String> {
    let meta = fs::metadata(archive).map_err(|e| format!("archive meta: {e}"))?;
    let compressed_len = meta.len();
    let file = File::open(archive).map_err(|e| format!("open archive: {e}"))?;
    let decoder =
        zstd::stream::read::Decoder::new(file).map_err(|e| format!("zstd open: {e}"))?;
    extract_tar_reader(decoder, compressed_len, dest)
}

fn extract_tar_reader<R: Read>(
    reader: R,
    compressed_len: u64,
    dest: &Path,
) -> Result<(), String> {
    if dest.exists() {
        fs::remove_dir_all(dest).map_err(|e| format!("clear staging: {e}"))?;
    }
    fs::create_dir_all(dest).map_err(|e| format!("mkdir staging: {e}"))?;

    let mut archive = Archive::new(reader);
    archive.set_overwrite(true);
    let mut entries = 0u64;
    let mut total_written = 0u64;

    for entry in archive
        .entries()
        .map_err(|e| format!("tar entries: {e}"))?
    {
        let mut entry = entry.map_err(|e| format!("tar entry: {e}"))?;
        entries += 1;
        if entries > ARCHIVE_MAX_ENTRIES {
            return Err("archive_too_many_entries".into());
        }

        let kind = entry.header().entry_type();
        match kind {
            EntryType::Regular | EntryType::Directory | EntryType::GNUSparse => {}
            EntryType::Symlink | EntryType::Link | EntryType::Continuous => {
                return Err(format!("archive_forbidden_entry:{kind:?}"));
            }
            other => {
                // Char/Block/Fifo/XGlobalHeader/… — reject.
                return Err(format!("archive_forbidden_entry:{other:?}"));
            }
        }

        let rel = entry
            .path()
            .map_err(|e| format!("tar path: {e}"))?
            .into_owned();
        if path_is_unsafe(&rel) {
            return Err(format!("archive_unsafe_path:{}", rel.display()));
        }

        if kind == EntryType::Directory {
            let dir = dest.join(&rel);
            fs::create_dir_all(&dir).map_err(|e| format!("mkdir {}: {e}", dir.display()))?;
            continue;
        }

        let size = entry.size();
        if size > ARCHIVE_MAX_FILE_BYTES {
            return Err(format!("archive_file_too_large:{size}"));
        }
        total_written = total_written.saturating_add(size);
        if total_written > ARCHIVE_MAX_TOTAL_BYTES {
            return Err("archive_total_too_large".into());
        }
        if compressed_len > 0 {
            let ratio = total_written / compressed_len.max(1);
            if ratio > ARCHIVE_MAX_COMPRESSION_RATIO {
                return Err("archive_compression_bomb".into());
            }
        }

        let out_path = dest.join(&rel);
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("mkdir {}: {e}", parent.display()))?;
        }
        // Refuse to follow an existing symlink at the destination.
        if out_path.symlink_metadata().map(|m| m.file_type().is_symlink()).unwrap_or(false) {
            return Err(format!("archive_symlink_dest:{}", out_path.display()));
        }
        let mut out = File::create(&out_path)
            .map_err(|e| format!("create {}: {e}", out_path.display()))?;
        let written = copy(&mut entry, &mut out).map_err(|e| format!("write entry: {e}"))?;
        if written as u64 > ARCHIVE_MAX_FILE_BYTES {
            return Err("archive_file_too_large".into());
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tar::Builder;

    fn make_tar_zst(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let mut tar_buf = Vec::new();
        {
            let mut builder = Builder::new(&mut tar_buf);
            for (name, data) in entries {
                let mut header = tar::Header::new_gnu();
                header.set_size(data.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                builder.append_data(&mut header, name, *data).unwrap();
            }
            builder.finish().unwrap();
        }
        zstd::encode_all(&tar_buf[..], 1).unwrap()
    }

    #[test]
    fn extracts_regular_files() {
        let dir = std::env::temp_dir().join(format!("eliteew-safe-arch-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let bytes = make_tar_zst(&[("index.html", b"<html/>"), ("pack-manifest.json", b"{}")]);
        extract_tar_zst_bytes(&bytes, &dir).unwrap();
        assert!(dir.join("index.html").is_file());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_symlink_entry() {
        let dir = std::env::temp_dir().join(format!("eliteew-safe-arch-link-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let mut tar_buf = Vec::new();
        {
            let mut builder = Builder::new(&mut tar_buf);
            let mut header = tar::Header::new_gnu();
            header.set_entry_type(EntryType::Symlink);
            header.set_size(0);
            header.set_mode(0o777);
            header.set_cksum();
            builder
                .append_data(&mut header, "link-name", std::io::empty())
                .unwrap();
            builder.finish().unwrap();
        }
        let bytes = zstd::encode_all(&tar_buf[..], 1).unwrap();
        let err = extract_tar_zst_bytes(&bytes, &dir).unwrap_err();
        assert!(err.contains("archive_forbidden_entry"), "{err}");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_parent_path() {
        assert!(path_is_unsafe(Path::new("../evil.txt")));
        assert!(path_is_unsafe(Path::new("/abs/evil.txt")));
        assert!(!path_is_unsafe(Path::new("ok/file.txt")));
    }
}
