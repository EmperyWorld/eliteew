/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock FoFline shell CSP + main/product capability split (CISO P0).
 *
 * Invariants:
 * - tauri.conf.json CSP is non-null.
 * - product capability excludes opener/updater.
 * - main capability uses typed launcher_open_external (no opener:allow-open-url).
 * - fofline_spa_origin serves FOFLINE_SPA_PACK_CSP on pack OK responses.
 *
 * Related:
 * - DESKTOP-FOFLINE-EDITION.md sterile / CISO residuals
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

describe('FoFline CSP + capability split', () => {
	it('shell tauri.conf.json CSP is non-null', () => {
		const conf = JSON.parse(
			readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8')
		) as {
			app: {
				security: { csp: string | null };
				windows: Array<{ dragDropEnabled?: boolean }>;
			};
		};
		expect(conf.app.security.csp).toEqual(expect.any(String));
		expect(conf.app.security.csp).not.toBeNull();
		expect(String(conf.app.security.csp)).toMatch(/script-src 'self'/);
		expect(String(conf.app.security.csp)).toMatch(/object-src 'none'/);
		expect(conf.app.windows[0]?.dragDropEnabled).toBe(false);
	});

	it('splits main vs product capabilities without opener/updater on product', () => {
		const main = JSON.parse(
			readFileSync(resolve(root, 'src-tauri/capabilities/default.json'), 'utf8')
		) as {
			identifier: string;
			local?: boolean;
			windows: string[];
			permissions: Array<string | Record<string, unknown>>;
		};
		const product = JSON.parse(
			readFileSync(resolve(root, 'src-tauri/capabilities/product.json'), 'utf8')
		) as {
			identifier: string;
			local?: boolean;
			windows: string[];
			permissions: string[];
		};
		expect(product.local).toBe(true);

		expect(main.windows).toEqual(['main']);
		expect(main.local).toBe(true);
		expect(main.permissions.join('\n')).not.toMatch(
			/opener:default|updater:default|opener:allow-open-url/
		);
		expect(main.permissions).toEqual(
			expect.arrayContaining([
				'allow-capsule-import-channel',
				'allow-capsule-import-pick-file',
				'allow-updater-check',
				'allow-launcher-open-external',
				'allow-license-preflight-cmd',
				'allow-license-heartbeat-cmd',
			])
		);

		expect(product.windows).toEqual(['product']);
		expect(product.permissions.join('\n')).not.toMatch(/opener|updater/);
		expect(product.permissions.join('\n')).not.toMatch(/fs-bridge|fs_bridge/);
		expect(product.permissions).toEqual(
			expect.arrayContaining([
				'core:default',
				'core:webview:allow-clear-all-browsing-data',
			])
		);
	});

	it('pack origin module defines FOFLINE_SPA_PACK_CSP and applies header helper', () => {
		const src = readFileSync(
			resolve(root, 'src-tauri/src/fofline_spa_origin.rs'),
			'utf8'
		);
		expect(src).toMatch(/FOFLINE_SPA_PACK_CSP/);
		expect(src).toMatch(/with_pack_security_headers/);
		expect(src).toMatch(/CONTENT_SECURITY_POLICY/);
		expect(src).toMatch(/script-src 'self'/);
		expect(src).toMatch(/frame-ancestors 'none'/);
		expect(src).toMatch(/media-src/);
		expect(
			src.split(';').some((d) => {
				const part = d.trim();
				return (
					part.startsWith('img-src') && part.split(/\s+/).includes('https:')
				);
			})
		).toBe(false);
	});

	it('shell CSP sets frame-ancestors and has no img https wildcard', () => {
		const conf = JSON.parse(
			readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8')
		) as { app: { security: { csp: string } } };
		const csp = String(conf.app.security.csp);
		expect(csp).toMatch(/frame-ancestors 'none'/);
		expect(csp).toMatch(/media-src/);
		expect(
			csp.split(';').some((d) => {
				const part = d.trim();
				return (
					part.startsWith('img-src') && part.split(/\s+/).includes('https:')
				);
			})
		).toBe(false);
	});
});
