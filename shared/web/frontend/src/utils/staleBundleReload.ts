/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Post-deploy stale SPA recovery: chunk reload, deploy id polling, bundle vs server mismatch reload.
 *
 * Invariants:
 * - `app-build-version.txt` is a single-line deploy id (no JSON).
 * - Never reload during OIDC callback (`?code=` / PKCE state in sessionStorage).
 * - Never reload while a maintenance window is active; completion owns the single recovery reload after `/api/health` ok.
 * - Reload circuit breaker (`reloadCircuitBreaker.ts`) stops auto-reload loops during backend restarts.
 * - At most one auto-reload per server deploy id for bundle mismatch (then manual UI).
 * - Manual UI uses DOM `addEventListener` (prod CSP blocks inline `onclick`).
 * - Manual UI mounts on `document.body` overlay after `detachAppReactRoot()` — never mutates `#root` while React is mounted.
 *
 * Related:
 * - `utils/appBuildId.ts`, `mainFullApp.ts`, `vite-plugin-build-version.ts`
 */

import { getAppBuildId } from './appBuildId';
import { isInteractiveLoginInFlight } from './authRedirect';
import {
	mountEliteRecoveryOverlay,
	mountEliteTechnicalOverlay,
} from './mountEliteImperativeOverlay';
import { detachAppReactRoot } from './reactAppLifecycle';
import { hasPendingAuthorizationCallbackInUrl } from '../services/keycloak';
import {
	clearReloadCircuitWhenHealthy,
	isReloadHoldActive,
	RECOVERY_HOLD_OVERLAY_ID,
	performRecoveryConnectionCheck,
	shouldBlockAutoReload,
} from '../services/maintenance/reloadCircuitBreaker';
import { getCurrentMaintenanceStatus } from '../services/maintenance/maintenanceState';
import { publishUnplannedMaintenanceFromHttpError } from '../services/maintenance/recoveryNotificationGuard';
import { isDesktopShellRoute } from './desktopShellRoute';
import { log } from './logger';
import { performInPlaceMaintenanceRecovery } from '../services/maintenance/performInPlaceMaintenanceRecovery';

export const DESKTOP_SOFT_RECOVERY_EVENT = 'eliteew:desktop-soft-recovery';

export const CHUNK_RELOAD_KEY = 'eliteew_chunk_fail_reload';
export const STALE_BUNDLE_OVERLAY_ID = 'eliteew-stale-bundle-overlay';
export const MAINTENANCE_RELOAD_SESSION_KEY =
	'eliteew_maintenance_completed_reload_v1';
export const BUNDLE_MISMATCH_RELOAD_KEY = 'eliteew_bundle_mismatch_reload_v1';

const BUILD_VERSION_URL = '/app-build-version.txt';

/** BroadcastChannel: one tab detects deploy → all tabs reload. */
export const APP_DEPLOY_BC = 'eliteew-app-deploy-v1';

/**
 * Background deploy-id poll. Visibility/focus still check immediately.
 * Was 15s — idle Network noise; deploy detection does not need sub-minute polls.
 */
const DEPLOY_POLL_MS = 300_000;

/** Auto-reload only when bundle is provably stale vs server (except chunk/maintenance/manual). */
const BUNDLE_GATED_RELOAD_REASONS = new Set([
	'bundle_build_mismatch',
	'socket_connect_bundle_mismatch',
	'client_stale_socket',
	'client_stale_connect_error',
	'client_stale_http',
	'deploy_version_changed',
]);

/** One auto-reload per server deploy id — prevents infinite loop when browser keeps cached JS. */
const RELOAD_COOLDOWN_MS = 3_000;

let deployBc: BroadcastChannel | null = null;
let pendingStaleReloadReason: string | null = null;
let lastKnownServerBuildId: string | null = null;
let lastReloadAttemptAt = 0;

function postReloadMarkerToServer(
	stage: string,
	reason?: string | null,
	extra?: Record<string, unknown>
): void {
	// Best-effort unload-path logging (keepalive) — must not break the app.
	try {
		const clientBuildId = getAppBuildId();
		const maintenanceStatus = getCurrentMaintenanceStatus();
		const payload = {
			level: 'error',
			serviceName: 'StaleBundleReload',
			message: 'RELOAD_MARKER',
			stage,
			reason: reason ?? null,
			clientBuildId,
			serverBuildId: lastKnownServerBuildId,
			maintenanceActive: maintenanceStatus.active,
			reloadHoldActive: isReloadHoldActive(),
			...(extra ?? {}),
		};

		void fetch('/api/v1/monitoring/logs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			keepalive: true,
		}).catch(() => {
			/* ignore unload-path logging */
		});
	} catch {
		/* ignore unload-path logging */
	}
}

/** Test-only: reset deploy watcher module state between Vitest cases. */
export function resetStaleBundleReloadModuleStateForTests(): void {
	lastKnownServerBuildId = null;
	lastReloadAttemptAt = 0;
	pendingStaleReloadReason = null;
}

/** Do not reload while another recovery flow owns the page. */
export function shouldDeferStaleBundleReload(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	return (
		hasPendingAuthorizationCallbackInUrl() ||
		isInteractiveLoginInFlight() ||
		getCurrentMaintenanceStatus().active
	);
}

/** Run a deferred deploy reload after OAuth callback completes (see keycloak.ts). */
export function flushDeferredStaleBundleReload(): void {
	if (!pendingStaleReloadReason || shouldDeferStaleBundleReload()) {
		return;
	}
	if (shouldBlockAutoReload(pendingStaleReloadReason)) {
		showRecoveryHoldOverlay();
		pendingStaleReloadReason = null;
		return;
	}
	const reason = pendingStaleReloadReason;
	pendingStaleReloadReason = null;
	void reloadAllAppTabsInternal(reason);
}

function getDeployBc(): BroadcastChannel | null {
	if (typeof BroadcastChannel === 'undefined') {
		return null;
	}
	if (!deployBc) {
		try {
			deployBc = new BroadcastChannel(APP_DEPLOY_BC);
			deployBc.onmessage = (event: MessageEvent) => {
				const data = event.data as
					| { type?: string; reason?: string }
					| undefined;
				if (data?.type === 'reload-all-tabs') {
					reloadAllAppTabs(data.reason);
				}
			};
		} catch {
			deployBc = null;
		}
	}
	return deployBc;
}

function forceHardNavigationReload(reason?: string): void {
	postReloadMarkerToServer('hard_navigation_reload', reason);
	const url = new URL(window.location.href);
	url.searchParams.set('_eliteew_reload', String(Date.now()));
	if (reason) {
		url.searchParams.set('_eliteew_reason', reason.slice(0, 48));
	}
	window.location.replace(url.toString());
}

function hideBlockingAppPreloader(): void {
	const preloader = document.getElementById('app-preloader');
	if (!preloader) {
		return;
	}
	preloader.classList.add('hidden');
	preloader.remove();
}

function manualHardPageReload(reason: string): void {
	try {
		sessionStorage.removeItem(CHUNK_RELOAD_KEY);
		clearBundleMismatchReloadMarker();
	} catch {
		/* ignore */
	}
	forceHardNavigationReload(reason);
}

/** User-initiated full page reload (F5, stale-bundle button, admin reload) — bypasses auto-reload circuit. */
export function performManualHardPageReload(reason = 'manual_user'): void {
	manualHardPageReload(reason);
}

/** True when baked bundle deploy id differs from server app-build-version.txt. */
export function isBundleBuildMismatch(serverVersion: string | null): boolean {
	const bundleVersion = getAppBuildId();
	if (
		serverVersion &&
		bundleVersion &&
		bundleVersion !== 'dev-local' &&
		bundleVersion === serverVersion
	) {
		clearBundleMismatchReloadMarker();
	}
	if (!import.meta.env.PROD || !serverVersion) {
		return false;
	}
	return (
		Boolean(bundleVersion) &&
		bundleVersion !== 'dev-local' &&
		bundleVersion !== serverVersion
	);
}

/** Align check for reload guards — works in dev tests and prod. */
export function bundleMatchesServerBuild(
	serverVersion: string | null
): boolean {
	const bundleVersion = getAppBuildId();
	if (!serverVersion || !bundleVersion || bundleVersion === 'dev-local') {
		return false;
	}
	return bundleVersion === serverVersion;
}

function isBundleMismatchReloadReason(reason?: string): boolean {
	return (
		reason === 'bundle_build_mismatch' ||
		reason === 'socket_connect_bundle_mismatch'
	);
}

/** Skip stale-bundle reload when baked deploy id already matches server. */
export async function shouldSkipAutoReloadWhenBundleCurrent(
	reason?: string
): Promise<boolean> {
	if (!reason || !BUNDLE_GATED_RELOAD_REASONS.has(reason)) {
		return false;
	}
	const serverBuild = lastKnownServerBuildId ?? (await fetchServerBuildId());
	if (!serverBuild) {
		return false;
	}
	if (serverBuild) {
		lastKnownServerBuildId = serverBuild;
	}
	return bundleMatchesServerBuild(serverBuild);
}

function getBundleMismatchReloadMarker(): string | null {
	try {
		return sessionStorage.getItem(BUNDLE_MISMATCH_RELOAD_KEY);
	} catch {
		return null;
	}
}

function markBundleMismatchReloadAttempt(serverVersion: string): void {
	try {
		sessionStorage.setItem(BUNDLE_MISMATCH_RELOAD_KEY, serverVersion);
	} catch {
		/* ignore */
	}
}

function clearBundleMismatchReloadMarker(): void {
	try {
		sessionStorage.removeItem(BUNDLE_MISMATCH_RELOAD_KEY);
	} catch {
		/* ignore */
	}
}

async function fetchServerBuildId(): Promise<string | null> {
	try {
		const r = await fetch(`${BUILD_VERSION_URL}?t=${Date.now()}`, {
			cache: 'no-store',
		});
		if (!r.ok) return null;
		const t = (await r.text()).trim();
		return t || null;
	} catch {
		return null;
	}
}

function canAutoReloadNow(reason?: string): boolean {
	if (
		reason === 'maintenance_completed' ||
		reason === 'manual_stale_bundle' ||
		reason === 'manual_stale_bundle_fallback'
	) {
		return true;
	}
	return Date.now() - lastReloadAttemptAt >= RELOAD_COOLDOWN_MS;
}

/**
 * After maintenance/outage: on `#desktop` refresh in-place (keep windows/icons mounted);
 * elsewhere hard-reload all tabs.
 */
export function requestMaintenanceReturn(reason?: string): void {
	if (typeof window !== 'undefined' && isDesktopShellRoute()) {
		window.dispatchEvent(
			new CustomEvent(DESKTOP_SOFT_RECOVERY_EVENT, {
				detail: { reason: reason ?? 'maintenance_completed' },
			})
		);
		return;
	}
	reloadAllAppTabs(reason);
}

/** Reload every open EliteEW tab (same origin) without asking the user. */
export function reloadAllAppTabs(reason?: string): void {
	if (shouldBlockAutoReload(reason)) {
		postReloadMarkerToServer('auto_reload_blocked', reason);
		showRecoveryHoldOverlay();
		return;
	}
	if (reason !== 'maintenance_completed' && shouldDeferStaleBundleReload()) {
		postReloadMarkerToServer('auto_reload_deferred', reason);
		pendingStaleReloadReason = reason ?? 'deferred_stale_reload';
		return;
	}
	void reloadAllAppTabsInternal(reason);
}

/** Wait-only recovery UI when auto-reload is blocked (backend restart / reload budget). */
export function showRecoveryHoldOverlay(): void {
	try {
		if (
			document.getElementById(RECOVERY_HOLD_OVERLAY_ID) ||
			document.getElementById(STALE_BUNDLE_OVERLAY_ID)
		) {
			return;
		}
		if (isDesktopShellRoute()) {
			if (!getCurrentMaintenanceStatus().active) {
				publishUnplannedMaintenanceFromHttpError(503, 30);
			}
			return;
		}
		detachAppReactRoot();
		hideBlockingAppPreloader();
		mountEliteRecoveryOverlay(RECOVERY_HOLD_OVERLAY_ID, {
			statusLabel: 'EliteEW · восстановление связи',
			footnote:
				'Вкладку можно оставить открытой. Когда связь вернётся — нажмите «Проверить связь».',
			panelVariant: 'recovery',
			ambientStatic: true,
			actionLabel: 'Проверить связь',
			actionPendingLabel: 'Проверяем связь…',
			onAction: async () => {
				const ready = await performRecoveryConnectionCheck();
				if (!ready) {
					return;
				}
				forceHardNavigationReload('manual_user');
			},
			role: 'alert',
			ariaLive: 'polite',
		});
	} catch {
		/* ignore */
	}
}

/** Test-only: reset auto-reload cooldown between Vitest cases. */
export function resetReloadCooldownForTests(): void {
	lastReloadAttemptAt = 0;
}

async function reloadAllAppTabsInternal(reason?: string): Promise<void> {
	if (document.getElementById(STALE_BUNDLE_OVERLAY_ID)) {
		return;
	}
	if (reason === 'maintenance_completed') {
		const serverBuild = lastKnownServerBuildId ?? (await fetchServerBuildId());
		if (serverBuild) {
			lastKnownServerBuildId = serverBuild;
		}
		if (serverBuild && bundleMatchesServerBuild(serverBuild)) {
			postReloadMarkerToServer('maintenance_in_place_recovery', reason, {
				serverBuildId: serverBuild,
			});
			await performInPlaceMaintenanceRecovery();
			log.info(
				'StaleBundleReload',
				'Skipped hard reload after maintenance — bundle already current',
				{ reason, serverBuild }
			);
			return;
		}
	}
	if (await shouldSkipAutoReloadWhenBundleCurrent(reason)) {
		log.info(
			'StaleBundleReload',
			'Skipped auto-reload — bundle already matches server',
			{ reason, bundle: getAppBuildId(), server: lastKnownServerBuildId }
		);
		return;
	}
	if (isBundleMismatchReloadReason(reason)) {
		const serverBuild = lastKnownServerBuildId ?? (await fetchServerBuildId());
		if (serverBuild && getBundleMismatchReloadMarker() === serverBuild) {
			showManualStaleBundleUI();
			return;
		}
		if (serverBuild) {
			markBundleMismatchReloadAttempt(serverBuild);
		}
	}
	if (!canAutoReloadNow(reason)) {
		return;
	}
	lastReloadAttemptAt = Date.now();
	postReloadMarkerToServer('reload_all_tabs_internal', reason);
	try {
		getDeployBc()?.postMessage({ type: 'reload-all-tabs', reason });
	} catch {
		/* BC blocked in some WebViews */
	}
	forceHardNavigationReload(reason);
}

/** Dynamic import / Vite chunk load failures (post-deploy stale tab). */
export function isLikelyStaleChunkImportError(
	message: string | null | undefined
): boolean {
	if (!message) return false;
	const m = message.toLowerCase();
	return (
		m.includes('failed to fetch dynamically imported module') ||
		m.includes('error loading dynamically imported module') ||
		m.includes('importing a module script failed') ||
		m.includes('loading chunk') ||
		m.includes('chunk load failed')
	);
}

export function handleChunkLoadFailure(): void {
	if (
		shouldBlockAutoReload('chunk_load_failure') ||
		getCurrentMaintenanceStatus().active ||
		isReloadHoldActive()
	) {
		postReloadMarkerToServer(
			'chunk_load_failure_hold_overlay',
			'chunk_load_failure'
		);
		showRecoveryHoldOverlay();
		return;
	}
	try {
		if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
			sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
			reloadAllAppTabs('chunk_load_failure');
			return;
		}
		sessionStorage.removeItem(CHUNK_RELOAD_KEY);
		showManualStaleBundleUI();
	} catch {
		window.location.reload();
	}
}

/** Manual refresh when auto-reload did not pick up the new deploy (cached bundle). */
export function showManualStaleBundleUI(): void {
	try {
		if (document.getElementById(STALE_BUNDLE_OVERLAY_ID)) {
			return;
		}

		detachAppReactRoot();
		hideBlockingAppPreloader();

		mountEliteTechnicalOverlay(STALE_BUNDLE_OVERLAY_ID, {
			title: 'Приложение обновлено',
			description:
				'Загрузилась старая версия страницы. Нажмите кнопку для загрузки новой.',
			eyebrow: 'EliteEW · обновление',
			tone: 'rose',
			role: 'alert',
			ariaLive: 'assertive',
			quote: null,
			actionLabel: 'Обновить страницу',
			onAction: () => {
				manualHardPageReload('manual_stale_bundle');
			},
		});
	} catch {
		manualHardPageReload('manual_stale_bundle_fallback');
	}
}

/** Cleared after successful app bootstrap when backend health is ok (see mainFullApp). */
export function clearChunkReloadFlag(): void {
	try {
		sessionStorage.removeItem(CHUNK_RELOAD_KEY);
	} catch {
		// ignore
	}
	void clearReloadCircuitWhenHealthy().then((healthy) => {
		if (!healthy) {
			return;
		}
		try {
			sessionStorage.removeItem(MAINTENANCE_RELOAD_SESSION_KEY);
		} catch {
			/* ignore */
		}
	});
}

export function markMaintenanceCompletionReload(windowId: string): boolean {
	try {
		if (sessionStorage.getItem(MAINTENANCE_RELOAD_SESSION_KEY) === windowId) {
			return false;
		}
		sessionStorage.setItem(MAINTENANCE_RELOAD_SESSION_KEY, windowId);
		return true;
	} catch {
		return true;
	}
}

/** Maintenance recovery: health check + single reload when backend is back. */
export async function requestMaintenanceRecoveryReload(
	maintenanceWindowId: string
): Promise<boolean> {
	const ready = await performRecoveryConnectionCheck();
	if (!ready) {
		return false;
	}
	if (shouldBlockAutoReload('maintenance_completed')) {
		return false;
	}
	if (!markMaintenanceCompletionReload(maintenanceWindowId)) {
		return false;
	}
	requestMaintenanceReturn('maintenance_completed');
	return true;
}

/** User-initiated reload — bypasses auto-reload hold budget. */
export function requestManualUserReload(): void {
	reloadAllAppTabs('manual_user');
}

/**
 * Poll build id file (no-cache). When it changes vs first read, reload all tabs.
 * Prod only; skips if file missing (e.g. dev).
 */
export function startDeployVersionWatcher(): void {
	if (!import.meta.env.PROD) return;
	if (isReloadHoldActive()) return;

	getDeployBc();

	let bootVersion: string | null = null;

	void (async () => {
		bootVersion = await fetchServerBuildId();
		lastKnownServerBuildId = bootVersion;
		if (isBundleBuildMismatch(bootVersion)) {
			reloadAllAppTabs('bundle_build_mismatch');
			return;
		}
		if (!bootVersion) return;

		const check = async () => {
			if (getCurrentMaintenanceStatus().active || isReloadHoldActive()) {
				return;
			}
			const cur = await fetchServerBuildId();
			if (cur) {
				lastKnownServerBuildId = cur;
			}
			if (isBundleBuildMismatch(cur)) {
				reloadAllAppTabs('bundle_build_mismatch');
				return;
			}
			if (cur && cur !== bootVersion) {
				bootVersion = cur;
			}
		};

		window.setInterval(() => void check(), DEPLOY_POLL_MS);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') void check();
		});
		window.addEventListener('focus', () => void check());
	})();
}
