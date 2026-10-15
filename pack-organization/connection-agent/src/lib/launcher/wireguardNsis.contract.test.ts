/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock WireGuard MSI pin + ops-only NSIS overlay (Wave 2: retail has no MSI).
 *
 * Invariants:
 * - VERSION.json has sha256 + url; ops windows conf embeds msiexec; retail conf does not.
 *
 * Related:
 * - src-tauri/tauri.windows.ops.conf.json
 * - packaging/windows/fetch-wireguard-msi.sh
 * - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-02
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const srcTauri = join(root, 'src-tauri');

describe('WireGuard NSIS embed contracts (ops-only)', () => {
	it('pins VERSION.json with sha256 and amd64 MSI URL', () => {
		const pin = JSON.parse(
			readFileSync(join(srcTauri, 'windows/wireguard/VERSION.json'), 'utf8')
		) as {
			url: string;
			sha256: string;
			filename: string;
			version: string;
		};
		expect(pin.filename).toBe('wireguard-amd64.msi');
		expect(pin.version).toMatch(/^\d+\.\d+/);
		expect(pin.sha256).toMatch(/^[a-f0-9]{64}$/);
		expect(pin.url).toContain('download.wireguard.com');
		expect(pin.url).toContain('wireguard-amd64');
	});

	it('retail windows conf does not embed MSI or installerHooks', () => {
		const conf = JSON.parse(
			readFileSync(join(srcTauri, 'tauri.windows.conf.json'), 'utf8')
		) as {
			bundle: {
				resources?: Record<string, string>;
				windows: { nsis: { installMode: string; installerHooks?: string } };
			};
		};
		expect(conf.bundle.windows.nsis.installMode).toBe('perMachine');
		expect(conf.bundle.windows.nsis.installerHooks).toBeUndefined();
		expect(conf.bundle.resources ?? {}).not.toHaveProperty(
			'windows/wireguard/wireguard-amd64.msi'
		);
	});

	it('ops windows conf is perMachine with installerHooks and MSI resource map', () => {
		const conf = JSON.parse(
			readFileSync(join(srcTauri, 'tauri.windows.ops.conf.json'), 'utf8')
		) as {
			bundle: {
				resources: Record<string, string>;
				windows: { nsis: { installMode: string; installerHooks: string } };
			};
		};
		expect(conf.bundle.windows.nsis.installMode).toBe('perMachine');
		expect(conf.bundle.windows.nsis.installerHooks).toContain('hooks.nsh');
		expect(conf.bundle.resources['windows/wireguard/wireguard-amd64.msi']).toBe(
			'wireguard-amd64.msi'
		);
	});

	it('hooks.nsh installs MSI quietly and never uninstalls WireGuard', () => {
		const hooks = readFileSync(join(srcTauri, 'windows/hooks.nsh'), 'utf8');
		expect(hooks).toContain('NSIS_HOOK_POSTINSTALL');
		expect(hooks).toContain('msiexec /i');
		expect(hooks).toContain('wireguard-amd64.msi');
		expect(hooks).toContain('packaging/windows/fetch-wireguard-msi.sh');
		expect(hooks).toMatch(/\/qn/);
		expect(hooks).toContain('Do not remove WireGuard');
		expect(hooks).not.toMatch(/msiexec \/x/i);
	});

	it('fetch script and package scripts exist', () => {
		expect(
			existsSync(join(root, 'packaging/windows/fetch-wireguard-msi.sh'))
		).toBe(true);
		const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(pkg.scripts['fetch:wireguard-msi']).toContain(
			'packaging/windows/fetch-wireguard-msi'
		);
		expect(pkg.scripts['build:windows']).toContain('--bundles nsis');
		expect(pkg.scripts['build:windows']).not.toContain('bash');
	});

	it('scripts/fetch-wireguard-msi.sh is a thin wrapper to packaging/', () => {
		const wrapper = join(root, 'scripts/fetch-wireguard-msi.sh');
		expect(existsSync(wrapper)).toBe(true);
		const body = readFileSync(wrapper, 'utf8');
		expect(body).toContain('packaging/windows/fetch-wireguard-msi.sh');
		expect(body).toMatch(/\bexec bash\b/);
		expect(body).not.toContain('download.wireguard.com');
	});
});
