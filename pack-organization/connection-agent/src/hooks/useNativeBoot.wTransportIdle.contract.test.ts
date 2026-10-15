/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock W-transport boot: missing keyring peer → idle status, never system wgStatus;
 * retail boot recovers from keyring (no WG private key in JS).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const boot = join(dirname(fileURLToPath(import.meta.url)), 'useNativeBoot.ts');
const sealedCmd = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../src-tauri/src/commands/sealed_store.rs'
);
const recoverCmd = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../src-tauri/src/commands/w_transport.rs'
);

describe('useNativeBoot W-transport idle (source)', () => {
	it('uses keyring recover and idle when peer missing', () => {
		const src = readFileSync(boot, 'utf8');
		expect(src).toContain('sealedPeerLoad');
		expect(src).toContain('wTransportRecoverFromKeyring');
		expect(src).not.toContain('sealedPeerLoadConf');
		expect(src).not.toContain('wTransportStartConf');
		expect(src).toContain('deviceBindStatus');
		expect(src).toContain('never probe system WG telemetry');
		expect(src).toMatch(/code:\s*['"]idle['"]/);
		expect(src).toContain('fingerprint_mismatch');
		expect(src).toMatch(/code:\s*['"]secure_store_load_failed['"]/);
		expect(src).toMatch(/!confLoadFailed[\s\S]*?code:\s*['"]idle['"]/);
		expect(src).toMatch(/code:\s*['"]channel_unstable['"]/);
	});

	it('native sealed_peer_load returns metadata Ok without conf body', () => {
		const src = readFileSync(sealedCmd, 'utf8');
		expect(src).toContain('pub fn sealed_peer_load');
		expect(src).toContain('fingerprint_mismatch');
		expect(src).not.toContain('sealed_peer_load_conf');
	});

	it('recover uses bounded backoff 1s→2s→5s max three', () => {
		const src = readFileSync(recoverCmd, 'utf8');
		expect(src).toContain('w_transport_recover_from_keyring');
		expect(src).toContain('let backoff_secs = [1u64, 2, 5]');
		expect(src).toContain('channel_unstable');
		expect(src).toContain('load_sealed_peer_for_transport');
		expect(src).not.toContain('sealed_peer_load_conf');
		expect(src).toContain('if i + 1 < backoff_secs.len()');
	});
});
