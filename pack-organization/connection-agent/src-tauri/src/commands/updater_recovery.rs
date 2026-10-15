// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Wave 8 / F-12 — privileged install from VerifiedUpdatePlan (signed latest.v2).
// SOCKS-aware download under W-transport; Linux RPM via capability branch:
// pkexec+dnf/rpm (retail) or sudo -n binary replace (Trusted Substrate). Windows NSIS `/S`.
// Invariants:
// - Trust roots required; unsigned latest.json is never an install source.
// - verify_latest_v2 binds product/channel/package/sequence before download.
// - Streamed bytes: exact size + SHA-256 + minisign (plan.artifact_*).
// - Linux retail: rpm NAME == package_id; rpm -Kv requires Header/Payload SHA256 digest
//   OK (digests-only fleet RPMs); dnf --nogpgcheck / rpm --nosignature only local.
// - Linux TS: userspace rpm2cpio|cpio extract → sudo -n install allowlisted binary.
// - On success persist_highest_sequence under app_data_dir.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §8
// - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §WebKitGTK / OTA
// ---

use crate::action_tickets::ActionTickets;
use crate::caller_context::require_main_window;
use crate::client_defaults;
use crate::error::StubResult;
use crate::artifact_stream;
use crate::fofline_egress::fofline_native_http_client;
use crate::resource_policy::RECOVERY_ARTIFACT_MAX_BYTES;
use crate::spa_pack;
use crate::verified_update_plan::{
    adopt_live_sequence_when_current, load_sequence_trust, persist_highest_sequence,
    platform_key_for_host, verify_latest_v2, PlanError,
};
use memmap2::Mmap;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::process::Command;
use tauri::{AppHandle, Manager, State, Window};
use tempfile::Builder;

fn recovery_platform_key() -> Result<&'static str, StubResult> {
    platform_key_for_host().map_err(|e| StubResult {
        ok: false,
        code: e.code().into(),
        message: "Recovery install is not available on this platform".into(),
    })
}

fn recovery_temp_suffix(platform: &str) -> &'static str {
    if platform == "windows-x86_64" {
        ".exe"
    } else {
        ".rpm"
    }
}

fn plan_err_to_stub(err: PlanError) -> StubResult {
    let ok = matches!(err, PlanError::NotNewer);
    StubResult {
        ok,
        code: err.code().into(),
        message: err.message(),
    }
}

/// Download latest signed shell artifact from OTA and install (Linux RPM / Windows NSIS).
#[tauri::command]
pub async fn updater_recovery_install(
    app: AppHandle,
    window: Window,
    tickets: State<'_, ActionTickets>,
) -> Result<StubResult, String> {
    require_main_window(&window)?;
    let ticket = tickets.consume_update_ticket()?;
    let result = updater_recovery_install_inner(app, &ticket.version).await?;
    if result.ok && result.code == "installed" {
        tickets.issue_restart_ticket("recovery_update_installed")?;
    }
    Ok(result)
}

pub(crate) async fn updater_recovery_install_inner(
    app: AppHandle,
    expected_version: &str,
) -> Result<StubResult, String> {
    let platform = match recovery_platform_key() {
        Ok(p) => p,
        Err(view) => return Ok(view),
    };

    let Some(roots) = client_defaults::resolve_update_trust_roots(&app) else {
        return Ok(StubResult {
            ok: false,
            code: "signing_required".into(),
            message: "Update trust roots incomplete — bake metadata/artifact keys".into(),
        });
    };

    let latest_url = client_defaults::resolve_recovery_latest_v2_url(&app);
    let current = app.package_info().version.to_string();
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    let trust = load_sequence_trust(&app_data);

    let client = match fofline_native_http_client(600) {
        Ok(c) => c,
        Err(e) => {
            return Ok(StubResult {
                ok: false,
                code: "offline_skip".into(),
                message: e,
            });
        }
    };

    let body = match client.get(&latest_url).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                return Ok(StubResult {
                    ok: false,
                    code: "offline_skip".into(),
                    message: format!("latest.v2.json HTTP {}", resp.status()),
                });
            }
            match resp.text().await {
                Ok(v) => v,
                Err(e) => {
                    return Ok(StubResult {
                        ok: false,
                        code: "check_failed".into(),
                        message: format!("latest.v2.json body: {e}"),
                    });
                }
            }
        }
        Err(e) => {
            return Ok(StubResult {
                ok: false,
                code: "offline_skip".into(),
                message: e.to_string(),
            });
        }
    };

    let plan = match verify_latest_v2(&body, &roots, platform, &current, &trust) {
        Ok(p) => p,
        Err(err) => {
            if matches!(err, PlanError::NotNewer) {
                adopt_live_sequence_when_current(&app_data, &body, platform, &current, &trust);
            }
            return Ok(plan_err_to_stub(err));
        }
    };

    if plan.version.trim() != expected_version.trim() {
        return Ok(StubResult {
            ok: false,
            code: "update_ticket_version_conflict".into(),
            message: "Available update changed — check again before installing".into(),
        });
    }

    let tmp = Builder::new()
        .prefix("eliteew-desktop-client-recovery-")
        .suffix(recovery_temp_suffix(platform))
        .tempfile()
        .map_err(|e| format!("recovery_tempfile: {e}"))?;

    let streamed = match client.get(plan.artifact_url.clone()).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                return Ok(StubResult {
                    ok: false,
                    code: "offline_skip".into(),
                    message: format!("artifact HTTP {}", resp.status()),
                });
            }
            match artifact_stream::stream_response_to_file(
                resp,
                tmp.path(),
                RECOVERY_ARTIFACT_MAX_BYTES,
                |_, _| {},
            )
            .await
            {
                Ok(s) => s,
                Err(e) if e.starts_with("artifact_too_large") || e.starts_with("disk_full") => {
                    return Ok(StubResult {
                        ok: false,
                        code: "artifact_too_large".into(),
                        message: "Update artifact exceeds the recovery size limit".into(),
                    });
                }
                Err(e) if e == "artifact_empty" => {
                    return Ok(StubResult {
                        ok: false,
                        code: "artifact_empty".into(),
                        message: "Update artifact is empty".into(),
                    });
                }
                Err(e) => {
                    return Ok(StubResult {
                        ok: false,
                        code: "offline_skip".into(),
                        message: e,
                    });
                }
            }
        }
        Err(e) => {
            return Ok(StubResult {
                ok: false,
                code: "offline_skip".into(),
                message: e.to_string(),
            });
        }
    };

    if streamed.bytes_written != plan.size {
        return Ok(StubResult {
            ok: false,
            code: "ota_artifact_size_mismatch".into(),
            message: format!(
                "Downloaded size {} does not match plan size {}",
                streamed.bytes_written, plan.size
            ),
        });
    }
    if streamed.sha256_hex != plan.sha256 {
        return Ok(StubResult {
            ok: false,
            code: "ota_artifact_sha256_mismatch".into(),
            message: "Downloaded artifact SHA-256 does not match signed metadata".into(),
        });
    }

    {
        let file = File::open(tmp.path()).map_err(|e| format!("recovery_reopen: {e}"))?;
        let map = unsafe { Mmap::map(&file) }.map_err(|e| format!("recovery_mmap: {e}"))?;
        if let Err(e) = spa_pack::verify_tauri_minisign(
            &map,
            &plan.artifact_signature,
            &plan.artifact_pubkey,
        ) {
            eprintln!("[STEP] updater_recovery_verify_fail err={e}");
            return Ok(StubResult {
                ok: false,
                code: "signature_invalid".into(),
                message: "Update signature verification failed".into(),
            });
        }
    }
    eprintln!(
        "[STEP] updater_recovery_verify_ok version={} platform={} package_id={}",
        plan.version, platform, plan.package_id
    );

    let expected_sha256 = plan.sha256.as_str();
    let install = if platform == "windows-x86_64" {
        install_nsis_silent(tmp.path(), expected_sha256)
    } else {
        install_linux_rpm(tmp.path(), expected_sha256, &plan.package_id)
    };

    match install {
        Ok(()) => {
            if let Err(e) = persist_highest_sequence(&app_data, plan.sequence, &plan.version, &plan.sha256) {
                eprintln!("[STEP] updater_recovery_sequence_persist_fail err={e}");
                return Ok(StubResult {
                    ok: false,
                    code: "sequence_persist_failed".into(),
                    message: "Update installed but sequence state could not be saved".into(),
                });
            }
            Ok(StubResult::ok_msg(
                "installed",
                format!(
                    "Recovery installed {} (was {}) — restart to apply",
                    plan.version, current
                ),
            ))
        }
        Err(msg) => {
            let lower = msg.to_lowercase();
            let code = if lower.contains("dismissed")
                || lower.contains("cancel")
                || lower.contains("authentication")
                || lower.contains("not authorized")
                || lower.contains("elevation")
                || lower.contains("access is denied")
            {
                "auth_required"
            } else {
                "package_install_failed"
            };
            Ok(StubResult {
                ok: false,
                code: code.into(),
                message: msg,
            })
        }
    }
}

fn install_linux_rpm(
    rpm_path: &std::path::Path,
    expected_sha256: &str,
    package_id: &str,
) -> Result<(), String> {
    if crate::rpm_payload::linux_pkexec_pkg_available() {
        eprintln!("[STEP] updater_recovery_install_via=pkexec_pkg");
        return install_rpm_pkexec(rpm_path, expected_sha256, package_id);
    }
    if crate::rpm_payload::linux_sudo_n_available() {
        eprintln!("[STEP] updater_recovery_install_via=sudo_binary");
        return install_rpm_sudo_binary(rpm_path, expected_sha256);
    }
    Err(
        "no supported Linux install path (need pkexec+dnf/rpm, or sudo -n for binary replace)"
            .into(),
    )
}

/// Trusted Substrate / embedded: no pkexec or rpm(8). Extract allowlisted binary, install via sudo -n.
fn install_rpm_sudo_binary(
    rpm_path: &std::path::Path,
    expected_sha256: &str,
) -> Result<(), String> {
    if expected_sha256.len() != 64
        || !expected_sha256
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("invalid expected rpm sha256".into());
    }
    let on_disk = std::fs::read(rpm_path).map_err(|e| format!("rpm read before extract: {e}"))?;
    let got = hex::encode(Sha256::digest(&on_disk));
    if got != expected_sha256 {
        return Err("rpm tempfile sha256 mismatch before extract".into());
    }

    let (_extract_dir, bin_path) = crate::rpm_payload::extract_desktop_client_binary(rpm_path)?;
    let bin_s = bin_path
        .to_str()
        .ok_or_else(|| "extracted binary path not utf-8".to_string())?;

    // Argv-only sudo: install primary path + optional TS payload slot (same as factory bake).
    let script = r#"set -euo pipefail
src="$1"
[ -n "$src" ] || { echo empty_src >&2; exit 2; }
[ -f "$src" ] || { echo missing_src >&2; exit 2; }
install -m 0755 -- "$src" /usr/bin/eliteew-desktop-client
if [ -d /opt/eliteew-trusted-substrate/payload ]; then
  install -m 0755 -- "$src" /opt/eliteew-trusted-substrate/payload/EliteEW.AppImage
fi
"#;

    let output = Command::new("sudo")
        .args(["-n", "bash", "-c", script, "eliteew-ota-binary-install", bin_s])
        .output()
        .map_err(|e| format!("sudo -n install failed to spawn: {e}"))?;
    if output.status.success() {
        eprintln!("[STEP] updater_recovery_sudo_binary_ok");
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    Err(format!(
        "sudo -n binary install failed status={}: {} {}",
        output.status,
        stderr.trim(),
        stdout.trim()
    ))
}

fn install_rpm_pkexec(
    rpm_path: &std::path::Path,
    expected_sha256: &str,
    package_id: &str,
) -> Result<(), String> {
    let path_str = rpm_path
        .to_str()
        .ok_or_else(|| "rpm path not utf-8".to_string())?;
    if expected_sha256.len() != 64
        || !expected_sha256
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("invalid expected rpm sha256".into());
    }
    let package_id = package_id.trim();
    if package_id.is_empty()
        || package_id
            .bytes()
            .any(|b| !(b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.'))
    {
        return Err("invalid expected package_id".into());
    }

    // Root owns the install copy. Hashing that copy closes verify→pkexec TOCTOU.
    // Trust for OTA is already minisign + sha256 + package_id (VerifiedUpdatePlan).
    // Use rpm -Kv: Fedora digests-only prints non-verbose "digests SIGNATURES"
    // with no "OK", so a "digest OK" grep on rpm -K always fails. Require
    // Header/Payload SHA256 digest: OK; ignore missing PGP (dnf --nogpgcheck /
    // rpm --nosignature only for this local verified path — never a repo fetch).
    let script = r#"set -euo pipefail
source_path="$1"
expected_sha256="$2"
expected_package_id="$3"
root_copy="$(mktemp /var/tmp/eliteew-recovery-rpm.XXXXXX.rpm)"
trap 'rm -f "$root_copy"' EXIT
install -m 0600 -- "$source_path" "$root_copy"
printf '%s  %s\n' "$expected_sha256" "$root_copy" | sha256sum -c -
pkg_name="$(rpm -qp --qf '%{NAME}' -- "$root_copy")"
if [ "$pkg_name" != "$expected_package_id" ]; then
  echo "package_id mismatch: got=$pkg_name expected=$expected_package_id" >&2
  exit 1
fi
rpm_k_out="$(rpm -Kv -- "$root_copy" 2>&1)" || true
printf '%s\n' "$rpm_k_out"
if printf '%s\n' "$rpm_k_out" | grep -qiE 'SHA256 digest: NOT OK|digest: NOT OK'; then
  echo "rpm -Kv reported digest NOT OK" >&2
  exit 1
fi
# Digests-only and signed RPMs both emit Header/Payload SHA256 digest: OK.
if ! printf '%s\n' "$rpm_k_out" | grep -qiE 'Header SHA256 digest: OK'; then
  echo "rpm -Kv missing Header SHA256 digest OK" >&2
  exit 1
fi
if ! printf '%s\n' "$rpm_k_out" | grep -qiE 'Payload SHA256 digest: OK'; then
  echo "rpm -Kv missing Payload SHA256 digest OK" >&2
  exit 1
fi
if command -v dnf >/dev/null 2>&1; then
  # Local OTA RPM already minisign+sha256 verified above; no bare `--` (dnf5).
  dnf install -y --setopt=install_weak_deps=False --nogpgcheck "$root_copy"
elif command -v rpm >/dev/null 2>&1; then
  rpm -Uvh --force --nosignature "$root_copy"
else
  echo "no dnf/rpm" >&2
  exit 127
fi
"#;

    let output = Command::new("pkexec")
        .args([
            "bash",
            "-c",
            script,
            "eliteew-recovery-install",
            path_str,
            expected_sha256,
            package_id,
        ])
        .output()
        .map_err(|e| format!("pkexec failed to spawn: {e}"))?;

    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    Err(format!(
        "pkexec install failed status={}: {} {}",
        output.status,
        stderr.trim(),
        stdout.trim()
    ))
}

/// Silent NSIS install after minisign + local SHA-256 re-check (Windows W-transport path).
fn install_nsis_silent(exe_path: &std::path::Path, expected_sha256: &str) -> Result<(), String> {
    if expected_sha256.len() != 64
        || !expected_sha256
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("invalid expected nsis sha256".into());
    }
    let on_disk = std::fs::read(exe_path).map_err(|e| format!("nsis read before install: {e}"))?;
    let got = hex::encode(Sha256::digest(&on_disk));
    if got != expected_sha256 {
        return Err("nsis tempfile sha256 mismatch before install".into());
    }
    let path_str = exe_path
        .to_str()
        .ok_or_else(|| "nsis path not utf-8".to_string())?;
    eprintln!("[STEP] updater_recovery_nsis_silent path_len={}", path_str.len());
    let output = Command::new(exe_path)
        .arg("/S")
        .output()
        .map_err(|e| format!("nsis failed to spawn: {e}"))?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    Err(format!(
        "nsis silent install failed status={}: {} {}",
        output.status,
        stderr.trim(),
        stdout.trim()
    ))
}

#[cfg(test)]
mod tests {
    use crate::client_defaults::BAKED_UPDATER_PUBKEY_CONNECTED;
    use super::recovery_platform_key;

    #[test]
    fn recovery_module_links() {
        assert!(true);
    }

    #[test]
    fn recovery_platform_key_matches_host() {
        let key = recovery_platform_key().expect("host should be linux or windows x86_64 CI");
        if cfg!(target_os = "linux") {
            assert_eq!(key, "linux-x86_64-rpm");
        }
        if cfg!(target_os = "windows") {
            assert_eq!(key, "windows-x86_64");
        }
    }

    #[test]
    fn recovery_source_uses_verified_update_plan() {
        let src = include_str!("updater_recovery.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        assert!(
            prod.contains("fofline_native_http_client"),
            "recovery must use FoFline SOCKS-aware HTTP under W-transport"
        );
        assert!(
            !prod.contains("reqwest::Client::builder"),
            "bare reqwest Client bypasses W-transport SOCKS"
        );
        assert!(
            prod.contains("verify_latest_v2") && prod.contains("resolve_update_trust_roots"),
            "install must verify signed latest.v2 before download"
        );
        assert!(
            prod.contains("latest.v2") || prod.contains("resolve_recovery_latest_v2_url"),
            "recovery must fetch latest.v2.json"
        );
        assert!(
            prod.contains("verify_tauri_minisign"),
            "privileged recovery must verify bytes before install"
        );
        assert!(
            prod.contains("load_sequence_trust"),
            "recovery must load sequence trust for monotonic sequence"
        );
        assert!(
            prod.contains("adopt_live_sequence_when_current"),
            "same-version live metadata must adopt sequence without reinstall"
        );
        assert!(
            prod.contains("persist_highest_sequence"),
            "successful install must persist sequence"
        );
        assert!(
            prod.contains("windows-x86_64"),
            "Windows NSIS platform must be supported"
        );
        assert!(
            prod.contains("install_nsis_silent") && prod.contains("\"/S\""),
            "Windows recovery must silent-install NSIS"
        );
        assert!(
            prod.contains("install_rpm_pkexec")
                && prod.contains("install_rpm_sudo_binary")
                && prod.contains("install_linux_rpm"),
            "Linux install must capability-branch pkexec vs sudo binary"
        );
        assert!(
            prod.contains("updater_recovery_install_via=pkexec_pkg")
                && prod.contains("updater_recovery_install_via=sudo_binary"),
            "install path selection must be observable in logs"
        );
        assert!(
            prod.contains("rpm -qp --qf '%{NAME}'")
                || prod.contains(r#"rpm -qp --qf '%{NAME}'"#),
            "Linux install must bind rpm NAME to package_id"
        );
        assert!(
            prod.contains("rpm -Kv"),
            "Linux install must run rpm -Kv (non-verbose digests-only has no OK token)"
        );
        assert!(
            prod.contains("--nogpgcheck"),
            "local OTA RPM install must use --nogpgcheck after minisign+sha256 (digests-only fleet RPMs)"
        );
        assert!(
            prod.contains("--nosignature"),
            "rpm fallback must skip signature when dnf absent (digests-only after minisign)"
        );
        assert!(
            prod.contains("Header SHA256 digest: OK")
                && prod.contains("Payload SHA256 digest: OK"),
            "rpm -Kv must require Header+Payload SHA256 digest OK"
        );
        assert!(
            prod.contains("SHA256 digest: NOT OK|digest: NOT OK"),
            "rpm -Kv must reject digest NOT OK without blanket Signature NOT OK fail"
        );
        assert!(
            prod.contains("eliteew-recovery-rpm.XXXXXX.rpm"),
            "recovery must use .rpm temp suffix for dnf local path"
        );
        assert!(
            !prod.contains("struct LatestFile"),
            "unsigned LatestFile latest.json path must stay retired"
        );
    }

    #[test]
    fn recovery_signature_verifier_rejects_invalid_bytes() {
        let result = crate::spa_pack::verify_tauri_minisign(
            b"not-a-signed-rpm",
            "invalid-signature",
            BAKED_UPDATER_PUBKEY_CONNECTED,
        );
        assert!(result.is_err());
    }
}
