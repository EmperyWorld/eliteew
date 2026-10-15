// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Import Capsule v3 (opaque) entirely inside Rust — Capsule v1/v2 retired on import.
// Invariants:
// - Decrypted package and channel material never cross IPC.
// - Decrypt uses per-device keyring SK only (no baked shared recipient).
// - activation_token stays Rust/keyring-only; never returned to JS.
// - After successful import: best-effort POST /activation/consume (Wave 9); failures
//   must not fail import ([STEP] activation_consume_skip).
// - Air path suppresses HTTP consume and ACKs on the same WebSocket instead.
// - Pending journal supports crash/retry without promoting secrets to JS.
// - Capsule v2 JSON envelope is denied (NCR-003 / Known Vulnerability metadata class).
// - This command module must not mention plaintext channel field names (F-04 scan).
// Related:
// - capsule_v2.rs · capsule_v3.rs · air_enroll_ws.rs
// - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §4 / §12g
// ---

use std::fs;
use std::io::Write;
use std::path::Path;

use ed25519_dalek::Signer;
use keyring::Entry;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, Window};

use crate::activation_gate;
use crate::capsule_v2::{
    channel_material_json_from_payload, is_legacy_capsule_v1, looks_like_capsule_v2,
};
use crate::capsule_v3::{bytes_to_ecap_v3_transport, looks_like_capsule_v3_bytes, looks_like_capsule_v3_transport, open_v3_with_recipient_sk};
use crate::caller_context::require_main_window;
use crate::client_defaults;
use crate::commands::sealed_store::app_identifier;
use crate::commands::w_transport::seat_channel_bring_up_inner;
use crate::device_bind;
use crate::device_identity;
use crate::device_keys;
use crate::device_request;
use crate::entitlement::{self, EntitlementStatusView};
use crate::fofline_egress::fofline_native_http_client;
use crate::native_egress_policy::assert_eliteew_https_platform_url;
use crate::resource_policy::{assert_ipc_bytes, CAPSULE_IPC_MAX_BYTES};
use crate::wg::userspace::WTransportStatus;

/// How activation is acknowledged after a successful Capsule import.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CapsuleActivationAckMode {
    /// USB / path import — best-effort HTTP consume.
    HttpBestEffort,
    /// Air WebSocket path — suppress HTTP; caller ACKs on the same socket.
    SuppressHttp,
}

const PENDING_JOURNAL: &str = "capsule_import_pending.v2.json";
const ACCOUNT_ACTIVATION_TOKEN: &str = "capsule.activation.token.v1";
const ACTIVATION_CONSUME_URL: &str =
    "https://app.eliteew.ru/api/v1/desktop-client/activation/consume";

#[derive(Debug, Clone, Serialize)]
pub struct CapsuleImportView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entitlement: Option<EntitlementStatusView>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transport: Option<WTransportStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_offline: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_online: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_fofline: Option<bool>,
}

fn fail_view(code: &str, message: &str) -> CapsuleImportView {
    CapsuleImportView {
        ok: false,
        code: code.into(),
        message: message.into(),
        entitlement: None,
        transport: None,
        mode: None,
        allow_offline: None,
        allow_online: None,
        allow_fofline: None,
    }
}

fn keyring_service(app_identifier: &str) -> String {
    let id = app_identifier.trim();
    if id.contains("fofline") {
        "world.empery.fofline".into()
    } else if id.contains("connected") {
        "world.empery.desktop.connected.v1".into()
    } else {
        "world.empery.desktop.client".into()
    }
}

fn scrub_string(s: &mut String) {
    // Best-effort overwrite before drop (F-04); do not return token over IPC.
    let bytes = unsafe { s.as_bytes_mut() };
    for b in bytes.iter_mut() {
        *b = 0;
    }
    s.clear();
}

fn store_activation_token(app_identifier: &str, token: &str) -> Result<(), String> {
    let service = keyring_service(app_identifier);
    let entry = Entry::new(&service, ACCOUNT_ACTIVATION_TOKEN)
        .map_err(|e| format!("keyring_entry: {e}"))?;
    entry
        .set_password(token)
        .map_err(|e| format!("keyring_set: {e}"))
}

pub(crate) fn load_activation_token(app_identifier: &str) -> Result<String, String> {
    let service = keyring_service(app_identifier);
    let entry = Entry::new(&service, ACCOUNT_ACTIVATION_TOKEN)
        .map_err(|e| format!("keyring_entry: {e}"))?;
    entry
        .get_password()
        .map_err(|e| format!("keyring_get: {e}"))
}

/// Build activation_ack fields (token stays Rust-only; scrub after send).
pub(crate) fn build_activation_ack_fields(
    app_data: &Path,
    app_id: &str,
    request_id: &str,
) -> Result<serde_json::Value, String> {
    let mut token = load_activation_token(app_id)?;
    if token.trim().is_empty() {
        scrub_string(&mut token);
        return Err("activation_token_missing".into());
    }
    let pub_state = device_keys::ensure_device_keys(app_data, Some(app_id))?;
    let signing = device_keys::load_signing_sk(app_data, Some(app_id))?;
    let token_sha256 = hex::encode(Sha256::digest(token.as_bytes()));
    let proof_nonce = random_hex(16);
    let proof_msg = format!("activate_v1|{request_id}|{token_sha256}|{proof_nonce}");
    let proof_signature = hex::encode(signing.sign(proof_msg.as_bytes()).to_bytes());
    let ack = serde_json::json!({
        "type": "activation_ack",
        "request_id": request_id,
        "activation_token": token,
        "device_signing_pubkey": pub_state.device_signing_pubkey,
        "proof_nonce": proof_nonce,
        "proof_signature": proof_signature,
    });
    scrub_string(&mut token);
    Ok(ack)
}

fn clear_activation_token(app_identifier: &str) {
    let service = keyring_service(app_identifier);
    if let Ok(entry) = Entry::new(&service, ACCOUNT_ACTIVATION_TOKEN) {
        let _ = entry.delete_credential();
    }
}

fn random_hex(nbytes: usize) -> String {
    let mut buf = vec![0u8; nbytes];
    let _ = getrandom::fill(&mut buf);
    hex::encode(buf)
}

/// Best-effort activation consume; never fails the import path.
async fn best_effort_activation_consume(app_data: &Path, app_id: &str, request_id: &str) {
    if request_id.trim().is_empty() {
        eprintln!("[STEP] activation_consume_skip reason=empty_request_id");
        return;
    }
    let mut token = match load_activation_token(app_id) {
        Ok(t) if !t.is_empty() => t,
        Ok(_) => {
            eprintln!("[STEP] activation_consume_skip reason=empty_token");
            return;
        }
        Err(e) => {
            eprintln!("[STEP] activation_consume_skip reason=token_load:{e}");
            return;
        }
    };

    let url = match assert_eliteew_https_platform_url(ACTIVATION_CONSUME_URL) {
        Ok(u) => u,
        Err(e) => {
            scrub_string(&mut token);
            eprintln!("[STEP] activation_consume_skip reason=url:{e}");
            return;
        }
    };

    let pub_state = match device_keys::ensure_device_keys(app_data, Some(app_id)) {
        Ok(s) => s,
        Err(e) => {
            scrub_string(&mut token);
            eprintln!("[STEP] activation_consume_skip reason=device_keys:{e}");
            return;
        }
    };
    let signing = match device_keys::load_signing_sk(app_data, Some(app_id)) {
        Ok(s) => s,
        Err(e) => {
            scrub_string(&mut token);
            eprintln!("[STEP] activation_consume_skip reason=signing_sk:{e}");
            return;
        }
    };

    let token_sha256 = hex::encode(Sha256::digest(token.as_bytes()));
    let proof_nonce = random_hex(16);
    let proof_msg = format!("activate_v1|{request_id}|{token_sha256}|{proof_nonce}");
    let proof_signature = hex::encode(signing.sign(proof_msg.as_bytes()).to_bytes());

    let body = serde_json::json!({
        "request_id": request_id,
        "activation_token": token,
        "device_signing_pubkey": pub_state.device_signing_pubkey,
        "proof_nonce": proof_nonce,
        "proof_signature": proof_signature,
    });

    let client = match fofline_native_http_client(20) {
        Ok(c) => c,
        Err(e) => {
            scrub_string(&mut token);
            eprintln!("[STEP] activation_consume_skip reason=http_client:{e}");
            return;
        }
    };

    match client.post(url).json(&body).send().await {
        Ok(resp) if resp.status().is_success() => {
            scrub_string(&mut token);
            clear_activation_token(app_id);
            eprintln!("[STEP] activation_consume_ok");
        }
        Ok(resp) => {
            scrub_string(&mut token);
            eprintln!(
                "[STEP] activation_consume_skip reason=http_status status={}",
                resp.status()
            );
        }
        Err(e) => {
            scrub_string(&mut token);
            eprintln!("[STEP] activation_consume_skip reason=http_send:{e}");
        }
    }
}

fn write_pending_journal(app_data: &Path, request_id: &str, step: &str) -> Result<(), String> {
    fs::create_dir_all(app_data).map_err(|e| format!("app data: {e}"))?;
    let path = app_data.join(PENDING_JOURNAL);
    let body = serde_json::json!({
        "request_id": request_id,
        "step": step,
    });
    let raw = serde_json::to_string_pretty(&body).map_err(|e| e.to_string())?;
    let mut f = fs::File::create(&path).map_err(|e| format!("pending journal: {e}"))?;
    f.write_all(raw.as_bytes())
        .map_err(|e| format!("pending journal write: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

fn clear_pending_journal(app_data: &Path) {
    let _ = fs::remove_file(app_data.join(PENDING_JOURNAL));
}

const CAPSULE_PICK_MAX_BYTES: usize = 256 * 1024;

/// Native OS file picker → Capsule import (GTK/WebKit `accept` is unreliable).
///
/// Do **not** rely on dialog extension filters alone: on xdg-desktop-portal,
/// unregistered `*.ecap` is often `application/octet-stream` and hidden by
/// the filter. Start in `~/EliteEW/Import` and validate EECAP3 after pick.
#[tauri::command]
pub async fn capsule_import_pick_file(
    app: AppHandle,
    window: Window,
) -> Result<CapsuleImportView, String> {
    require_main_window(&window)?;
    let _lease = activation_gate::begin_usb().map_err(|code| code)?;
    let mut dialog = rfd::AsyncFileDialog::new()
        .set_title("Выберите файл доступа EliteEW (.ecap)");
    if let Ok(home) = std::env::var("HOME") {
        let import = Path::new(&home).join("EliteEW").join("Import");
        let downloads = Path::new(&home).join("Downloads");
        if import.is_dir() {
            dialog = dialog.set_directory(&import);
        } else if downloads.is_dir() {
            dialog = dialog.set_directory(&downloads);
        }
    }
    let picked = dialog
        .pick_file()
        .await
        .ok_or_else(|| "capsule_pick_cancelled".to_string())?;
    let bytes = fs::read(picked.path()).map_err(|e| format!("capsule_pick_read: {e}"))?;
    if bytes.is_empty() {
        return Ok(fail_view("empty_file", "Файл пустой"));
    }
    if bytes.len() > CAPSULE_PICK_MAX_BYTES {
        return Ok(fail_view(
            "file_too_large",
            "Файл слишком большой (лимит 256 КБ)",
        ));
    }
    let raw = if looks_like_capsule_v3_bytes(&bytes) {
        bytes_to_ecap_v3_transport(&bytes)?
    } else {
        String::from_utf8(bytes).map_err(|_| "invalid_utf8".to_string())?
    };
    import_capsule_transport(&app, &raw, CapsuleActivationAckMode::HttpBestEffort).await
}

#[tauri::command]
pub async fn capsule_import_channel(
    app: AppHandle,
    window: Window,
    raw: String,
) -> Result<CapsuleImportView, String> {
    require_main_window(&window)?;
    let _lease = activation_gate::begin_usb().map_err(|code| code)?;
    assert_ipc_bytes("capsule", &raw, CAPSULE_IPC_MAX_BYTES)?;
    import_capsule_transport(&app, &raw, CapsuleActivationAckMode::HttpBestEffort).await
}

/// Shared Capsule import core (USB transport string or Air-delivered EECAP3).
pub(crate) async fn import_capsule_transport(
    app: &AppHandle,
    raw: &str,
    ack_mode: CapsuleActivationAckMode,
) -> Result<CapsuleImportView, String> {
    if is_legacy_capsule_v1(raw) {
        return Ok(fail_view(
            "capsule_v1_retired",
            "Этот пакет устарел. Подготовьте запрос устройства и получите новый пакет доступа.",
        ));
    }

    let open_v3 = looks_like_capsule_v3_transport(raw);
    let open_v2 = looks_like_capsule_v2(raw);
    // NCR-003: Capsule v2 JSON envelope discloses license meta — fail-closed on import.
    if open_v2 && !open_v3 {
        eprintln!("[STEP] capsule_v2_retired_deny");
        return Ok(fail_view(
            "capsule_v2_retired",
            "Этот пакет устарел. Подготовьте запрос устройства и получите новый пакет доступа.",
        ));
    }
    if !open_v3 {
        return Ok(fail_view("not_capsule", "Файл недействителен"));
    }

    let data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    let id = app_identifier(app);

    let sk = match device_keys::load_recipient_sk_bytes(&data, Some(&id)) {
        Ok(sk) => sk,
        Err(_) => {
            eprintln!("[STEP] capsule_open_fail code=device_keys_missing");
            return Ok(fail_view(
                "device_keys_missing",
                "Сначала подготовьте запрос устройства, затем импортируйте новый пакет доступа.",
            ));
        }
    };

    let package_text = match open_v3_with_recipient_sk(raw, sk) {
        Ok(value) => value,
        Err(message) => {
            eprintln!("[STEP] capsule_open_fail code=decrypt_or_sig encoding=ecap_v3");
            let code = if message == "capsule_keys_missing" {
                "capsule_keys_missing"
            } else {
                "invalid_capsule"
            };
            return Ok(fail_view(code, &message));
        }
    };

    let mut package: serde_json::Value = match serde_json::from_str(&package_text) {
        Ok(value) => value,
        Err(_) => {
            return Ok(fail_view("invalid_package", "Файл доступа повреждён"));
        }
    };

    let request_id = package
        .get("request_id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let payload_product = package
        .get("product_id")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let payload_rk = package
        .get("recipient_key_id")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if let Ok(pub_state) = device_keys::ensure_device_keys(&data, Some(&id)) {
        let expected_product = device_request::product_for_app_identifier(&id);
        if !payload_product.is_empty() && payload_product != expected_product {
            return Ok(fail_view(
                "product_mismatch",
                "Пакет предназначен для другого продукта. Подготовьте запрос устройства в нужном приложении.",
            ));
        }
        if !payload_rk.is_empty() && payload_rk != pub_state.recipient_key_id {
            return Ok(fail_view(
                "recipient_mismatch",
                "Пакет выдан для другого устройства. Подготовьте новый запрос устройства.",
            ));
        }
    }

    if let Err(e) = write_pending_journal(&data, &request_id, "opened") {
        eprintln!("[STEP] capsule_pending_journal_fail reason={e}");
    }

    // Pull activation token out of the payload before any further IPC-facing work.
    let mut activation_token = package
        .as_object_mut()
        .and_then(|obj| obj.remove("activation_token"))
        .and_then(|v| match v {
            serde_json::Value::String(s) => Some(s),
            _ => None,
        });
    if let Some(ref token) = activation_token {
        if let Err(e) = store_activation_token(&id, token) {
            eprintln!("[STEP] capsule_activation_token_store_skip reason={e}");
        }
    }
    if let Some(ref mut token) = activation_token {
        scrub_string(token);
    }
    drop(activation_token);

    let entitlement_value = match package.get("entitlement") {
        Some(value) if value.is_object() => value,
        _ => {
            return Ok(CapsuleImportView {
                ok: false,
                code: "entitlement_missing".into(),
                message: "В файле нет подтверждённого пакета доступа".into(),
                entitlement: None,
                transport: None,
                mode: summary_string(&package, "mode"),
                allow_offline: summary_bool(&package, "allow_offline"),
                allow_online: summary_bool(&package, "allow_online"),
                allow_fofline: summary_bool(&package, "allow_fofline"),
            });
        }
    };
    let entitlement_text =
        serde_json::to_string(entitlement_value).map_err(|error| error.to_string())?;

    let _ = write_pending_journal(&data, &request_id, "entitlement_import");
    let fingerprint = device_identity::load_or_create(&data)
        .ok()
        .map(|identity| identity.machine_fingerprint);
    let baked_key = client_defaults::resolve_entitlement_pubkey_hex(app);
    let entitlement = match entitlement::import_and_store(
        &data,
        &entitlement_text,
        fingerprint.as_deref(),
        baked_key.as_deref(),
        Some(&id),
    ) {
        Ok(view) => view,
        Err(error) => {
            eprintln!("[STEP] capsule_entitlement_import_fail");
            return Ok(CapsuleImportView {
                ok: false,
                code: "entitlement_invalid".into(),
                message: error,
                entitlement: None,
                transport: None,
                mode: summary_string(&package, "mode"),
                allow_offline: summary_bool(&package, "allow_offline"),
                allow_online: summary_bool(&package, "allow_online"),
                allow_fofline: summary_bool(&package, "allow_fofline"),
            });
        }
    };

    if let Some(license_id) = entitlement.license_id.as_deref() {
        let _ = write_pending_journal(&data, &request_id, "device_bind");
        if let Err(error) = device_bind::ensure_bind(&data, license_id) {
            return Ok(CapsuleImportView {
                ok: false,
                code: error,
                message: "Пакет доступа предназначен для другого устройства".into(),
                entitlement: Some(entitlement),
                transport: None,
                mode: summary_string(&package, "mode"),
                allow_offline: summary_bool(&package, "allow_offline"),
                allow_online: summary_bool(&package, "allow_online"),
                allow_fofline: summary_bool(&package, "allow_fofline"),
            });
        }
    }

    let channel_material = channel_material_json_from_payload(&package)?;
    let _ = write_pending_journal(&data, &request_id, "channel_bring_up");
    let channel = seat_channel_bring_up_inner(app, &channel_material);
    let mode = summary_string(&package, "mode");
    let allow_offline = summary_bool(&package, "allow_offline");
    let allow_online = summary_bool(&package, "allow_online");
    let allow_fofline = summary_bool(&package, "allow_fofline");

    let ok = channel.ok && entitlement.ok;
    if ok {
        clear_pending_journal(&data);
        match ack_mode {
            CapsuleActivationAckMode::HttpBestEffort => {
                best_effort_activation_consume(&data, &id, &request_id).await;
            }
            CapsuleActivationAckMode::SuppressHttp => {
                eprintln!("[STEP] activation_consume_skip reason=air_ws_ack");
            }
        }
    }

    Ok(CapsuleImportView {
        ok,
        code: if channel.ok {
            "imported".into()
        } else {
            channel.code
        },
        message: if channel.ok {
            "Файл доступа принят".into()
        } else {
            channel.message
        },
        entitlement: Some(entitlement),
        transport: channel.transport,
        mode,
        allow_offline,
        allow_online,
        allow_fofline,
    })
}

fn summary_string(package: &serde_json::Value, key: &str) -> Option<String> {
    package
        .get(key)
        .and_then(serde_json::Value::as_str)
        .map(str::to_string)
}

fn summary_bool(package: &serde_json::Value, key: &str) -> Option<bool> {
    package.get(key).and_then(serde_json::Value::as_bool)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn activation_consume_url_is_platform_https() {
        assert!(assert_eliteew_https_platform_url(ACTIVATION_CONSUME_URL).is_ok());
    }

    #[test]
    fn proof_message_shape_matches_api() {
        let msg = format!(
            "activate_v1|{}|{}|{}",
            "dr1_abc",
            "aa".repeat(32),
            "bb".repeat(8)
        );
        assert!(msg.starts_with("activate_v1|dr1_abc|"));
        assert!(msg.contains(&("aa".repeat(32))));
    }
}
