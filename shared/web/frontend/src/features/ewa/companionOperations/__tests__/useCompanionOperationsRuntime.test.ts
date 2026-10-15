/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock — operations runtime registers bridge handlers once and survives
 * parent callback identity churn without remount.
 *
 * Invariants:
 * - getCompanionOperationsRuntimeHandlers stays populated across rerenders.
 *
 * Related:
 * - useCompanionOperationsRuntime.ts
 * - companionOperationsRuntimeBridge.ts
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	clearCompanionOperationsRuntimeHandlers,
	getCompanionOperationsRuntimeHandlers,
} from '@/features/ewa/companionOperations/companionOperationsRuntimeBridge';
import { useCompanionOperationsStore } from '@/features/ewa/companionOperations/companionOperationsStore';
import { useCompanionOperationsRuntime } from '@/features/ewa/companionOperations/useCompanionOperationsRuntime';
import {
	listEwaCompanionTaskRuns,
	type EwaCompanionTaskRun,
} from '@/services/ewa/ewaCompanionChatApi';

vi.mock(
	'@/features/ewa/companionOperations/useCompanionTaskEventsStream',
	() => ({
		useCompanionTaskEventsStream: vi.fn(),
	})
);

vi.mock('@/services/ewa/ewaCompanionChatApi', () => ({
	listEwaCompanionTaskRuns: vi.fn(async () => []),
	cancelEwaCompanionTaskRun: vi.fn(),
	confirmEwaCompanionTaskRun: vi.fn(),
	coerceCompanionActions: vi.fn(() => []),
	coerceTaskRunListRow: vi.fn(),
	isCompanionTaskRunRevisionConflictError: vi.fn(() => false),
}));

const t = ((key: string) => key) as never;

function makeRun(
	id: string,
	status = 'running',
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

function makeRuntimeProps(
	overrides: Partial<Parameters<typeof useCompanionOperationsRuntime>[0]> = {}
) {
	return {
		pollEnabled: true,
		isDesktopWindowActive: true,
		notifyError: vi.fn(),
		notifySuccess: vi.fn(),
		t,
		onDispatchActions: vi.fn(),
		onNewActiveRun: vi.fn(),
		...overrides,
	};
}

describe('useCompanionOperationsRuntime', () => {
	beforeEach(() => {
		clearCompanionOperationsRuntimeHandlers();
		useCompanionOperationsStore.getState().reset();
		vi.clearAllMocks();
	});

	it('registers bridge handlers once and forwards refresh after parent rerender', async () => {
		const first = makeRuntimeProps();
		const { rerender } = renderHook(
			(props: ReturnType<typeof makeRuntimeProps>) =>
				useCompanionOperationsRuntime(props),
			{ initialProps: first }
		);

		const handlersAfterMount = getCompanionOperationsRuntimeHandlers();
		expect(handlersAfterMount?.refreshOperationRuns).toBeTypeOf('function');

		rerender(
			makeRuntimeProps({
				onDispatchActions: vi.fn(),
				onNewActiveRun: vi.fn(),
				notifyError: vi.fn(),
			})
		);

		const handlersAfterRerender = getCompanionOperationsRuntimeHandlers();
		expect(handlersAfterRerender).toBe(handlersAfterMount);

		await expect(
			handlersAfterRerender?.refreshOperationRuns({ silent: true })
		).resolves.toBeUndefined();
	});

	it('keeps the poll loop stable across store updates and parent rerenders', async () => {
		vi.mocked(listEwaCompanionTaskRuns).mockResolvedValue([makeRun('run-a')]);
		const first = makeRuntimeProps();
		const { rerender } = renderHook(
			(props: ReturnType<typeof makeRuntimeProps>) =>
				useCompanionOperationsRuntime(props),
			{ initialProps: first }
		);

		await waitFor(() => {
			expect(listEwaCompanionTaskRuns).toHaveBeenCalledTimes(1);
		});

		act(() => {
			useCompanionOperationsStore
				.getState()
				.setOperationRuns([makeRun('run-a')]);
		});
		rerender(
			makeRuntimeProps({
				onDispatchActions: vi.fn(),
				onNewActiveRun: vi.fn(),
				notifyError: vi.fn(),
			})
		);

		expect(listEwaCompanionTaskRuns).toHaveBeenCalledTimes(1);
	});

	it('requests includeSteps on operations list poll', async () => {
		vi.mocked(listEwaCompanionTaskRuns).mockResolvedValue([makeRun('run-a')]);
		renderHook(() => useCompanionOperationsRuntime(makeRuntimeProps()));

		await waitFor(() => {
			expect(listEwaCompanionTaskRuns).toHaveBeenCalled();
		});

		expect(listEwaCompanionTaskRuns).toHaveBeenCalledWith(
			expect.any(Number),
			expect.objectContaining({
				includeSteps: true,
				listProfile: 'summary',
			})
		);
	});

	it('schedules ≥5 min safety poll when active runs enable SSE-first mode', async () => {
		const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
		act(() => {
			useCompanionOperationsStore
				.getState()
				.setOperationRuns([makeRun('run-a')]);
		});
		vi.mocked(listEwaCompanionTaskRuns).mockResolvedValue([makeRun('run-a')]);
		renderHook(() => useCompanionOperationsRuntime(makeRuntimeProps()));

		await waitFor(() => {
			expect(listEwaCompanionTaskRuns).toHaveBeenCalledTimes(1);
		});

		await waitFor(() => {
			expect(setTimeoutSpy.mock.calls.some((call) => call[1] === 300_000)).toBe(
				true
			);
		});

		setTimeoutSpy.mockRestore();
	});

	it('schedules idle poll ≥120s when desktop is active and no runs', async () => {
		const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
		vi.mocked(listEwaCompanionTaskRuns).mockResolvedValue([]);
		renderHook(() => useCompanionOperationsRuntime(makeRuntimeProps()));

		await waitFor(() => {
			expect(listEwaCompanionTaskRuns).toHaveBeenCalledTimes(1);
		});

		await waitFor(() => {
			expect(setTimeoutSpy.mock.calls.some((call) => call[1] === 120_000)).toBe(
				true
			);
		});

		setTimeoutSpy.mockRestore();
	});

	it('does not reschedule idle poll when desktop window is inactive', async () => {
		const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
		vi.mocked(listEwaCompanionTaskRuns).mockResolvedValue([]);
		renderHook(() =>
			useCompanionOperationsRuntime(
				makeRuntimeProps({ isDesktopWindowActive: false })
			)
		);

		await waitFor(() => {
			expect(listEwaCompanionTaskRuns).toHaveBeenCalledTimes(1);
		});

		await act(async () => {
			await Promise.resolve();
		});

		expect(setTimeoutSpy.mock.calls.some((call) => call[1] === 120_000)).toBe(
			false
		);

		setTimeoutSpy.mockRestore();
	});

	it('skips visibility refresh while the document is hidden', async () => {
		vi.mocked(listEwaCompanionTaskRuns).mockResolvedValue([makeRun('run-a')]);
		renderHook(() => useCompanionOperationsRuntime(makeRuntimeProps()));

		await waitFor(() => {
			expect(listEwaCompanionTaskRuns).toHaveBeenCalledTimes(1);
		});

		const visibilitySpy = vi
			.spyOn(document, 'visibilityState', 'get')
			.mockReturnValue('hidden');
		act(() => {
			document.dispatchEvent(new Event('visibilitychange'));
		});
		expect(listEwaCompanionTaskRuns).toHaveBeenCalledTimes(1);
		visibilitySpy.mockRestore();
	});

	it('ignores stale refresh responses after a newer request', async () => {
		vi.mocked(listEwaCompanionTaskRuns).mockResolvedValue([]);
		renderHook(() =>
			useCompanionOperationsRuntime(makeRuntimeProps({ pollEnabled: false }))
		);

		// pollEnabled=false: no mount poll loop; refresh is manual via bridge handlers only.
		await waitFor(() => {
			expect(
				getCompanionOperationsRuntimeHandlers()?.refreshOperationRuns
			).toBeTypeOf('function');
		});
		vi.mocked(listEwaCompanionTaskRuns).mockClear();

		let resolveFirst: ((rows: EwaCompanionTaskRun[]) => void) | undefined;
		const first = new Promise<EwaCompanionTaskRun[]>((resolve) => {
			resolveFirst = resolve;
		});
		vi.mocked(listEwaCompanionTaskRuns)
			.mockImplementationOnce(() => first)
			.mockResolvedValueOnce([makeRun('run-new')]);

		const handlers = getCompanionOperationsRuntimeHandlers();
		expect(handlers?.refreshOperationRuns).toBeTypeOf('function');

		const stalePromise = handlers?.refreshOperationRuns({ silent: true });
		const latestPromise = handlers?.refreshOperationRuns({ silent: true });

		await waitFor(() => {
			expect(listEwaCompanionTaskRuns).toHaveBeenCalledTimes(2);
		});

		resolveFirst?.([makeRun('run-stale')]);
		await Promise.all([stalePromise, latestPromise]);

		await waitFor(() => {
			expect(
				useCompanionOperationsStore
					.getState()
					.operationRuns.some((r) => r.id === 'run-new')
			).toBe(true);
		});
		expect(
			useCompanionOperationsStore
				.getState()
				.operationRuns.some((r) => r.id === 'run-stale')
		).toBe(false);
		expect(useCompanionOperationsStore.getState().operationsRefreshing).toBe(
			false
		);
	});
});
