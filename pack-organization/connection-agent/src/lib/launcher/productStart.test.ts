/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock for product Start URL + FoFline remote/local Start + L3 cutover + L5 remote deny.
 */

import { describe, expect, it } from 'vitest';
import {
	assertFoflineStartUrlAllowed,
	buildFoflineLocalStartUrl,
	buildFoflineStartUrl,
	buildProductStartUrl,
	isVersionAtLeast,
	resolveFoflineStartCutover,
} from './productStart';

describe('buildProductStartUrl', () => {
	it('appends eliteewDesktopClient=1', () => {
		expect(buildProductStartUrl('https://app.eliteew.ru')).toBe(
			'https://app.eliteew.ru/?eliteewDesktopClient=1'
		);
	});

	it('does not append license or device bind query params (Wave 2)', () => {
		expect(
			buildProductStartUrl('https://app.eliteew.ru', {
				licenseId: 'lic-1',
				deviceId: 'dev-2',
			})
		).toBe('https://app.eliteew.ru/?eliteewDesktopClient=1');
	});

	it('strips leftover bind ids already on appBase (Wave 2)', () => {
		const url = buildProductStartUrl(
			'https://app.eliteew.ru/?eliteewLicenseId=lic-1&eliteewDeviceId=dev-2&ticket=t1'
		);
		expect(url).toBe('https://app.eliteew.ru/?eliteewDesktopClient=1');
	});
});

describe('buildFoflineStartUrl', () => {
	it('appends eliteewFoflineClient=1 without desktopNative query', () => {
		const url = buildFoflineStartUrl('https://app.eliteew.ru', {
			licenseId: 'lic-1',
			deviceId: 'dev-2',
		});
		expect(url).toContain('eliteewFoflineClient=1');
		expect(url).not.toContain('eliteewLicenseId');
		expect(url).not.toContain('eliteewDeviceId');
		expect(url).not.toContain('eliteewDesktopClient');
	});
});

describe('buildFoflineLocalStartUrl', () => {
	it('uses fofline-spa origin with fofline query only', () => {
		const url = buildFoflineLocalStartUrl({
			licenseId: 'lic-1',
			deviceId: 'dev-2',
		});
		expect(url.startsWith('fofline-spa://localhost/index.html')).toBe(true);
		expect(url).toContain('eliteewFoflineClient=1');
		expect(url).not.toContain('eliteewLicenseId');
		expect(url).not.toContain('eliteewDeviceId');
		expect(url).not.toContain('eliteewDesktopClient');
		expect(url).not.toContain('app.eliteew.ru');
	});
});

describe('resolveFoflineStartCutover', () => {
	it('prefers local when pack ready', () => {
		const r = resolveFoflineStartCutover({
			packReady: true,
			appBase: 'https://app.eliteew.ru',
			remoteFallback: true,
			licenseId: 'lic-1',
		});
		expect(r.kind).toBe('local');
		expect(r.url).toContain('fofline-spa://localhost');
		expect(r.url).not.toContain('eliteewLicenseId');
	});

	it('L5: pack ready wins over remote fallback (no public SPA default)', () => {
		const r = resolveFoflineStartCutover({
			packReady: true,
			appBase: 'https://app.eliteew.ru',
			remoteFallback: true,
		});
		expect(r.kind).toBe('local');
		expect(r.url).not.toContain('app.eliteew.ru');
		expect(r.code).toBeUndefined();
	});

	it('blocks when pack missing and no remote fallback', () => {
		const r = resolveFoflineStartCutover({
			packReady: false,
			appBase: 'https://app.eliteew.ru',
			remoteFallback: false,
		});
		expect(r).toEqual({ kind: 'blocked', code: 'pack_not_ready' });
	});

	it('allows remote only when fallback flag set and pack not ready', () => {
		const r = resolveFoflineStartCutover({
			packReady: false,
			appBase: 'https://app.eliteew.ru',
			remoteFallback: true,
			deviceId: 'dev-2',
		});
		expect(r.kind).toBe('remote');
		expect(r.code).toBe('remote_fallback');
		expect(r.url).toContain('https://app.eliteew.ru');
		expect(r.url).toContain('eliteewFoflineClient=1');
	});
});

describe('assertFoflineStartUrlAllowed', () => {
	it('allows local pack URL always', () => {
		expect(
			assertFoflineStartUrlAllowed({
				url: 'fofline-spa://localhost/index.html?eliteewFoflineClient=1',
				packReady: true,
				remoteFallback: false,
			})
		).toEqual({ ok: true });
	});

	it('denies remote product SPA when pack ready', () => {
		expect(
			assertFoflineStartUrlAllowed({
				url: 'https://app.eliteew.ru/?eliteewFoflineClient=1',
				packReady: true,
				remoteFallback: true,
			})
		).toEqual({ ok: false, code: 'remote_spa_forbidden_pack_ready' });
	});

	it('denies remote without fallback when pack missing', () => {
		expect(
			assertFoflineStartUrlAllowed({
				url: 'https://app.eliteew.ru/?eliteewFoflineClient=1',
				packReady: false,
				remoteFallback: false,
			})
		).toEqual({ ok: false, code: 'remote_spa_forbidden' });
	});

	it('allows remote only with fallback and pack missing', () => {
		expect(
			assertFoflineStartUrlAllowed({
				url: 'https://app.eliteew.ru/?eliteewFoflineClient=1',
				packReady: false,
				remoteFallback: true,
			})
		).toEqual({ ok: true });
	});

	it('does not gate cloud desktop Start', () => {
		expect(
			assertFoflineStartUrlAllowed({
				url: 'https://app.eliteew.ru/?eliteewDesktopClient=1',
				packReady: true,
				remoteFallback: false,
			})
		).toEqual({ ok: true });
	});
});

describe('isVersionAtLeast', () => {
	it('allows equal and newer', () => {
		expect(isVersionAtLeast('0.1.0', '0.1.0')).toBe(true);
		expect(isVersionAtLeast('0.2.0', '0.1.0')).toBe(true);
	});

	it('blocks older', () => {
		expect(isVersionAtLeast('0.1.0', '0.2.0')).toBe(false);
	});

	it('empty min always passes', () => {
		expect(isVersionAtLeast('0.0.1', '')).toBe(true);
	});
});
