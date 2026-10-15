/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks the visual workflow surface helper and output-surface import chain.
 *
 * Invariants:
 * - Visual builder navigation emits the workflow_dag_builder mode discriminator.
 *
 * Related:
 * - ../CompanionWorkflowEditMode.tsx
 * - ../CompanionOutputSurface.tsx
 */

import { describe, expect, it } from 'vitest';

import { CompanionOutputSurface } from '@/features/ewa/companionOutputSurface/CompanionOutputSurface';
import { workflowDagBuilderSurface } from '@/features/ewa/companionOutputSurface/CompanionWorkflowEditMode';

describe('workflowDagBuilderSurface import chain', () => {
	it('keeps the helper and output surface wired to the visual mode', () => {
		expect(CompanionOutputSurface).toBeTypeOf('function');
		expect(workflowDagBuilderSurface).toBeTypeOf('function');
		expect(workflowDagBuilderSurface('wf-1')).toEqual({
			mode: 'workflow_dag_builder',
			payload: { workflowId: 'wf-1' },
		});
		expect(
			workflowDagBuilderSurface(undefined, { duplicateFromId: 'wf-copy' })
		).toEqual({
			mode: 'workflow_dag_builder',
			payload: { duplicateFromId: 'wf-copy' },
		});
	});
});
