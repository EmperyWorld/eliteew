fn is_enabled(name: &str) -> bool {
    std::env::var(name).is_ok_and(|value| {
        matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        )
    })
}

fn require_hex32(name: &str) {
    let value = std::env::var(name).unwrap_or_default();
    let trimmed = value.trim();
    let valid = trimmed.len() == 64
        && !trimmed.contains("REPLACE_WITH")
        && trimmed.bytes().all(|byte| byte.is_ascii_hexdigit());
    assert!(valid, "{name} must be provisioned as 32-byte hex for release");
    let known_dev_value = match name {
        "ELITEEW_DESKTOP_CAPSULE_SIGNING_PK" => {
            trimmed == "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0"
        }
        _ => false,
    };
    assert!(!known_dev_value, "{name} uses a forbidden public dev vector");
}

fn require_release_tauri_trust_conf() {
    let conf_path = std::path::Path::new("tauri.conf.json");
    let raw = std::fs::read_to_string(conf_path)
        .unwrap_or_else(|e| panic!("release bake requires readable tauri.conf.json: {e}"));
    assert!(
        !raw.contains("REPLACE_WITH"),
        "release tauri.conf.json must not contain REPLACE_WITH placeholders"
    );
    let conf: serde_json::Value = serde_json::from_str(&raw)
        .unwrap_or_else(|e| panic!("release tauri.conf.json parse failed: {e}"));
    let updater = conf
        .pointer("/plugins/updater")
        .unwrap_or_else(|| panic!("release bake missing plugins.updater"));
    let pubkey = updater
        .get("pubkey")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    assert!(
        pubkey.starts_with("dW50cnVzdGVk") && !pubkey.contains("REPLACE_WITH"),
        "release bake requires a real plugins.updater.pubkey"
    );
    let elite = conf
        .pointer("/plugins/eliteew-desktop-client")
        .unwrap_or_else(|| panic!("release bake missing plugins.eliteew-desktop-client"));
    for key in [
        "metadata_pubkey_hex",
        "metadata_key_id",
        "artifact_key_id",
        "denylist_pubkey_hex",
        "product_id",
        "channel",
        "package_id",
    ] {
        let value = elite.get(key).and_then(|v| v.as_str()).unwrap_or("");
        assert!(
            !value.is_empty() && !value.contains("REPLACE_WITH"),
            "release bake requires plugins.eliteew-desktop-client.{key}"
        );
    }
    let meta_pk = elite
        .get("metadata_pubkey_hex")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    assert!(
        meta_pk.len() == 64 && meta_pk.bytes().all(|b| b.is_ascii_hexdigit()),
        "metadata_pubkey_hex must be 32-byte hex"
    );
    let deny_pk = elite
        .get("denylist_pubkey_hex")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    assert!(
        deny_pk.len() == 64 && deny_pk.bytes().all(|b| b.is_ascii_hexdigit()),
        "denylist_pubkey_hex must be 32-byte hex"
    );
    let entitlements = elite
        .get("entitlement_pubkey_hex")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    assert!(
        entitlements != deny_pk,
        "denylist_pubkey_hex must differ from entitlement_pubkey_hex (Wave 8 role split)"
    );
}

fn main() {
    let conf_raw = std::fs::read_to_string("tauri.conf.json")
        .unwrap_or_else(|e| panic!("tauri.conf.json unreadable: {e}"));
    let conf: serde_json::Value = serde_json::from_str(&conf_raw)
        .unwrap_or_else(|e| panic!("tauri.conf.json parse failed: {e}"));
    let identifier = conf
        .get("identifier")
        .and_then(|v| v.as_str())
        .unwrap_or("world.empery.desktop.client");
    println!("cargo:rustc-env=TAURI_APP_IDENTIFIER={identifier}");
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if target_os == "linux" {
        println!("cargo:rustc-link-lib=glib-2.0");
    }

    for name in ["ELITEEW_DESKTOP_CAPSULE_SIGNING_PK", "ELITEEW_CAPSULE_DEV_KEYS"] {
        println!("cargo:rerun-if-env-changed={name}");
    }
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-env-changed=CARGO_FEATURE_OPS_SYSTEM_WG");
    if std::env::var("PROFILE").as_deref() == Ok("release") {
        assert!(
            !is_enabled("ELITEEW_CAPSULE_DEV_KEYS"),
            "ELITEEW_CAPSULE_DEV_KEYS is forbidden for release builds"
        );
        // Capsule v2 decrypt uses per-device keyring SK only — no shared recipient bake.
        require_hex32("ELITEEW_DESKTOP_CAPSULE_SIGNING_PK");
        require_release_tauri_trust_conf();
    }
    let mut command_names: Vec<&str> = vec![
        "desktop_client_ping",
        "host_network_status",
        "host_network_link_snapshot",
        "host_network_wired_apply",
        "host_network_wifi_scan",
        "host_network_wifi_connect",
        "host_network_wifi_disconnect",
        "license_status",
        "license_local_factory_reset_prepare",
        "license_local_factory_reset",
        "device_identity_status",
        "device_identity_ensure",
        "device_request_prepare",
        "device_request_status",
        "device_bind_status",
        "device_bind_ensure",
        "entitlement_status",
        "entitlement_import_json",
        "entitlement_import_from_grant",
        "file_grant_issue",
        "file_grant_pick",
        "capsule_import_channel",
        "capsule_import_pick_file",
        "air_enroll_exchange",
        "license_preflight_cmd",
        "license_heartbeat_cmd",
        "sealed_peer_load",
        "sealed_peer_clear",
        "w_transport_l7_probe",
        "w_transport_status_cmd",
        "w_transport_proxy_url_cmd",
        "w_transport_start_from_keyring",
        "w_transport_recover_from_keyring",
        "w_transport_stop_cmd",
        "product_open",
        "fofline_local_start_url",
        "product_webview_wipe",
        "product_close_for_license_kill_switch_cmd",
        "product_session_refresh",
        "product_session_logout",
        "video_call_meet_stage_open",
        "video_call_meet_stage_set_bounds",
        "video_call_meet_stage_close",
        "ebrowser_open",
        "ebrowser_navigate",
        "ebrowser_refresh_policy",
        "ebrowser_get_location",
        "ebrowser_get_chrome_snapshot",
        "ebrowser_reload",
        "ebrowser_history_back",
        "ebrowser_history_forward",
        "ebrowser_set_bounds",
        "ebrowser_close",
        "ebrowser_get_downloads",
        "ebrowser_tabs_list",
        "ebrowser_tab_create",
        "ebrowser_tab_activate",
        "ebrowser_tab_close",
        "ebrowser_set_media_toggles",
        "ebrowser_get_media_toggles",
        "ebrowser_find",
        "ebrowser_set_zoom",
        "ebrowser_get_zoom",
        "native_oidc_start",
        "native_oidc_complete",
        "native_oidc_refresh",
        "native_oidc_logout",
        "native_oidc_interactive_login",
        "kernel_offline_open_mount",
        "updater_check",
        "updater_install",
        "updater_recovery_install",
        "fofline_spa_pack_status",
        "fofline_spa_pack_check_update",
        "fofline_spa_pack_sync",
        "fofline_spa_assets_sync",
        "fofline_spa_assets_cancel",
        "webkit_graphics_status",
        "webkit_graphics_reset",
        "app_restart",
        "launcher_open_external",
        "ai_local_status",
        "ai_local_chat",
        "ai_third_party_status",
        "ai_third_party_save_settings",
        "ai_third_party_save_api_key",
        "ai_third_party_clear_api_key",
        "ai_third_party_chat",
        "ai_eliteew_status",
        "ai_eliteew_chat",
        "denylist_status",
        "denylist_refresh",
        "clipboard_status",
        "clipboard_read",
        "clipboard_write",
        "fs_bridge_roots",
        "fs_bridge_list_dir",
        "fs_bridge_read_file",
        "fs_bridge_write_atomic",
        "notifications_list",
        "notifications_add",
        "notifications_dismiss",
        "native_audio_play_from_grant",
        "native_audio_pause",
        "native_audio_resume",
        "native_audio_stop",
        "native_audio_seek",
        "native_audio_set_volume",
        "native_audio_status",
    ];
    if std::env::var_os("CARGO_FEATURE_OPS_SYSTEM_WG").is_some() {
        command_names.extend([
            "wg_status",
            "wg_validate_handoff",
            "wg_install_handoff",
            "wg_bring_up",
            "wg_bring_down",
            "wg_reveal_staged",
            // Ops-only plaintext seat bring-up; retail Capsule uses Rust-inner only.
            "seat_channel_bring_up",
        ]);
    }
    // AppManifest::commands requires &'static [&str]; build.rs runs once.
    let command_names: &'static [&str] = Box::leak(command_names.into_boxed_slice());
    let manifest = tauri_build::AppManifest::new().commands(command_names);
    let attributes = tauri_build::Attributes::new().app_manifest(manifest);
    tauri_build::try_build(attributes)
        .unwrap_or_else(|error| panic!("failed to build EliteEW Tauri manifest: {error:#}"));
}
