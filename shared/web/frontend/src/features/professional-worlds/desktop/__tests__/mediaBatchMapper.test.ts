/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import {
	reduceProfessionalBatchSseMaps,
	realtorBatchLineAwaitingDecision,
} from '../mediaBatchMapper';

describe('reduceProfessionalBatchSseMaps', () => {
	it('merges envelopes per batch_item_id', () => {
		let state = reduceProfessionalBatchSseMaps(
			{},
			{ event: 'item_progress', data: { batch_item_id: 'a', item_index: 0 } }
		);
		state = reduceProfessionalBatchSseMaps(state, {
			event: 'error',
			data: { batch_item_id: 'a', phase: 'error', error: 'boom' },
		});
		expect(state.a?.last_error).toBe('boom');
		expect(state.a?.phases.join(',')).toContain('item_progress');
	});
});

describe('realtorBatchLineAwaitingDecision', () => {
	it('detects awaiting when output exists without decision', () => {
		expect(
			realtorBatchLineAwaitingDecision({ enhancement_job_id: 'ej1' }, {
				output_content_id: 'c1',
			} as { output_content_id: string })
		).toBe(true);
	});
	it('suppresses buttons after accepted decision', () => {
		expect(
			realtorBatchLineAwaitingDecision(
				{
					enhancement_job_id: 'ej1',
					review_decision: 'accepted',
				},
				{ output_content_id: 'c1' }
			)
		).toBe(false);
	});
});
