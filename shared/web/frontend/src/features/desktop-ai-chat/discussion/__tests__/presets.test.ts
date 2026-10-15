/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Discussion fallback preset ids against backend registry.
 */
import { describe, expect, it } from 'vitest';
import { DISCUSSION_FALLBACK_PRESETS, DISCUSSION_PRESET_IDS } from '../presets';

describe('DISCUSSION_PRESET_IDS', () => {
	it('matches backend built-in preset ids', () => {
		expect(DISCUSSION_PRESET_IDS).toEqual([
			'brainstorm',
			'product_review',
			'marketing_strategy',
			'responsibility_assignment',
			'interview',
			'decision',
			'negotiation',
		]);
	});

	it('lets Interview start with a single interviewer', () => {
		const interview = DISCUSSION_FALLBACK_PRESETS.find(
			(p) => p.id === 'interview'
		);
		expect(interview?.min_roster).toBe(1);
		expect(interview?.max_roster).toBe(4);
		expect(interview?.default_intensity).toBe('calm');
	});
});
