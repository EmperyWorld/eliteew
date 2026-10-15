/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure contract tests for Desktop Atomic Conditional Access (Wave 0).
 *
 * Related:
 * - atomicConditionalAccessContract.ts
 */

import { describe, expect, it } from 'vitest';
import {
	FORBIDDEN_START_URL_QUERY_PARAMS,
	GENERIC_AUTH_POLICY_DENY_CODE,
	LEGACY_MIGRATION_PATHS,
	MIGRATION_PENDING_DPOP_JKT,
	REQUIRED_BINDING_ACR,
	accountLevelQuarantineAllowed,
	authRiskMayAutoRevokeLicense,
	authRiskMayChangeLicenseStatus,
	authRiskNextBindingState,
	authRiskBumpsAuthzEpoch,
	authRiskRevokesOpenTickets,
	bindingMigrationSlotAction,
	clientSuppliedPrivilegeFlagTrusted,
	commitEmailVerifiedGrandfathered,
	isGenericAuthPolicyError,
	isMigrationPendingDpopJkt,
	isNativeKeycloakClientId,
	nativeChannelsForLicenseFlags,
	nativeOidcStorageKeyMayHoldRefreshToken,
	nativeAccessPepMode,
	nativeTokenHasRequiredBindingClaims,
	startUrlHasForbiddenBindIds,
} from '../atomicConditionalAccessContract';

describe('atomicConditionalAccessContract (Wave 0)', () => {
	it('detects forbidden bind ids in Start URL', () => {
		expect(
			startUrlHasForbiddenBindIds(
				'https://app.eliteew.ru/?eliteewDesktopClient=1&eliteewLicenseId=lic'
			)
		).toBe(true);
		expect(
			startUrlHasForbiddenBindIds(
				'https://app.eliteew.ru/?eliteewDesktopClient=1'
			)
		).toBe(false);
	});

	it('validates native binding claims', () => {
		expect(
			nativeTokenHasRequiredBindingClaims({
				acr: REQUIRED_BINDING_ACR,
				eliteew_binding_id: 'bind_1',
				eliteew_binding_epoch: 2,
				cnf: { jkt: 'jkt' },
			})
		).toBe(true);
		expect(nativeTokenHasRequiredBindingClaims({ acr: '0' })).toBe(false);
	});

	it('maps generic auth-policy deny family', () => {
		expect(isGenericAuthPolicyError(GENERIC_AUTH_POLICY_DENY_CODE)).toBe(true);
		expect(isGenericAuthPolicyError('invalid_grant')).toBe(true);
		expect(isGenericAuthPolicyError('license_expired')).toBe(false);
	});

	it('never auto-revokes license from auth-risk', () => {
		expect(authRiskMayAutoRevokeLicense()).toBe(false);
		expect(authRiskMayChangeLicenseStatus('valid_replay')).toBe(false);
		expect(authRiskMayChangeLicenseStatus('admin_quarantine')).toBe(false);
	});

	it('unsigned proofs never change binding state', () => {
		expect(
			authRiskNextBindingState({
				kind: 'unsigned_bad_proof',
				current: 'active',
				corroborated: false,
			})
		).toBeNull();
		expect(authRiskRevokesOpenTickets('unsigned_bad_proof')).toBe(false);
	});

	it('valid replay raises risk then quarantines only when corroborated', () => {
		expect(
			authRiskNextBindingState({
				kind: 'valid_replay',
				current: 'active',
				corroborated: false,
			})
		).toBe('restricted');
		expect(
			authRiskNextBindingState({
				kind: 'valid_replay',
				current: 'restricted',
				corroborated: true,
			})
		).toBe('quarantined');
		expect(authRiskRevokesOpenTickets('valid_replay')).toBe(true);
		expect(authRiskBumpsAuthzEpoch('admin_end_sessions')).toBe(true);
		expect(authRiskBumpsAuthzEpoch('unsigned_bad_proof')).toBe(false);
	});

	it('account quarantine requires admin or corroborated multi-signal', () => {
		expect(
			accountLevelQuarantineAllowed({
				adminAction: false,
				multiSignalCorroborated: false,
			})
		).toBe(false);
		expect(
			accountLevelQuarantineAllowed({
				adminAction: true,
				multiSignalCorroborated: false,
			})
		).toBe(true);
	});

	it('never trusts client privilege flags', () => {
		expect(clientSuppliedPrivilegeFlagTrusted('is_admin')).toBe(false);
	});

	it('recognizes native Keycloak clients', () => {
		expect(isNativeKeycloakClientId('empery-desktop')).toBe(true);
		expect(isNativeKeycloakClientId('empery-web')).toBe(false);
	});

	it('flags native OIDC storage keys that must not hold refresh at enforce', () => {
		expect(
			nativeOidcStorageKeyMayHoldRefreshToken(
				'eliteew.keycloak.desktopNative.oidcTokens.v1',
				'desktopNative'
			)
		).toBe(true);
		expect(
			nativeOidcStorageKeyMayHoldRefreshToken(
				'eliteew.keycloak.desktopNative.oidcAuthState.v1',
				'desktopNative'
			)
		).toBe(false);
	});

	it('lists remaining Wave 4 leftover assert paths (not 410 yet)', () => {
		expect(LEGACY_MIGRATION_PATHS.length).toBeGreaterThanOrEqual(2);
		expect(FORBIDDEN_START_URL_QUERY_PARAMS).toContain('eliteewLicenseId');
	});

	it('scopes native access PEP: web skip, missing claims only at enforce', () => {
		expect(
			nativeAccessPepMode({
				claims: { azp: 'empery-web', sub: 'u' },
				enforceMissingClaims: true,
			})
		).toBe('skip');
		expect(
			nativeAccessPepMode({
				claims: { azp: 'empery-desktop', sub: 'u' },
				enforceMissingClaims: false,
			})
		).toBe('skip');
		expect(
			nativeAccessPepMode({
				claims: { azp: 'empery-desktop', sub: 'u' },
				enforceMissingClaims: true,
			})
		).toBe('deny');
		expect(
			nativeAccessPepMode({
				claims: {
					azp: 'empery-fofline',
					acr: REQUIRED_BINDING_ACR,
					eliteew_binding_id: 'bind_1',
					eliteew_binding_epoch: 2,
					cnf: { jkt: 'jkt' },
				},
				enforceMissingClaims: false,
			})
		).toBe('require_current_binding');
	});

	it('classifies Wave 6 fleet migration slots and grandfather email', () => {
		expect(
			nativeChannelsForLicenseFlags({
				allowOnline: true,
				allowFofline: true,
			})
		).toEqual([
			['desktop', 'empery-desktop'],
			['fofline', 'empery-fofline'],
		]);
		expect(
			commitEmailVerifiedGrandfathered({
				requestSub: 'sub-1',
				licenseBoundSub: 'sub-1',
			})
		).toBe(true);
		expect(
			commitEmailVerifiedGrandfathered({
				requestSub: 'sub-1',
				licenseBoundSub: null,
				bindingSub: 'sub-1',
			})
		).toBe(false);
		expect(
			bindingMigrationSlotAction({
				boundKeycloakSub: 'sub-1',
				channelEnabled: true,
				existingBindingSub: null,
				existingBindingState: null,
			})
		).toBe('create');
		expect(
			bindingMigrationSlotAction({
				boundKeycloakSub: 'sub-1',
				channelEnabled: true,
				existingBindingSub: 'sub-1',
				existingBindingState: 'restricted',
			})
		).toBe('already_migrated');
		expect(isMigrationPendingDpopJkt(MIGRATION_PENDING_DPOP_JKT)).toBe(true);
	});
});
