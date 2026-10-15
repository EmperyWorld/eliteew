/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure session/device health classifier for desktop UI indicators. Keeps visual
 * status decisions testable outside React while the hook performs live probes.
 *
 * Invariants:
 * - Critical auth failures win over softer realtime or staleness warnings.
 * - A single transient network miss is warning; repeated misses become critical.
 *
 * Related:
 * - `components/ui/useSessionDeviceHealth.ts`
 * - `components/ui/AuthStatusIndicator.tsx`
 */

export type SessionProfileProbeStatus =
	| 'valid'
	| 'expired'
	| 'checking'
	| 'unknown'
	| 'error';

export type SessionDeviceHealthLevel =
	| 'healthy'
	| 'warning'
	| 'critical'
	| 'checking'
	| 'unknown';

export type SessionDeviceHealthReason =
	| 'initializing'
	| 'checking'
	| 'signedOut'
	| 'tokenExpired'
	| 'serverOffline'
	| 'temporaryNetwork'
	| 'realtimeOffline'
	| 'tokenExpiring'
	| 'statusUnknown'
	| 'staleCheck'
	| 'healthy'
	| 'unknown';

export type SessionDeviceHealthSnapshot = {
	loading: boolean;
	isAuthenticated: boolean;
	hasAccessToken: boolean;
	profileStatus: SessionProfileProbeStatus;
	lastCheck: number;
	consecutiveFailures: number;
	tokenSecondsLeft: number | null;
	realtimeConnected?: boolean | null;
};

export type SessionDeviceHealthClassification = {
	level: SessionDeviceHealthLevel;
	reason: SessionDeviceHealthReason;
	serverReachable: boolean | null;
	tokenFresh: boolean | null;
	realtimeHealthy: boolean | null;
};

export const SESSION_TOKEN_WARNING_SECONDS = 5 * 60;
export const SESSION_CHECK_STALE_MS = 2 * 60 * 1000;
export const SESSION_CRITICAL_FAILURES = 2;

export function classifySessionDeviceHealth(
	snapshot: SessionDeviceHealthSnapshot,
	now = Date.now()
): SessionDeviceHealthClassification {
	const realtimeHealthy =
		typeof snapshot.realtimeConnected === 'boolean'
			? snapshot.realtimeConnected
			: null;
	const tokenFresh =
		snapshot.tokenSecondsLeft === null
			? snapshot.hasAccessToken
				? null
				: false
			: snapshot.tokenSecondsLeft > SESSION_TOKEN_WARNING_SECONDS;
	const serverReachable =
		snapshot.profileStatus === 'valid' || snapshot.profileStatus === 'expired'
			? true
			: snapshot.profileStatus === 'error'
				? false
				: null;

	const base = {
		serverReachable,
		tokenFresh,
		realtimeHealthy,
	};

	if (snapshot.loading) {
		return { ...base, level: 'checking', reason: 'initializing' };
	}
	if (snapshot.profileStatus === 'checking') {
		return { ...base, level: 'checking', reason: 'checking' };
	}
	if (!snapshot.isAuthenticated || !snapshot.hasAccessToken) {
		return { ...base, level: 'critical', reason: 'signedOut' };
	}
	if (
		snapshot.profileStatus === 'expired' ||
		(snapshot.tokenSecondsLeft !== null && snapshot.tokenSecondsLeft <= 0)
	) {
		return { ...base, level: 'critical', reason: 'tokenExpired' };
	}
	if (snapshot.consecutiveFailures >= SESSION_CRITICAL_FAILURES) {
		return { ...base, level: 'critical', reason: 'serverOffline' };
	}
	if (snapshot.profileStatus === 'error') {
		return { ...base, level: 'warning', reason: 'temporaryNetwork' };
	}
	if (realtimeHealthy === false) {
		return { ...base, level: 'warning', reason: 'realtimeOffline' };
	}
	if (
		snapshot.tokenSecondsLeft !== null &&
		snapshot.tokenSecondsLeft <= SESSION_TOKEN_WARNING_SECONDS
	) {
		return { ...base, level: 'warning', reason: 'tokenExpiring' };
	}
	if (snapshot.profileStatus === 'unknown') {
		return { ...base, level: 'warning', reason: 'statusUnknown' };
	}
	if (now - snapshot.lastCheck > SESSION_CHECK_STALE_MS) {
		return { ...base, level: 'warning', reason: 'staleCheck' };
	}
	if (snapshot.profileStatus === 'valid') {
		return { ...base, level: 'healthy', reason: 'healthy' };
	}

	return { ...base, level: 'unknown', reason: 'unknown' };
}
