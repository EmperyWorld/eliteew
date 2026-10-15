/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * F-04 lock — no JS production path may pass, store, or export wg_conf / seatChannelBringUp.
 *
 * Invariants:
 * - Non-test src must not contain seatChannelBringUp.
 * - Non-test src must not contain wg_conf except seatPackage reject gate.
 * - Seat package parser rejects plaintext wg_conf.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-04
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseSeatPackageJson, SEAT_KIND } from '../launcher/seatPackage';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function walkTsFiles(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		const st = statSync(p);
		if (st.isDirectory()) {
			if (name === 'node_modules' || name === 'dist') continue;
			walkTsFiles(p, out);
			continue;
		}
		if (!/\.(ts|tsx)$/.test(name)) continue;
		if (/\.(test|contract\.test)\.(ts|tsx)$/.test(name)) continue;
		out.push(p);
	}
	return out;
}

describe('F-04 zero JS wg_conf exposure', () => {
	it('rejects seat JSON that embeds plaintext wg_conf', () => {
		const parsed = parseSeatPackageJson(
			JSON.stringify({
				v: 1,
				kind: SEAT_KIND,
				mode: 'cloud',
				license_key: 'EE-A-B-C-D',
				wg_conf: '[Interface]\nPrivateKey = x\n',
			})
		);
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.error).toMatch(/Capsule|\.ecap|открытом виде/i);
	});

	it('has no production JS/TS pass/store/export of channel conf', () => {
		const allowWgConfField = new Set(['lib/launcher/seatPackage.ts']);
		const files = walkTsFiles(srcRoot);
		const offenders: string[] = [];
		for (const file of files) {
			const rel = relative(srcRoot, file);
			const text = readFileSync(file, 'utf8');
			if (text.includes('seatChannelBringUp')) {
				offenders.push(`${rel}:seatChannelBringUp`);
			}
			if (text.includes('wg_conf') && !allowWgConfField.has(rel)) {
				offenders.push(`${rel}:wg_conf`);
			}
		}
		expect(offenders).toEqual([]);
	});
});
