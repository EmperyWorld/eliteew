/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock file-drop helpers for launcher conf / entitlement import.
 *
 * Related:
 * - lib/ui/fileDrop.ts
 */

import { describe, expect, it } from 'vitest';
import {
	looksLikeEntitlementJson,
	looksLikeWireGuardConf,
	readDroppedAccessFile,
	readDroppedTextFile,
} from './fileDrop';

describe('fileDrop', () => {
	it('detects WireGuard conf shape', () => {
		expect(
			looksLikeWireGuardConf(
				'[Interface]\nPrivateKey = abc\nAddress = 10.0.0.1/32\n'
			)
		).toBe(true);
		expect(looksLikeWireGuardConf('hello')).toBe(false);
	});

	it('detects entitlement-ish JSON', () => {
		expect(
			looksLikeEntitlementJson(
				'{"license_id":"x","edition":"client","apps":[]}'
			)
		).toBe(true);
		expect(looksLikeEntitlementJson('{"foo":1}')).toBe(false);
		expect(looksLikeEntitlementJson('not-json')).toBe(false);
		expect(
			looksLikeEntitlementJson(
				JSON.stringify({ encoding: 'ecap_v3', package_b64: 'QQ==' })
			)
		).toBe(false);
	});

	it('rejects empty dropped files', async () => {
		const empty = new File([], 'empty.conf', { type: 'text/plain' });
		const result = await readDroppedTextFile(empty);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('пуст');
		}
	});

	it('reads small text files', async () => {
		const file = new File(['[Interface]\nPrivateKey = x\n'], 'wg.conf', {
			type: 'text/plain',
		});
		const result = await readDroppedTextFile(file);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.text).toContain('[Interface]');
			expect(result.name).toBe('wg.conf');
		}
	});

	it('wraps EECAP3 binary as ecap_v3 transport', async () => {
		const magic = new Uint8Array([
			0x45, 0x45, 0x43, 0x41, 0x50, 0x33, 0x00, 0x00, 0x01, 0x02,
		]);
		const file = new File([magic], 'access.ecap', {
			type: 'application/octet-stream',
		});
		const result = await readDroppedAccessFile(file);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.text) as {
				encoding: string;
				package_b64: string;
			};
			expect(parsed.encoding).toBe('ecap_v3');
			expect(parsed.package_b64.length).toBeGreaterThan(0);
		}
	});
});
