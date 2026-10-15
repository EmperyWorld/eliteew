/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for Social Hub desktop icon/window label alignment with product title.
 *
 * Invariants:
 * - Legacy desktop names map to i18n-driven labels; custom operator labels stay intact.
 *
 * Related:
 * - socialHubDesktopChrome.ts
 */

import { describe, expect, it } from 'vitest';

import type { DesktopItem } from '@/pages/Desktop/types/desktop.types';

import { withSocialHubDesktopItemsDisplayName } from '../socialHubDesktopChrome';

describe('socialHubDesktopChrome', () => {
	it('replaces legacy Social hub icon label with product name', () => {
		const items: DesktopItem[] = [
			{
				id: 'app-social-hub',
				name: 'Social hub',
				type: 'app',
				position: { x: 0, y: 0 },
				appComponent: 'SocialHubApp',
			},
		];

		const next = withSocialHubDesktopItemsDisplayName(items, {
			name: 'Connections',
			description: 'Requests, contacts, lists, privacy, and phone app.',
		});

		expect(next[0]?.name).toBe('Connections');
	});

	it('preserves operator-renamed desktop icon label', () => {
		const items: DesktopItem[] = [
			{
				id: 'app-social-hub',
				name: 'Мои люди',
				type: 'app',
				position: { x: 0, y: 0 },
				appComponent: 'SocialHubApp',
			},
		];

		const next = withSocialHubDesktopItemsDisplayName(items, {
			name: 'Связи',
		});

		expect(next[0]?.name).toBe('Мои люди');
	});
});
