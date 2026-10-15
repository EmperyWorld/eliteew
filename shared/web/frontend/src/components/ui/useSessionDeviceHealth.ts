/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React hook that probes the current user session, token freshness, and optional
 * desktop realtime state for the session/device panel and taskbar tray glow.
 *
 * Invariants:
 * - Profile probes use ``PROFILE_ME_QUERY_KEY`` via the shared QueryClient (same as AuthContext);
 *   concurrent tray + AuthStatusIndicator mounts coalesce to one GET /profile/me.
 * - One module-level poll loop for all mounts (tray + floating panel + nav) — no N× setInterval.
 * - No raw token or secret is shown in UI.
 * - Interactive re-login stays behind `beginInteractiveLogin`.
 *
 * Related:
 * - `components/ui/sessionDeviceHealth.ts`
 * - `services/authSession.ts`, `contexts/AuthContext.tsx`
 * - documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md §Cold #desktop
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import authSession from '../../services/authSession';
import profileService, {
	PROFILE_ME_QUERY_KEY,
} from '../../services/profileService';
import { queryClient } from '../../providers/QueryProvider';
import {
	beginInteractiveLogin,
	resolveDefaultOidcRedirectUri,
} from '../../utils/authRedirect';
import { log } from '../../utils/logger';
import {
	classifySessionDeviceHealth,
	SESSION_TOKEN_WARNING_SECONDS,
	type SessionDeviceHealthClassification,
	type SessionProfileProbeStatus,
} from './sessionDeviceHealth';

type SessionProbeInfo = {
	status: SessionProfileProbeStatus;
	lastCheck: number;
	checkCount: number;
	consecutiveFailures: number;
	lastError?: string;
};

export type UseSessionDeviceHealthOptions = {
	realtimeConnected?: boolean | null;
	/**
	 * When true (default), this mount retains the shared poll loop.
	 * Decorative nav/widget mounts should pass false — tray (or open panel) owns polling.
	 */
	pollingEnabled?: boolean;
};

export type UseSessionDeviceHealthResult = SessionDeviceHealthClassification & {
	user: ReturnType<typeof useAuth>['user'];
	isAuthenticated: boolean;
	loading: boolean;
	profileStatus: SessionProfileProbeStatus;
	lastCheck: number;
	checkCount: number;
	consecutiveFailures: number;
	lastError?: string;
	tokenSecondsLeft: number | null;
	manualCheckInProgress: boolean;
	tokenRefreshInProgress: boolean;
	checkNow: () => Promise<void>;
	refreshTokenNow: () => Promise<void>;
	refreshLogin: () => void;
	logout: () => Promise<void>;
};

const SESSION_HEALTH_LOG_COMPONENT = 'SessionDeviceHealth';
/** Profile/device probe while tray health UI is mounted (was 60s). */
const SESSION_HEALTH_POLL_MS = 180_000;
/** Local JWT expiry tick only — no network. */
const TOKEN_TICK_MS = 30_000;

type ProbeStoreSnapshot = {
	probe: SessionProbeInfo;
	manualCheckInProgress: boolean;
	tokenRefreshInProgress: boolean;
	tokenTick: number;
};

const probeListeners = new Set<() => void>();
let probeSnapshot: ProbeStoreSnapshot = {
	probe: {
		status: 'unknown',
		lastCheck: Date.now(),
		checkCount: 0,
		consecutiveFailures: 0,
	},
	manualCheckInProgress: false,
	tokenRefreshInProgress: false,
	tokenTick: Date.now(),
};

let abortController: AbortController | null = null;
let profile404 = false;
let proactiveTokenRefresh = false;
let pollRetainCount = 0;
let pollIntervalId: number | null = null;
let tokenTickIntervalId: number | null = null;
let visibilityHandler: (() => void) | null = null;
let pollBootstrapped = false;

function emitProbe(): void {
	for (const listener of probeListeners) {
		listener();
	}
}

function patchProbeStore(patch: Partial<ProbeStoreSnapshot>): void {
	probeSnapshot = { ...probeSnapshot, ...patch };
	emitProbe();
}

function patchProbe(patch: Partial<SessionProbeInfo>): void {
	probeSnapshot = {
		...probeSnapshot,
		probe: { ...probeSnapshot.probe, ...patch },
	};
	emitProbe();
}

function getErrorStatus(error: unknown): number | undefined {
	const shaped = error as {
		statusCode?: number;
		response?: { status?: number };
	};
	return shaped?.statusCode ?? shaped?.response?.status;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message || 'Network error';
	}
	const shaped = error as { message?: string };
	return shaped?.message || 'Network error';
}

function getTokenSecondsLeft(): number | null {
	const exp = authSession.tokenParsed?.exp;
	if (!exp) return null;
	return Math.round(exp - Date.now() / 1000);
}

async function runSharedProbe(isManual: boolean): Promise<void> {
	if (isManual) {
		patchProbeStore({ manualCheckInProgress: true });
	}
	if (abortController) {
		abortController.abort();
	}
	abortController = new AbortController();

	try {
		if (!authSession.token) {
			patchProbe({
				status: 'unknown',
				lastCheck: Date.now(),
				lastError: undefined,
			});
			return;
		}

		if (profile404) {
			patchProbe({
				status: 'unknown',
				lastCheck: Date.now(),
				lastError: undefined,
			});
			return;
		}

		patchProbe({ status: 'checking' });
		await queryClient.fetchQuery({
			queryKey: PROFILE_ME_QUERY_KEY,
			queryFn: ({ signal }) =>
				profileService.getProfile({
					signal: abortController?.signal ?? signal,
				}),
			staleTime: 30_000,
		});

		const now = Date.now();
		patchProbe({
			status: 'valid',
			lastCheck: now,
			checkCount: probeSnapshot.probe.checkCount + 1,
			consecutiveFailures: 0,
			lastError: undefined,
		});
	} catch (caught: unknown) {
		const error = caught as { name?: string; code?: string };
		if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') {
			return;
		}

		const status = getErrorStatus(caught);
		const now = Date.now();
		if (status === 401 || status === 403) {
			patchProbe({
				status: 'expired',
				lastCheck: now,
				checkCount: probeSnapshot.probe.checkCount + 1,
				consecutiveFailures: probeSnapshot.probe.consecutiveFailures + 1,
				lastError: 'Session expired or not authenticated',
			});
		} else if (status === 404) {
			profile404 = true;
			patchProbe({
				status: 'unknown',
				lastCheck: now,
				checkCount: probeSnapshot.probe.checkCount + 1,
				consecutiveFailures: 0,
				lastError: undefined,
			});
		} else {
			patchProbe({
				status: 'error',
				lastCheck: now,
				checkCount: probeSnapshot.probe.checkCount + 1,
				consecutiveFailures: probeSnapshot.probe.consecutiveFailures + 1,
				lastError: status ? `HTTP ${status}` : getErrorMessage(caught),
			});
		}
	} finally {
		if (isManual) {
			patchProbeStore({ manualCheckInProgress: false });
		}
	}
}

function subscribeProbeStore(listener: () => void): () => void {
	probeListeners.add(listener);
	return () => {
		probeListeners.delete(listener);
	};
}

function getProbeStoreSnapshot(): ProbeStoreSnapshot {
	return probeSnapshot;
}

async function bootstrapPollOnce(): Promise<void> {
	if (pollBootstrapped) return;
	pollBootstrapped = true;
	let attempts = 0;
	const maxAttempts = 50;
	while (!authSession.token && attempts < maxAttempts && pollRetainCount > 0) {
		await new Promise((resolve) => window.setTimeout(resolve, 100));
		attempts++;
	}
	if (pollRetainCount > 0 && authSession.token) {
		void runSharedProbe(false);
	}
}

function startSharedPollLoop(): void {
	if (pollIntervalId !== null) return;

	void bootstrapPollOnce();

	pollIntervalId = window.setInterval(() => {
		if (!document.hidden) {
			void runSharedProbe(false);
		}
	}, SESSION_HEALTH_POLL_MS);

	visibilityHandler = () => {
		if (!document.hidden) {
			void runSharedProbe(false);
		}
	};
	document.addEventListener('visibilitychange', visibilityHandler);

	if (tokenTickIntervalId === null) {
		tokenTickIntervalId = window.setInterval(() => {
			patchProbeStore({ tokenTick: Date.now() });
		}, TOKEN_TICK_MS);
	}
}

function stopSharedPollLoop(): void {
	if (pollIntervalId !== null) {
		window.clearInterval(pollIntervalId);
		pollIntervalId = null;
	}
	if (visibilityHandler) {
		document.removeEventListener('visibilitychange', visibilityHandler);
		visibilityHandler = null;
	}
	if (tokenTickIntervalId !== null) {
		window.clearInterval(tokenTickIntervalId);
		tokenTickIntervalId = null;
	}
	if (abortController) {
		abortController.abort();
		abortController = null;
	}
	pollBootstrapped = false;
}

function retainSharedPoll(): void {
	pollRetainCount += 1;
	if (pollRetainCount === 1) {
		startSharedPollLoop();
	}
}

function releaseSharedPoll(): void {
	pollRetainCount = Math.max(0, pollRetainCount - 1);
	if (pollRetainCount === 0) {
		stopSharedPollLoop();
	}
}

/** Test/diagnostics: how many mounts currently retain the shared poll. */
export function getSessionDeviceHealthPollRetainCountForTests(): number {
	return pollRetainCount;
}

export function useSessionDeviceHealth(
	options: UseSessionDeviceHealthOptions = {}
): UseSessionDeviceHealthResult {
	const { realtimeConnected = null, pollingEnabled = true } = options;
	const { user, isAuthenticated, loading, logout, checkAuthentication } =
		useAuth();
	const store = useSyncExternalStore(
		subscribeProbeStore,
		getProbeStoreSnapshot,
		getProbeStoreSnapshot
	);

	useEffect(() => {
		if (!pollingEnabled) return;
		retainSharedPoll();
		return () => {
			releaseSharedPoll();
		};
	}, [pollingEnabled]);

	const checkNowManual = useCallback(async () => {
		await runSharedProbe(true);
		if (!isAuthenticated && authSession.token) {
			await checkAuthentication();
		}
	}, [checkAuthentication, isAuthenticated]);

	const refreshTokenNow = useCallback(async () => {
		patchProbeStore({ tokenRefreshInProgress: true });
		try {
			await authSession.updateToken(5 * 60);
			patchProbeStore({ tokenTick: Date.now() });
			// updateToken → onAuthRefreshSuccess → silent syncWithAuthSession only.
			// Do not call checkAuthentication here — it also fetchAndApplyProfile and
			// historically used non-silent sync (600s Desktop remount + API storm).
			await runSharedProbe(false);
		} catch (caught: unknown) {
			const err = caught instanceof Error ? caught : new Error(String(caught));
			log.warn(SESSION_HEALTH_LOG_COMPONENT, 'Token refresh failed', err);
			patchProbe({
				status: 'expired',
				lastCheck: Date.now(),
				checkCount: probeSnapshot.probe.checkCount + 1,
				consecutiveFailures: probeSnapshot.probe.consecutiveFailures + 1,
				lastError: 'Session expired or not authenticated',
			});
		} finally {
			patchProbeStore({ tokenRefreshInProgress: false });
		}
	}, []);

	const refreshLogin = useCallback(() => {
		beginInteractiveLogin('manual_login', {
			redirectUri: resolveDefaultOidcRedirectUri(),
		});
	}, []);

	const tokenSecondsLeft = getTokenSecondsLeft();
	// Depend on tokenTick so classification refreshes without a local interval.
	void store.tokenTick;

	const proactiveGuardRef = useRef(false);
	useEffect(() => {
		if (
			tokenSecondsLeft === null ||
			tokenSecondsLeft > SESSION_TOKEN_WARNING_SECONDS ||
			tokenSecondsLeft <= 0
		) {
			if (
				tokenSecondsLeft === null ||
				tokenSecondsLeft > SESSION_TOKEN_WARNING_SECONDS
			) {
				proactiveTokenRefresh = false;
				proactiveGuardRef.current = false;
			}
			return;
		}
		if (
			proactiveTokenRefresh ||
			proactiveGuardRef.current ||
			store.tokenRefreshInProgress
		) {
			return;
		}
		proactiveTokenRefresh = true;
		proactiveGuardRef.current = true;
		void refreshTokenNow();
	}, [tokenSecondsLeft, store.tokenRefreshInProgress, refreshTokenNow]);

	const classification = classifySessionDeviceHealth({
		loading,
		isAuthenticated,
		hasAccessToken: Boolean(authSession.token),
		profileStatus: store.probe.status,
		lastCheck: store.probe.lastCheck,
		consecutiveFailures: store.probe.consecutiveFailures,
		tokenSecondsLeft,
		realtimeConnected,
	});

	return {
		...classification,
		user,
		isAuthenticated,
		loading,
		profileStatus: store.probe.status,
		lastCheck: store.probe.lastCheck,
		checkCount: store.probe.checkCount,
		consecutiveFailures: store.probe.consecutiveFailures,
		lastError: store.probe.lastError,
		tokenSecondsLeft,
		manualCheckInProgress: store.manualCheckInProgress,
		tokenRefreshInProgress: store.tokenRefreshInProgress,
		checkNow: checkNowManual,
		refreshTokenNow,
		refreshLogin,
		logout,
	};
}
