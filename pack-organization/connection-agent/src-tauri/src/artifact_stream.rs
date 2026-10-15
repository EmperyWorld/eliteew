// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Wave 7 / F-13 — stream HTTP response bodies to a temp file with running SHA-256.
// Invariants:
// - Never buffer the full artifact in a Vec.
// - Enforce Content-Length + streamed byte caps; mismatch fails closed.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §Wave 7
// ---

use std::fs::File;
use std::io::Write;
use std::path::Path;

use futures_util::StreamExt;
use sha2::{Digest, Sha256};

pub struct StreamedArtifact {
    pub sha256_hex: String,
    pub bytes_written: u64,
}

/// Best-effort free space under `path` (Linux). None when unavailable.
pub fn free_disk_bytes(path: &Path) -> Option<u64> {
    #[cfg(target_os = "linux")]
    {
        use std::ffi::CString;
        let c = CString::new(path.to_str()?).ok()?;
        unsafe {
            let mut s: libc::statvfs = std::mem::zeroed();
            if libc::statvfs(c.as_ptr(), &mut s) == 0 {
                return Some(s.f_bavail as u64 * s.f_frsize as u64);
            }
        }
        None
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = path;
        None
    }
}

pub fn assert_disk_headroom(path: &Path, need: u64) -> Result<(), String> {
    if let Some(free) = free_disk_bytes(path) {
        // Keep ~10% headroom beyond the artifact size.
        let need_with_headroom = need.saturating_add(need / 10).saturating_add(64 * 1024 * 1024);
        if free < need_with_headroom {
            return Err(format!(
                "disk_full:free={free}:need={need_with_headroom}"
            ));
        }
    }
    Ok(())
}

/// Stream `resp` into `dest`, hashing while writing.
pub async fn stream_response_to_file<F>(
    resp: reqwest::Response,
    dest: &Path,
    max_bytes: u64,
    mut on_progress: F,
) -> Result<StreamedArtifact, String>
where
    F: FnMut(u64, Option<u64>),
{
    if let Some(cl) = resp.content_length() {
        if cl > max_bytes {
            return Err(format!("artifact_too_large:content_length={cl}:max={max_bytes}"));
        }
        assert_disk_headroom(dest.parent().unwrap_or(dest), cl)?;
    } else {
        assert_disk_headroom(dest.parent().unwrap_or(dest), max_bytes.min(512 * 1024 * 1024))?;
    }

    let mut file = File::create(dest).map_err(|e| format!("create dest: {e}"))?;
    let mut hasher = Sha256::new();
    let mut written: u64 = 0;
    let declared = resp.content_length();
    let mut stream = resp.bytes_stream();
    on_progress(0, declared);

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("stream chunk: {e}"))?;
        let next = written
            .checked_add(chunk.len() as u64)
            .ok_or_else(|| "artifact_size_overflow".to_string())?;
        if next > max_bytes {
            return Err(format!("artifact_too_large:streamed={next}:max={max_bytes}"));
        }
        file.write_all(&chunk)
            .map_err(|e| format!("write dest: {e}"))?;
        hasher.update(&chunk);
        written = next;
        on_progress(written, declared);
    }

    if written == 0 {
        return Err("artifact_empty".into());
    }
    if let Some(cl) = declared {
        if cl != written {
            return Err(format!(
                "artifact_content_length_mismatch:declared={cl}:actual={written}"
            ));
        }
    }

    file.flush().map_err(|e| format!("flush dest: {e}"))?;
    file.sync_all().map_err(|e| format!("sync dest: {e}"))?;

    Ok(StreamedArtifact {
        sha256_hex: hex::encode(hasher.finalize()),
        bytes_written: written,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stream_artifact_struct_fields() {
        let s = StreamedArtifact {
            sha256_hex: "abc".into(),
            bytes_written: 3,
        };
        assert_eq!(s.bytes_written, 3);
    }
}
