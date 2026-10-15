/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks the stable companionOperationsUi barrel import path after module decomposition.
 *
 * Invariants:
 * - Representative filter, mission, and progress symbols remain available from the barrel.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionOperationsUi.ts
 */

import { describe, expect, it } from 'vitest';

import {
	deriveMissionSurfaceBundles,
	deriveTranscriptProgressItems,
	partitionOperationRuns,
	type CompanionOperationUiStatus,
	type MissionSurfaceBundle,
} from '@/features/ewa/companionOperations/companionOperationsUi';

describe('companionOperationsUi barrel import chain', () => {
	it('re-exports filter, mission, and progress helpers', () => {
		const status: CompanionOperationUiStatus = 'pending';
		const bundle: MissionSurfaceBundle | null = null;

		expect(status).toBe('pending');
		expect(bundle).toBeNull();
		expect(partitionOperationRuns).toBeTypeOf('function');
		expect(deriveMissionSurfaceBundles).toBeTypeOf('function');
		expect(deriveTranscriptProgressItems).toBeTypeOf('function');
	});
});
