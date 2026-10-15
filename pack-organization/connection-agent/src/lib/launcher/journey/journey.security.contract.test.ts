/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source locks for Journey Tauri constraints (CSP / capabilities / no deferred plugins).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §6
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../..');

describe('Journey Tauri constraints (source)', () => {
	it('main CSP keeps frame-src none (no iframe brochure)', () => {
		const conf = JSON.parse(
			readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8')
		) as { app: { security: { csp: string | null } } };
		expect(String(conf.app.security.csp)).toMatch(/frame-src 'none'/);
	});

	it('product capability never gains opener or updater', () => {
		const product = JSON.parse(
			readFileSync(
				resolve(root, 'src-tauri/capabilities/product.json'),
				'utf8'
			)
		) as { permissions: string[] };
		expect(product.permissions.join('\n')).not.toMatch(/opener|updater/);
		expect(product.permissions.join('\n')).not.toMatch(/fs-bridge|fs_bridge/);
	});

	it('main capability retains typed launcher links + updater for Journey CTAs / Релизы', () => {
		const main = JSON.parse(
			readFileSync(
				resolve(root, 'src-tauri/capabilities/default.json'),
				'utf8'
			)
		) as { permissions: string[] };
		expect(main.local).toBe(true);
		expect(main.permissions).toEqual(
			expect.arrayContaining(['allow-launcher-open-external']),
		);
		expect(main.permissions.join('\n')).not.toMatch(/opener:default|updater:default|opener:allow-open-url/);
	});

	it('v1 does not add dialog / store / notification plugins', () => {
		const cargo = readFileSync(resolve(root, 'src-tauri/Cargo.toml'), 'utf8');
		expect(cargo).not.toMatch(/tauri-plugin-dialog/);
		expect(cargo).not.toMatch(/tauri-plugin-store/);
		expect(cargo).not.toMatch(/tauri-plugin-notification/);
		const pkg = JSON.parse(
			readFileSync(resolve(root, 'package.json'), 'utf8')
		) as { dependencies?: Record<string, string> };
		const deps = Object.keys(pkg.dependencies ?? {}).join('\n');
		expect(deps).not.toMatch(/plugin-dialog|plugin-store|plugin-notification/);
	});
});
