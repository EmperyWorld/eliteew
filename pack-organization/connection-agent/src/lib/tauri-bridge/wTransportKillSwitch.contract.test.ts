/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source lock: W-transport kill-switch closes product WebView when SOCKS/tunnel is down
 * (stop / status / recover exhausted) — Dual-OS PoC checklist #2 in-tree cause.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../src-tauri/src');
const productRs = join(root, 'commands/product.rs');
const wTransportRs = join(root, 'commands/w_transport.rs');
const libRs = join(root, 'lib.rs');

describe('W-transport product kill-switch (source)', () => {
	it('defines product_close_for_w_transport_kill_switch gated on w_transport_enabled', () => {
		const src = readFileSync(productRs, 'utf8');
		expect(src).toContain('product_close_for_w_transport_kill_switch');
		expect(src).toMatch(
			/pub fn product_close_for_w_transport_kill_switch[\s\S]*?w_transport_enabled\(\)/
		);
		expect(src).toContain('w_transport_kill_switch product_closed');
	});

	it('stop + socks-down status + recover exhausted invoke kill-switch', () => {
		const src = readFileSync(wTransportRs, 'utf8');
		expect(src).toContain('product_close_for_w_transport_kill_switch');
		expect(src).toMatch(
			/pub fn w_transport_stop_cmd[\s\S]*?w_transport_stop_for_app/
		);
		expect(src).toMatch(
			/fn w_transport_stop_for_app[\s\S]*?product_close_for_w_transport_kill_switch/
		);
		expect(src).toMatch(
			/if !st\.socks_listening \{[\s\S]*?product_close_for_w_transport_kill_switch/
		);
		expect(src).toMatch(
			/w_transport_recover_exhausted[\s\S]*?product_close_for_w_transport_kill_switch/
		);
	});

	it('Exit path stops W-transport with AppHandle (kill-switch eligible)', () => {
		const src = readFileSync(libRs, 'utf8');
		expect(src).toMatch(
			/RunEvent::Exit[\s\S]*?w_transport_stop_for_app\(app\)/
		);
	});
});
