/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock TREE_SEMVER mirrors + CHANNEL_MATRIX header for release bumps.
 *
 * Invariants:
 * - APP_VERSION / Cargo / tauri.conf / release-state.tree_semver match package.json.
 * - release-state schema is eliteew.desktop-client.release-state.v1.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-VERSION-SOT.md
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('desktop-client release version parity', () => {
	it('keeps TREE_SEMVER mirrors + release-state header aligned', () => {
		const pkg = JSON.parse(
			readFileSync(join(root, 'package.json'), 'utf8')
		) as { version: string };
		const tauri = JSON.parse(
			readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8')
		) as { version: string };
		const state = JSON.parse(
			readFileSync(join(root, 'docs/release-state.v1.json'), 'utf8')
		) as {
			schema: string;
			tree_semver: string;
			channels: Record<
				string,
				Record<string, { status: string; semver?: string; reason?: string }>
			>;
		};
		const appVersion = readFileSync(
			join(root, 'src/lib/launcher/appVersion.ts'),
			'utf8'
		);
		const cargo = readFileSync(join(root, 'src-tauri/Cargo.toml'), 'utf8');
		expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
		expect(tauri.version).toBe(pkg.version);
		expect(appVersion).toContain(`export const APP_VERSION = '${pkg.version}'`);
		expect(cargo).toMatch(
			new RegExp(`^version = "${pkg.version.replace(/\./g, '\\.')}"`, 'm')
		);
		expect(state.schema).toBe('eliteew.desktop-client.release-state.v1');
		expect(state.tree_semver).toBe(pkg.version);
		for (const [channel, platforms] of Object.entries(state.channels)) {
			for (const [platform, row] of Object.entries(platforms)) {
				expect(
					row.status,
					`${channel}.${platform} status`
				).toMatch(/^(live|lag|hold|omitted)$/);
				if (row.status === 'live') {
					expect(row.semver, `${channel}.${platform} live semver`).toBe(
						pkg.version
					);
				} else {
					expect(
						(row.reason ?? '').trim().length,
						`${channel}.${platform} reason`
					).toBeGreaterThan(0);
				}
			}
		}
	});
});
