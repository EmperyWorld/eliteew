/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract locks for Shell chromeProfile resolve + traits (U4).
 *
 * Related:
 * - ../shellChrome.ts
 * - ../useShellChrome.ts
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md §C
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { __resetAndReseedShellAppCatalogForTests } from '../appRegistry.catalog';
import {
	getShellChromeProfileTraits,
	resolveShellChromeProfile,
	resolveShellChromeTraits,
} from '../shellChrome';

describe('shellChrome (U4)', () => {
	beforeEach(() => {
		__resetAndReseedShellAppCatalogForTests();
	});

	it('maps traits per chromeProfile', () => {
		expect(getShellChromeProfileTraits('standard')).toEqual({
			denseChromeAllowed: true,
			allowPersistenceBadges: true,
			preferMinimalHeader: false,
		});
		expect(getShellChromeProfileTraits('settings')).toEqual({
			denseChromeAllowed: false,
			allowPersistenceBadges: false,
			preferMinimalHeader: true,
		});
		expect(getShellChromeProfileTraits('iframe_launcher')).toEqual({
			denseChromeAllowed: false,
			allowPersistenceBadges: false,
			preferMinimalHeader: true,
			portalPolicyHint: 'forbidden',
		});
	});

	it('resolves DesktopShellSettings → settings from seeded catalog', () => {
		expect(resolveShellChromeProfile('DesktopShellSettings')).toBe('settings');
		expect(resolveShellChromeTraits('DesktopShellSettings')).toMatchObject({
			allowPersistenceBadges: false,
			denseChromeAllowed: false,
			preferMinimalHeader: true,
		});
	});

	it('resolves iframe launcher apps → iframe_launcher', () => {
		expect(resolveShellChromeProfile('VideoCallApp')).toBe('iframe_launcher');
		expect(resolveShellChromeProfile('LocalServiceIframeApp')).toBe(
			'iframe_launcher'
		);
		expect(resolveShellChromeTraits('VideoCallApp').portalPolicyHint).toBe(
			'forbidden'
		);
	});

	it('defaults unknown / empty appComponent to standard', () => {
		expect(resolveShellChromeProfile('TotallyUnknownApp')).toBe('standard');
		expect(resolveShellChromeProfile(null)).toBe('standard');
		expect(resolveShellChromeProfile(undefined)).toBe('standard');
		expect(resolveShellChromeProfile('')).toBe('standard');
		expect(
			resolveShellChromeTraits('TotallyUnknownApp').allowPersistenceBadges
		).toBe(true);
	});

	it('keeps standard for typical first-party self-scroll apps', () => {
		expect(resolveShellChromeProfile('StudioGU')).toBe('standard');
		expect(resolveShellChromeProfile('UGSHubApp')).toBe('standard');
	});
});
