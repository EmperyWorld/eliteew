/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock for Wave 5/O2 package scripts (linux rpm / windows nsis; AppImage paused).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('desktop-client package scripts Wave 5 + O2', () => {
	it('exposes build:linux, build:linux:updater, build:linux:fofline, and build:windows', () => {
		const pkgPath = join(
			dirname(fileURLToPath(import.meta.url)),
			'../../../package.json'
		);
		const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
			scripts: Record<string, string>;
			version: string;
		};
		expect(pkg.scripts['build:linux']).toContain('ensure-linux-build-deps');
		expect(pkg.scripts['build:linux']).toContain('--bundles rpm');
		expect(pkg.scripts['build:linux:updater']).toContain('ensure-linux-build-deps');
		expect(pkg.scripts['build:linux:updater']).toContain('--bundles rpm');
		expect(pkg.scripts['build:linux:updater']).not.toContain('appimage');
		expect(pkg.scripts['build:linux:fofline']).toContain('build-linux-fofline.sh');
		expect(pkg.scripts['build:windows']).toContain('--bundles nsis');
		expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
	});

	it('FoFline Linux build script refuses ALSA shims and documents natural RPM name', () => {
		const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
		const ensure = readFileSync(
			join(root, 'scripts/ensure-linux-build-deps.sh'),
			'utf8'
		);
		const fofline = readFileSync(
			join(root, 'scripts/build-linux-fofline.sh'),
			'utf8'
		);
		const conf = JSON.parse(
			readFileSync(join(root, 'src-tauri/tauri.conf.fofline.example.json'), 'utf8')
		) as { productName: string };
		expect(ensure).toContain('alsa-lib-devel');
		expect(ensure).toContain('alsa-devel-3008206');
		expect(ensure).toContain('PKG_CONFIG_PATH');
		expect(fofline).toContain('ensure-linux-build-deps.sh');
		expect(fofline).toContain('tauri.conf.fofline.example.json');
		expect(fofline).toMatch(/no rename|do not mv/i);
		expect(conf.productName).toBe('EliteEW FoFline');
	});

	it('bakes updater endpoints and pubkey in tauri.conf for user UX', () => {
		const confPath = join(
			dirname(fileURLToPath(import.meta.url)),
			'../../../src-tauri/tauri.conf.json'
		);
		const conf = JSON.parse(readFileSync(confPath, 'utf8')) as {
			version: string;
			plugins: {
				updater: { pubkey: string; endpoints: string[] };
				'eliteew-desktop-client': { entitlement_pubkey_hex: string };
			};
		};
		expect(conf.version).toMatch(/^\d+\.\d+\.\d+$/);
		expect(conf.plugins.updater.pubkey.length).toBeGreaterThan(32);
		expect(conf.plugins.updater.pubkey).not.toContain('REPLACE_WITH');
		expect(conf.plugins.updater.endpoints[0]).toContain('desktop-client-updates');
		expect(conf.plugins['eliteew-desktop-client'].entitlement_pubkey_hex).toMatch(
			/^[0-9a-f]{64}$/i
		);
	});

	it('signing example enables updater artifacts for rpm only (never overrides pubkey)', () => {
		const confPath = join(
			dirname(fileURLToPath(import.meta.url)),
			'../../../src-tauri/tauri.conf.signing.example.json'
		);
		const raw = readFileSync(confPath, 'utf8');
		const conf = JSON.parse(raw) as {
			bundle: { createUpdaterArtifacts: boolean; targets: string[] };
			plugins?: { updater?: { pubkey?: string; endpoints?: string[] } };
		};
		expect(conf.bundle.createUpdaterArtifacts).toBe(true);
		expect(conf.bundle.targets).toEqual(['rpm']);
		expect(conf.bundle.targets).not.toContain('appimage');
		// 0.4.7 regression: merge REPLACE_WITH pubkey → client shows signing_required forever.
		expect(raw).not.toContain('REPLACE_WITH');
		expect(conf.plugins?.updater?.pubkey).toBeUndefined();
	});
});
