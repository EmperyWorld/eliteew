import { describe, expect, it } from 'vitest';

import {
	DEFAULT_FALLBACK_VERTICAL,
	playbooksModuleKeyForVertical,
	resolveActiveVerticalSlug,
} from './verticalConstants';

describe('verticalConstants', () => {
	it('resolveActiveVerticalSlug prefers preferred active slug', () => {
		expect(
			resolveActiveVerticalSlug(
				[
					{ vertical_slug: 'realtor', is_active: true },
					{ vertical_slug: 'consultant', is_active: true },
				],
				'consultant'
			)
		).toBe('consultant');
	});

	it('resolveActiveVerticalSlug uses first active when no preference', () => {
		expect(
			resolveActiveVerticalSlug([
				{ vertical_slug: 'consultant', is_active: true },
				{ vertical_slug: 'realtor', is_active: true },
			])
		).toBe('consultant');
	});

	it('resolveActiveVerticalSlug falls back to realtor legacy default', () => {
		expect(resolveActiveVerticalSlug([])).toBe(DEFAULT_FALLBACK_VERTICAL);
		expect(resolveActiveVerticalSlug(undefined)).toBe(
			DEFAULT_FALLBACK_VERTICAL
		);
	});

	it('playbooksModuleKeyForVertical uses slug prefix convention', () => {
		expect(playbooksModuleKeyForVertical('consultant')).toBe(
			'consultant_playbooks'
		);
		expect(playbooksModuleKeyForVertical('realtor')).toBe('realtor_playbooks');
	});
});
