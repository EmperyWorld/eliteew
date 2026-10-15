import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	activateSiteStudioProxy,
	deactivateSiteStudioProxy,
	isSiteStudioProxyActive,
	rewriteSiteStudioProxyUrl,
	setSiteStudioKirsProxyScope,
	setSiteStudioPublicUploadsOrigin,
	SITE_STUDIO_PROXY_BASE,
} from '../siteStudioProxy';

function resetProxyScopes(): void {
	setSiteStudioKirsProxyScope(null);
	setSiteStudioPublicUploadsOrigin(null);
	while (isSiteStudioProxyActive()) {
		deactivateSiteStudioProxy();
	}
}

describe('siteStudioProxy', () => {
	beforeEach(() => {
		resetProxyScopes();
	});

	afterEach(() => {
		resetProxyScopes();
	});

	it('leaves URL unchanged when proxy is inactive', () => {
		expect(rewriteSiteStudioProxyUrl('/some/path')).toBe('/some/path');
	});

	it('prefixes relative paths when active', () => {
		activateSiteStudioProxy();
		expect(rewriteSiteStudioProxyUrl('/foo/bar')).toBe(
			`${SITE_STUDIO_PROXY_BASE}/foo/bar`
		);
	});

	it('normalizes path without leading slash when active', () => {
		activateSiteStudioProxy();
		expect(rewriteSiteStudioProxyUrl('foo')).toBe(
			`${SITE_STUDIO_PROXY_BASE}/foo`
		);
	});

	it('does not rewrite absolute http(s) URLs when active', () => {
		activateSiteStudioProxy();
		expect(rewriteSiteStudioProxyUrl('https://cdn.example/x')).toBe(
			'https://cdn.example/x'
		);
	});

	it('does not rewrite /api, /ws, /socket.io, or site-studio proxy prefix when active', () => {
		activateSiteStudioProxy();
		expect(rewriteSiteStudioProxyUrl('/api/v1/ping')).toBe('/api/v1/ping');
		expect(rewriteSiteStudioProxyUrl('/ws')).toBe('/ws');
		expect(rewriteSiteStudioProxyUrl('/socket.io/')).toBe('/socket.io/');
		expect(rewriteSiteStudioProxyUrl(`${SITE_STUDIO_PROXY_BASE}/x`)).toBe(
			`${SITE_STUDIO_PROXY_BASE}/x`
		);
	});

	it('does not rewrite when baseURL is an API base', () => {
		activateSiteStudioProxy();
		expect(rewriteSiteStudioProxyUrl('ping', '/api/v1')).toBe('ping');
		expect(
			rewriteSiteStudioProxyUrl('rel', 'https://app.eliteew.ru/api/v1')
		).toBe('rel');
	});

	it('tracks nested activate/deactivate scopes', () => {
		expect(isSiteStudioProxyActive()).toBe(false);
		activateSiteStudioProxy();
		activateSiteStudioProxy();
		expect(isSiteStudioProxyActive()).toBe(true);
		deactivateSiteStudioProxy();
		expect(isSiteStudioProxyActive()).toBe(true);
		deactivateSiteStudioProxy();
		expect(isSiteStudioProxyActive()).toBe(false);
	});

	it('does not go negative on deactivate', () => {
		deactivateSiteStudioProxy();
		deactivateSiteStudioProxy();
		expect(isSiteStudioProxyActive()).toBe(false);
	});

	it('rewrites protocol-relative path as relative (//host/...) when active', () => {
		activateSiteStudioProxy();
		const out = rewriteSiteStudioProxyUrl('//cdn.example/x');
		expect(out).toContain(SITE_STUDIO_PROXY_BASE);
		expect(out).toContain('cdn.example');
	});

	it('returns undefined when url is undefined and proxy active', () => {
		activateSiteStudioProxy();
		expect(rewriteSiteStudioProxyUrl(undefined)).toBeUndefined();
	});

	it('uses KIRS project proxy base when scoped', () => {
		activateSiteStudioProxy();
		setSiteStudioKirsProxyScope('88e1272d-624f-4b00-87e7-2ac1415c8589');
		const kirsBase =
			'/api/v1/desktop/kirs/projects/88e1272d-624f-4b00-87e7-2ac1415c8589/proxy';
		expect(rewriteSiteStudioProxyUrl('/auth/me')).toBe(`${kirsBase}/auth/me`);
		expect(rewriteSiteStudioProxyUrl(`${kirsBase}/x`)).toBe(`${kirsBase}/x`);
	});

	it('uses public storefront origin for /uploads when KIRS scope includes publicSiteUrl', () => {
		activateSiteStudioProxy();
		setSiteStudioKirsProxyScope(
			'88e1272d-624f-4b00-87e7-2ac1415c8589',
			'https://foo.sites.eliteew.ru/'
		);
		expect(rewriteSiteStudioProxyUrl('/uploads/services/x.webp')).toBe(
			'https://foo.sites.eliteew.ru/uploads/services/x.webp'
		);
		const kirsBase =
			'/api/v1/desktop/kirs/projects/88e1272d-624f-4b00-87e7-2ac1415c8589/proxy';
		expect(rewriteSiteStudioProxyUrl('/auth/me')).toBe(`${kirsBase}/auth/me`);
	});

	it('uses public origin for /uploads when setSiteStudioPublicUploadsOrigin (user Site Studio)', () => {
		activateSiteStudioProxy();
		setSiteStudioPublicUploadsOrigin('https://user.example.com');
		expect(rewriteSiteStudioProxyUrl('/uploads/a.webp')).toBe(
			'https://user.example.com/uploads/a.webp'
		);
	});
});
