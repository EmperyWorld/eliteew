// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Main-window Air enrollment: one-code → TLS WS → Rust-only Capsule import → WS ACK.
// Invariants:
// - Access code is the only IPC input; no caller URL/host/path.
// - Capsule bytes, plaintext package, channel material, activation token never cross IPC.
// - Activation gate coordinates with USB Capsule import.
// Related:
// - documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md §6
// - DESKTOP-CLIENT-SECURITY-BOUNDARIES.md F-01 / F-04 / F-06 / F-08 / F-13
// ---

use serde::Serialize;
use tauri::{AppHandle, Manager, Window};
use zeroize::Zeroize;

use crate::activation_gate;
use crate::air_enroll_code::parse_access_code;
use crate::air_enroll_ws;
use crate::caller_context::require_main_window;
use crate::commands::capsule::{
    build_activation_ack_fields, import_capsule_transport, CapsuleActivationAckMode,
    CapsuleImportView,
};
use crate::commands::sealed_store::app_identifier;
use crate::capsule_v3::bytes_to_ecap_v3_transport;
use crate::device_request;
use crate::resource_policy::assert_ipc_bytes;

const AIR_CODE_IPC_MAX_BYTES: usize = 128;

#[derive(Debug, Clone, Serialize)]
pub struct AirEnrollExchangeView {
    pub ok: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entitlement: Option<crate::entitlement::EntitlementStatusView>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transport: Option<crate::wg::userspace::WTransportStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_offline: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_online: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_fofline: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub redelivery: Option<bool>,
}

fn fail_view(code: &str, message: &str) -> AirEnrollExchangeView {
    AirEnrollExchangeView {
        ok: false,
        code: code.into(),
        message: message.into(),
        entitlement: None,
        transport: None,
        mode: None,
        allow_offline: None,
        allow_online: None,
        allow_fofline: None,
        redelivery: None,
    }
}

fn map_import(view: CapsuleImportView, redelivery: bool) -> AirEnrollExchangeView {
    AirEnrollExchangeView {
        ok: view.ok,
        code: view.code,
        message: if view.ok {
            "Доступ по коду принят".into()
        } else {
            view.message
        },
        entitlement: view.entitlement,
        transport: view.transport,
        mode: view.mode,
        allow_offline: view.allow_offline,
        allow_online: view.allow_online,
        allow_fofline: view.allow_fofline,
        redelivery: Some(redelivery),
    }
}

fn humanize_air_error(code: &str) -> &str {
    match code {
        "air_code_structure" | "air_code_port" | "air_code_port_range" | "air_code_checksum"
        | "crockford_length" | "crockford_character" | "crockford_padding"
        | "crockford_noncanonical" => {
            "Код доступа не распознан. Проверьте символы и попробуйте снова."
        }
        "usb_import_busy" | "air_enroll_busy" | "air_enroll_in_progress" => {
            "Сейчас уже идёт активация. Дождитесь завершения или отмены."
        }
        "air_ws_connect" | "air_ws_connect_timeout" | "air_ws_timeout" | "air_ws_closed" => {
            "Не удалось связаться с сервером по коду. Проверьте сеть и срок кода."
        }
        "air_enroll_failed" | "air_ws_capsule_sha256" | "air_ws_capsule_size" => {
            "Код больше не действует или доставка прервалась. Запросите новый код у администратора."
        }
        "air_enroll_ack_failed" => {
            "Доступ получен, но подтверждение не завершилось. При необходимости запросите повторную выдачу."
        }
        _ => "Не удалось активировать доступ по коду. Попробуйте снова или используйте файл доступа.",
    }
}

#[tauri::command]
pub async fn air_enroll_exchange(
    app: AppHandle,
    window: Window,
    access_code: String,
) -> Result<AirEnrollExchangeView, String> {
    require_main_window(&window)?;
    assert_ipc_bytes("air_enroll_code", &access_code, AIR_CODE_IPC_MAX_BYTES)?;

    let lease = match activation_gate::begin_air() {
        Ok(l) => l,
        Err(code) => {
            return Ok(fail_view(&code, humanize_air_error(&code)));
        }
    };

    let mut parsed = match parse_access_code(&access_code) {
        Ok(c) => c,
        Err(code) => {
            drop(lease);
            return Ok(fail_view(&code, humanize_air_error(&code)));
        }
    };
    // Clear IPC copy early; parsed holds secrets until Drop.
    let mut access_code = access_code;
    access_code.zeroize();
    drop(access_code);

    let data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    let id = app_identifier(&app);

    let (device_request, _display) = match device_request::build_signed_request(&data, &id) {
        Ok(v) => v,
        Err(e) => {
            parsed.zeroize();
            drop(lease);
            eprintln!("[STEP] air_enroll_fail reason=device_request:{e}");
            return Ok(fail_view(
                "device_request_failed",
                "Не удалось подготовить устройство к активации. Повторите попытку.",
            ));
        }
    };

    let exchange = air_enroll_ws::exchange_until_capsule(&parsed, &device_request).await;
    parsed.zeroize();

    let (delivered, mut session) = match exchange {
        Ok(v) => v,
        Err(code) => {
            drop(lease);
            eprintln!("[STEP] air_enroll_fail reason={code}");
            return Ok(fail_view(&code, humanize_air_error(&code)));
        }
    };

    if let Err(e) = lease.mark_air_claimed() {
        drop(lease);
        let _ = session.send_import_nack("gate_lost").await;
        return Ok(fail_view(&e, humanize_air_error(&e)));
    }

    let transport = match bytes_to_ecap_v3_transport(&delivered.bytes) {
        Ok(t) => t,
        Err(e) => {
            let _ = session.send_import_nack("not_capsule").await;
            drop(lease);
            eprintln!("[STEP] air_enroll_fail reason=transport:{e}");
            return Ok(fail_view(
                "not_capsule",
                "Полученный пакет доступа повреждён. Запросите новый код.",
            ));
        }
    };

    let import = import_capsule_transport(
        &app,
        &transport,
        CapsuleActivationAckMode::SuppressHttp,
    )
    .await?;

    if !import.ok {
        let nack_code = if import.code.chars().all(|c| {
            c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'
        }) {
            import.code.as_str()
        } else {
            "import_failed"
        };
        let _ = session.send_import_nack(nack_code).await;
        drop(lease);
        return Ok(map_import(import, delivered.redelivery));
    }

    let mut ack = match build_activation_ack_fields(&data, &id, &delivered.request_id) {
        Ok(v) => v,
        Err(e) => {
            let _ = session.send_import_nack("activation_token_missing").await;
            drop(lease);
            eprintln!("[STEP] air_enroll_fail reason=ack_build:{e}");
            return Ok(fail_view(
                "activation_ack_failed",
                humanize_air_error("air_enroll_ack_failed"),
            ));
        }
    };

    let ack_result = session.send_activation_ack(ack.clone()).await;
    if let Some(obj) = ack.as_object_mut() {
        if let Some(serde_json::Value::String(token)) = obj.get_mut("activation_token") {
            token.zeroize();
        }
    }
    drop(ack);

    if let Err(code) = ack_result {
        drop(lease);
        eprintln!("[STEP] air_enroll_fail reason=ack_send:{code}");
        // Import already succeeded locally; report honest partial outcome.
        let mut view = map_import(import, delivered.redelivery);
        view.ok = false;
        view.code = code;
        view.message = humanize_air_error("air_enroll_ack_failed").into();
        return Ok(view);
    }

    drop(lease);
    Ok(map_import(import, delivered.redelivery))
}

#[cfg(test)]
mod tests {
    #[test]
    fn command_source_locks_main_window_and_no_url_arg() {
        let src = include_str!("air_enroll.rs");
        let body = src
            .split("mod tests")
            .next()
            .expect("command body before tests");
        assert!(body.contains("require_main_window"));
        assert!(body.contains("access_code: String"));
        assert!(!body.contains("ws_url"));
        assert!(!body.contains("base_url"));
        assert!(body.contains("SuppressHttp"));
        assert!(body.contains("build_signed_request"));
        assert!(!body.contains("export_to_import"));
    }
}
