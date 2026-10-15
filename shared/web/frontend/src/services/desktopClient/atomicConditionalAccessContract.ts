/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure contract constants and evaluators for Desktop Atomic Conditional Access.
 * Wave 0 lock surface — no axios/Keycloak imports.
 *
 * Invariants:
 * - Auth-risk pipeline never auto-revokes license.
 * - Unsigned proofs never change binding/license state.
 * - Client-supplied privilege flags are never trusted.
 * - Native profiles must not persist refresh tokens in browser storage (target).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
 * - __tests__/atomicConditionalAccessContract.test.ts
 */

export const NATIVE_KEYCLOAK_CLIENT_IDS = [
	'empery-desktop',
	'empery-fofline',
] as const;

export type NativeKeycloakClientId =
	(typeof NATIVE_KEYCLOAK_CLIENT_IDS)[number];

export const REQUIRED_BINDING_ACR = 'eliteew-device-bound' as const;

export const REQUIRED_BINDING_CLAIMS = [
	'acr',
	'eliteew_binding_id',
	'eliteew_binding_epoch',
] as const;

export const REQUIRED_CNF_JKT_CLAIM = 'cnf.jkt' as const;

export const FORBIDDEN_START_URL_QUERY_PARAMS = [
	'eliteewLicenseId',
	'eliteewDeviceId',
] as const;

export const ALLOWED_START_URL_PROFILE_MARKERS = [
	'eliteewDesktopClient',
	'eliteewFoflineClient',
] as const;

export const GENERIC_AUTH_POLICY_DENY_CODE = 'auth_policy_denied' as const;

export const GENERIC_AUTH_POLICY_USER_MESSAGE_KEY =
	'desktop.atomicAuth.genericDeny' as const;

/** Native OIDC token storage keys that must not hold refresh tokens at enforce. */
export const FORBIDDEN_NATIVE_REFRESH_STORAGE_SUFFIXES = [
	'.oidcTokens.v1',
] as const;

export const LEGACY_MIGRATION_PATHS = [
	'shared/web/frontend/src/services/desktopClient/desktopClientSessionAssert.ts',
	'shared/api/routers/desktop_client/license.py',
] as const;

export type BindingState = 'active' | 'restricted' | 'quarantined' | 'revoked';

export type AuthRiskEventKind =
	| 'unsigned_bad_proof'
	| 'stale_nonce'
	| 'valid_replay'
	| 'impossible_transition'
	| 'admin_quarantine'
	| 'admin_restore'
	| 'admin_allow_rebind'
	| 'admin_end_sessions'
	| 'admin_clear_kc_failures';

export type AdminRecoveryAction =
	| 'end_sessions'
	| 'quarantine_device'
	| 'restore_login'
	| 'allow_rebind'
	| 'clear_kc_login_failures';

const NO_STATE_CHANGE_KINDS: ReadonlySet<AuthRiskEventKind> = new Set([
	'unsigned_bad_proof',
	'admin_end_sessions',
	'admin_clear_kc_failures',
	'admin_allow_rebind',
]);

const TICKET_REVOKE_KINDS: ReadonlySet<AuthRiskEventKind> = new Set([
	'valid_replay',
	'stale_nonce',
	'impossible_transition',
	'admin_quarantine',
	'admin_end_sessions',
]);

const EPOCH_BUMP_KINDS: ReadonlySet<AuthRiskEventKind> = new Set([
	'admin_end_sessions',
]);

export function startUrlHasForbiddenBindIds(url: string): boolean {
	try {
		const parsed = new URL(url);
		for (const param of FORBIDDEN_START_URL_QUERY_PARAMS) {
			if (parsed.searchParams.has(param)) {
				return true;
			}
		}
		return false;
	} catch {
		return true;
	}
}

export function nativeTokenHasRequiredBindingClaims(
	claims: Record<string, unknown>
): boolean {
	if (claims.acr !== REQUIRED_BINDING_ACR) {
		return false;
	}
	const bindingId = claims.eliteew_binding_id;
	if (typeof bindingId !== 'string' || !bindingId.trim()) {
		return false;
	}
	const epoch = claims.eliteew_binding_epoch;
	if (typeof epoch !== 'number' || !Number.isInteger(epoch) || epoch < 1) {
		return false;
	}
	const cnf = claims.cnf;
	if (!cnf || typeof cnf !== 'object') {
		return false;
	}
	const jkt = (cnf as Record<string, unknown>).jkt;
	return typeof jkt === 'string' && jkt.trim().length > 0;
}

export function isGenericAuthPolicyError(code: string): boolean {
	const normalized = code.trim().toLowerCase();
	if (!normalized) {
		return false;
	}
	if (normalized === GENERIC_AUTH_POLICY_DENY_CODE) {
		return true;
	}
	return (
		normalized === 'invalid_grant' ||
		normalized === 'access_denied' ||
		normalized === 'unauthorized_client'
	);
}

export function authRiskMayAutoRevokeLicense(): boolean {
	return false;
}

export function authRiskMayChangeLicenseStatus(
	_kind: AuthRiskEventKind
): boolean {
	return false;
}

export function authRiskRevokesOpenTickets(kind: AuthRiskEventKind): boolean {
	return TICKET_REVOKE_KINDS.has(kind);
}

export function authRiskBumpsAuthzEpoch(kind: AuthRiskEventKind): boolean {
	return EPOCH_BUMP_KINDS.has(kind) || TICKET_REVOKE_KINDS.has(kind);
}

export function accountLevelQuarantineAllowed(input: {
	adminAction: boolean;
	multiSignalCorroborated: boolean;
}): boolean {
	return Boolean(input.adminAction || input.multiSignalCorroborated);
}

export function authRiskNextBindingState(input: {
	kind: AuthRiskEventKind;
	current: BindingState;
	corroborated: boolean;
}): BindingState | null {
	const { kind, current, corroborated } = input;
	if (NO_STATE_CHANGE_KINDS.has(kind)) {
		return null;
	}
	if (current === 'revoked') {
		return null;
	}
	if (kind === 'admin_quarantine') {
		return 'quarantined';
	}
	if (kind === 'admin_restore') {
		return 'active';
	}
	if (kind === 'valid_replay' || kind === 'stale_nonce') {
		if (current === 'quarantined') {
			return null;
		}
		if (corroborated && current === 'restricted') {
			return 'quarantined';
		}
		if (current === 'active') {
			return 'restricted';
		}
		return null;
	}
	if (kind === 'impossible_transition') {
		if (current === 'quarantined') {
			return null;
		}
		if (corroborated) {
			return 'quarantined';
		}
		if (current === 'active') {
			return 'restricted';
		}
		return null;
	}
	return null;
}

export function clientSuppliedPrivilegeFlagTrusted(_flag: string): boolean {
	return false;
}

export function isNativeKeycloakClientId(
	clientId: string
): clientId is NativeKeycloakClientId {
	return (NATIVE_KEYCLOAK_CLIENT_IDS as readonly string[]).includes(clientId);
}

export type NativeAccessPepMode = 'skip' | 'require_current_binding' | 'deny';

export function nativeTokenAzp(claims: Record<string, unknown>): string {
	const raw = claims.azp ?? claims.client_id ?? claims.clientId;
	return typeof raw === 'string' ? raw.trim() : '';
}

export function nativeAccessPepMode(input: {
	claims: Record<string, unknown>;
	enforceMissingClaims: boolean;
}): NativeAccessPepMode {
	if (!isNativeKeycloakClientId(nativeTokenAzp(input.claims))) {
		return 'skip';
	}
	if (nativeTokenHasRequiredBindingClaims(input.claims)) {
		return 'require_current_binding';
	}
	if (input.enforceMissingClaims) {
		return 'deny';
	}
	return 'skip';
}

export function nativeOidcStorageKeyMayHoldRefreshToken(
	storageKey: string,
	profile: 'desktopNative' | 'foflineNative'
): boolean {
	if (profile !== 'desktopNative' && profile !== 'foflineNative') {
		return false;
	}
	const lower = storageKey.toLowerCase();
	if (!lower.includes(profile.toLowerCase())) {
		return false;
	}
	return FORBIDDEN_NATIVE_REFRESH_STORAGE_SUFFIXES.some((suffix) =>
		storageKey.endsWith(suffix)
	);
}

/** Wave 6 — fleet binding migration sentinel until first native PoP commit. */
export const MIGRATION_PENDING_DPOP_JKT = 'migrate:pending-pop' as const;

export const MIGRATION_REBIND_DAYS = 365 as const;

export type BindingMigrationSlotAction =
	| 'create'
	| 'already_migrated'
	| 'conflict_sub'
	| 'skip_no_bound_sub'
	| 'skip_channel_disabled';

export function nativeChannelsForLicenseFlags(input: {
	allowOnline: boolean;
	allowFofline: boolean;
}): ReadonlyArray<readonly [channel: string, clientId: string]> {
	const slots: Array<readonly [string, string]> = [];
	if (input.allowOnline) {
		slots.push(['desktop', 'empery-desktop']);
	}
	if (input.allowFofline) {
		slots.push(['fofline', 'empery-fofline']);
	}
	return slots;
}

export function commitEmailVerifiedGrandfathered(input: {
	requestSub: string;
	licenseBoundSub: string | null | undefined;
	bindingSub?: string | null;
}): boolean {
	// License-column only — admin clear of bound_keycloak_sub must stick.
	void input.bindingSub;
	const sub = input.requestSub.trim();
	if (!sub) {
		return false;
	}
	const bound = (input.licenseBoundSub ?? '').trim();
	return Boolean(bound && bound === sub);
}

export function bindingMigrationSlotAction(input: {
	boundKeycloakSub: string | null | undefined;
	channelEnabled: boolean;
	existingBindingSub: string | null | undefined;
	existingBindingState: string | null | undefined;
}): BindingMigrationSlotAction {
	if (!input.channelEnabled) {
		return 'skip_channel_disabled';
	}
	const bound = (input.boundKeycloakSub ?? '').trim();
	if (!bound) {
		return 'skip_no_bound_sub';
	}
	const state = (input.existingBindingState ?? '').trim();
	const existing = (input.existingBindingSub ?? '').trim();
	if (state && state !== 'revoked') {
		if (existing && existing === bound) {
			return 'already_migrated';
		}
		return 'conflict_sub';
	}
	return 'create';
}

export function isMigrationPendingDpopJkt(
	dpopJkt: string | null | undefined
): boolean {
	return (dpopJkt ?? '').trim() === MIGRATION_PENDING_DPOP_JKT;
}
