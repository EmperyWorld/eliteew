/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Smoke test that merged EWA sprite contains core companion strip symbol ids.
 *
 * Related:
 * - src/features/ewa/ewaIcons/sprites/ewa-icons-combined.svg
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const spritePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'../sprites/ewa-icons-combined.svg'
);

describe('ewa-icons-combined.svg', () => {
	it('includes companion strip symbols', () => {
		const xml = readFileSync(spritePath, 'utf8');
		for (const id of [
			'icon-ewa-brain',
			'icon-ewa-dashboard',
			'icon-ewa-analytics',
			'icon-success',
			'icon-processing',
			'icon-loading',
		]) {
			expect(xml).toContain(`id="${id}"`);
		}
	});
});
