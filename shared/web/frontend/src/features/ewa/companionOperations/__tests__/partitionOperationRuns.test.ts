/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for operations run partitioning and display limits (U3.4).
 */

import { describe, expect, it } from 'vitest';

import {
	OPERATIONS_DISPLAY_LIMIT_DEFAULT,
	partitionOperationRuns,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import { makeCompanionTaskRun } from '@/features/ewa/companionOperations/companionTaskRunFixtures';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

function run(id: string, status: string): EwaCompanionTaskRun {
	return makeCompanionTaskRun({
		id,
		status,
		intent_kind: 'image_generation_background',
		user_message: id,
	});
}

describe('partitionOperationRuns (U3.4)', () => {
	it('caps total visible rows by displayLimit', () => {
		const runs = Array.from({ length: 12 }, (_, i) =>
			run(`r${i}`, i === 0 ? 'running' : 'completed')
		);
		const { active, history } = partitionOperationRuns(runs, 5);
		expect(active.length + history.length).toBe(5);
	});

	it('defaults to OPERATIONS_DISPLAY_LIMIT_DEFAULT', () => {
		const runs = Array.from({ length: 12 }, (_, i) =>
			run(`r${i}`, 'completed')
		);
		const partitioned = partitionOperationRuns(runs);
		expect(partitioned.active.length + partitioned.history.length).toBe(
			OPERATIONS_DISPLAY_LIMIT_DEFAULT
		);
	});
});
