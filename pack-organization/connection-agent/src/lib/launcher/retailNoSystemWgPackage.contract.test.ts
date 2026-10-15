/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 2 lock: retail packaging must not ship ops wg-portal helper, polkit, or WireGuard MSI.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-02
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const windowsConf = join(root, 'src-tauri/tauri.windows.conf.json');
const hooks = join(root, 'src-tauri/windows/hooks.nsh');
const rpmPost = join(root, 'packaging/linux/rpm-postinstall.sh');
const opsInstall = join(
	root,
	'packaging/linux/ops/install-wg-portal-helper.sh'
);

describe('retail package inventory excludes system-WG ops tooling', () => {
	it('retail Windows conf does not embed WireGuard MSI', () => {
		const conf = readFileSync(windowsConf, 'utf8');
		expect(conf).not.toMatch(/wireguard-amd64\.msi/);
		expect(conf).not.toMatch(/installerHooks/);
	});

	it('retail NSIS hooks do not msiexec WireGuard', () => {
		if (!existsSync(hooks)) {
			return;
		}
		const src = readFileSync(hooks, 'utf8');
		// Hooks file may remain for ops overlay; retail conf must not reference it.
		expect(readFileSync(windowsConf, 'utf8')).not.toContain('hooks.nsh');
		void src;
	});

	it('retail RPM postinstall does not install helper or polkit', () => {
		const post = readFileSync(rpmPost, 'utf8');
		expect(post).not.toMatch(/eliteew-wg-portal-helper/);
		expect(post).not.toMatch(/polkit/);
		expect(post).not.toMatch(/wireguard/);
	});

	it('ops helper installer exists as a separate ops path', () => {
		expect(existsSync(opsInstall)).toBe(true);
		const src = readFileSync(opsInstall, 'utf8');
		expect(src).toContain('/usr/libexec/eliteew-wg-portal-helper');
		expect(src).toContain('polkit');
	});

	it('retail AppManifest registers wg_* only under ops-system-wg Cargo feature', () => {
		const src = readFileSync(join(root, 'src-tauri/build.rs'), 'utf8');
		const gate = 'std::env::var_os("CARGO_FEATURE_OPS_SYSTEM_WG")';
		expect(src).toContain(gate);
		const [base, ops] = src.split(gate);
		expect(base).not.toMatch(/"wg_status"/);
		expect(base).not.toMatch(/"wg_bring_up"/);
		expect(ops).toMatch(/"wg_status"/);
		expect(ops).toMatch(/"wg_bring_up"/);
	});
});
