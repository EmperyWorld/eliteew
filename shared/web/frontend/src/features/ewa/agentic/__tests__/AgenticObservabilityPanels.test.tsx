/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for agentic Operations observability panels. Locks malformed trace/tree payloads to empty UI
 * states instead of Desktop error-boundary crashes.
 *
 * Invariants:
 * - Missing `nodes` / `checkpoints` arrays degrade to empty panels.
 *
 * Related:
 * - src/features/ewa/agentic/AgenticTaskTreePanel.tsx
 * - src/features/ewa/agentic/AgenticExecutionTrace.tsx
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgenticExecutionTrace } from '@/features/ewa/agentic/AgenticExecutionTrace';
import { AgenticTaskTreePanel } from '@/features/ewa/agentic/AgenticTaskTreePanel';
import { AGENTIC_OBSERVABILITY_POLL_MS } from '@/features/ewa/agentic/agenticObservabilityActive';

const fetchTreeMock = vi.hoisted(() => vi.fn());
const fetchTraceMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/ewa/agentic/agenticTraceApi', async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import('@/features/ewa/agentic/agenticTraceApi')
		>();
	return {
		...actual,
		fetchAgenticSessionTree: fetchTreeMock,
		fetchAgenticSessionTrace: fetchTraceMock,
	};
});

describe('Agentic observability panels', () => {
	beforeEach(() => {
		fetchTreeMock.mockReset();
		fetchTraceMock.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders empty task-tree state when tree payload has no nodes array', async () => {
		fetchTreeMock.mockResolvedValueOnce({ session_id: 'sess-1' });
		fetchTraceMock.mockResolvedValueOnce({
			session_id: 'sess-1',
			checkpoints: [],
		});

		render(
			<AgenticTaskTreePanel sessionId="sess-1" sessionStatus="completed" />
		);

		expect(
			await screen.findByText(
				/План ещё не построен|Подробные шаги|Mission plan is not ready|steps.*not saved|did not save/i
			)
		).toBeInTheDocument();
	});

	it('renders empty trace state when trace payload has no checkpoints array', async () => {
		fetchTraceMock.mockResolvedValueOnce({ session_id: 'sess-1' });

		render(
			<AgenticExecutionTrace sessionId="sess-1" sessionStatus="completed" />
		);

		expect(
			await screen.findByText(
				/Пока нет шагов|Журнал выполнения пуст|Execution log is empty/i
			)
		).toBeInTheDocument();
	});

	it('polls tree while session is executing and stops when terminal', async () => {
		vi.useFakeTimers();
		fetchTreeMock.mockResolvedValue({
			session_id: 'sess-1',
			nodes: [
				{
					id: 'n1',
					node_kind: 'act',
					status: 'running',
					title: 'Step',
					tool_name: null,
					sort_order: 0,
					materialized_path: '/n1',
				},
			],
		});
		fetchTraceMock.mockResolvedValue({ session_id: 'sess-1', checkpoints: [] });

		const { rerender } = render(
			<AgenticTaskTreePanel sessionId="sess-1" sessionStatus="executing" />
		);

		await act(async () => {
			await Promise.resolve();
		});
		expect(fetchTreeMock).toHaveBeenCalledTimes(1);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(AGENTIC_OBSERVABILITY_POLL_MS);
		});
		expect(fetchTreeMock).toHaveBeenCalledTimes(2);

		rerender(
			<AgenticTaskTreePanel sessionId="sess-1" sessionStatus="completed" />
		);
		await act(async () => {
			await Promise.resolve();
		});
		const afterTerminal = fetchTreeMock.mock.calls.length;

		await act(async () => {
			await vi.advanceTimersByTimeAsync(AGENTIC_OBSERVABILITY_POLL_MS * 2);
		});
		expect(fetchTreeMock).toHaveBeenCalledTimes(afterTerminal);
	});

	it('opens DocEditor when a completed file_create step is clicked', async () => {
		const onOpenDocEditor = vi.fn();
		fetchTreeMock.mockResolvedValueOnce({
			session_id: 'sess-1',
			nodes: [
				{
					id: 'n-file',
					node_kind: 'act',
					status: 'completed',
					title: 'Создание документа',
					tool_name: 'file_create',
					sort_order: 0,
					materialized_path: '/n-file',
				},
			],
		});
		fetchTraceMock.mockResolvedValueOnce({
			session_id: 'sess-1',
			checkpoints: [
				{
					seq: 3,
					node_id: 'n-file',
					kind: 'act',
					payload_json: {
						tool: 'file_create',
						status: 'ok',
						summary: 'Готова: создала документ «market.md»',
						created_unified_content_id: 'uc-market',
						document_name: 'market.md',
					},
				},
			],
		});

		render(
			<AgenticTaskTreePanel
				sessionId="sess-1"
				sessionStatus="completed"
				onOpenDocEditor={onOpenDocEditor}
			/>
		);

		const step = await screen.findByRole('button', {
			name: /Создание документа/i,
		});
		await act(async () => {
			step.click();
		});
		expect(onOpenDocEditor).toHaveBeenCalledWith('uc-market');
		expect(
			await screen.findByText(/market\.md|Готова: создала документ/i)
		).toBeInTheDocument();
	});

	it('hides observe ticks and collapses research_plan dumps to laconic journal lines', async () => {
		fetchTraceMock.mockResolvedValueOnce({
			session_id: 'sess-1',
			checkpoints: [
				{
					seq: 1,
					node_id: null,
					kind: 'observe',
					payload_json: { summary: 'tick iter=1' },
				},
				{
					seq: 2,
					node_id: null,
					kind: 'state_transition',
					payload_json: { summary: '' },
				},
				{
					seq: 3,
					node_id: 'n1',
					kind: 'act',
					payload_json: {
						summary: '## Фокус\n\n**Контекст решения**\n\n- пункт один',
					},
				},
			],
		});

		render(
			<AgenticExecutionTrace sessionId="sess-1" sessionStatus="completed" />
		);

		expect(
			await screen.findByText(/Экспертное исследование завершено/i)
		).toBeInTheDocument();
		expect(screen.queryByText(/Контекст решения/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/tick iter/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/^##\s*Фокус/)).not.toBeInTheDocument();
		expect(screen.queryByText(/#3|#5/)).not.toBeInTheDocument();
	});
});
