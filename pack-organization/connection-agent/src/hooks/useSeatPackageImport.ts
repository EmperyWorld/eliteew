/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Primary seat/capsule import: entitlement + userspace W-transport + optional redeem.
 *
 * Invariants:
 * - Never calls wg_install / system bring-up (No System Footprint / no sudo).
 * - Retail sealed UI never routes to Channel/License editors on failure.
 */

import { useCallback } from "react";
import { redeemLicense } from "../lib/enroll/redeemLicense";
import { bindPatchFromEntitlement } from "../lib/launcher/bindHydration";
import { persistBindIds } from "../lib/launcher/bindSession";
import {
	resolveCapsuleNativePick,
	resolveSeatOrCapsuleImport,
} from "../lib/launcher/capsuleImport";
import {
	persistLicenseCapabilities,
	readPersistedLicenseCapabilities,
} from "../lib/launcher/licenseCapabilities";
import {
	flagsForMode,
	normalizeSeatMode,
	resolveSeatModeLabelRu,
} from "../lib/launcher/licenseModes";
import { resolveAllowFoflineBoot } from "../lib/launcher/resolveAllowFoflineBoot";
import { isRetailSealedUi } from "../lib/launcher/retailSealed";
import { parseSeatPackageJson } from "../lib/launcher/seatPackage";
import {
	type LauncherStep,
	nextStepAfterSeatImport,
} from "../lib/launcher/stepGates";
import {
	airEnrollExchange,
	type CapsuleImportView,
	deviceBindEnsure,
	type EntitlementStatusView,
	ensureDeviceIdentity,
	entitlementImportJson,
	type WgPortalStatus,
	wTransportL7Probe,
} from "../lib/tauri-bridge/commands";
import { wTransportToPortalStatus } from "../lib/tunnel/wTransportPortalMap";
import { editionLabelRu, humanizeEntitlement } from "../lib/ui/statusCopy";

async function applyCapsuleLikeImport(opts: {
	imported: CapsuleImportView;
	setEntitlement: (ent: EntitlementStatusView) => void;
	setStep: (step: LauncherStep) => void;
	setLauncherDetail: (detail: string) => void;
	setWg: (wg: WgPortalStatus) => void;
	setBindLicenseId: (id: string | null) => void;
	setBindDeviceId: (id: string | null) => void;
	setAllowOnline: (v: boolean | null) => void;
	setAllowFofline: (v: boolean | null) => void;
	refreshDenylist: () => Promise<unknown>;
	successPrefix: string;
}) {
	const {
		imported,
		setEntitlement,
		setStep,
		setLauncherDetail,
		setWg,
		setBindLicenseId,
		setBindDeviceId,
		setAllowOnline,
		setAllowFofline,
		refreshDenylist,
		successPrefix,
	} = opts;
	const ent = imported.entitlement ?? {
		ok: imported.ok,
		code: imported.code,
		message: imported.message,
	};
	setEntitlement(ent);
	const mode = normalizeSeatMode(imported.mode ?? "both");
	const modeFlags =
		typeof imported.allow_online === "boolean" &&
		typeof imported.allow_offline === "boolean"
			? {
					allowOffline: imported.allow_offline,
					allowOnline: imported.allow_online,
				}
			: flagsForMode(mode);
	setAllowOnline(modeFlags.allowOnline);
	const seatFofline = resolveAllowFoflineBoot({
		entitlementAllowFofline:
			typeof imported.allow_fofline === "boolean"
				? imported.allow_fofline
				: typeof ent.allow_fofline === "boolean"
					? ent.allow_fofline
					: null,
		persistedAllowFofline: readPersistedLicenseCapabilities()?.allowFofline,
	});
	setAllowFofline(seatFofline);
	persistLicenseCapabilities({
		licenseId: ent.license_id ?? null,
		allowOffline: modeFlags.allowOffline,
		allowOnline: modeFlags.allowOnline,
		...(typeof seatFofline === "boolean" ? { allowFofline: seatFofline } : {}),
	});
	if (ent.license_id) setBindLicenseId(ent.license_id);
	if (ent.device_id) setBindDeviceId(ent.device_id);
	if (imported.transport) {
		let l7Ok: boolean | undefined;
		try {
			const probe = await wTransportL7Probe();
			l7Ok = probe.ok;
		} catch {
			l7Ok = false;
		}
		setWg(
			wTransportToPortalStatus(imported.transport as never, true, {
				l7Ok,
			}),
		);
	}
	setLauncherDetail(humanizeEntitlement(ent.code, ent.message));
	await refreshDenylist();
	if (!imported.ok) {
		setStep("home");
		return;
	}
	const modeLabel = resolveSeatModeLabelRu({
		mode: imported.mode,
		allowOffline: modeFlags.allowOffline,
		allowOnline: modeFlags.allowOnline,
	});
	if (mode === "offline") {
		setStep("shell");
		setLauncherDetail(
			`${successPrefix} · Режим: ${modeLabel}. Офлайн-приложения готовы.`,
		);
		return;
	}
	setStep(
		nextStepAfterSeatImport({
			mode,
			entitlementOk: ent.ok,
			hasWgConf: Boolean(imported.transport?.socks_listening),
			redeemAttempted: false,
			redeemSucceeded: false,
		}),
	);
	setLauncherDetail(`${successPrefix} · Режим: ${modeLabel}`);
}

export function useSeatPackageImport(opts: {
	enrollBase: string;
	setImportBusy: (busy: boolean) => void;
	setEntitlement: (ent: EntitlementStatusView) => void;
	setStep: (step: LauncherStep) => void;
	setLauncherDetail: (detail: string) => void;
	setWg: (wg: WgPortalStatus) => void;
	setWgBusy: (busy: boolean) => void;
	setLicenseKey: (key: string) => void;
	setLicenseBusy: (busy: boolean) => void;
	setLicenseStatus: (status: string) => void;
	setBindLicenseId: (id: string | null) => void;
	setBindDeviceId: (id: string | null) => void;
	setAllowOnline: (v: boolean | null) => void;
	setAllowFofline: (v: boolean | null) => void;
	setOnlineBoundLabel: (label: string | null) => void;
	refreshDenylist: () => Promise<unknown>;
}) {
	const {
		enrollBase,
		setImportBusy,
		setEntitlement,
		setStep,
		setLauncherDetail,
		setWg,
		setWgBusy: _setWgBusy,
		setLicenseKey,
		setLicenseBusy,
		setLicenseStatus,
		setBindLicenseId,
		setBindDeviceId,
		setAllowOnline,
		setAllowFofline,
		setOnlineBoundLabel,
		refreshDenylist,
	} = opts;

	const handleImportSeatJsonText = useCallback(
		async (
			raw: string,
			preResolved?: Awaited<ReturnType<typeof resolveSeatOrCapsuleImport>>,
		) => {
			setImportBusy(true);
			try {
				const resolved = preResolved ?? (await resolveSeatOrCapsuleImport(raw));
				if (!resolved.ok) {
					setEntitlement({
						ok: false,
						code: resolved.code?.trim() || "import_error",
						message: resolved.error,
					});
					setStep(isRetailSealedUi() ? "home" : "home");
					setLauncherDetail(resolved.error);
					return;
				}
				if (resolved.kind === "capsule") {
					await applyCapsuleLikeImport({
						imported: resolved.import,
						setEntitlement,
						setStep,
						setLauncherDetail,
						setWg,
						setBindLicenseId,
						setBindDeviceId,
						setAllowOnline,
						setAllowFofline,
						refreshDenylist,
						successPrefix: "Пакет места импортирован",
					});
					return;
				}
				const parsed = parseSeatPackageJson(resolved.seatJson);
				if (!parsed.ok) {
					setEntitlement({
						ok: false,
						code: "import_error",
						message: parsed.error,
					});
					return;
				}
				const seat = parsed.package;
				const mode = normalizeSeatMode(seat.mode);
				const modeLabel = resolveSeatModeLabelRu({
					mode: seat.mode,
					edition: seat.edition,
					profileId: seat.profile_id,
					modeLabelRu: seat.mode_label_ru,
					allowOffline: seat.allow_offline,
					allowOnline: seat.allow_online,
				});
				const modeFlags =
					typeof seat.allow_online === "boolean" &&
					typeof seat.allow_offline === "boolean"
						? {
								allowOffline: seat.allow_offline,
								allowOnline: seat.allow_online,
							}
						: flagsForMode(mode);
				setAllowOnline(modeFlags.allowOnline);
				const seatFofline = resolveAllowFoflineBoot({
					entitlementAllowFofline:
						typeof seat.allow_fofline === "boolean" ? seat.allow_fofline : null,
					persistedAllowFofline:
						readPersistedLicenseCapabilities()?.allowFofline,
				});
				setAllowFofline(seatFofline);
				persistLicenseCapabilities({
					licenseId: seat.license_id ?? null,
					allowOffline: modeFlags.allowOffline,
					allowOnline: modeFlags.allowOnline,
					...(typeof seatFofline === "boolean"
						? { allowFofline: seatFofline }
						: {}),
				});
				if (seat.license_id) {
					setBindLicenseId(seat.license_id);
				}
				if (seat.license_key) {
					setLicenseKey(seat.license_key);
				}

				let entOk = false;
				if (seat.entitlement) {
					try {
						const ent = await entitlementImportJson(
							JSON.stringify(seat.entitlement),
						);
						setEntitlement(ent);
						const patch = bindPatchFromEntitlement(ent);
						if (patch.licenseId) setBindLicenseId(patch.licenseId);
						if (patch.deviceId) setBindDeviceId(patch.deviceId);
						entOk = ent.ok;
						if (ent.ok) {
							const lid =
								ent.license_id?.trim() || seat.license_id?.trim() || "";
							if (lid) {
								const bind = await deviceBindEnsure(lid);
								if (!bind.ok) {
									setEntitlement({
										ok: false,
										code: bind.code,
										message: bind.message,
										license_id: lid,
									});
									setLauncherDetail(
										humanizeEntitlement(bind.code, bind.message),
									);
									setStep("home");
									return;
								}
							}
							setLauncherDetail(humanizeEntitlement(ent.code, ent.message));
							await refreshDenylist();
						}
					} catch (err) {
						setEntitlement({
							ok: false,
							code: "import_error",
							message:
								err instanceof Error
									? err.message
									: "Не удалось сохранить пакет доступа",
						});
					}
				}

				// F-04: plaintext channel conf in seat JSON is rejected by parseSeatPackageJson.
				// Channel material arrives only via Capsule import (Rust-internal).

				if (mode === "offline" && entOk) {
					setStep("shell");
					setLauncherDetail(
						`Пакет места импортирован · Режим: ${modeLabel}. Офлайн-приложения готовы.`,
					);
					return;
				}

				let redeemAttempted = false;
				let redeemSucceeded = false;
				if (seat.license_key && (mode === "cloud" || mode === "both")) {
					redeemAttempted = true;
					setLicenseBusy(true);
					try {
						const identity = await ensureDeviceIdentity();
						const result = await redeemLicense({
							enrollBase,
							licenseKey: seat.license_key,
							devicePubkey: identity.device_pubkey,
							machineFingerprint: identity.machine_fingerprint,
						});
						if (result.ok) {
							redeemSucceeded = true;
							setBindLicenseId(result.license_id);
							setBindDeviceId(result.device_id);
							persistBindIds(result.license_id, result.device_id);
							if (typeof result.allow_online === "boolean") {
								setAllowOnline(result.allow_online);
							}
							const redeemFofline = resolveAllowFoflineBoot({
								entitlementAllowFofline:
									typeof result.allow_fofline === "boolean"
										? result.allow_fofline
										: null,
								persistedAllowFofline: seatFofline,
							});
							setAllowFofline(redeemFofline);
							persistLicenseCapabilities({
								licenseId: result.license_id,
								allowOffline:
									typeof result.allow_offline === "boolean"
										? result.allow_offline
										: modeFlags.allowOffline,
								allowOnline:
									typeof result.allow_online === "boolean"
										? result.allow_online
										: modeFlags.allowOnline,
								...(typeof redeemFofline === "boolean"
									? { allowFofline: redeemFofline }
									: {}),
							});
							setOnlineBoundLabel(
								`${editionLabelRu(result.edition)} · ${result.device_id.slice(0, 8)}…`,
							);
							setLicenseStatus(
								`Активировано · ${editionLabelRu(result.edition)}`,
							);
							if (result.entitlement && !entOk) {
								const ent = await entitlementImportJson(
									JSON.stringify(result.entitlement),
								);
								setEntitlement(ent);
								const patch = bindPatchFromEntitlement(ent);
								if (patch.licenseId) setBindLicenseId(patch.licenseId);
								if (patch.deviceId) setBindDeviceId(patch.deviceId);
								entOk = ent.ok;
							}
							setStep("shell");
							setLauncherDetail(
								modeFlags.allowOnline
									? `Пакет места импортирован · Режим: ${modeLabel}. Можно открыть облачный рабочий стол.`
									: `Пакет места импортирован · Режим: ${modeLabel}. Офлайн-приложения готовы.`,
							);
							await refreshDenylist();
							return;
						}
						setLicenseStatus(humanizeEntitlement(result.code, result.message));
						setStep(isRetailSealedUi() ? "home" : "license");
						setLauncherDetail(
							isRetailSealedUi()
								? "Не удалось активировать пакет. Проверьте интернет и повторите импорт файла."
								: humanizeEntitlement(result.code, result.message),
						);
						return;
					} catch (err) {
						setLicenseStatus(
							err instanceof Error
								? err.message
								: "Не удалось активировать лицензию из пакета",
						);
						setStep(isRetailSealedUi() ? "home" : "tunnel");
						setLauncherDetail(
							err instanceof Error
								? err.message
								: "Не удалось активировать пакет. Повторите импорт.",
						);
						return;
					} finally {
						setLicenseBusy(false);
					}
				}

				const next = nextStepAfterSeatImport({
					mode,
					entitlementOk: entOk,
					hasWgConf: false,
					redeemSucceeded,
					redeemAttempted,
				});
				setStep(next);
				if (next === "shell" && entOk) {
					return;
				}
				setLauncherDetail(
					seat.notes_ru ||
						"Пакет принят частично — завершите настройку по шагам ниже.",
				);
			} finally {
				setImportBusy(false);
			}
		},
		[
			enrollBase,
			refreshDenylist,
			setAllowFofline,
			setAllowOnline,
			setBindDeviceId,
			setBindLicenseId,
			setEntitlement,
			setImportBusy,
			setLauncherDetail,
			setLicenseBusy,
			setLicenseKey,
			setLicenseStatus,
			setOnlineBoundLabel,
			setStep,
			setWg,
		],
	);

	const handleCapsuleNativePick = useCallback(async () => {
		const pre = await resolveCapsuleNativePick();
		if (!pre.ok && !pre.error.trim()) {
			return;
		}
		await handleImportSeatJsonText("", pre);
	}, [handleImportSeatJsonText]);

	const handleAirEnroll = useCallback(
		async (accessCode: string) => {
			setImportBusy(true);
			try {
				const imported = await airEnrollExchange(accessCode);
				await applyCapsuleLikeImport({
					imported,
					setEntitlement,
					setStep,
					setLauncherDetail,
					setWg,
					setBindLicenseId,
					setBindDeviceId,
					setAllowOnline,
					setAllowFofline,
					refreshDenylist,
					successPrefix: "Доступ по коду принят",
				});
			} catch (err) {
				const message =
					err instanceof Error
						? err.message
						: "Не удалось активировать доступ по коду";
				setEntitlement({
					ok: false,
					code: "air_enroll_error",
					message,
				});
				setLauncherDetail(message);
				setStep("home");
			} finally {
				setImportBusy(false);
			}
		},
		[
			refreshDenylist,
			setAllowFofline,
			setAllowOnline,
			setBindDeviceId,
			setBindLicenseId,
			setEntitlement,
			setImportBusy,
			setLauncherDetail,
			setStep,
			setWg,
		],
	);

	return {
		handleImportSeatJsonText,
		handleCapsuleNativePick,
		handleAirEnroll,
	};
}
