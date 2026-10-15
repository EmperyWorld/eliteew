/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed wrappers around Tauri invoke for desktop-client (WG, identity, entitlement, O2 updater, O3 AI, O4 denylist, O5 clipboard/notifications/native audio, Stage 2 FS bridge).
 *
 * Invariants:
 * - WG install requires elevation (pkexec); UI must surface honest failures.
 * - updater_install only after update_available from native check.
 * - ai_local_* never sends third-party API keys.
 * - native_audio_* is offline MusicPlayer only — grant/stream play, no HTML5 fallback, no byte IPC.
 * - fs_bridge_* is allowlisted Import/staging relative paths only — absolute IPC denied (Wave 7); not a Content Manager replacement.
 * - fs_bridge_* is main-window only (product WebView ACL must not include allow-fs-bridge-*).
 * - host_network_status / mutate are main-window only; available without entitlement; never opens NM GUI.
 * - host_network_link_snapshot is main or product (taskbar read-only; no addresses).
 * - file_grant_* issues opaque TTL grants; privileged file ops consume grant ids.
 *
 * Related:
 * - src-tauri/src/commands/*
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1–§8.2
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md §Client edition
 */

import { invoke } from "@tauri-apps/api/core";

function isTauriRuntime(): boolean {
	return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export { isTauriRuntime };

export type StubResult = {
	ok: boolean;
	code: string;
	message: string;
};

export type WgPortalStatus = {
	ok: boolean;
	code: string;
	message: string;
	unit_active: boolean;
	conf_present: boolean;
	staged_path?: string | null;
};

export type DeviceIdentityView = {
	ok: boolean;
	code: string;
	message: string;
	device_pubkey: string;
	machine_fingerprint: string;
};

export type EntitlementStatusView = {
	ok: boolean;
	code: string;
	message: string;
	license_id?: string | null;
	/** Server device UUID from signed entitlement (Start URL / session assert). */
	device_id?: string | null;
	edition?: string | null;
	profile_id?: string | null;
	apps?: string[] | null;
	exp?: number | null;
	/** FoFline W2 bit from signed entitlement (absent on older blobs). */
	allow_fofline?: boolean | null;
	/** Cloud channel bit from signed entitlement (absent on older blobs). */
	allow_online?: boolean | null;
};

export async function pingNative(): Promise<StubResult> {
	return invoke<StubResult>("desktop_client_ping");
}

export async function stubLicenseStatus(): Promise<StubResult> {
	return invoke<StubResult>("license_status");
}

export async function ensureDeviceIdentity(): Promise<DeviceIdentityView> {
	return invoke<DeviceIdentityView>("device_identity_ensure");
}

export type DeviceRequestPrepareView = {
	ok: boolean;
	code: string;
	message: string;
	display_fingerprint: string;
	request_json: string;
	export_path?: string | null;
};

export async function deviceRequestPrepare(): Promise<DeviceRequestPrepareView> {
	return invoke<DeviceRequestPrepareView>("device_request_prepare");
}

export async function entitlementStatus(): Promise<EntitlementStatusView> {
	return invoke<EntitlementStatusView>("entitlement_status");
}

export async function entitlementImportJson(
	rawJson: string,
): Promise<EntitlementStatusView> {
	return invoke<EntitlementStatusView>("entitlement_import_json", {
		rawJson,
	});
}

export async function entitlementImportFromGrant(
	grantId: string,
): Promise<EntitlementStatusView> {
	return invoke<EntitlementStatusView>("entitlement_import_from_grant", {
		grantId,
	});
}

export type FileGrantView = {
	grant_id: string;
	purpose: string;
	expires_in_secs: number;
};

export async function fileGrantIssue(opts: {
	root: "import" | "staging";
	relative: string;
	purpose: "entitlement_import" | "audio_play" | "fs_read";
}): Promise<FileGrantView> {
	return invoke<FileGrantView>("file_grant_issue", {
		root: opts.root,
		relative: opts.relative,
		purpose: opts.purpose,
	});
}

export async function fileGrantPick(
	purpose: "entitlement_import" | "audio_play" | "fs_read",
): Promise<FileGrantView> {
	return invoke<FileGrantView>("file_grant_pick", { purpose });
}

export type CapsuleImportView = {
	ok: boolean;
	code: string;
	message: string;
	entitlement?: EntitlementStatusView | null;
	transport?: {
		ok: boolean;
		code: string;
		message: string;
		enabled: boolean;
		socks_listening: boolean;
	} | null;
	mode?: string | null;
	allow_offline?: boolean | null;
	allow_online?: boolean | null;
	allow_fofline?: boolean | null;
};

/** Retail: Rust-only capsule import — no decrypted package over IPC. */
export async function capsuleImportChannel(
	raw: string,
): Promise<CapsuleImportView> {
	return invoke<CapsuleImportView>("capsule_import_channel", { raw });
}

export type AirEnrollExchangeView = {
	ok: boolean;
	code: string;
	message: string;
	entitlement?: EntitlementStatusView | null;
	transport?: {
		ok: boolean;
		code: string;
		message: string;
		enabled: boolean;
		socks_listening: boolean;
	} | null;
	mode?: string | null;
	allow_offline?: boolean | null;
	allow_online?: boolean | null;
	allow_fofline?: boolean | null;
	redelivery?: boolean | null;
};

/**
 * Air one-code enrollment — Rust parses code, opens baked WSS, imports Capsule.
 * JS never receives Capsule bytes, secrets, or activation token.
 */
export async function airEnrollExchange(
	accessCode: string,
): Promise<AirEnrollExchangeView> {
	return invoke<AirEnrollExchangeView>("air_enroll_exchange", {
		accessCode,
	});
}

/** Native `.ecap` picker — GTK/WebKit HTML `accept` is unreliable on Linux. */
export async function capsuleImportPickFile(): Promise<CapsuleImportView> {
	return invoke<CapsuleImportView>("capsule_import_pick_file");
}

export type LicenseGateCmdView = {
	ok: boolean;
	code: string;
	message: string;
	expires_at?: string | null;
	allow_online?: boolean | null;
	allow_fofline?: boolean | null;
	allow_offline?: boolean | null;
};

export async function licensePreflightNative(opts: {
	licenseId: string;
	deviceId?: string | null;
	machineFingerprint?: string | null;
}): Promise<LicenseGateCmdView> {
	return invoke<LicenseGateCmdView>("license_preflight_cmd", {
		licenseId: opts.licenseId,
		deviceId: opts.deviceId || null,
		machineFingerprint: opts.machineFingerprint || null,
	});
}

export async function licenseHeartbeatNative(opts: {
	licenseId: string;
	deviceId?: string | null;
	machineFingerprint?: string | null;
}): Promise<LicenseGateCmdView> {
	return invoke<LicenseGateCmdView>("license_heartbeat_cmd", {
		licenseId: opts.licenseId,
		deviceId: opts.deviceId || null,
		machineFingerprint: opts.machineFingerprint || null,
	});
}

export type SealedPeerStoreView = {
	ok: boolean;
	code: string;
	message: string;
	present: boolean;
};

export type L7ProbeView = {
	ok: boolean;
	code: string;
	message: string;
	status?: number | null;
};

export type DeviceBindView = {
	ok: boolean;
	code: string;
	message: string;
	bound: boolean;
	license_id?: string | null;
	machine_fingerprint?: string | null;
};

export async function deviceBindStatus(): Promise<DeviceBindView> {
	return invoke<DeviceBindView>("device_bind_status");
}

export async function deviceBindEnsure(
	licenseId: string,
): Promise<DeviceBindView> {
	return invoke<DeviceBindView>("device_bind_ensure", { licenseId });
}

/** Retail: standalone bind clear is ops-only — use license factory reset journey. */
export async function deviceBindClear(): Promise<DeviceBindView> {
	return {
		ok: false,
		code: "ops_bind_clear_removed",
		message:
			"Снятие привязки доступно через сброс лицензии в настройках, не отдельной командой.",
		bound: false,
		license_id: null,
		machine_fingerprint: null,
	};
}

/** Journey W5a Core: local wipe of entitlement / bind / all-edition peer (no server revoke). */
export type LicenseLocalFactoryResetView = {
	ok: boolean;
	cleared: string[];
	skipped: string[];
	failed: string[];
	requires_restart: boolean;
};

export async function licenseLocalFactoryResetPrepare(): Promise<string> {
	return invoke<string>("license_local_factory_reset_prepare");
}

export async function licenseLocalFactoryReset(
	confirmationToken: string,
): Promise<LicenseLocalFactoryResetView> {
	return invoke<LicenseLocalFactoryResetView>("license_local_factory_reset", {
		confirmationToken,
	});
}

export async function sealedPeerClear(): Promise<SealedPeerStoreView> {
	return invoke<SealedPeerStoreView>("sealed_peer_clear");
}

export async function sealedPeerLoad(): Promise<SealedPeerStoreView> {
	return invoke<SealedPeerStoreView>("sealed_peer_load");
}

/** Retail: start tunnel from keyring — WG private key never enters JS. */
export async function wTransportStartFromKeyring(): Promise<WTransportStatus> {
	return invoke<WTransportStatus>("w_transport_start_from_keyring");
}

/** Bounded recover from keyring (1s→2s→5s, max 3). Fail-closed after exhaustion. */
export async function wTransportRecoverFromKeyring(): Promise<WTransportStatus> {
	return invoke<WTransportStatus>("w_transport_recover_from_keyring");
}

export async function wTransportL7Probe(): Promise<L7ProbeView> {
	return invoke<L7ProbeView>("w_transport_l7_probe");
}

export async function stubDeviceIdentityStatus(): Promise<DeviceIdentityView> {
	return invoke<DeviceIdentityView>("device_identity_status");
}

const OPS_SYSTEM_WG_UNAVAILABLE: WgPortalStatus = {
	ok: false,
	code: "ops_system_wg_required",
	message:
		"Системный канал доступен только в служебной сборке. Используйте защищённый канал приложения.",
	unit_active: false,
	conf_present: false,
};

/** Retail FE never invokes system-WG commands (ops-system-wg profile only). */
export async function wgStatus(): Promise<WgPortalStatus> {
	return { ...OPS_SYSTEM_WG_UNAVAILABLE };
}

export async function wgValidateHandoff(
	_confText: string,
): Promise<WgPortalStatus> {
	return { ...OPS_SYSTEM_WG_UNAVAILABLE };
}

export async function wgInstallHandoff(
	_confText: string,
): Promise<WgPortalStatus> {
	return { ...OPS_SYSTEM_WG_UNAVAILABLE };
}

export async function wgBringUp(): Promise<WgPortalStatus> {
	return { ...OPS_SYSTEM_WG_UNAVAILABLE };
}

export async function wgBringDown(): Promise<WgPortalStatus> {
	return { ...OPS_SYSTEM_WG_UNAVAILABLE };
}

export async function wgRevealStaged(): Promise<WgPortalStatus> {
	return { ...OPS_SYSTEM_WG_UNAVAILABLE };
}

/** W-transport (userspace) — retail packages default ON via env / ensure_*; =0 → system WG. */
export type WTransportStatus = {
	ok: boolean;
	code: string;
	message: string;
	enabled: boolean;
	socks_listening: boolean;
	socks_addr?: string | null;
	proxy_url?: string | null;
	handshake_packet_sent: boolean;
	tcp_over_wg: string;
	fail_closed: boolean;
};

export type ProxyEgressPlan = {
	fail_closed: boolean;
	proxy_url?: string | null;
	code: string;
	message: string;
	linux_webkitgtk: string;
	windows_webview2: string;
};

export async function wTransportStatus(): Promise<WTransportStatus> {
	return invoke<WTransportStatus>("w_transport_status_cmd");
}

export async function wTransportProxyUrl(): Promise<ProxyEgressPlan> {
	return invoke<ProxyEgressPlan>("w_transport_proxy_url_cmd");
}

export async function wTransportStop(): Promise<WTransportStatus> {
	return invoke<WTransportStatus>("w_transport_stop_cmd");
}

/** @deprecated use wgStatus */
export async function stubWgStatus(): Promise<WgPortalStatus> {
	return wgStatus();
}

export type UpdaterCheckView = {
	ok: boolean;
	code: string;
	message: string;
	current_version?: string | null;
	available_version?: string | null;
};

/** Wave 6 typed Start — Rust builds URL; no caller destination. */
export type ProductTarget =
	| {
			kind: "connectedCloud";
			licenseId?: string | null;
			deviceId?: string | null;
	  }
	| {
			kind: "foflineLocal";
			licenseId?: string | null;
			deviceId?: string | null;
	  }
	| {
			kind: "spaDeepLink";
			appId: string;
			licenseId?: string | null;
			deviceId?: string | null;
	  };

export async function productOpen(target: ProductTarget): Promise<{
	ok: boolean;
	code: string;
	message: string;
	url: string;
	proxy_url?: string | null;
}> {
	return invoke("product_open", { target });
}

export type NativeOidcClient = "emperyDesktop" | "emperyFofline";

export type NativeOidcCommandView = {
	ok: boolean;
	code: string;
	message: string;
	authorization_url?: string | null;
	transaction_id?: string | null;
	dpop_jkt?: string | null;
	access_token?: string | null;
	id_token?: string | null;
	expires_in?: number | null;
};

/** Wave 2: typed native OIDC — main window only; never refresh token. */
export async function nativeOidcStart(input: {
	client: NativeOidcClient;
	licenseId?: string | null;
	deviceId?: string | null;
}): Promise<NativeOidcCommandView> {
	return invoke<NativeOidcCommandView>("native_oidc_start", {
		client: input.client,
		licenseId: input.licenseId ?? null,
		deviceId: input.deviceId ?? null,
	});
}

export async function nativeOidcComplete(input: {
	client: NativeOidcClient;
	callbackUrl: string;
	transactionId: string;
}): Promise<NativeOidcCommandView> {
	return invoke<NativeOidcCommandView>("native_oidc_complete", {
		client: input.client,
		callbackUrl: input.callbackUrl,
		transactionId: input.transactionId,
	});
}

export async function nativeOidcRefresh(
	client: NativeOidcClient,
): Promise<NativeOidcCommandView> {
	return invoke<NativeOidcCommandView>("native_oidc_refresh", { client });
}

export async function nativeOidcLogout(
	client: NativeOidcClient,
): Promise<NativeOidcCommandView> {
	return invoke<NativeOidcCommandView>("native_oidc_logout", { client });
}

/** Hub Start: refresh-or-auth-window → complete (main window only). */
export async function nativeOidcInteractiveLogin(input: {
	client: NativeOidcClient;
	licenseId?: string | null;
	deviceId?: string | null;
}): Promise<NativeOidcCommandView> {
	return invoke<NativeOidcCommandView>("native_oidc_interactive_login", {
		client: input.client,
		licenseId: input.licenseId ?? null,
		deviceId: input.deviceId ?? null,
	});
}

export type LauncherExternalLinkKind =
	| "site"
	| "support_mail"
	| "source_code";

/** Fixed public links — Rust maps the typed kind; JavaScript never supplies a URL. */
export async function launcherOpenExternal(
	kind: LauncherExternalLinkKind,
): Promise<void> {
	return invoke("launcher_open_external", { kind });
}

/** Clear product WebView browsing data (Journey W5b / FoFline logout). */
export type ProductWebviewWipeView = {
	wiped: boolean;
	code: string;
	message: string;
};

export async function productWebviewWipe(): Promise<ProductWebviewWipeView> {
	return invoke<ProductWebviewWipeView>("product_webview_wipe");
}

/** Close product WebView when local license is denied/revoked (license kill-switch). */
export async function productCloseForLicenseKillSwitch(): Promise<boolean> {
	return invoke<boolean>("product_close_for_license_kill_switch_cmd");
}

/** Native FoFline local Start URL builder (parity with `buildFoflineLocalStartUrl`). */
export async function foflineLocalStartUrl(opts?: {
	licenseId?: string | null;
	deviceId?: string | null;
}): Promise<string> {
	return invoke("fofline_local_start_url", {
		licenseId: opts?.licenseId ?? null,
		deviceId: opts?.deviceId ?? null,
	});
}

export type KernelOfflineOpenResult = {
	ok: boolean;
	code: string;
	message: string;
	url: string;
	app_component?: string | null;
};

/** Wave K1: open allowlisted Kernel-offline mount in a dedicated WebviewWindow. */
export async function kernelOfflineOpenMount(
	appComponent: string,
): Promise<KernelOfflineOpenResult> {
	return invoke<KernelOfflineOpenResult>("kernel_offline_open_mount", {
		appComponent,
	});
}

export async function updaterCheck(): Promise<UpdaterCheckView> {
	return invoke<UpdaterCheckView>("updater_check");
}

export async function updaterInstall(): Promise<StubResult> {
	return invoke<StubResult>("updater_install");
}

/** Linux RPM recovery when signed OTA gate is broken — no browser. */
export async function updaterRecoveryInstall(): Promise<StubResult> {
	return invoke<StubResult>("updater_recovery_install");
}

/** FoFline SPA pack local sync status (L2) + L4 remote skew + A2 groups. */
export type FoflineSpaPackStatusView = {
	ok: boolean;
	state: string;
	code: string;
	message: string;
	app_build_id?: string | null;
	remote_app_build_id?: string | null;
	update_available?: boolean;
	progress_bytes?: number | null;
	progress_total?: number | null;
	install_path?: string | null;
	groups_ready?: number;
	groups_total?: number;
	groups_syncing?: boolean;
	active_group_id?: string | null;
};

export async function foflineSpaPackStatus(
	allowFofline: boolean,
): Promise<FoflineSpaPackStatusView> {
	return invoke<FoflineSpaPackStatusView>("fofline_spa_pack_status", {
		allowFofline,
	});
}

/** L4: compare local ready pack to spa-latest without downloading. */
export async function foflineSpaPackCheckUpdate(
	allowFofline: boolean,
): Promise<FoflineSpaPackStatusView> {
	return invoke<FoflineSpaPackStatusView>("fofline_spa_pack_check_update", {
		allowFofline,
	});
}

export async function foflineSpaPackSync(
	allowFofline: boolean,
): Promise<FoflineSpaPackStatusView> {
	return invoke<FoflineSpaPackStatusView>("fofline_spa_pack_sync", {
		allowFofline,
	});
}

/** A2: background optional asset groups after core ready (idempotent). */
export async function foflineSpaAssetsSync(
	allowFofline: boolean,
): Promise<FoflineSpaPackStatusView> {
	return invoke<FoflineSpaPackStatusView>("fofline_spa_assets_sync", {
		allowFofline,
	});
}

/** A2: cooperative cancel between groups. */
export async function foflineSpaAssetsCancel(
	allowFofline: boolean,
): Promise<boolean> {
	return invoke<boolean>("fofline_spa_assets_cancel", { allowFofline });
}

export type WebkitGraphicsStatusView = {
	ok: boolean;
	code: string;
	message: string;
	sticky_compositing_off: boolean;
	process_escalated: boolean;
	unclean_strikes: number;
	recovery_available: boolean;
};

/** Linux: sticky software-compositing escalate status (WebKit ~1-core lag). */
export async function webkitGraphicsStatus(): Promise<WebkitGraphicsStatusView> {
	return invoke<WebkitGraphicsStatusView>("webkit_graphics_status");
}

/** Clear sticky escalate; caller must restart for GPU path. */
export async function webkitGraphicsReset(): Promise<StubResult> {
	return invoke<StubResult>("webkit_graphics_reset");
}

/** Relaunch native process after OTA install (does not return on success). */
export async function appRestart(): Promise<void> {
	await invoke("app_restart");
}

export type AiLocalStatusView = {
	ok: boolean;
	code: string;
	message: string;
	base_url?: string | null;
	model?: string | null;
};

export type AiChatMessage = {
	role: string;
	content: string;
};

export type AiLocalChatView = {
	ok: boolean;
	code: string;
	message: string;
	reply?: string | null;
};

export async function aiLocalStatus(): Promise<AiLocalStatusView> {
	return invoke<AiLocalStatusView>("ai_local_status");
}

export async function aiLocalChat(
	messages: AiChatMessage[],
	model?: string | null,
): Promise<AiLocalChatView> {
	return invoke<AiLocalChatView>("ai_local_chat", {
		messages,
		model: model ?? null,
	});
}

export type AiThirdPartyStatusView = {
	ok: boolean;
	code: string;
	message: string;
	base_url?: string | null;
	model?: string | null;
	has_api_key: boolean;
	key_source: string;
};

export type AiThirdPartyChatView = {
	ok: boolean;
	code: string;
	message: string;
	reply?: string | null;
};

export async function aiThirdPartyStatus(): Promise<AiThirdPartyStatusView> {
	return invoke<AiThirdPartyStatusView>("ai_third_party_status");
}

export async function aiThirdPartySaveSettings(
	baseUrl: string,
	model: string,
): Promise<AiThirdPartyStatusView> {
	return invoke<AiThirdPartyStatusView>("ai_third_party_save_settings", {
		apiOrigin: baseUrl,
		model,
	});
}

export async function aiThirdPartySaveApiKey(
	apiKey: string,
): Promise<AiThirdPartyStatusView> {
	return invoke<AiThirdPartyStatusView>("ai_third_party_save_api_key", {
		apiKey,
	});
}

export async function aiThirdPartyClearApiKey(): Promise<AiThirdPartyStatusView> {
	return invoke<AiThirdPartyStatusView>("ai_third_party_clear_api_key");
}

export async function aiThirdPartyChat(
	messages: AiChatMessage[],
	model?: string | null,
): Promise<AiThirdPartyChatView> {
	return invoke<AiThirdPartyChatView>("ai_third_party_chat", {
		messages,
		model: model ?? null,
	});
}

export type AiEliteewStatusView = {
	ok: boolean;
	code: string;
	message: string;
	base_url?: string | null;
	model?: string | null;
	network_ok: boolean;
};

export type AiEliteewChatView = {
	ok: boolean;
	code: string;
	message: string;
	reply?: string | null;
};

export async function aiEliteewStatus(): Promise<AiEliteewStatusView> {
	return invoke<AiEliteewStatusView>("ai_eliteew_status");
}

export async function aiEliteewChat(
	messages: AiChatMessage[],
	model?: string | null,
): Promise<AiEliteewChatView> {
	return invoke<AiEliteewChatView>("ai_eliteew_chat", {
		messages,
		model: model ?? null,
	});
}

export type DenylistStatusView = {
	ok: boolean;
	code: string;
	message: string;
	revoked: boolean;
	license_id?: string | null;
	denylist_url?: string | null;
};

export async function denylistStatus(): Promise<DenylistStatusView> {
	return invoke<DenylistStatusView>("denylist_status");
}

export async function denylistRefresh(): Promise<DenylistStatusView> {
	return invoke<DenylistStatusView>("denylist_refresh");
}

export type ClipboardEntry = {
	text: string;
	saved_at: number;
};

export type ClipboardView = {
	ok: boolean;
	code: string;
	message: string;
	text?: string | null;
	history?: ClipboardEntry[] | null;
};

export async function clipboardStatus(): Promise<ClipboardView> {
	return invoke<ClipboardView>("clipboard_status");
}

export async function clipboardRead(): Promise<ClipboardView> {
	return invoke<ClipboardView>("clipboard_read");
}

export async function clipboardWrite(text: string): Promise<ClipboardView> {
	return invoke<ClipboardView>("clipboard_write", { text });
}

/** Stage 2 FS bridge — allowlisted `$HOME/EliteEW/Import` + app staging only. */
export type FsBridgeRootInfo = {
	id: string;
	label: string;
	path: string;
	exists: boolean;
};

export type FsBridgeRootsView = {
	ok: boolean;
	code: string;
	message: string;
	roots?: FsBridgeRootInfo[] | null;
};

export type FsBridgeEntry = {
	name: string;
	path: string;
	is_dir: boolean;
	size?: number | null;
};

export type FsBridgeListView = {
	ok: boolean;
	code: string;
	message: string;
	path?: string | null;
	entries?: FsBridgeEntry[] | null;
};

export type FsBridgeReadView = {
	ok: boolean;
	code: string;
	message: string;
	path?: string | null;
	text?: string | null;
	bytes_b64?: string | null;
	size?: number | null;
};

export type FsBridgeWriteView = {
	ok: boolean;
	code: string;
	message: string;
	path?: string | null;
	size?: number | null;
};

export async function fsBridgeRoots(): Promise<FsBridgeRootsView> {
	return invoke<FsBridgeRootsView>("fs_bridge_roots");
}

export async function fsBridgeListDir(
	path: string,
	maxDepth?: number | null,
): Promise<FsBridgeListView> {
	return invoke<FsBridgeListView>("fs_bridge_list_dir", {
		path,
		maxDepth: maxDepth ?? null,
	});
}

export async function fsBridgeReadFile(
	path: string,
): Promise<FsBridgeReadView> {
	return invoke<FsBridgeReadView>("fs_bridge_read_file", { path });
}

export async function fsBridgeWriteAtomic(opts: {
	path: string;
	text?: string;
	bytesB64?: string;
}): Promise<FsBridgeWriteView> {
	return invoke<FsBridgeWriteView>("fs_bridge_write_atomic", {
		path: opts.path,
		text: opts.text ?? null,
		bytesB64: opts.bytesB64 ?? null,
	});
}

export type NotificationItem = {
	id: string;
	title: string;
	body: string;
	created_at: number;
};

export type NotificationsView = {
	ok: boolean;
	code: string;
	message: string;
	items: NotificationItem[];
};

export async function notificationsList(): Promise<NotificationsView> {
	return invoke<NotificationsView>("notifications_list");
}

export async function notificationsAdd(
	title: string,
	body: string,
): Promise<NotificationsView> {
	return invoke<NotificationsView>("notifications_add", { title, body });
}

export async function notificationsDismiss(
	id: string,
): Promise<NotificationsView> {
	return invoke<NotificationsView>("notifications_dismiss", { id });
}

/** @deprecated use updaterCheck */
export async function stubUpdaterCheck(): Promise<UpdaterCheckView> {
	return updaterCheck();
}

export type NativeAudioView = {
	ok: boolean;
	code: string;
	message: string;
	file_name?: string | null;
	position_secs?: number | null;
	duration_secs?: number | null;
	playing?: boolean | null;
	volume?: number | null;
};

export type NativeAudioProgress = {
	position_secs: number;
	duration_secs?: number | null;
	playing: boolean;
	file_name?: string | null;
};

export const NATIVE_AUDIO_PROGRESS_EVENT = "native-audio-progress";
export const NATIVE_AUDIO_ENDED_EVENT = "native-audio-ended";

export async function nativeAudioPlayFromGrant(
	grantId: string,
): Promise<NativeAudioView> {
	return invoke<NativeAudioView>("native_audio_play_from_grant", { grantId });
}

export async function nativeAudioPause(): Promise<NativeAudioView> {
	return invoke<NativeAudioView>("native_audio_pause");
}

export async function nativeAudioResume(): Promise<NativeAudioView> {
	return invoke<NativeAudioView>("native_audio_resume");
}

export async function nativeAudioStop(): Promise<NativeAudioView> {
	return invoke<NativeAudioView>("native_audio_stop");
}

export async function nativeAudioSeek(
	positionSecs: number,
): Promise<NativeAudioView> {
	return invoke<NativeAudioView>("native_audio_seek", {
		positionSecs,
	});
}

export async function nativeAudioSetVolume(
	volume: number,
): Promise<NativeAudioView> {
	return invoke<NativeAudioView>("native_audio_set_volume", { volume });
}

export async function nativeAudioStatus(): Promise<NativeAudioView> {
	return invoke<NativeAudioView>("native_audio_status");
}

/** Host OS network (wired + Wi‑Fi) — main window; not license-gated. */
export type HostNetworkBackend = "network_manager" | "networkd" | "unavailable";

export type HostNetworkDeviceView = {
	name: string;
	kind: string;
	state: string;
	connection?: string | null;
	ipv4: string[];
};

export type HostNetworkStatusView = {
	ok: boolean;
	code: string;
	message: string;
	backend: HostNetworkBackend;
	wifiSupported: boolean;
	devices: HostNetworkDeviceView[];
};

export type HostWifiApView = {
	ssid: string;
	signal: number;
	security: string;
	inUse: boolean;
};

export type HostNetworkActionView = {
	ok: boolean;
	code: string;
	message: string;
};

export type HostWiredApplyRequest = {
	ifname: string;
	mode: "dhcp" | "static";
	address?: string | null;
	gateway?: string | null;
	dns?: string | null;
};

export type HostWifiConnectRequest = {
	ssid: string;
	password?: string | null;
	ifname?: string | null;
};

export type HostLinkKind = "ethernet" | "wifi" | "modem";

export type HostLinkSnapshotView = {
	ok: boolean;
	code: string;
	message: string;
	kind: HostLinkKind | null;
	active: boolean;
};

export async function hostNetworkStatus(): Promise<HostNetworkStatusView> {
	return invoke<HostNetworkStatusView>("host_network_status");
}

export async function hostNetworkLinkSnapshot(): Promise<HostLinkSnapshotView> {
	return invoke<HostLinkSnapshotView>("host_network_link_snapshot");
}

export async function hostNetworkWiredApply(
	request: HostWiredApplyRequest,
): Promise<HostNetworkActionView> {
	return invoke<HostNetworkActionView>("host_network_wired_apply", { request });
}

export async function hostNetworkWifiScan(): Promise<HostWifiApView[]> {
	return invoke<HostWifiApView[]>("host_network_wifi_scan");
}

export async function hostNetworkWifiConnect(
	request: HostWifiConnectRequest,
): Promise<HostNetworkActionView> {
	return invoke<HostNetworkActionView>("host_network_wifi_connect", {
		request,
	});
}

export async function hostNetworkWifiDisconnect(
	ifname?: string | null,
): Promise<HostNetworkActionView> {
	return invoke<HostNetworkActionView>("host_network_wifi_disconnect", {
		ifname: ifname ?? null,
	});
}
