import { describe, expect, it } from 'vitest';

import {
	buildAmkaStepExportMetaLines,
	computeAmkaTimelineState,
	countAmkaPlanEnsembleTasks,
	findFirstFailedEnsembleStep,
	findFirstFailedStepIndex,
	formatAmkaEnsembleErrorForUi,
	resolveAmkaStepEnsembleMeta,
	resolveAmkaStepExecutionMode,
	summarizeAmkaEnsembleStepOutcomes,
	shouldShowAmkaEnsembleOutcomeSummary,
	truncateAmkaExportLine,
} from '@/features/amka/amkaViewUtils';

describe('computeAmkaTimelineState', () => {
	it('marks approval stage when awaiting_approval', () => {
		const { activeIndex } = computeAmkaTimelineState({
			status: 'awaiting_approval',
			current_stage: 'approval',
		});
		expect(activeIndex).toBe(1);
	});

	it('marks wrap_up when completed', () => {
		const { activeIndex } = computeAmkaTimelineState({
			status: 'completed',
			current_stage: 'done',
		});
		expect(activeIndex).toBe(3);
	});
});

describe('resolveAmkaStepEnsembleMeta', () => {
	it('reads heroes from nested ensemble_subset', () => {
		const meta = resolveAmkaStepEnsembleMeta({
			plan_payload: { execution_mode: 'desktop_ensemble' },
			report_payload: {
				mode: 'operations',
				execution_mode: 'desktop_ensemble',
				ensemble_subset: {
					mode: 'desktop_ensemble',
					heroes: ['likiy_sorrento', 'arlyqueen'],
					template_hint: 'research_plan_v1',
					elapsed_ms: 12_500,
				},
			},
		});
		expect(meta.isEnsembleStep).toBe(true);
		expect(meta.heroIds).toEqual(['likiy_sorrento', 'arlyqueen']);
		expect(meta.template).toBe('research_plan_v1');
		expect(meta.elapsedMs).toBe(12_500);
	});

	it('resolveAmkaStepExecutionMode prefers plan payload', () => {
		expect(
			resolveAmkaStepExecutionMode({
				plan_payload: { execution_mode: 'desktop_ensemble' },
				report_payload: { execution_mode: 'marketing_tool_agent' },
			})
		).toBe('desktop_ensemble');
	});

	it('findFirstFailedEnsembleStep returns failed ensemble step', () => {
		const hit = findFirstFailedEnsembleStep([
			{
				status: 'completed',
				ordinal: 1,
				title: 'Ok',
				plan_payload: { execution_mode: 'marketing_tool_agent' },
			},
			{
				status: 'failed',
				ordinal: 19,
				title: 'Evidence',
				plan_payload: { execution_mode: 'desktop_ensemble' },
			},
		]);
		expect(hit?.ordinal).toBe(19);
		expect(hit?.meta.isEnsembleStep).toBe(true);
	});

	it('findFirstFailedStepIndex and countAmkaPlanEnsembleTasks', () => {
		expect(
			findFirstFailedStepIndex([{ status: 'completed' }, { status: 'failed' }])
		).toBe(1);
		expect(
			countAmkaPlanEnsembleTasks([
				{ execution_mode: 'desktop_ensemble' },
				{ execution_mode: 'marketing_tool_agent' },
				{ execution_mode: 'desktop_ensemble' },
			])
		).toBe(2);
	});

	it('resolveAmkaStepEnsembleMeta reads report.error and step error_payload', () => {
		const meta = resolveAmkaStepEnsembleMeta({
			status: 'failed',
			plan_payload: { execution_mode: 'desktop_ensemble' },
			report_payload: {
				mode: 'desktop_ensemble',
				error: 'ensemble_empty_output',
			},
			error_payload: { message: 'ignored when report.error present' },
		});
		expect(meta.error).toBe('ensemble_empty_output');
		expect(meta.isEnsembleStep).toBe(true);
	});

	it('truncateAmkaExportLine caps long export errors', () => {
		const long = 'x'.repeat(500);
		expect(truncateAmkaExportLine(long)).toHaveLength(401);
		expect(truncateAmkaExportLine('short')).toBe('short');
	});

	it('shouldShowAmkaEnsembleOutcomeSummary hides zero-state before execute', () => {
		expect(
			shouldShowAmkaEnsembleOutcomeSummary(
				{
					planned: 3,
					completed: 0,
					fallback: 0,
					failed: 0,
					running: 0,
					pending: 3,
				},
				'awaiting_approval'
			)
		).toBe(false);
		expect(
			shouldShowAmkaEnsembleOutcomeSummary(
				{
					planned: 3,
					completed: 1,
					fallback: 0,
					failed: 0,
					running: 1,
					pending: 1,
				},
				'running'
			)
		).toBe(true);
	});

	it('summarizeAmkaEnsembleStepOutcomes aggregates completed, fallback, failed', () => {
		const outcomes = summarizeAmkaEnsembleStepOutcomes(
			[
				{
					status: 'completed',
					plan_payload: { execution_mode: 'desktop_ensemble' },
					report_payload: { mode: 'desktop_ensemble' },
					metrics_after: { ensemble_completed: true },
				},
				{
					status: 'completed',
					plan_payload: { execution_mode: 'desktop_ensemble' },
					report_payload: {
						mode: 'desktop_ensemble',
						ensemble_fallback: true,
					},
					metrics_after: { ensemble_fallback_to_tool_agent: true },
				},
				{
					status: 'failed',
					plan_payload: { execution_mode: 'desktop_ensemble' },
					error_payload: { message: 'boom' },
				},
				{
					status: 'running',
					plan_payload: { execution_mode: 'desktop_ensemble' },
				},
			],
			4
		);
		expect(outcomes).toEqual({
			planned: 4,
			completed: 1,
			fallback: 1,
			failed: 1,
			running: 1,
			pending: 0,
		});
	});

	it('buildAmkaStepExportMetaLines dedupes identical ensemble and step errors', () => {
		const lines = buildAmkaStepExportMetaLines({
			status: 'failed',
			plan_payload: { execution_mode: 'desktop_ensemble' },
			report_payload: {
				mode: 'desktop_ensemble',
				error: 'ensemble_empty_output',
			},
			error_payload: { message: 'ensemble_empty_output' },
		});
		expect(
			lines.filter((line) => line.includes('ensemble_empty_output'))
		).toHaveLength(1);
	});

	it('buildAmkaStepExportMetaLines and formatAmkaEnsembleErrorForUi', () => {
		const lines = buildAmkaStepExportMetaLines({
			status: 'failed',
			plan_payload: { execution_mode: 'desktop_ensemble' },
			report_payload: {
				mode: 'desktop_ensemble',
				heroes: ['likiy_sorrento'],
				ensemble_error: 'ensemble_empty_output',
				elapsed_ms: 45000,
			},
			error_payload: { message: 'step failed' },
			metrics_after: { ensemble_fallback_to_tool_agent: true },
		});
		expect(lines.some((line) => line.includes('ensemble_empty_output'))).toBe(
			true
		);
		expect(lines.some((line) => line.includes('~45 с'))).toBe(true);
		expect(lines.some((line) => line.includes('step failed'))).toBe(true);
		const label = formatAmkaEnsembleErrorForUi(
			(key, opts) =>
				key.endsWith('ensemble_empty_output')
					? 'empty doc'
					: (opts?.defaultValue ?? key),
			'ensemble_empty_output'
		);
		expect(label).toBe('empty doc');
	});
});
