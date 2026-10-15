/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const capsuleImportChannel = vi.fn();
vi.mock('../tauri-bridge/commands', () => ({
	capsuleImportChannel: (...args: unknown[]) => capsuleImportChannel(...args),
}));

import { resolveSeatOrCapsuleImport, looksLikeCapsuleV3 } from './capsuleImport';

describe('resolveSeatOrCapsuleImport', () => {
	beforeEach(() => {
		capsuleImportChannel.mockReset();
	});

	it('imports capsules via Rust-only channel', async () => {
		capsuleImportChannel.mockResolvedValue({
			ok: true,
			code: 'imported',
			message: 'ok',
			entitlement: { ok: true, code: 'ok', message: 'ok' },
		});
		const raw = JSON.stringify({ kind: 'eliteew_desktop_capsule', v: 1 });
		const result = await resolveSeatOrCapsuleImport(raw);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.kind).toBe('capsule');
		}
		expect(capsuleImportChannel).toHaveBeenCalledOnce();
	});

	it('detects ecap_v3 transport', () => {
		expect(
			looksLikeCapsuleV3(
				JSON.stringify({ encoding: 'ecap_v3', package_b64: 'QQ==' })
			)
		).toBe(true);
		expect(
			looksLikeCapsuleV3(
				JSON.stringify({ kind: 'eliteew_desktop_capsule', v: 2 })
			)
		).toBe(false);
	});

	it('imports ecap_v3 via Rust-only channel', async () => {
		capsuleImportChannel.mockResolvedValue({
			ok: true,
			code: 'imported',
			message: 'ok',
			entitlement: { ok: true, code: 'ok', message: 'ok' },
		});
		const raw = JSON.stringify({ encoding: 'ecap_v3', package_b64: 'QQ==' });
		const result = await resolveSeatOrCapsuleImport(raw);
		expect(result.ok).toBe(true);
		expect(capsuleImportChannel).toHaveBeenCalledWith(raw);
	});
});
