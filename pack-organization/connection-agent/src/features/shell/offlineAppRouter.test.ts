/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Lock O5 offline app router (pack ids only).
 */

import { describe, expect, it } from 'vitest';
import {
	isPackOfflineApp,
	offlineAppLabel,
	PACK_OFFLINE_APP_IDS,
	resolveOfflineAppPanel,
} from './offlineAppRouter';

describe('resolveOfflineAppPanel', () => {
	it('opens pack apps and denies unknown', () => {
		expect(resolveOfflineAppPanel('ClipboardManager')).toBe('ClipboardManager');
		expect(resolveOfflineAppPanel('MusicPlayer')).toBe('MusicPlayer');
		expect(resolveOfflineAppPanel('AssistantApp')).toBe('unavailable');
		expect(resolveOfflineAppPanel('')).toBe('unavailable');
	});
});

describe('offlineAppLabel / isPackOfflineApp', () => {
	it('labels pack apps', () => {
		expect(offlineAppLabel('ProjectAboutApp')).toBe('О приложении');
		expect(isPackOfflineApp('NotificationsApp')).toBe(true);
		expect(isPackOfflineApp('EWDesk')).toBe(false);
	});

	it('exports stable PACK_OFFLINE_APP_IDS for catalog parity', () => {
		expect([...PACK_OFFLINE_APP_IDS]).toEqual([
			'ClipboardManager',
			'MusicPlayer',
			'NotificationsApp',
			'ProjectAboutApp',
		]);
	});
});
