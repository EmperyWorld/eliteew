/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Status-aware step icons — completed never uses animated processing.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionStepKindVisual.ts
 */

import { describe, expect, it } from 'vitest';

import { companionStepKindIcon } from '@/features/ewa/companionOperations/companionStepKindVisual';

describe('companionStepKindIcon', () => {
	it('uses static success glyph for completed steps', () => {
		expect(companionStepKindIcon('call_expert_chat', 'completed')).toBe(
			'icon-success'
		);
		expect(companionStepKindIcon('file_create', 'done')).toBe('icon-success');
	});

	it('uses error glyph for failed steps', () => {
		expect(companionStepKindIcon('llm_summarize', 'failed')).toBe('icon-error');
	});

	it('maps thematic icons while in flight', () => {
		expect(companionStepKindIcon('call_expert_chat', 'running')).toBe(
			'icon-ewa-brain'
		);
		expect(companionStepKindIcon('unknown_tool', 'running')).toBe(
			'icon-processing'
		);
	});
});
