/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for Professional Worlds admin key validation (module vs identifier keys).
 *
 * Invariants:
 * - Seeded module keys with hyphens must pass assignment validation.
 * - action_key / preset_key style identifiers keep underscore-only slug rules.
 *
 * Related:
 * - adminValidation.ts
 * - api/schemas/professional_worlds.py (`normalize_module_key`)
 */

import { describe, expect, it } from 'vitest';

import {
	normalizeAdminModuleKey,
	validateAdminKey,
	validateAdminModuleKey,
} from './adminValidation';

describe('validateAdminModuleKey', () => {
	it('accepts catalog module keys with hyphens and underscores', () => {
		expect(validateAdminModuleKey('media-studio', 'module_key')).toBeNull();
		expect(validateAdminModuleKey('public-presence', 'module_key')).toBeNull();
		expect(
			validateAdminModuleKey('realtor_playbooks', 'module_key')
		).toBeNull();
		expect(validateAdminModuleKey('realtor_insights', 'module_key')).toBeNull();
	});

	it('normalizes underscores to hyphens like the API', () => {
		expect(normalizeAdminModuleKey('media_studio')).toBe('media-studio');
		expect(validateAdminModuleKey('media_studio', 'module_key')).toBeNull();
	});

	it('rejects empty and invalid slugs', () => {
		expect(validateAdminModuleKey('', 'module_key')).not.toBeNull();
		expect(validateAdminModuleKey('9bad', 'module_key')).not.toBeNull();
		expect(validateAdminModuleKey('bad key', 'module_key')).not.toBeNull();
	});
});

describe('validateAdminKey', () => {
	it('accepts underscore identifiers for actions and presets', () => {
		expect(validateAdminKey('realtor_hero_cover', 'preset_key')).toBeNull();
	});

	it('rejects hyphens in non-module identifier keys', () => {
		expect(validateAdminKey('media-studio', 'action_key')).not.toBeNull();
	});
});
