/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock: FoFline W-transport Tauri invoke names stay wired in commands.ts.
 *
 * Invariants:
 * - Bridge exports must match retail src-tauri `w_transport_*` registration.
 * - Raw conf/store/start IPC and seat_channel_bring_up stay absent from retail JS (F-04).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3
 * - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-04
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const commandsTs = join(here, 'commands.ts');
const libRs = join(here, '../../../src-tauri/src/lib.rs');
const buildRs = join(here, '../../../src-tauri/build.rs');

const retailCmds = [
	'w_transport_status_cmd',
	'w_transport_proxy_url_cmd',
	'w_transport_start_from_keyring',
	'w_transport_recover_from_keyring',
	'w_transport_stop_cmd',
] as const;

describe('w-transport tauri bridge contract', () => {
	it('exports invoke wrappers for W-transport commands', () => {
		const src = readFileSync(commandsTs, 'utf8');
		for (const name of [
			'wTransportStatus',
			'wTransportProxyUrl',
			'wTransportStartFromKeyring',
			'wTransportRecoverFromKeyring',
			'wTransportStop',
		]) {
			expect(src).toContain(`export async function ${name}`);
		}
		for (const cmd of retailCmds) {
			expect(src).toMatch(new RegExp(`[\"']${cmd}[\"']`));
		}
		expect(src).not.toContain('seatChannelBringUp');
		expect(src).not.toMatch(/['"]seat_channel_bring_up['"]/);
		for (const banned of [
			'w_transport_start_conf',
			'w_transport_store_and_start',
			'w_transport_start_staged',
		]) {
			expect(src).not.toMatch(new RegExp(`[\"']${banned}[\"']`));
		}
	});

	it('registers the same command names in retail lib.rs invoke_handler', () => {
		const src = readFileSync(libRs, 'utf8');
		for (const cmd of retailCmds) {
			expect(src).toContain(cmd);
		}
		// Retail handler must not register seat_channel_bring_up (ops feature only).
		expect(src).not.toMatch(
			/generate_handler!\[[\s\S]*?seat_channel_bring_up[\s\S]*?\]/
		);
		for (const banned of [
			'w_transport_start_conf',
			'w_transport_store_and_start',
			'w_transport_start_staged',
			'wg_install_handoff',
		]) {
			expect(src).not.toContain(banned);
		}
	});

	it('keeps seat_channel_bring_up off retail AppManifest base list', () => {
		const src = readFileSync(buildRs, 'utf8');
		const baseBlock = src.slice(
			src.indexOf('let mut command_names'),
			src.indexOf('CARGO_FEATURE_OPS_SYSTEM_WG')
		);
		expect(baseBlock).not.toContain('seat_channel_bring_up');
		expect(src).toContain('seat_channel_bring_up');
	});
});
