/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for vertical module assignment key matching and enabled coercion.
 */

import { describe, expect, it } from 'vitest';

import {
	coerceAssignmentEnabled,
	findVerticalModuleAssignment,
	isModuleEnabledForVertical,
	moduleKeysMatch,
} from './adminModuleAssignment';
import type { ProfessionalVerticalModule } from './types';

function assignment(
	moduleKey: string,
	isEnabled: unknown
): ProfessionalVerticalModule {
	return {
		id: 'a1',
		vertical_slug: 'realtor',
		module_key: moduleKey,
		module_name: null,
		module_category: null,
		icon_key: null,
		config: {},
		sort_order: 0,
		is_enabled: isEnabled as boolean,
		created_at: '2026-05-05T00:00:00Z',
		updated_at: '2026-05-05T00:00:00Z',
	};
}

describe('moduleKeysMatch', () => {
	it('matches underscore catalog key to hyphen assignment key', () => {
		expect(moduleKeysMatch('realtor_playbooks', 'realtor-playbooks')).toBe(
			true
		);
	});

	it('finds assignment for catalog module', () => {
		const rows = [assignment('realtor-playbooks', true)];
		expect(
			findVerticalModuleAssignment(rows, 'realtor_playbooks')?.module_key
		).toBe('realtor-playbooks');
	});
});

describe('isModuleEnabledForVertical', () => {
	it('reads enabled flag with string coercion', () => {
		const rows = [assignment('objects', 'true')];
		expect(isModuleEnabledForVertical(rows, 'objects')).toBe(true);
	});

	it('returns false when assignment row is missing', () => {
		expect(isModuleEnabledForVertical([], 'realtor_insights')).toBe(false);
	});
});

describe('coerceAssignmentEnabled', () => {
	it('treats postgres-style t as enabled', () => {
		expect(coerceAssignmentEnabled('t')).toBe(true);
	});
});
