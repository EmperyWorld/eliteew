/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { licensePreflight } from './licensePreflight';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('licensePreflight', () => {
	it('maps expired to fail-closed RU message', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: false,
				status: 403,
				json: async () => ({
					detail: { code: 'license_expired', message: 'License expired' },
				}),
			}))
		);
		const r = await licensePreflight('https://example.test', {
			licenseId: '00000000-0000-0000-0000-000000000001',
		});
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.code).toBe('license_expired');
			expect(r.message).toContain('истёк');
		}
	});

	it('returns ok payload without inventing fields', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				status: 200,
				json: async () => ({
					ok: true,
					code: 'ok',
					expires_at: '2026-12-01T00:00:00Z',
					allow_online: true,
					allow_fofline: false,
					allow_offline: true,
				}),
			}))
		);
		const r = await licensePreflight('https://example.test/', {
			licenseId: '00000000-0000-0000-0000-000000000001',
		});
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.expiresAt).toBe('2026-12-01T00:00:00Z');
			expect(r.allowOnline).toBe(true);
		}
	});
});
