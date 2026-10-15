/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock — normalize + apply Desktop UI language (ru|en).
 *
 * Related:
 * - `../applyDesktopUiLanguage.ts`
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/config', () => ({
	default: {
		changeLanguage: vi.fn(async () => undefined),
	},
	ensureDesktopUiReady: vi.fn(async () => undefined),
}));

vi.mock('@/services/profileService', () => ({
	default: {
		updateLanguage: vi.fn(),
	},
}));

import i18n, { ensureDesktopUiReady } from '@/i18n/config';
import profileService from '@/services/profileService';
import {
	applyDesktopUiLanguage,
	normalizeDesktopUiLanguage,
} from '../applyDesktopUiLanguage';

describe('applyDesktopUiLanguage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('normalizes language codes to ru|en', () => {
		expect(normalizeDesktopUiLanguage('en-US')).toBe('en');
		expect(normalizeDesktopUiLanguage('ru')).toBe('ru');
		expect(normalizeDesktopUiLanguage(undefined)).toBe('ru');
		expect(normalizeDesktopUiLanguage('fr')).toBe('ru');
	});

	it('changes i18n without profile persist when persist=false', async () => {
		const result = await applyDesktopUiLanguage('en', { persist: false });
		expect(i18n.changeLanguage).toHaveBeenCalledWith('en');
		expect(ensureDesktopUiReady).toHaveBeenCalled();
		expect(profileService.updateLanguage).not.toHaveBeenCalled();
		expect(result).toEqual({
			language: 'en',
			preferences: null,
			persisted: false,
		});
	});

	it('persists via profileService when persist=true', async () => {
		const prefs = { language: 'en' };
		vi.mocked(profileService.updateLanguage).mockResolvedValue(prefs as never);
		const result = await applyDesktopUiLanguage('en', { persist: true });
		expect(profileService.updateLanguage).toHaveBeenCalledWith('en');
		expect(result.persisted).toBe(true);
		expect(result.preferences).toBe(prefs);
	});

	it('keeps i18n change when profile persist fails', async () => {
		vi.mocked(profileService.updateLanguage).mockRejectedValue(
			new Error('offline')
		);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const result = await applyDesktopUiLanguage('ru', { persist: true });
		expect(i18n.changeLanguage).toHaveBeenCalledWith('ru');
		expect(result.persisted).toBe(false);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});
