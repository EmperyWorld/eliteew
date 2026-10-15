/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for surface block payload parsers (U4.10–U4.13).
 *
 * Invariants:
 * - Malformed payload must not throw.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/companionSurfaceBlockPayload.ts
 */

import { describe, expect, it } from 'vitest';

import {
	companionSurfaceBlockBuilderSurface,
	parseCompanionSurfaceBlockChoices,
	parseCompanionSurfaceBlockHistoryRef,
	parseCompanionSurfaceBlockStepsSummary,
	parseCompanionSurfaceBlockText,
} from '@/features/ewa/companionOutputSurface/companionSurfaceBlockPayload';
import type { CompanionSurfaceBlock } from '@/services/ewa/ewaCompanionChatApi';

function block(
	kind: CompanionSurfaceBlock['kind'],
	payload: Record<string, unknown>
): CompanionSurfaceBlock {
	return {
		id: 'b1',
		kind,
		title: 'Title',
		payload,
		actions: [],
	};
}

describe('companionSurfaceBlockPayload', () => {
	it('parses localized text body', () => {
		expect(
			parseCompanionSurfaceBlockText(
				block('text', { text_ru: 'Подсказка', text_en: 'Hint' }),
				true
			)
		).toBe('Подсказка');
	});

	it('parses choice options with prompts', () => {
		const choices = parseCompanionSurfaceBlockChoices(
			block('choice', {
				choices: [
					{ id: 'a', label_ru: 'Вариант A', prompt: 'выбери A' },
					{ label_en: 'B only' },
				],
			}),
			false
		);
		expect(choices).toEqual([
			{ id: 'a', label: 'Вариант A', prompt: 'выбери A' },
			{ id: 'choice-1', label: 'B only', prompt: 'B only' },
		]);
	});

	it('builds visual workflow surface from payload refs', () => {
		const surface = companionSurfaceBlockBuilderSurface({
			workflowId: 'wf-1',
			seedTriggerPhrase: 'утро',
		});
		expect(surface).toEqual({
			mode: 'workflow_dag_builder',
			payload: { workflowId: 'wf-1', seedTriggerPhrase: 'утро' },
		});
	});

	it('parses history ref run id and label', () => {
		expect(
			parseCompanionSurfaceBlockHistoryRef(
				block('history_ref', {
					ref_run_id: 'run-old',
					label_en: 'Morning ritual',
				}),
				false
			)
		).toEqual({ runId: 'run-old', label: 'Morning ritual' });
	});

	it('summarizes workflow timeline steps from payload', () => {
		expect(
			parseCompanionSurfaceBlockStepsSummary(
				block('workflow_timeline', {
					steps: [
						{ status: 'completed' },
						{ status: 'running' },
						{ status: 'done' },
					],
				})
			)
		).toEqual({ total: 3, completed: 2 });
	});
});
