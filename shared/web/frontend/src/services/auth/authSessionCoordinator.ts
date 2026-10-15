/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single destruction hub for auth-bound client caches on logout, session replace, principal change, and init failure (MA-02.4).
 * Atomic session termination (kill switch): abort HTTP, disconnect sockets, then §3.4 cache cascade.
 * Principal-change path reuses the logout cache subset without HTTP abort / socket kill / authSessionLock.
 *
 * Invariants:
 * - Fixed §3.4 steps 1–5 order; OIDC token purge stays in keycloak.clearSession / authSessionLogout (step 6).
 * - Selective purge only — never localStorage.clear() / sessionStorage.clear().
 * - Re-entrant auth-error storms coalesce via authSessionLock (one teardown wave).
 * - Principal change clears the same cache subset as full logout cascade; does not abort HTTP or sockets.
 *
 * Related:
 * - contexts/AuthContext.tsx, services/keycloak.ts, FRONTEND_BROWSER_CACHE_MODEL.md §3.4
 * - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md (E3 / V-H4)
 */
import { useCompanionOperationsStore } from '@/features/ewa/companionOperations/companionOperationsStore';
import { clearIdentityAndSessionKeys } from '@/pages/Desktop/components/GAFChat/GAFChatCrypto';
import { clearDesktopShellStateCache } from '@/pages/Desktop/services/desktopApi';
import { clearFeSessionApiCaches } from '@/services/api/conditionalJsonGet';
import { clearCompanionOperationContentPreviewDownloadGuard } from '@/services/content/companionOperationContentPreviewDownload';
import { resetQueryClient } from '@/providers/QueryProvider';
import { clearNotificationStore } from '@/notifications/context';
import { clearTokenCache } from '@/utils/tokenCache';
import { log } from '@/utils/logger';
import { logCacheInvalidation } from '@/services/api/cacheInvalidationLogger';
import { abortAllPendingHttpRequests } from './authSessionHttpAbort';
import {
	beginAuthSessionTeardown,
	endAuthSessionTeardown,
} from './authSessionLock';
import { terminateAllAuthenticatedSockets } from './authSessionSocketTeardown';
import { clearPrincipalScopedLocalStorage } from './clearPrincipalScopedLocalStorage';
import { requestFoflineProductWebviewWipe } from './foflineProductWebviewWipe';

const LOG_COMPONENT = 'AuthSessionCoordinator';

export type AuthSessionLogoutCascadeOptions = {
	/** Principal sub for companion/Poemma/desktop LS prefix purge (step 1). */
	principalId?: string | null;
	/** When false, skip notification center RAM clear (default: true). */
	clearNotifications?: boolean;
};

/**
 * Canonical client teardown — steps 1–5 of FRONTEND_BROWSER_CACHE_MODEL §3.4 plus token exp RAM cache.
 * Step 6 (OIDC persisted tokens) is owned by `keycloak.clearSession` / `authSessionLogout`.
 */
export function executeFullLogoutCascade(
	options: AuthSessionLogoutCascadeOptions = {}
): void {
	const principalId = options.principalId?.trim() || null;
	log.info(LOG_COMPONENT, 'executeFullLogoutCascade', {
		hasPrincipal: Boolean(principalId),
	});

	clearPrincipalScopedLocalStorage(principalId);
	clearIdentityAndSessionKeys();
	clearDesktopShellStateCache();
	clearFeSessionApiCaches();
	clearCompanionOperationContentPreviewDownloadGuard();
	// E3 / V-H4: drop in-memory operation runs so a new session cannot inherit ghost SSE state.
	useCompanionOperationsStore.getState().reset();
	clearTokenCache();
	resetQueryClient();
	requestFoflineProductWebviewWipe();

	if (options.clearNotifications !== false) {
		clearNotificationStore();
	}
}

/**
 * Principal switch without full logout — same §3.4 cache subset as `executeFullLogoutCascade`.
 * Does **not** abort HTTP, disconnect sockets, or take authSessionLock (session stays alive).
 */
export function executePrincipalChangeCacheReset(
	options: AuthSessionLogoutCascadeOptions = {}
): void {
	const principalId = options.principalId?.trim() || null;
	log.info(LOG_COMPONENT, 'executePrincipalChangeCacheReset', {
		hasPrincipal: Boolean(principalId),
	});
	logCacheInvalidation('executePrincipalChangeCacheReset', {
		hasPrincipal: Boolean(principalId),
	});
	executeFullLogoutCascade(options);
}

/** Alias for keycloak.init failure paths after `clearSession(true)` (G1/G2). */
export function executePostKeycloakSessionClearCascade(
	options: AuthSessionLogoutCascadeOptions = {}
): void {
	executeAuthSessionTermination(options);
}

/**
 * Atomic session termination — abort HTTP, disconnect sockets, then §3.4 cache cascade.
 * Returns false when a teardown wave is already in flight (re-entry guard).
 */
export function executeAuthSessionTermination(
	options: AuthSessionLogoutCascadeOptions = {}
): boolean {
	if (!beginAuthSessionTeardown()) {
		log.debug(
			LOG_COMPONENT,
			'executeAuthSessionTermination skipped — lock held'
		);
		return false;
	}
	try {
		log.info(LOG_COMPONENT, 'executeAuthSessionTermination — kill switch');
		abortAllPendingHttpRequests();
		terminateAllAuthenticatedSockets();
		executeFullLogoutCascade(options);
		return true;
	} finally {
		endAuthSessionTeardown();
	}
}
