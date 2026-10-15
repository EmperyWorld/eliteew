/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Home drop zone: retail sealed accepts capsule only; rejects seat/entitlement.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const home = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../features/home/HomeScreen.tsx'
);

describe('HomeScreen sealed drop (source)', () => {
	it('routes capsule to seat import; sealed rejects seat and entitlement', () => {
		const src = readFileSync(home, 'utf8');
		expect(src).toContain('readDroppedAccessFile');
		expect(src).toContain('looksLikeCapsuleJson');
		expect(src).toContain('looksLikeCapsuleV3');
		expect(src).toContain('looksLikeSeatPackageJson');
		expect(src).toContain('looksLikeEntitlementJson');
		expect(src).toContain('onImportSeatJsonText(read.text)');
		expect(src).toContain('eliteew-*.ecap');
		expect(src).toContain('onPickAccessFile');
		expect(src).toContain('Выбрать файл .ecap');
		// Capsule path first, then seat gated by sealed.
		expect(src).toMatch(
			/if \(looksLikeCapsuleV3\(read\.text\) \|\| looksLikeCapsuleJson\(read\.text\)\)/
		);
		expect(src).toMatch(
			/if \(looksLikeSeatPackageJson\(read\.text\)\)[\s\S]*?if \(sealed\)/
		);
		expect(src).toMatch(
			/if \(looksLikeEntitlementJson\(read\.text\)\)[\s\S]*?if \(sealed\)/
		);
	});
});
