/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock W-transport ↔ TunnelScreen portal status mapping and Install path gate.
 *
 * Invariants:
 * - socks_listening maps to unit_active; ok never invented.
 * - useWgPortal Install/BringUp uses keyring recover only (F-04; no conf IPC).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3
 * - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-04
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { wTransportToPortalStatus } from './wTransportPortalMap';
import type { WTransportStatus } from '../tauri-bridge/commands';

const here = dirname(fileURLToPath(import.meta.url));

describe('wTransportToPortalStatus', () => {
	it('maps socks_listening to unit_active without inventing ok', () => {
		const st: WTransportStatus = {
			ok: true,
			code: 'socks_up',
			message: 'up',
			enabled: true,
			socks_listening: true,
			proxy_url: 'socks5://127.0.0.1:9',
			handshake_packet_sent: true,
			tcp_over_wg: 'ready',
			fail_closed: true,
		};
		const portal = wTransportToPortalStatus(st, true);
		expect(portal.ok).toBe(true);
		expect(portal.unit_active).toBe(true);
		expect(portal.conf_present).toBe(true);
		// Listen-only is not «protected» until L7 probe.
		expect(portal.code).toBe('socks_listening');
	});

	it('maps L7 ok to protected', () => {
		const st: WTransportStatus = {
			ok: true,
			code: 'socks_up',
			message: 'up',
			enabled: true,
			socks_listening: true,
			handshake_packet_sent: true,
			tcp_over_wg: 'ready',
			fail_closed: true,
		};
		const portal = wTransportToPortalStatus(st, true, { l7Ok: true });
		expect(portal.code).toBe('protected');
		expect(portal.ok).toBe(true);
	});

	it('maps L7 fail to channel_unconfirmed', () => {
		const st: WTransportStatus = {
			ok: true,
			code: 'socks_up',
			message: 'up',
			enabled: true,
			socks_listening: true,
			handshake_packet_sent: true,
			tcp_over_wg: 'ready',
			fail_closed: true,
		};
		const portal = wTransportToPortalStatus(st, true, { l7Ok: false });
		expect(portal.code).toBe('channel_unconfirmed');
		expect(portal.ok).toBe(false);
	});

	it('keeps ok false when native reports down', () => {
		const st: WTransportStatus = {
			ok: false,
			code: 'down',
			message: 'idle',
			enabled: true,
			socks_listening: false,
			handshake_packet_sent: false,
			tcp_over_wg: 'down',
			fail_closed: true,
		};
		expect(wTransportToPortalStatus(st, false).ok).toBe(false);
		expect(wTransportToPortalStatus(st, false).unit_active).toBe(false);
	});
});

describe('useWgPortal W-transport Install gate (source)', () => {
	it('Install recovers from keyring only when mode is w_transport (F-04)', () => {
		const src = readFileSync(join(here, '../../hooks/useWgPortal.ts'), 'utf8');
		expect(src).toContain("mode === 'w_transport'");
		expect(src).toContain('wTransportRecoverFromKeyring');
		expect(src).not.toContain('wTransportStoreAndStart');
		expect(src).not.toContain('wTransportStartConf');
		expect(src).not.toContain('seatChannelBringUp');
		expect(src).toMatch(
			/if \(mode === 'w_transport'\)[\s\S]*?wTransportRecoverFromKeyring/
		);
	});

	it('BringUp / Down / Refresh skip system wg_* when gate on', () => {
		const src = readFileSync(join(here, '../../hooks/useWgPortal.ts'), 'utf8');
		expect(src).toContain('wTransportRecoverFromKeyring');
		expect(src).toContain('wTransportStop');
		expect(src).toContain('wTransportStatus');
		expect(src).toContain('never call wg_install');
	});
});
