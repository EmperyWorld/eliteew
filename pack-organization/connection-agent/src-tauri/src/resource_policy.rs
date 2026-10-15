// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Wave 7 / F-13 — central resource caps for IPC payloads, archives, and downloads.
// Invariants:
// - Prefer measured headroom over legacy 2 GiB defaults.
// - Caps are fail-closed at the Rust boundary (not FE-only).
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §Wave 7
// ---

/// Core FoFline SPA pack archive (tar.zst) download / extract budget.
pub const CORE_PACK_ARCHIVE_MAX_BYTES: u64 = 512 * 1024 * 1024;
/// Optional asset-group archive budget (per group).
pub const GROUP_ARCHIVE_MAX_BYTES: u64 = 1024 * 1024 * 1024;
/// Linux/Windows recovery installer artifact.
pub const RECOVERY_ARTIFACT_MAX_BYTES: u64 = 256 * 1024 * 1024;
/// Single EBrowser WebKit download budget (staging → account library ingest).
pub const EBROWSER_DOWNLOAD_MAX_BYTES: u64 = 256 * 1024 * 1024;
/// Single fs_bridge read/write payload.
pub const FS_BRIDGE_FILE_MAX_BYTES: u64 = 32 * 1024 * 1024;
/// Capsule JSON IPC (sealed envelope, not plaintext seat).
pub const CAPSULE_IPC_MAX_BYTES: usize = 512 * 1024;
/// Offline entitlement JSON IPC.
pub const ENTITLEMENT_IPC_MAX_BYTES: usize = 256 * 1024;
/// Device-request export blob.
pub const DEVICE_REQUEST_IPC_MAX_BYTES: usize = 64 * 1024;
/// Notification title/body field.
pub const NOTIFICATION_FIELD_MAX_CHARS: usize = 2_000;
/// Max AI chat messages per request.
pub const AI_CHAT_MAX_MESSAGES: usize = 40;
/// Max chars per AI message content.
pub const AI_CHAT_MESSAGE_MAX_CHARS: usize = 32_768;
/// Max native AI HTTP response body.
pub const AI_HTTP_RESPONSE_MAX_BYTES: u64 = 2 * 1024 * 1024;
/// Safe archive: max entries.
pub const ARCHIVE_MAX_ENTRIES: u64 = 50_000;
/// Safe archive: max single regular file.
pub const ARCHIVE_MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;
/// Safe archive: max total decompressed bytes (covers core + group headroom).
pub const ARCHIVE_MAX_TOTAL_BYTES: u64 = GROUP_ARCHIVE_MAX_BYTES.saturating_mul(2);
/// Safe archive: max decompressed/compressed ratio (bomb guard).
pub const ARCHIVE_MAX_COMPRESSION_RATIO: u64 = 100;
/// File grant TTL.
pub const FILE_GRANT_TTL_SECS: u64 = 120;
/// Max concurrent file grants.
pub const FILE_GRANT_MAX_ACTIVE: usize = 8;

pub fn assert_ipc_bytes(label: &str, raw: &str, max: usize) -> Result<(), String> {
    if raw.len() > max {
        return Err(format!("{label}_too_large:{}:max={max}", raw.len()));
    }
    Ok(())
}

/// Cap AI chat IPC (message count + per-message content length).
pub fn assert_ai_chat_bounds<'a>(
    message_count: usize,
    contents: impl IntoIterator<Item = &'a str>,
) -> Result<(), String> {
    if message_count > AI_CHAT_MAX_MESSAGES {
        return Err(format!(
            "ai_messages_too_many:{message_count}:max={AI_CHAT_MAX_MESSAGES}"
        ));
    }
    for (i, content) in contents.into_iter().enumerate() {
        let n = content.chars().count();
        if n > AI_CHAT_MESSAGE_MAX_CHARS {
            return Err(format!(
                "ai_message_too_large:idx={i}:chars={n}:max={AI_CHAT_MESSAGE_MAX_CHARS}"
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn core_pack_cap_below_legacy_2gib() {
        assert!(CORE_PACK_ARCHIVE_MAX_BYTES < 2_147_483_648);
        assert!(GROUP_ARCHIVE_MAX_BYTES <= 1024 * 1024 * 1024);
    }

    #[test]
    fn ipc_cap_rejects_oversized() {
        let big = "x".repeat(ENTITLEMENT_IPC_MAX_BYTES + 1);
        assert!(assert_ipc_bytes("entitlement", &big, ENTITLEMENT_IPC_MAX_BYTES).is_err());
    }
}
