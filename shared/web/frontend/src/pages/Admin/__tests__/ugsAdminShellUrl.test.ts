/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it, vi } from 'vitest';
import {
	migrateLegacyUgsAdminShellUrl,
	normalizeLegacyUgsAdminSectionId,
} from '../shell/ugsAdminShellUrl';

describe('ugsAdminShellUrl', () => {
	it('normalizes legacy section id to ugsV2', () => {
		expect(normalizeLegacyUgsAdminSectionId('ugs')).toBe('ugsV2');
		expect(normalizeLegacyUgsAdminSectionId('users')).toBe('users');
	});

	it('migrates legacy section=ugs deep link to ugsV2', () => {
		const replaceState = vi.fn();
		Object.defineProperty(window, 'location', {
			value: {
				href: 'https://app.test/admin?section=ugs',
				pathname: '/admin',
				search: '?section=ugs',
				hash: '',
			},
			writable: true,
			configurable: true,
		});
		window.history.replaceState = replaceState;

		migrateLegacyUgsAdminShellUrl({ enabled: true });

		const url = replaceState.mock.calls[0]?.[2] as string;
		expect(url).toContain('section=ugsV2');
		expect(new URL(`https://app.test${url}`).searchParams.get('section')).toBe(
			'ugsV2'
		);
	});
});
