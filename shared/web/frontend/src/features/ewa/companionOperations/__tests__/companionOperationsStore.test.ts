/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for companion operations Zustand store merges and selectors.
 *
 * Invariants:
 * - applyRunsUpdater and mergePolledRuns respect OPERATIONS_STORE_CAP via UI helpers.
 *
 * Related:
 * - companionOperationsStore.ts
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
	selectLiveActiveRunIdSet,
	selectTranscriptProgressItems,
	useCompanionOperationsStore,
	useTranscriptProgressItems,
} from '@/features/ewa/companionOperations/companionOperationsStore';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';
import type { TFunction } from 'i18next';

function makeRun(
	id: string,
	status: string,
	overrides: Partial<EwaCompanionTaskRun> = {}
): EwaCompanionTaskRun {
	return {
		id,
		principal_id: 'p1',
		status,
		intent_kind: 'test',
		user_message: '',
		plan_payload: {},
		confirmation_state: {},
		result_payload: {},
		error_payload: {},
		execution_mode: 'sync',
		created_at: null,
		updated_at: null,
		completed_at: null,
		run_revision: 1,
		...overrides,
	};
}

describe('companionOperationsStore', () => {
	beforeEach(() => {
		useCompanionOperationsStore.getState().reset();
	});

	it('applyRunsUpdater merges via operation run helpers', () => {
		const run = makeRun('run-a', 'running');
		useCompanionOperationsStore.getState().setOperationRuns([run]);
		useCompanionOperationsStore
			.getState()
			.applyRunsUpdater((prev) =>
				prev.map((row) =>
					row.id === 'run-a' ? { ...row, status: 'completed' } : row
				)
			);
		expect(
			useCompanionOperationsStore.getState().operationRuns[0]?.status
		).toBe('completed');
	});

	it('mergePolledRuns replaces known rows and appends new ones', () => {
		useCompanionOperationsStore
			.getState()
			.setOperationRuns([makeRun('run-a', 'running')]);
		useCompanionOperationsStore
			.getState()
			.mergePolledRuns([
				makeRun('run-a', 'completed'),
				makeRun('run-b', 'pending'),
			]);
		const ids = useCompanionOperationsStore
			.getState()
			.operationRuns.map((row) => row.id);
		expect(ids).toContain('run-a');
		expect(ids).toContain('run-b');
		const runA = useCompanionOperationsStore
			.getState()
			.operationRuns.find((row) => row.id === 'run-a');
		expect(runA?.status).toBe('completed');
	});

	it('skips store notify when polled snapshot is unchanged', () => {
		const run = makeRun('run-a', 'running');
		useCompanionOperationsStore.getState().setOperationRuns([run]);
		const before = useCompanionOperationsStore.getState().operationRuns;
		useCompanionOperationsStore.getState().mergePolledRuns([run]);
		const after = useCompanionOperationsStore.getState().operationRuns;
		expect(after).toBe(before);
	});

	it('mergePolledRuns refreshes when error_payload changes without revision bump', () => {
		const failed = makeRun('run-a', 'failed', {
			run_revision: 3,
			error_payload: { message: 'step_missing_tool_name' },
		});
		useCompanionOperationsStore.getState().setOperationRuns([failed]);
		const before = useCompanionOperationsStore.getState().operationRuns;
		useCompanionOperationsStore.getState().mergePolledRuns([
			makeRun('run-a', 'failed', {
				run_revision: 3,
				updated_at: '2026-07-06T23:06:15Z',
				error_payload: {
					message: 'plan_tool_args_invalid:document_extractor',
				},
			}),
		]);
		const after = useCompanionOperationsStore.getState().operationRuns;
		expect(after).not.toBe(before);
		expect(after[0]?.error_payload?.message).toContain(
			'plan_tool_args_invalid'
		);
	});

	it('mergePolledRuns refreshes when confirmation_state changes without revision bump', () => {
		const awaiting = makeRun('run-a', 'awaiting_confirmation', {
			run_revision: 3,
			confirmation_state: { state: 'confirming', prompt: 'old prompt' },
		});
		useCompanionOperationsStore.getState().setOperationRuns([awaiting]);
		const before = useCompanionOperationsStore.getState().operationRuns;
		useCompanionOperationsStore.getState().mergePolledRuns([
			makeRun('run-a', 'awaiting_confirmation', {
				run_revision: 3,
				confirmation_state: { state: 'confirming', prompt: 'new prompt' },
			}),
		]);
		const after = useCompanionOperationsStore.getState().operationRuns;
		expect(after).not.toBe(before);
		expect(after[0]?.confirmation_state?.prompt).toBe('new prompt');
	});

	it('mergePolledRuns refreshes when steps change without revision bump', () => {
		const running = makeRun('run-a', 'running', {
			run_revision: 3,
			steps: [
				{
					id: 'step-1',
					run_id: 'run-a',
					step_index: 0,
					step_kind: 'agentic_node',
					title: 'Plan',
					status: 'running',
					input_payload: {},
					output_payload: {},
					error_payload: {},
					created_at: null,
					updated_at: null,
					completed_at: null,
				},
			],
		});
		useCompanionOperationsStore.getState().setOperationRuns([running]);
		const before = useCompanionOperationsStore.getState().operationRuns;
		useCompanionOperationsStore.getState().mergePolledRuns([
			makeRun('run-a', 'running', {
				run_revision: 3,
				steps: [
					...(running.steps ?? []),
					{
						id: 'step-2',
						run_id: 'run-a',
						step_index: 1,
						step_kind: 'agentic_node',
						title: 'Write',
						status: 'pending',
						input_payload: {},
						output_payload: {},
						error_payload: {},
						created_at: null,
						updated_at: null,
						completed_at: null,
					},
				],
			}),
		]);
		const after = useCompanionOperationsStore.getState().operationRuns;
		expect(after).not.toBe(before);
		expect(after[0]?.steps).toHaveLength(2);
	});

	it('selectLiveActiveRunIdSet tracks active statuses only', () => {
		useCompanionOperationsStore
			.getState()
			.setOperationRuns([
				makeRun('active', 'running'),
				makeRun('done', 'completed'),
			]);
		const active = selectLiveActiveRunIdSet(
			useCompanionOperationsStore.getState()
		);
		expect([...active]).toEqual(['active']);
	});

	it('caches derived progress snapshots for React external-store reads', () => {
		const t = ((key: string, fallback?: string) =>
			fallback ?? key) as TFunction<'marketing'>;
		useCompanionOperationsStore.getState().setOperationRuns([
			makeRun('agentic-active', 'running', {
				intent_kind: 'agentic_session',
				user_message: '/agent',
				plan_payload: {
					kind: 'agentic_session_v1',
					session_status: 'executing',
					plan_summary: 'Debug EWA',
					agentic_session_id: 'session-1',
				},
			}),
		]);

		const state = useCompanionOperationsStore.getState();
		const first = selectTranscriptProgressItems(state, t);
		expect(selectTranscriptProgressItems(state, t)).toBe(first);

		const { result, rerender } = renderHook(() =>
			useTranscriptProgressItems(t)
		);
		const hookFirst = result.current;
		rerender();

		expect(result.current).toBe(hookFirst);
		expect(hookFirst[0]).toMatchObject({
			runId: 'agentic-active',
			intentKind: 'agentic_session',
			status: 'active',
		});
	});
});
