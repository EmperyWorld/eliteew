/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract: host link snapshot bridge never uses navigator.onLine; chip always on rail.
 *
 * Related:
 * - ../hostNetworkLinkSnapshot.ts
 * - ../../components/TaskbarNetworkLinkChip.tsx
 * - ../../components/TaskbarRightToolbar.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

vi.mock('@/services/keycloakProfile', () => ({
	getOidcRuntimeProfile: vi.fn(() => 'web'),
}));

import { getOidcRuntimeProfile } from '@/services/keycloakProfile';
import {
	fetchHostLinkSnapshot,
	hostLinkFromEmpiierosPayload,
	unavailableHostLinkSnapshot,
} from '../hostNetworkLinkSnapshot';

describe('hostNetworkLinkSnapshot', () => {
	beforeEach(() => {
		vi.mocked(getOidcRuntimeProfile).mockReturnValue('web');
		delete (window as Window & { __TAURI_INTERNALS__?: unknown })
			.__TAURI_INTERNALS__;
		delete (window as Window & { EmperyDesktopNetworkLink?: unknown })
			.EmperyDesktopNetworkLink;
	});

	it('degrades without Tauri and never reads browser reachability as link', async () => {
		const src = readFileSync(
			join(dir, '../hostNetworkLinkSnapshot.ts'),
			'utf8'
		);
		expect(src).not.toMatch(/navigator\.onLine/);
		const snap = await fetchHostLinkSnapshot();
		expect(snap).toEqual(unavailableHostLinkSnapshot('not_native_shell'));
		expect(snap.active).toBe(false);
	});

	it('parses native invoke payload for wifi active', async () => {
		vi.mocked(getOidcRuntimeProfile).mockReturnValue('desktopNative');
		(
			window as Window & {
				__TAURI_INTERNALS__?: { invoke: () => Promise<unknown> };
			}
		).__TAURI_INTERNALS__ = {
			invoke: async () => ({
				ok: true,
				code: 'ok',
				message: '',
				kind: 'wifi',
				active: true,
			}),
		};
		const snap = await fetchHostLinkSnapshot();
		expect(snap.ok).toBe(true);
		expect(snap.kind).toBe('wifi');
		expect(snap.active).toBe(true);
	});

	it('reads the EmpiierOS seat snapshot and drops addresses', async () => {
		(
			window as Window & {
				EmperyDesktopNetworkLink?: {
					getLinkSnapshot: () => Promise<unknown>;
				};
			}
		).EmperyDesktopNetworkLink = {
			getLinkSnapshot: async () => ({
				ok: true,
				kind: 'ethernet',
				active: true,
				ipv4: '192.168.8.10/30',
				ssid: 'lab',
			}),
		};
		const snap = await fetchHostLinkSnapshot();
		expect(snap.ok).toBe(true);
		expect(snap.kind).toBe('ethernet');
		expect(snap.active).toBe(true);
		expect(snap.message).toBe('');
		expect(JSON.stringify(snap)).not.toContain('192.168.8.10');
		expect(JSON.stringify(snap)).not.toContain('lab');
	});

	it('rejects an EmpiierOS payload that is not a link', () => {
		expect(
			hostLinkFromEmpiierosPayload({ ok: false, kind: null, active: false })
				.active
		).toBe(false);
		expect(
			hostLinkFromEmpiierosPayload({ ok: true, kind: 'modem', active: true }).ok
		).toBe(false);
	});
});

describe('TaskbarNetworkLinkChip rail contract', () => {
	it('mounts chip on TaskbarRightToolbar primary rail always', () => {
		const toolbar = readFileSync(
			join(dir, '../../components/TaskbarRightToolbar.tsx'),
			'utf8'
		);
		const overflow = readFileSync(
			join(dir, '../../components/TaskbarSecondaryOverflow.tsx'),
			'utf8'
		);
		const chip = readFileSync(
			join(dir, '../../components/TaskbarNetworkLinkChip.tsx'),
			'utf8'
		);
		expect(toolbar).toContain('<TaskbarNetworkLinkChip');
		expect(overflow).not.toContain('TaskbarNetworkLinkChip');
		expect(overflow).not.toContain('networkLink');
		expect(chip).toContain('data-testid="taskbar-network-link-chip"');
		expect(chip).toContain('networkLinkActive');
		expect(chip).toContain('networkLinkInactive');
		expect(chip).not.toMatch(/navigator\.onLine/);
	});
});
