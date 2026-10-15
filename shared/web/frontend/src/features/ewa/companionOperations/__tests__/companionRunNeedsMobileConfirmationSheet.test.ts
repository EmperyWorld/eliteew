/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for mobile confirmation sheet auto-open guard (U5.9).
 */

import { describe, expect, it } from 'vitest';

import { companionRunNeedsMobileConfirmationSheet } from '@/features/ewa/companionOperations/companionOperationsUi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

describe('companionRunNeedsMobileConfirmationSheet', () => {
	it('returns true only for awaiting_confirmation', () => {
		expect(
			companionRunNeedsMobileConfirmationSheet({
				id: 'r1',
				status: 'awaiting_confirmation',
			} as EwaCompanionTaskRun)
		).toBe(true);
		expect(
			companionRunNeedsMobileConfirmationSheet({
				id: 'r2',
				status: 'running',
			} as EwaCompanionTaskRun)
		).toBe(false);
	});
});
