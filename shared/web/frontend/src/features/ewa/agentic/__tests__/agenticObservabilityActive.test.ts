/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock active vs terminal session statuses for agentic tree/trace polling.
 *
 * Related:
 * - agenticObservabilityActive.ts
 */

import { describe, expect, it } from 'vitest';

import { isAgenticObservabilitySessionActive } from '@/features/ewa/agentic/agenticObservabilityActive';

describe('isAgenticObservabilitySessionActive', () => {
	it('treats live mission statuses as active', () => {
		for (const status of [
			'init',
			'planning',
			'replanning',
			'executing',
			'awaiting_human',
			'paused',
			'Executing',
		]) {
			expect(isAgenticObservabilitySessionActive(status)).toBe(true);
		}
	});

	it('treats terminal statuses as inactive', () => {
		for (const status of [
			'completed',
			'failed',
			'cancelled',
			'abandoned',
			'',
		]) {
			expect(isAgenticObservabilitySessionActive(status)).toBe(false);
		}
	});
});
