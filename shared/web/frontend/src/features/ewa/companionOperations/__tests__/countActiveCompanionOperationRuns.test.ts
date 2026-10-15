/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for active operation run counting (U5.6).
 */

import { describe, expect, it } from 'vitest';

import { countActiveCompanionOperationRuns } from '@/features/ewa/companionOperations/companionOperationsUi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

describe('countActiveCompanionOperationRuns', () => {
	it('counts only active statuses', () => {
		const runs = [
			{
				id: 'a',
				status: 'running',
				intent_kind: 'music_generation_background',
			},
			{ id: 'b', status: 'completed', intent_kind: 'image_generation' },
			{
				id: 'c',
				status: 'awaiting_confirmation',
				intent_kind: 'action_workflow',
			},
		] as EwaCompanionTaskRun[];
		expect(countActiveCompanionOperationRuns(runs)).toBe(2);
	});

	it('returns zero for empty list', () => {
		expect(countActiveCompanionOperationRuns([])).toBe(0);
	});
});
