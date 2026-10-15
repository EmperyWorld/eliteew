/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cold boot: native ping, WG status, entitlement verify, bind hydration (#015).
 * Exposes Journey Identifying flags (full resolve, not ping-only).
 *
 * Invariants:
 * - Omitted entitlement allow_fofline must not coerce to false (wipes FoFline CTA).
 * - Identifying completes only after ping + channel restore + entitlementStatus.
 *
 * Related:
 * - resolveAllowFoflineBoot.ts · DESKTOP-FOFLINE-EDITION.md §4.2
 * - lib/launcher/journey/journeyPhase.ts · DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §3
 */

import { useCallback, useEffect, useState } from "react";
import { bindPatchFromEntitlement } from "../lib/launcher/bindHydration";
import { readPersistedBindIds } from "../lib/launcher/bindSession";
import {
	persistLicenseCapabilities,
	readPersistedLicenseCapabilities,
} from "../lib/launcher/licenseCapabilities";
import {
	flagsForMode,
	seatModeFromEdition,
} from "../lib/launcher/licenseModes";
import { resolveAllowFoflineBoot } from "../lib/launcher/resolveAllowFoflineBoot";
import type { LauncherStep } from "../lib/launcher/stepGates";
import {
	deviceBindStatus,
	type EntitlementStatusView,
	entitlementStatus,
	pingNative,
	sealedPeerLoad,
	type WgPortalStatus,
	wTransportL7Probe,
	wTransportRecoverFromKeyring,
	wTransportStatus,
} from "../lib/tauri-bridge/commands";
import { wTransportToPortalStatus } from "../lib/tunnel/wTransportPortalMap";
import { humanizeEntitlement } from "../lib/ui/statusCopy";

export function useNativeBoot(opts: {
	setEntitlement: (ent: EntitlementStatusView) => void;
	setWg: (wg: WgPortalStatus) => void;
	setStep: (step: LauncherStep) => void;
	setLauncherDetail: (detail: string) => void;
	setBindLicenseId: (id: string | null) => void;
	setBindDeviceId: (id: string | null) => void;
	setAllowOnline: (v: boolean | null) => void;
	setAllowFofline: (v: boolean | null) => void;
	refreshDenylist: () => Promise<unknown>;
}) {
	const {
		setEntitlement,
		setWg,
		setStep,
		setLauncherDetail,
		setBindLicenseId,
		setBindDeviceId,
		setAllowOnline,
		setAllowFofline,
		refreshDenylist,
	} = opts;

	const [nativeReady, setNativeReady] = useState(false);
	const [channelRestoreDone, setChannelRestoreDone] = useState(false);
	const [entitlementStatusDone, setEntitlementStatusDone] = useState(false);
	const [bootFailed, setBootFailed] = useState(false);
	const [bootAttempt, setBootAttempt] = useState(0);

	const retryBoot = useCallback(() => {
		setNativeReady(false);
		setChannelRestoreDone(false);
		setEntitlementStatusDone(false);
		setBootFailed(false);
		setBootAttempt((n) => n + 1);
	}, []);

	useEffect(() => {
		void (async () => {
			try {
				await pingNative();
				setNativeReady(true);
				try {
					const wt = await wTransportStatus();
					if (wt.enabled) {
						const bind = await deviceBindStatus();
						if (bind.code === "fingerprint_mismatch") {
							setWg({
								ok: false,
								code: "fingerprint_mismatch",
								message: bind.message,
								unit_active: false,
								conf_present: true,
							});
							setLauncherDetail(humanizeEntitlement(bind.code, bind.message));
						} else {
							let confPresent = false;
							let confLoadFailed = false;
							try {
								const present = await sealedPeerLoad();
								confPresent = Boolean(present.present && present.ok);
								if (present.code === "fingerprint_mismatch") {
									setWg({
										ok: false,
										code: "fingerprint_mismatch",
										message:
											"Канал привязан к другому устройству. Нужен новый пакет доступа.",
										unit_active: false,
										conf_present: true,
									});
									setLauncherDetail(
										humanizeEntitlement(
											"fingerprint_mismatch",
											"Канал привязан к другому устройству",
										),
									);
									confPresent = false;
								} else if (!present.ok && present.code !== "missing") {
									confLoadFailed = true;
									setWg({
										ok: false,
										code: "secure_store_load_failed",
										message:
											"Не удалось восстановить защищённый канал из хранилища устройства",
										unit_active: false,
										conf_present: false,
									});
									setLauncherDetail(
										"Не удалось восстановить защищённый канал. Повторите импорт файла доступа.",
									);
								}
							} catch (err) {
								const msg = err instanceof Error ? err.message : String(err);
								if (msg.includes("fingerprint_mismatch")) {
									setWg({
										ok: false,
										code: "fingerprint_mismatch",
										message:
											"Канал привязан к другому устройству. Нужен новый пакет доступа.",
										unit_active: false,
										conf_present: true,
									});
									setLauncherDetail(
										humanizeEntitlement(
											"fingerprint_mismatch",
											"Канал привязан к другому устройству",
										),
									);
								} else {
									confLoadFailed = true;
									setWg({
										ok: false,
										code: "secure_store_load_failed",
										message:
											"Не удалось восстановить защищённый канал из хранилища устройства",
										unit_active: false,
										conf_present: false,
									});
									setLauncherDetail(
										"Не удалось восстановить защищённый канал. Повторите импорт файла доступа.",
									);
								}
							}
							if (confPresent && !confLoadFailed) {
								try {
									const started = await wTransportRecoverFromKeyring();
									let l7Ok: boolean | undefined;
									try {
										const probe = await wTransportL7Probe();
										l7Ok = probe.ok;
									} catch {
										l7Ok = false;
									}
									setWg(wTransportToPortalStatus(started, true, { l7Ok }));
								} catch (err) {
									const msg = err instanceof Error ? err.message : String(err);
									if (msg.includes("sealed_peer_missing")) {
										setWg(
											wTransportToPortalStatus(
												await wTransportStatus(),
												false,
												{ l7Ok: false },
											),
										);
									} else if (msg.includes("channel_unstable")) {
										setWg({
											ok: false,
											code: "channel_unstable",
											message:
												"Соединение нестабильно. Нажмите «Проверить соединение».",
											unit_active: false,
											conf_present: true,
										});
										setLauncherDetail(
											"Соединение нестабильно. Нажмите «Проверить соединение».",
										);
									} else {
										setWg({
											ok: false,
											code: "channel_start_failed",
											message:
												"Не удалось подключить защищённый канал. Нажмите «Проверить соединение».",
											unit_active: false,
											conf_present: true,
										});
										setLauncherDetail(
											"Соединение нестабильно. Нажмите «Проверить соединение».",
										);
									}
								}
							} else if (
								!confLoadFailed &&
								bind.code !== "fingerprint_mismatch"
							) {
								// W-transport product path: never probe system WG telemetry.
								setWg(
									wTransportToPortalStatus(
										{
											ok: true,
											enabled: true,
											socks_listening: false,
											code: "idle",
											message: "Защищённый канал не запущен",
											handshake_packet_sent: false,
											tcp_over_wg: "down",
											fail_closed: true,
										},
										false,
									),
								);
							}
						}
					} else {
						// Retail never probes system WG when W-transport gate is off.
						setWg({
							ok: false,
							code: "ops_system_wg_required",
							message: "Системный канал доступен только в служебной сборке.",
							unit_active: false,
							conf_present: false,
						});
					}
				} catch (error) {
					console.error("[STEP] desktop_client_channel_restore_fail", error);
					const message =
						"Не удалось восстановить защищённый канал на этом устройстве";
					setWg({
						ok: false,
						code: "channel_restore_failed",
						message,
						unit_active: false,
						conf_present: false,
					});
					setLauncherDetail(
						"Не удалось восстановить защищённый канал. Повторите попытку или импорт файла доступа.",
					);
				} finally {
					setChannelRestoreDone(true);
				}
				const ent = await entitlementStatus();
				setEntitlement(ent);
				const patch = bindPatchFromEntitlement(ent);
				const persisted = readPersistedBindIds();
				if (patch.licenseId) setBindLicenseId(patch.licenseId);
				else if (persisted?.licenseId) setBindLicenseId(persisted.licenseId);
				if (patch.deviceId) setBindDeviceId(patch.deviceId);
				else if (persisted?.deviceId) setBindDeviceId(persisted.deviceId);
				if (ent.ok) {
					const caps = readPersistedLicenseCapabilities();
					const mode = seatModeFromEdition(ent.edition, ent.profile_id, {
						allowOffline: caps?.allowOffline,
						allowOnline: caps?.allowOnline,
					});
					const onlineFromMode = flagsForMode(mode).allowOnline;
					setAllowOnline(
						typeof caps?.allowOnline === "boolean"
							? caps.allowOnline
							: onlineFromMode,
					);
					// Signed blob wins when present; else last redeem/import persist.
					// Omitted blob bit must NOT become false (0.4.23 wiped persist → no FoFline CTA).
					let fofline = resolveAllowFoflineBoot({
						entitlementAllowFofline: ent.allow_fofline,
						persistedAllowFofline: caps?.allowFofline,
					});
					// One-shot recovery: 0.4.23 persisted false when blob omitted the bit.
					// Ignore that false so a re-redeem / new entitlement can restore CTA.
					if (
						fofline === false &&
						typeof ent.allow_fofline !== "boolean" &&
						caps?.allowFofline === false
					) {
						fofline = null;
					}
					setAllowFofline(fofline === true);
					persistLicenseCapabilities({
						licenseId: ent.license_id ?? caps?.licenseId ?? null,
						allowOnline:
							typeof caps?.allowOnline === "boolean"
								? caps.allowOnline
								: onlineFromMode,
						...(typeof fofline === "boolean" ? { allowFofline: fofline } : {}),
					});
					setStep("shell");
					setLauncherDetail(humanizeEntitlement(ent.code, ent.message));
					await refreshDenylist();
				}
				setEntitlementStatusDone(true);
			} catch (error) {
				console.error("[STEP] desktop_client_boot_fail", error);
				setNativeReady(false);
				setChannelRestoreDone(true);
				setEntitlementStatusDone(true);
				setBootFailed(true);
				setLauncherDetail(
					"Не удалось подготовить EliteEW на этом устройстве. Повторите попытку.",
				);
			}
		})();
		// boot once per attempt
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [bootAttempt]);

	return {
		nativeReady,
		channelRestoreDone,
		entitlementStatusDone,
		bootFailed,
		retryBoot,
	};
}
