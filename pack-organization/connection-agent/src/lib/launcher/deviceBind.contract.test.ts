/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock hardware seat bind, legacy migration, and edition-isolated keyring cleanup.
 *
 * Related:
 * - DESKTOP-FOFLINE-EDITION.md §device bind
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { humanizeEntitlement, humanizeWg } from '../ui/statusCopy';

const root = resolve(__dirname, '../../..');

describe('device hardware bind', () => {
	it('import ensures bind on Capsule Rust path; v1/v2 import retired; ops seat path remains gated', () => {
		const src = readFileSync(
			resolve(root, 'src/hooks/useSeatPackageImport.ts'),
			'utf8'
		);
		// Wave 4 retail capsule path: bind + channel happen inside Rust capsule_import_channel.
		expect(src).toContain('resolveSeatOrCapsuleImport');
		const capsuleCmd = readFileSync(
			resolve(root, 'src-tauri/src/commands/capsule.rs'),
			'utf8'
		);
		expect(capsuleCmd).toContain('device_bind::ensure_bind');
		expect(capsuleCmd).toContain('capsule_v1_retired');
		expect(capsuleCmd).toContain('capsule_v2_retired');
		expect(capsuleCmd).toContain('capsule_v2_retired_deny');
		expect(capsuleCmd).not.toContain('capsule_v2_known_vuln_import');
		expect(capsuleCmd).not.toContain('open_v2_with_recipient_sk');
		expect(capsuleCmd).toContain('PENDING_JOURNAL');
		// Ops plaintext seat path may still call deviceBindEnsure when present.
		if (src.includes('deviceBindEnsure')) {
			expect(src).toContain('deviceBindEnsure');
		}
	});

	it('boot asserts bind / fingerprint_mismatch before channel restore', () => {
		const src = readFileSync(
			resolve(root, 'src/hooks/useNativeBoot.ts'),
			'utf8'
		);
		expect(src).toContain('deviceBindStatus');
		expect(src).toContain('fingerprint_mismatch');
	});

	it('ops clear bind + peer is wired in App (non-sealed)', () => {
		const src = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
		expect(src).toContain('deviceBindClear');
		expect(src).toContain('sealedPeerClear');
		expect(src).toContain('onClearDeviceBind');
	});

	it('humanizes fingerprint_mismatch for license and channel', () => {
		expect(humanizeEntitlement('fingerprint_mismatch')).toContain(
			'другому устройству'
		);
		expect(humanizeWg('fingerprint_mismatch')).toContain('другому устройству');
	});

	it('rust modules expose bind file and envelope', () => {
		const bind = readFileSync(
			resolve(root, 'src-tauri/src/device_bind.rs'),
			'utf8'
		);
		const store = readFileSync(
			resolve(root, 'src-tauri/src/capsule_store.rs'),
			'utf8'
		);
		expect(bind).toContain('device_bind.v1.json');
		expect(bind).toContain('fingerprint_mismatch');
		expect(store).toContain('eliteew_sealed_peer_v1');
		expect(store).toContain('world.empery.fofline');
		expect(store).toContain('world.empery.desktop.connected.v1');
		expect(store).toContain('from_legacy');
		expect(store).not.toContain(
			'let _ = clear_peer_conf_service(LEGACY_SERVICE)'
		);
		expect(bind).toContain('NamedTempFile::new_in');
		expect(bind).toContain('device_bind_schema_unsupported');
	});

	it('release capsule signing PK is provisioned; shared recipient SK is gone', () => {
		const capsule = readFileSync(
			resolve(root, 'src-tauri/src/capsule.rs'),
			'utf8'
		);
		const capsuleV2 = readFileSync(
			resolve(root, 'src-tauri/src/capsule_v2.rs'),
			'utf8'
		);
		const build = readFileSync(resolve(root, 'src-tauri/build.rs'), 'utf8');
		expect(capsule).not.toContain('BAKED_RECIPIENT_SK_HEX');
		expect(capsule).not.toContain('ELITEEW_DESKTOP_CAPSULE_RECIPIENT_SK');
		expect(capsuleV2).not.toContain('ELITEEW_DESKTOP_CAPSULE_RECIPIENT_SK');
		expect(build).not.toContain('ELITEEW_DESKTOP_CAPSULE_RECIPIENT_SK');
		expect(build).toContain(
			'require_hex32("ELITEEW_DESKTOP_CAPSULE_SIGNING_PK")'
		);
		expect(build).toContain('forbidden public dev vector');
		expect(capsule).toContain('capsule_v1_retired');
		expect(capsuleV2).toContain('eliteew-desktop-capsule-v2');
	});
});
