/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for seat package JSON parse (desktop-client-014).
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - src/lib/launcher/seatPackage.ts
 */

import { describe, expect, it } from 'vitest';
import {
	looksLikeSeatPackageJson,
	parseSeatPackageJson,
	SEAT_KIND,
} from './seatPackage';

describe('seatPackage', () => {
	it('detects seat kind', () => {
		expect(
			looksLikeSeatPackageJson(
				JSON.stringify({ v: 1, kind: SEAT_KIND, mode: 'offline' })
			)
		).toBe(true);
		expect(looksLikeSeatPackageJson('{"kind":"other"}')).toBe(false);
	});

	it('parses offline pack with entitlement', () => {
		const raw = {
			v: 1,
			kind: SEAT_KIND,
			mode: 'offline',
			mode_label_ru: 'Офлайн-режим',
			license_key: 'EE-A-B-C-D',
			entitlement: { v: 1, payload: {}, sig: 'x' },
		};
		const parsed = parseSeatPackageJson(JSON.stringify(raw));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.package.mode).toBe('offline');
		expect(parsed.package.mode_label_ru).toBe('Офлайн-режим');
		expect(parsed.package.entitlement).toBeTruthy();
	});

	it('rejects cloud pack with plaintext wg_conf (F-04)', () => {
		const raw = {
			v: 1,
			kind: SEAT_KIND,
			mode: 'cloud',
			license_key: 'EE-A-B-C-D',
			wg_conf: '[Interface]\nPrivateKey = x\n',
		};
		const parsed = parseSeatPackageJson(JSON.stringify(raw));
		expect(parsed.ok).toBe(false);
	});

	it('parses cloud pack without wg_conf', () => {
		const raw = {
			v: 1,
			kind: SEAT_KIND,
			mode: 'cloud',
			license_key: 'EE-A-B-C-D',
		};
		const parsed = parseSeatPackageJson(JSON.stringify(raw));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.package.mode).toBe('cloud');
		expect('wg_conf' in parsed.package).toBe(false);
	});

	it('rejects empty pack', () => {
		const parsed = parseSeatPackageJson(
			JSON.stringify({ v: 1, kind: SEAT_KIND, mode: 'offline' })
		);
		expect(parsed.ok).toBe(false);
	});
});
