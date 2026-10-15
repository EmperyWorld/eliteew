/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 5 lock: license_redeem IPC is retired (no caller enroll_base HTTP).
 * W-transport SOCKS remains on platform egress client for other EliteEW calls.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md F-06
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const licenseRs = join(root, 'src-tauri/src/commands/license.rs');
const egressRs = join(root, 'src-tauri/src/fofline_egress.rs');
const bridgeTs = join(root, 'src/lib/tauri-bridge/commands.ts');

describe('license_redeem retired + platform egress SOCKS (source)', () => {
	it('license_redeem is fail-closed without HTTP client', () => {
		const src = readFileSync(licenseRs, 'utf8');
		expect(src).toContain('license_redeem_removed');
		expect(src).not.toContain('fofline_native_http_client');
		expect(src).not.toMatch(/reqwest::Client::builder/);
	});

	it('platform egress still prefers socks5h', () => {
		const egress = readFileSync(egressRs, 'utf8');
		expect(egress).toContain('socks5h://');
		expect(egress).toContain('socks5h_proxy_url');
		expect(egress).toContain('redirect(reqwest::redirect::Policy::none())');
	});

	it('L7 probe bridge drops caller URL', () => {
		const bridge = readFileSync(bridgeTs, 'utf8');
		expect(bridge).toMatch(/export async function wTransportL7Probe\(\): Promise/);
		expect(bridge).not.toMatch(/w_transport_l7_probe", \{ url \}/);
	});
});
