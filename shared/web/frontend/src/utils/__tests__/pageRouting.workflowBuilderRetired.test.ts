/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock the retired WorkflowBuilder route contract: legacy hashes must no-op
 * instead of resolving into an active shell page.
 *
 * Invariants:
 * - `workflow-builder` is not a valid `PageType` candidate after retirement.
 *
 * Related:
 * - src/utils/pageRouting.ts
 * - src/pages/Desktop/utils/desktopOnlyLegacyRoutes.ts
 */
import { describe, expect, it } from 'vitest';
import { isUgsLegacyPage } from '@/pages/Desktop/utils/desktopOnlyLegacyRoutes';
import { normalizePageCandidate } from '@/utils/pageRouting';

describe('WorkflowBuilder route retirement', () => {
	it('rejects workflow-builder during page normalization', () => {
		expect(normalizePageCandidate('workflow-builder')).toBeNull();
		expect(
			normalizePageCandidate('#workflow-builder?workflowId=wf-9')
		).toBeNull();
	});

	it('removes workflow-builder from legacy UGS handoff pages', () => {
		expect(isUgsLegacyPage('workflow-builder')).toBe(false);
		expect(isUgsLegacyPage('ugs-hub')).toBe(true);
	});
});
