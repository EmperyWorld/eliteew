/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock shell OTA recovery/install SOCKS under W-transport (no bare reqwest).
 *
 * Invariants:
 * - updater_recovery uses fofline_native_http_client for Linux RPM + Windows NSIS.
 * - Recovery verifies signature before privileged/silent install.
 * - updater_install uses recovery whenever W-transport is on (no ota_socks_required dead-end).
 * - Missing signing configuration never invokes privileged recovery.
 *
 * Related:
 * - DESKTOP-FOFLINE-EDITION.md §3.3 / §3.4 Shell OTA
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

describe('updater SOCKS recovery (W-transport)', () => {
	it('recovery install uses fofline_native_http_client for RPM and NSIS', () => {
		const src = readFileSync(
			resolve(root, 'src-tauri/src/commands/updater_recovery.rs'),
			'utf8'
		);
		const prod = src.split('#[cfg(test)]')[0] ?? src;
		expect(prod).toContain('fofline_native_http_client');
		expect(prod).toContain('verify_tauri_minisign');
		expect(prod).toContain('resolve_recovery_latest_v2_url');
		expect(prod).toContain('verify_latest_v2');
		expect(prod).toContain('VerifiedUpdatePlan');
		expect(prod).toContain('windows-x86_64');
		expect(prod).toContain('install_nsis_silent');
		expect(prod).toContain('"/S"');
		expect(prod).toContain('--nogpgcheck');
		expect(prod).toContain('--nosignature');
		expect(prod).toContain('rpm -Kv');
		expect(prod).toContain('Header SHA256 digest: OK');
		expect(prod).toContain('Payload SHA256 digest: OK');
		expect(prod).toContain('SHA256 digest: NOT OK|digest: NOT OK');
		expect(prod).toContain('expected_package_id');
		expect(prod).toContain('platform_key_for_host');
		expect(prod).toContain('sha256sum -c -');
		expect(prod).toContain('root_copy="$(mktemp');
		expect(prod).toContain('load_sequence_trust');
		expect(prod).not.toContain('reqwest::Client::builder');
		expect(prod).not.toContain('not_linux');
	});

	it('updater_check uses signed latest.v2 only (VerifiedUpdatePlan)', () => {
		const src = readFileSync(
			resolve(root, 'src-tauri/src/commands/updater.rs'),
			'utf8'
		);
		const prod = src.split('#[cfg(test)]')[0] ?? src;
		expect(prod).toContain('check_via_verified_v2');
		expect(prod).toContain('load_sequence_trust');
		expect(prod).toContain('adopt_live_sequence_when_current');
		expect(prod).not.toContain('Repair update');
		expect(prod).toContain('verify_latest_v2');
		expect(prod).toContain('resolve_recovery_latest_v2_url');
		expect(prod).toContain('fofline_native_http_client');
		expect(prod).not.toContain('check_via_fofline_latest_json');
		expect(prod).not.toContain('ota_socks_required');
		expect(prod).not.toContain('updater_builder');
	});

	it('updater_install always uses recovery VerifiedUpdatePlan path', () => {
		const src = readFileSync(
			resolve(root, 'src-tauri/src/commands/updater.rs'),
			'utf8'
		);
		const prod = src.split('#[cfg(test)]')[0] ?? src;
		expect(prod).toContain('updater_recovery_install_inner');
		expect(prod).not.toContain('download_and_install');
	});

	it('does not recover around a missing or invalid signing gate', () => {
		const hook = readFileSync(resolve(root, 'src/hooks/useUpdater.ts'), 'utf8');
		const gate = hook.match(
			/if \(code === 'signing_required' \|\| code === 'updater_build_failed'\) \{([\s\S]*?)\n\t\t\t\}/
		);
		expect(gate?.[1]).toBeDefined();
		expect(gate?.[1]).not.toContain('handleRecoveryInstall');
		expect(gate?.[1]).toContain('return;');
	});
});
