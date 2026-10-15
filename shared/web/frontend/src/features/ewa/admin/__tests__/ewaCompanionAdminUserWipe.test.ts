/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for admin Users wipe confirm helper and error classification.
 *
 * Related:
 * - src/features/ewa/admin/ewaCompanionAdminUserWipe.ts
 */
import { describe, expect, it } from 'vitest';
import {
	classifyWipeError,
	confirmNamespaceMatches,
	confirmPrincipalIdMatches,
} from '../ewaCompanionAdminUserWipe';

describe('confirmPrincipalIdMatches', () => {
	it('requires exact trimmed match', () => {
		expect(confirmPrincipalIdMatches('abc-1', 'abc-1')).toBe(true);
		expect(confirmPrincipalIdMatches('abc-1', ' abc-1 ')).toBe(true);
		expect(confirmPrincipalIdMatches('abc-1', 'ABC-1')).toBe(false);
		expect(confirmPrincipalIdMatches('abc-1', 'other')).toBe(false);
		expect(confirmPrincipalIdMatches('', '')).toBe(false);
	});
});

describe('confirmNamespaceMatches', () => {
	it('requires exact trimmed match', () => {
		expect(
			confirmNamespaceMatches('companion_memory_v1', 'companion_memory_v1')
		).toBe(true);
		expect(
			confirmNamespaceMatches('companion_memory_v1', ' companion_memory_v1 ')
		).toBe(true);
		expect(
			confirmNamespaceMatches('companion_memory_v1', 'Companion_memory_v1')
		).toBe(false);
	});
});

describe('classifyWipeError', () => {
	it('maps known backend detail codes', () => {
		expect(classifyWipeError(new Error('confirm_mismatch'))).toBe(
			'confirm_mismatch'
		);
		expect(classifyWipeError(new Error('confirm_principal_id_mismatch'))).toBe(
			'confirm_mismatch'
		);
		expect(
			classifyWipeError(new Error('companion_wipe_qdrant_unavailable'))
		).toBe('qdrant_unavailable');
		expect(
			classifyWipeError(new Error('companion_wipe_qdrant_purge_failed'))
		).toBe('qdrant_purge_failed');
		expect(classifyWipeError(new Error('companion_profile_not_found'))).toBe(
			'not_found'
		);
	});

	it('falls back to generic', () => {
		expect(classifyWipeError(new Error('boom'))).toBe('generic');
		expect(classifyWipeError(null)).toBe('generic');
	});
});
