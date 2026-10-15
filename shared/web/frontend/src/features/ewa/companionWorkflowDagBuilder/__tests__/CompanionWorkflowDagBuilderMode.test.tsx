/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Covers honest empty-canvas behavior in the visual workflow builder shell.
 *
 * Invariants:
 * - React Flow is mocked at its package boundary; builder state remains real.
 *
 * Related:
 * - ../CompanionWorkflowDagBuilderMode.tsx
 */

import { render, screen, waitFor } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionWorkflowDagBuilderMode } from '@/features/ewa/companionWorkflowDagBuilder/CompanionWorkflowDagBuilderMode';
import {
	getCompanionUserWorkflow,
	type CompanionUserWorkflow,
} from '@/services/ewa/companionUserWorkflowsApi';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) =>
			key === 'ewaCompanion.workflowDag.emptyCanvas'
				? 'Start with a node'
				: key,
		i18n: { language: 'en' },
	}),
}));

vi.mock('@xyflow/react', () => ({
	ReactFlowProvider: ({ children }: { children: ReactNode }) => children,
	useNodesState: (initial: unknown[]) => {
		const [value, setValue] = useState(initial);
		return [value, setValue, vi.fn()];
	},
	useEdgesState: (initial: unknown[]) => {
		const [value, setValue] = useState(initial);
		return [value, setValue, vi.fn()];
	},
	useReactFlow: () => ({ screenToFlowPosition: (point: unknown) => point }),
	applyNodeChanges: (_changes: unknown, nodes: unknown) => nodes,
	applyEdgeChanges: (_changes: unknown, edges: unknown) => edges,
	addEdge: (edge: unknown, edges: unknown[]) => [...edges, edge],
}));

vi.mock(
	'@/features/ewa/companionWorkflowDagBuilder/canvas/CompanionDagCanvas',
	() => ({
		CompanionDagCanvas: () => <div data-testid="mock-dag-canvas" />,
	})
);
vi.mock(
	'@/features/ewa/companionWorkflowDagBuilder/panels/DagInspectorPanel',
	() => ({
		DagInspectorPanel: () => null,
	})
);
vi.mock(
	'@/features/ewa/companionWorkflowDagBuilder/panels/DagNodePalette',
	() => ({
		DagNodePalette: () => <div data-testid="mock-node-palette" />,
	})
);
vi.mock(
	'@/features/ewa/companionWorkflowDagBuilder/panels/DagPresetsPanel',
	() => ({
		DagPresetsPanel: () => null,
	})
);
vi.mock(
	'@/features/ewa/companionWorkflowDagBuilder/panels/DagPickerController',
	() => ({
		DagPickerController: () => null,
	})
);
vi.mock('@/notifications', () => ({
	useNotifications: () => ({
		notify: {
			success: vi.fn(),
			error: vi.fn(),
			warning: vi.fn(),
		},
	}),
}));

vi.mock('@/services/ewa/companionUserWorkflowsApi', async () => {
	const actual = await vi.importActual<
		typeof import('@/services/ewa/companionUserWorkflowsApi')
	>('@/services/ewa/companionUserWorkflowsApi');
	return { ...actual, getCompanionUserWorkflow: vi.fn() };
});

const mockedGetWorkflow = vi.mocked(getCompanionUserWorkflow);

const dagWorkflow: CompanionUserWorkflow = {
	id: 'dag-1',
	principal_id: 'p-1',
	name: 'Morning',
	enabled: true,
	trigger_json: { type: 'phrase', patterns: ['start morning'] },
	definition_json: {
		schema_version: 2,
		workflow_id: 'dag-1',
		version: 1,
		title_ru: 'Morning',
		title_en: 'Morning',
		enabled: true,
		triggers: [{ type: 'regex', pattern: 'start morning' }],
		nodes: [
			{
				id: 'node-1',
				type: 'prompt_gen',
				mode: 'stateful',
				title_ru: 'Prompt',
				title_en: 'Prompt',
				config: {},
				inputs: { prompt: 'Hello' },
				outputs: { text: 'text' },
			},
		],
		edges: [],
	},
	version: 1,
	created_at: null,
	updated_at: null,
};

describe('CompanionWorkflowDagBuilderMode', () => {
	it('renders the empty canvas overlay before nodes are added', () => {
		render(
			<CompanionWorkflowDagBuilderMode
				onSaved={vi.fn()}
				onBackToChat={vi.fn()}
				onExitToWorkflows={vi.fn()}
			/>
		);

		expect(screen.getByTestId('mock-dag-canvas')).toBeInTheDocument();
		expect(screen.getByTestId('ewa-dag-canvas-empty')).toHaveTextContent(
			'Start with a node'
		);
	});

	it('loads a DAG duplicate as a named copy without an edit id', async () => {
		mockedGetWorkflow.mockResolvedValueOnce(dagWorkflow);
		render(
			<CompanionWorkflowDagBuilderMode
				duplicateFromId="dag-1"
				onSaved={vi.fn()}
				onBackToChat={vi.fn()}
				onExitToWorkflows={vi.fn()}
			/>
		);

		await waitFor(() => {
			expect(screen.getByDisplayValue('Morning (copy)')).toBeInTheDocument();
		});
		expect(mockedGetWorkflow).toHaveBeenCalledWith('dag-1');
	});

	it('returns to workflow list when a linear workflow cannot open in DAG builder', async () => {
		mockedGetWorkflow.mockResolvedValueOnce({
			...dagWorkflow,
			definition_json: { steps: [] },
		});
		const onExitToWorkflows = vi.fn();
		render(
			<CompanionWorkflowDagBuilderMode
				workflowId="linear-1"
				onSaved={vi.fn()}
				onBackToChat={vi.fn()}
				onExitToWorkflows={onExitToWorkflows}
			/>
		);

		await waitFor(() => {
			expect(onExitToWorkflows).toHaveBeenCalled();
		});
	});

	it('prefers edit mode when edit and duplicate ids conflict', async () => {
		mockedGetWorkflow.mockResolvedValueOnce(dagWorkflow);
		render(
			<CompanionWorkflowDagBuilderMode
				workflowId="dag-1"
				duplicateFromId="other-dag"
				onSaved={vi.fn()}
				onBackToChat={vi.fn()}
				onExitToWorkflows={vi.fn()}
			/>
		);

		await waitFor(() => {
			expect(screen.getByDisplayValue('Morning')).toBeInTheDocument();
		});
		expect(
			screen.queryByDisplayValue('Morning (copy)')
		).not.toBeInTheDocument();
		expect(mockedGetWorkflow).toHaveBeenLastCalledWith('dag-1');
	});

	it('shows an inline retry action when loading fails', async () => {
		mockedGetWorkflow.mockRejectedValueOnce(new Error('offline'));
		render(
			<CompanionWorkflowDagBuilderMode
				workflowId="dag-offline"
				onSaved={vi.fn()}
				onBackToChat={vi.fn()}
				onExitToWorkflows={vi.fn()}
			/>
		);

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'ewaCompanion.workflowDag.loadErrorTitle'
		);
		expect(
			screen.getByRole('button', { name: 'ewaCompanion.workflowDag.retry' })
		).toBeInTheDocument();
	});
});
