/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for chronicle static manifest metrics.
 *
 * Invariants:
 * - Domain ids and positive LOC must remain stable for visualization density.
 * - User-facing labels are not stored on the manifest (i18n owns copy).
 *
 * Related:
 * - data/chronicleManifest.ts
 */

import { describe, expect, it } from 'vitest';
import {
	CHRONICLE_MANIFEST,
	findChronicleDomain,
	particleBudgetFromManifest,
} from '../data/chronicleManifest';

describe('chronicleManifest', () => {
	it('exposes measured scale and domain constellation', () => {
		expect(CHRONICLE_MANIFEST.measuredLinesOfCode).toBeGreaterThan(1_000_000);
		expect(CHRONICLE_MANIFEST.commits30d).toBeGreaterThan(0);
		expect(CHRONICLE_MANIFEST.domains.map((d) => d.id)).toEqual(
			expect.arrayContaining(['api', 'spa', 'mobile', 'dewa', 'ewgen', 'ops'])
		);
		for (const domain of CHRONICLE_MANIFEST.domains) {
			expect(domain.linesOfCode).toBeGreaterThan(0);
			expect(domain.orbit).toBeGreaterThan(0);
			expect(domain).not.toHaveProperty('label');
			expect(domain).not.toHaveProperty('role');
		}
		for (const layer of CHRONICLE_MANIFEST.layers) {
			expect(layer.cameraZ).toBeGreaterThan(0);
			expect(layer).not.toHaveProperty('title');
		}
	});

	it('keeps particle budget in a sane WebGL range', () => {
		const n = particleBudgetFromManifest();
		expect(n).toBeGreaterThanOrEqual(900);
		expect(n).toBeLessThanOrEqual(2_800);
	});

	it('resolves domain focus by id', () => {
		expect(findChronicleDomain(null)).toBeNull();
		expect(findChronicleDomain('api')?.id).toBe('api');
		expect(findChronicleDomain('spa')?.layer).toBe('mask');
	});
});
