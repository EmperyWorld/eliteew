/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for companion task SSE transport mode selection.
 */

import { describe, expect, it } from 'vitest';

import { companionTaskEventsStreamMode } from '@/features/ewa/companionOperations/companionTaskEventsStreamMode';

describe('companionTaskEventsStreamMode', () => {
	it('uses per-run SSE when exactly one active run', () => {
		expect(companionTaskEventsStreamMode(['run-1'])).toEqual({
			mode: 'per_run',
			runId: 'run-1',
		});
	});

	it('uses global SSE for zero or multiple active runs', () => {
		expect(companionTaskEventsStreamMode([])).toEqual({
			mode: 'global',
			runId: null,
		});
		expect(companionTaskEventsStreamMode(['a', 'b'])).toEqual({
			mode: 'global',
			runId: null,
		});
	});
});
