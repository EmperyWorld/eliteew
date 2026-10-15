/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit lock for companion plans feature probe cache (opaque 404 / disabled stop-loop).
 *
 * Invariants:
 * - Module state only; resetCompanionPlansFeatureProbeStateForTests clears between cases.
 *
 * Related:
 * - companionPlansFeatureProbe.ts
 * - documentation/product/ewa/EWA-DEATH-SPIRAL-REGRESSION-GATE.md
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
	cacheCompanionPlansFeatureProbeState,
	readCompanionPlansFeatureProbeState,
	resetCompanionPlansFeatureProbeStateForTests,
} from '@/services/ewa/companionPlansFeatureProbe';

describe('companionPlansFeatureProbe', () => {
	beforeEach(() => {
		resetCompanionPlansFeatureProbeStateForTests();
	});

	it('starts unknown and caches enabled/disabled', () => {
		expect(readCompanionPlansFeatureProbeState()).toBe('unknown');
		cacheCompanionPlansFeatureProbeState('enabled');
		expect(readCompanionPlansFeatureProbeState()).toBe('enabled');
		cacheCompanionPlansFeatureProbeState('disabled');
		expect(readCompanionPlansFeatureProbeState()).toBe('disabled');
	});

	it('reset clears probe to unknown for tests', () => {
		cacheCompanionPlansFeatureProbeState('disabled');
		resetCompanionPlansFeatureProbeStateForTests();
		expect(readCompanionPlansFeatureProbeState()).toBe('unknown');
	});
});
