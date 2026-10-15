/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin launcher Step FSM orchestrator — wires hooks to feature screens (#012).
 *
 * Invariants:
 * - Offline shell requires local entitlement verify; online SPA Start is optional.
 * - Seat package import is the primary enroll path (desktop-client-014).
 * - Retail sealed: home ↔ shell only; no Channel/License editors; ops via version taps.
 * - OTA install CTA only after update_available from signed check.
 * - Shell entry / native boot auto-checks updater; Linux RPM auto-installs + restarts.
 * - FoFline L2–L3: after allow_fofline, sync SPA pack; Start prefers local fofline-spa origin.
 * - Linux WebKit sticky escalate: in-app «Вернуть плавность» (#018), never seat shell.
 * - Journey W1: Identifying until full boot resolve — never flash activation drop-zone.
 * - Journey W2: Hub (EliteEW | Релизы | Ещё) replaces ShellStep dashboard.
 * - Journey W3: Welcome (2) → Activation; onboarding_completed local; skip Welcome after reset.
 * - Journey W4: Релизы notes + suppress silent Linux auto-apply until notes shown for version.
 * - Host network: «Сеть» after Identifying without entitlement (wired + Wi‑Fi, no NM GUI).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §Sealed Capsule
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §3–§5
 * - hooks/use*.ts
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ActivationScreen } from "./features/activation/ActivationScreen";
import { IdentifyingScreen } from "./features/boot/IdentifyingScreen";
import { LauncherHero } from "./features/chrome/LauncherHero";
import { StepRail } from "./features/chrome/StepRail";
import { HubShell } from "./features/hub/HubShell";
import { LicenseScreen } from "./features/license/LicenseScreen";
import { HostNetworkPanel } from "./features/network/HostNetworkPanel";
import "./features/network/hostNetwork.css";
import { WelcomeTour } from "./features/onboard/WelcomeTour";
import { TunnelScreen } from "./features/tunnel/TunnelScreen";
import { useCloudStart } from "./hooks/useCloudStart";
import { useDenylist } from "./hooks/useDenylist";
import { useEntitlementImport } from "./hooks/useEntitlementImport";
import { useFoflineSpaPack } from "./hooks/useFoflineSpaPack";
import { useFoflineStart } from "./hooks/useFoflineStart";
import { useLicenseRedeem } from "./hooks/useLicenseRedeem";
import { useNativeBoot } from "./hooks/useNativeBoot";
import { useRuntimePresenceReport } from "./hooks/useRuntimePresenceReport";
import { useSeatPackageImport } from "./hooks/useSeatPackageImport";
import { useUpdater } from "./hooks/useUpdater";
import { useWebkitGraphicsRecovery } from "./hooks/useWebkitGraphicsRecovery";
import { useWgPortal } from "./hooks/useWgPortal";
import { getDesktopClientBases } from "./lib/config/bases";
import { detectBuildChannel } from "./lib/enroll/reportRuntimePresence";
import { APP_VERSION } from "./lib/launcher/appVersion";
import {
	consumeAfterLocalReset,
	DEFAULT_AUTO_APPLY_POLICY,
	defaultHubTab,
	type HubPrimaryTab,
	markOnboardingCompleted,
	markUpdateNotesShownForVersion,
	maySilentAutoApplyUpdate,
	phaseAfterIdentifying,
	readOnboardingCompleted,
	readUpdateNotesShownForVersion,
} from "./lib/launcher/journey";
import {
	getMinClientVersion,
	isVersionAtLeast,
} from "./lib/launcher/productStart";
import {
	enableOpsDebugUi,
	isRetailSealedUi,
} from "./lib/launcher/retailSealed";
import type { LauncherStep } from "./lib/launcher/stepGates";
import type {
	EntitlementStatusView,
	LauncherExternalLinkKind,
} from "./lib/tauri-bridge/commands";
import {
	deviceBindClear,
	deviceBindStatus,
	deviceRequestPrepare,
	launcherOpenExternal,
	sealedPeerClear,
	wTransportStatus,
	wTransportStop,
} from "./lib/tauri-bridge/commands";
import { wTransportToPortalStatus } from "./lib/tunnel/wTransportPortalMap";
import { editionLabelRu, humanizeEntitlement } from "./lib/ui/statusCopy";
import "./styles/tokens.css";
import "./styles/base.css";

const OPS_GESTURE_TAPS = 7;

function App() {
	const bases = getDesktopClientBases();
	const minVersion = getMinClientVersion();
	const versionOk = isVersionAtLeast(APP_VERSION, minVersion);
	const sealed = isRetailSealedUi();
	const [step, setStep] = useState<LauncherStep>("home");
	const [opsTapCount, setOpsTapCount] = useState(0);
	const [deviceRequestHint, setDeviceRequestHint] = useState<string | null>(
		null,
	);
	const [deviceBound, setDeviceBound] = useState<boolean | null>(null);
	const [clearDeviceBindBusy, setClearDeviceBindBusy] = useState(false);
	const [entitlement, setEntitlement] = useState<EntitlementStatusView | null>(
		null,
	);
	const [launcherDetail, setLauncherDetail] = useState(
		versionOk
			? "Офлайн-приложения доступны по локальной лицензии; облачный рабочий стол — при наличии сети."
			: `Версия ${APP_VERSION} ниже минимума ${minVersion}`,
	);
	const [hubTab, setHubTab] = useState<HubPrimaryTab>("eliteew");
	/** Host network sheet — available without entitlement. */
	const [networkOpen, setNetworkOpen] = useState(false);
	/** Once user picks a Hub tab, stop reseeding from updater availability. */
	const [hubTabUserChosen, setHubTabUserChosen] = useState(false);
	const [onboardingCompleted, setOnboardingCompleted] = useState(() =>
		readOnboardingCompleted(),
	);
	const [afterLocalReset] = useState(() => consumeAfterLocalReset());
	const [updateNotesShownForVersion, setUpdateNotesShownForVersion] = useState<
		string | null
	>(() => readUpdateNotesShownForVersion());

	const { denylist, refreshDenylist } = useDenylist();
	const wg = useWgPortal();
	const license = useLicenseRedeem({
		enrollBase: bases.enrollBase,
		setEntitlement,
		setStep,
		setLauncherDetail,
		refreshDenylist,
	});
	const entitlementImport = useEntitlementImport({
		setEntitlement,
		setStep,
		setLauncherDetail,
		setBindLicenseId: license.setBindLicenseId,
		setBindDeviceId: license.setBindDeviceId,
		refreshDenylist,
	});
	const { handleImportSeatJsonText, handleCapsuleNativePick, handleAirEnroll } =
		useSeatPackageImport({
			enrollBase: bases.enrollBase,
			setImportBusy: entitlementImport.setImportBusy,
			setEntitlement,
			setStep,
			setLauncherDetail,
			setWg: wg.setWg,
			setWgBusy: wg.setWgBusy,
			setLicenseKey: license.setLicenseKey,
			setLicenseBusy: license.setLicenseBusy,
			setLicenseStatus: license.setLicenseStatus,
			setBindLicenseId: license.setBindLicenseId,
			setBindDeviceId: license.setBindDeviceId,
			setAllowOnline: license.setAllowOnline,
			setAllowFofline: license.setAllowFofline,
			setOnlineBoundLabel: license.setOnlineBoundLabel,
			refreshDenylist,
		});
	const updater = useUpdater({
		setLauncherDetail,
		maySilentAutoApply: (availableVersion) =>
			maySilentAutoApplyUpdate({
				policy: DEFAULT_AUTO_APPLY_POLICY,
				updateAvailable: true,
				notesVisibleForAvailableVersion:
					updateNotesShownForVersion !== availableVersion,
				platform: detectBuildChannel() === "rpm" ? "linux" : "other",
			}),
	});
	const {
		nativeReady,
		channelRestoreDone,
		entitlementStatusDone,
		bootFailed,
		retryBoot,
	} = useNativeBoot({
		setEntitlement,
		setWg: wg.setWg,
		setStep,
		setLauncherDetail,
		setBindLicenseId: license.setBindLicenseId,
		setBindDeviceId: license.setBindDeviceId,
		setAllowOnline: license.setAllowOnline,
		setAllowFofline: license.setAllowFofline,
		refreshDenylist,
	});
	const journeyPhase = phaseAfterIdentifying(
		{
			nativeReady,
			channelRestoreDone,
			entitlementStatusDone,
			entitlementOk: Boolean(entitlement?.ok),
			bootFailed,
		},
		{ onboardingCompleted, afterLocalReset },
	);
	/** W1 gate: never mount Activation drop-zone until Identifying completes. */
	const showIdentifying =
		journeyPhase === "identifying" || journeyPhase === "boot_error";
	const showWelcome = journeyPhase === "welcome";
	const showActivation = journeyPhase === "activation";
	const showHub = journeyPhase === "hub";
	const hideStepRail =
		showIdentifying || showWelcome || showActivation || showHub;
	const graphics = useWebkitGraphicsRecovery({
		nativeReady,
		setLauncherDetail,
	});
	const productChannelListening = Boolean(wg.wg?.unit_active);
	const productChannelCode = wg.wg?.code ?? null;

	const {
		canOnlineStart,
		handleStartAttempt,
		refreshLicensePreflight,
		cloudGateDetail,
		preflightPending: cloudPreflightPending,
	} = useCloudStart({
		enrollBase: bases.enrollBase,
		versionOk,
		minVersion,
		entitlement,
		onlineBoundLabel: license.onlineBoundLabel,
		allowOnline: license.allowOnline,
		bindLicenseId: license.bindLicenseId,
		bindDeviceId: license.bindDeviceId,
		channelRestoreDone,
		productChannelListening,
		productChannelCode,
		setLauncherDetail,
		onLicenseKillSwitch: (code, message) => {
			setLauncherDetail(message || code);
			setEntitlement((prev) =>
				prev
					? { ...prev, ok: false, code, message: message || code }
					: {
							ok: false,
							code,
							message: message || code,
						},
			);
		},
	});
	const { pack: foflineSpaPack, handleSpaPackSync } = useFoflineSpaPack({
		allowFofline: license.allowFofline,
		setLauncherDetail,
	});
	const {
		canFoflineStart,
		handleFoflineStartAttempt,
		refreshLicensePreflight: refreshFoflineLicensePreflight,
		foflineGateDetail,
		preflightPending: foflinePreflightPending,
	} = useFoflineStart({
		enrollBase: bases.enrollBase,
		versionOk,
		minVersion,
		entitlement,
		allowFofline: license.allowFofline,
		bindLicenseId: license.bindLicenseId,
		bindDeviceId: license.bindDeviceId,
		channelRestoreDone,
		productChannelListening,
		productChannelCode,
		spaPack: foflineSpaPack,
		setLauncherDetail,
		onLicenseKillSwitch: (code, message) => {
			setLauncherDetail(message || code);
			setEntitlement((prev) =>
				prev
					? { ...prev, ok: false, code, message: message || code }
					: {
							ok: false,
							code,
							message: message || code,
						},
			);
		},
	});

	useRuntimePresenceReport({
		enrollBase: bases.enrollBase,
		licenseId: license.bindLicenseId,
		deviceId: license.bindDeviceId,
		wg: wg.wg,
	});

	const preflightPending = cloudPreflightPending || foflinePreflightPending;

	const handleCheckChannelAndLicense = useCallback(async () => {
		await wg.handleRefreshWg();
		await refreshLicensePreflight();
		await refreshFoflineLicensePreflight();
	}, [
		refreshFoflineLicensePreflight,
		refreshLicensePreflight,
		wg.handleRefreshWg,
	]);

	const openOpener = (kind: LauncherExternalLinkKind, failMessage: string) => {
		void (async () => {
			try {
				await launcherOpenExternal(kind);
			} catch (err) {
				setLauncherDetail(err instanceof Error ? err.message : failMessage);
			}
		})();
	};

	const finishWelcome = () => {
		markOnboardingCompleted();
		setOnboardingCompleted(true);
	};

	const otaAfterIdentifyRef = useRef(false);

	useEffect(() => {
		if (!entitlementStatusDone || bootFailed || !channelRestoreDone) return;
		if (otaAfterIdentifyRef.current) return;

		void (async () => {
			const needsChannel =
				Boolean(entitlement?.ok) && Boolean(wg.wg?.conf_present);
			if (needsChannel) {
				let channelUp = Boolean(wg.wg?.unit_active);
				if (!channelUp) {
					await wg.handleRefreshWg();
					try {
						const st = await wTransportStatus();
						channelUp = Boolean(st.ok && st.socks_listening && st.proxy_url);
					} catch {
						channelUp = false;
					}
				}
				if (!channelUp) {
					return;
				}
			}
			otaAfterIdentifyRef.current = true;
			await updater.handleUpdateCheckAndAutoApply();
		})();
	}, [
		bootFailed,
		channelRestoreDone,
		entitlement?.ok,
		entitlementStatusDone,
		wg.handleRefreshWg,
		wg.wg?.conf_present,
		wg.wg?.unit_active,
		updater.handleUpdateCheckAndAutoApply,
	]);

	useEffect(() => {
		if (!showHub) {
			setHubTabUserChosen(false);
			return;
		}
		if (step !== "shell") {
			setStep("shell");
			return;
		}
		if (hubTabUserChosen) return;
		// Re-seed when updaterAvailability resolves after Identifying (W2).
		// Notes-shown persistence lands in W4; until then null = open Релизы whenever update is known.
		setHubTab(
			defaultHubTab({
				updateAvailable: Boolean(updater.updaterAvailable),
				availableVersion: updater.updaterAvailable,
				updateNotesShownForVersion,
			}),
		);
	}, [
		showHub,
		step,
		hubTabUserChosen,
		updater.updaterAvailable,
		updateNotesShownForVersion,
	]);

	useEffect(() => {
		if (!showHub || hubTab !== "releases") return;
		const available = updater.updaterAvailable;
		if (!available) return;
		if (updateNotesShownForVersion === available) return;
		markUpdateNotesShownForVersion(available);
		setUpdateNotesShownForVersion(available);
	}, [showHub, hubTab, updater.updaterAvailable, updateNotesShownForVersion]);

	useEffect(() => {
		if (step !== "shell") return;
		void wg.handleRefreshWg();
		// enter-shell refresh once per step change
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [step]);

	useEffect(() => {
		if (!nativeReady && step !== "shell") return;
		void (async () => {
			try {
				const st = await deviceBindStatus();
				setDeviceBound(st.bound && st.ok);
			} catch {
				setDeviceBound(null);
			}
		})();
	}, [nativeReady, step, entitlement?.ok]);

	const handleClearDeviceBind = () => {
		void (async () => {
			setClearDeviceBindBusy(true);
			try {
				await deviceBindClear();
				await sealedPeerClear();
				setDeviceBound(false);
				setLauncherDetail(
					"Привязка снята. Импортируйте новый пакет доступа на этом устройстве.",
				);
				try {
					await wTransportStop();
				} catch {
					/* stop best-effort */
				}
				wg.setWg(
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
			} finally {
				setClearDeviceBindBusy(false);
			}
		})();
	};

	useEffect(() => {
		if (!sealed) return;
		if (step === "tunnel" || step === "license") {
			setStep("home");
		}
	}, [sealed, step]);

	const handleOpsVersionTap = () => {
		if (!sealed) return;
		const next = opsTapCount + 1;
		if (next >= OPS_GESTURE_TAPS) {
			enableOpsDebugUi();
			setOpsTapCount(0);
			setLauncherDetail(
				"Режим поддержки включён. Канал и лицензия доступны для диагностики — без установки в систему.",
			);
			return;
		}
		setOpsTapCount(next);
	};

	const boundLabel = entitlement?.ok
		? `Режим: ${editionLabelRu(entitlement.edition, entitlement.profile_id)}`
		: (license.onlineBoundLabel ?? "ещё не привязана");

	const activationProps = {
		entitlementMessage: entitlement
			? humanizeEntitlement(entitlement.code, entitlement.message)
			: sealed
				? "Импортируйте файл доступа, выданный администратором…"
				: "Импортируйте пакет места или проверьте локальную лицензию…",
		importPath: entitlementImport.importPath,
		onImportPathChange: entitlementImport.setImportPath,
		importBusy: entitlementImport.importBusy,
		onImport: () => void entitlementImport.handleImport(),
		onImportJsonText: (raw: string) =>
			void entitlementImport.handleImportJsonText(raw),
		onImportSeatJsonText: (raw: string) => void handleImportSeatJsonText(raw),
		onPickAccessFile: sealed ? () => void handleCapsuleNativePick() : undefined,
		onOnlineEnroll: sealed ? undefined : () => setStep("tunnel"),
		onAirEnroll: sealed
			? (code: string) => handleAirEnroll(code)
			: undefined,
		airEnrollBusy: entitlementImport.importBusy,
		deviceRequestHint,
		onPrepareDeviceRequest: () => {
			void (async () => {
				try {
					const prepared = await deviceRequestPrepare();
					const path = prepared.export_path?.trim();
					if (!path) {
						setDeviceRequestHint(
							`Код ${prepared.display_fingerprint}. Файл запроса не сохранён — повторите подготовку.`,
						);
						return;
					}
					// Visible copy into the browser Downloads folder (easier to find than Import).
					if (prepared.request_json) {
						const blob = new Blob([prepared.request_json], {
							type: "application/json",
						});
						const url = URL.createObjectURL(blob);
						const anchor = document.createElement("a");
						anchor.href = url;
						anchor.download = `eliteew-device-request-${prepared.display_fingerprint}.json`;
						anchor.click();
						URL.revokeObjectURL(url);
					}
					setDeviceRequestHint(
						`Код ${prepared.display_fingerprint}. Файл сохранён: ${path}. Передайте этот JSON администратору и дождитесь пакета доступа.`,
					);
				} catch (err) {
					setDeviceRequestHint(
						err instanceof Error
							? err.message
							: "Не удалось подготовить запрос устройства",
					);
				}
			})();
		},
	};

	return (
		<main className="shell" data-step={step} data-journey-phase={journeyPhase}>
			{showIdentifying ? (
				<IdentifyingScreen
					failed={journeyPhase === "boot_error"}
					detail={launcherDetail}
					onRetry={journeyPhase === "boot_error" ? retryBoot : undefined}
				/>
			) : (
				<>
					{(showWelcome || showActivation || showHub) && !networkOpen ? (
						<div className="host-network-chrome">
							<button
								type="button"
								className="btn"
								data-journey="host-network-open"
								onClick={() => setNetworkOpen(true)}
							>
								Сеть
							</button>
						</div>
					) : null}

					{networkOpen ? (
						<HostNetworkPanel
							variant="sheet"
							onClose={() => setNetworkOpen(false)}
						/>
					) : null}

					{showWelcome || showActivation ? null : (
						<LauncherHero
							onVersionTap={sealed ? handleOpsVersionTap : undefined}
						>
							{hideStepRail ? null : (
								<StepRail
									step={step}
									nativeReady={nativeReady}
									onStepChange={setStep}
								/>
							)}
						</LauncherHero>
					)}

					<div className="shell-stage">
						{showWelcome ? (
							<WelcomeTour
								onContinueToActivation={finishWelcome}
								onOpenSite={() =>
									openOpener("site", "Не удалось открыть сайт EliteEW")
								}
								onOpenMailto={() =>
									openOpener(
										"support_mail",
										"Не удалось открыть почтовый клиент",
									)
								}
							/>
						) : null}

						{showActivation ? <ActivationScreen {...activationProps} /> : null}

						{!sealed && step === "tunnel" ? (
							<TunnelScreen
								status={wg.wg}
								busy={wg.wgBusy}
								transportMode={wg.transportMode}
								allowSgSkip={wg.allowSgSkip}
								onAllowSgSkipChange={wg.setAllowSgSkip}
								onValidate={() => void wg.handleValidate()}
								onInstall={() => void wg.handleInstall()}
								onBringUp={() => void wg.handleBringUp()}
								onBringDown={() => void wg.handleBringDown()}
								onRevealStaged={() => void wg.handleRevealStaged()}
								onRefresh={() => void wg.handleRefreshWg()}
								onContinue={() => setStep("license")}
							/>
						) : null}

						{!sealed && step === "license" ? (
							<LicenseScreen
								licenseKey={license.licenseKey}
								onLicenseKeyChange={license.setLicenseKey}
								statusMessage={license.licenseStatus}
								busy={license.licenseBusy}
								onBack={() => setStep("tunnel")}
								onContinue={() => void license.handleRedeem()}
							/>
						) : null}

						{showHub && step === "shell" ? (
							<HubShell
								tab={hubTab}
								onTabChange={(next) => {
									setHubTabUserChosen(true);
									setHubTab(next);
								}}
								eliteew={{
									appBase: bases.appBase,
									entitlement,
									versionOk,
									canOnlineStart,
									canFoflineStart,
									allowOnline: license.allowOnline,
									allowFofline: license.allowFofline,
									launcherDetail,
									cloudGateDetail,
									foflineGateDetail,
									preflightPending,
									denylist,
									foflineSpaPack:
										license.allowFofline === true ? foflineSpaPack : null,
									onStart: () => void handleStartAttempt(),
									onFoflineStart:
										license.allowFofline === true
											? () => void handleFoflineStartAttempt()
											: undefined,
									onFoflineSpaPackRetry:
										license.allowFofline === true
											? () => void handleSpaPackSync()
											: undefined,
									onFoflineSpaPackUpdate:
										license.allowFofline === true
											? () => void handleSpaPackSync()
											: undefined,
									onRefreshDenylist: () => void refreshDenylist(),
									onGoHome: () => setStep("home"),
									onCheckChannel: () => void handleCheckChannelAndLicense(),
									channelCheckBusy: wg.wgBusy,
									onOpenSite: () => {
										openOpener("site", "Не удалось открыть сайт EliteEW");
									},
								}}
								releases={{
									updaterMessage: updater.updaterMessage,
									updaterAvailable: updater.updaterAvailable,
									updateCheckBusy: updater.updateCheckBusy,
									updateInstallBusy: updater.updateInstallBusy,
									updateRestartBusy: updater.updateRestartBusy,
									updaterNeedsRestart: updater.updaterNeedsRestart,
									onCheckUpdate: () => void updater.handleUpdateCheck(),
									onInstall: () => void updater.handleUpdateInstall(),
									onRestart: () => void updater.handleAppRestart(),
								}}
								more={{
									appBase: bases.appBase,
									enrollBase: bases.enrollBase,
									wg: wg.wg,
									entitlement,
									onlineBoundLabel: license.onlineBoundLabel,
									boundLabel,
									deviceBound,
									onCheckChannel: () => void handleCheckChannelAndLicense(),
									channelCheckBusy: wg.wgBusy,
									onOpenTunnel: sealed ? undefined : () => setStep("tunnel"),
									onClearDeviceBind: sealed ? undefined : handleClearDeviceBind,
									clearDeviceBindBusy,
									onOpenSite: () =>
										openOpener("site", "Не удалось открыть сайт EliteEW"),
									onOpenSourceCode: () =>
										openOpener(
											"source_code",
											"Не удалось открыть исходный код",
										),
									onOpenMailto: () =>
										openOpener(
											"support_mail",
											"Не удалось открыть почтовый клиент",
										),
									graphicsRecoveryAvailable: graphics.recoveryAvailable,
									graphicsRecoveryBusy: graphics.recoveryBusy,
									onGraphicsRecovery: () => void graphics.handleRecovery(),
									onGoHome: () => setStep("home"),
									onStopChannel: sealed
										? () => {
												void (async () => {
													wg.setWgBusy(true);
													try {
														const st = await wTransportStop();
														wg.setWg(wTransportToPortalStatus(st, true));
														setLauncherDetail("Защищённый канал отключён.");
													} catch (err) {
														setLauncherDetail(
															err instanceof Error
																? err.message
																: "Не удалось отключить канал",
														);
													} finally {
														wg.setWgBusy(false);
													}
												})();
											}
										: undefined,
									channelStopBusy: wg.wgBusy,
								}}
							/>
						) : null}
					</div>
				</>
			)}
		</main>
	);
}

export default App;
