/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for companion left-rail open-apps fingerprint (diff-driven shell sync).
 *
 * Related:
 * - companionShellOpenAppsFingerprint.ts
 */

import { describe, expect, it } from 'vitest';

import { companionShellOpenAppsFingerprint } from '@/features/ewa/companionUx/companionShellOpenAppsFingerprint';

describe('companionShellOpenAppsFingerprint', () => {
	it('returns empty for null / missing windows', () => {
		expect(companionShellOpenAppsFingerprint(null)).toBe('');
		expect(companionShellOpenAppsFingerprint({ windows: [] })).toBe('');
	});

	it('ignores minimized windows and blank components', () => {
		expect(
			companionShellOpenAppsFingerprint({
				windows: [
					{ app_component: 'DocEditor', minimized: false },
					{ app_component: 'MusicPlayer', minimized: true },
					{ app_component: '  ', minimized: false },
					{ app_component: null, minimized: false },
				],
			})
		).toBe('DocEditor');
	});

	it('is order-independent (sorted join)', () => {
		const a = companionShellOpenAppsFingerprint({
			windows: [
				{ app_component: 'MusicPlayer', minimized: false },
				{ app_component: 'DocEditor', minimized: false },
			],
		});
		const b = companionShellOpenAppsFingerprint({
			windows: [
				{ app_component: 'DocEditor', minimized: false },
				{ app_component: 'MusicPlayer', minimized: false },
			],
		});
		expect(a).toBe(b);
		expect(a).toBe(`DocEditor${'\0'}MusicPlayer`);
	});
});
