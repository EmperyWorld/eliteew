/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component-level regression coverage for EWA companion workflow list surface accessibility states.
 *
 * Invariants:
 * - Loading and empty workflow list states remain polite status updates.
 * - Row action failures are announced as assertive alerts.
 *
 * Related:
 * - ../CompanionWorkflowEditMode
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompanionWorkflowEditMode } from '../CompanionWorkflowEditMode';
import {
	fetchCompanionUserWorkflowToolCatalog,
	listCompanionUserWorkflows,
	setCompanionUserWorkflowEnabled,
	type CompanionUserWorkflow,
} from '@/services/ewa/companionUserWorkflowsApi';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, string | number>) => {
			if (key === 'ewaCompanion.userWorkflowEditTitle') return 'My workflows';
			if (key === 'ewaCompanion.userWorkflowEditSubtitle')
				return `Saved: ${params?.count ?? ''}`;
			if (key === 'ewaCompanion.outputSurfaceBackToChat') return 'Back';
			if (key === 'ewaCompanion.userWorkflowEditNew') return 'Create';
			if (key === 'ewaCompanion.userWorkflowEditNewVisual')
				return 'New visual chain';
			if (key === 'ewaCompanion.userWorkflowEditLegacyReadOnly')
				return 'Legacy linear chain is read-only until rebuilt as a visual DAG chain.';
			if (key === 'ewaCompanion.userWorkflowEditEmptyVisualCta')
				return 'Start a visual chain';
			if (key === 'ewaCompanion.userWorkflowEditLoading') return 'Loading';
			if (key === 'ewaCompanion.userWorkflowEditEmpty')
				return 'No workflows yet';
			if (key === 'ewaCompanion.userWorkflowEditActionsAria')
				return 'Workflow actions';
			if (key === 'ewaCompanion.userWorkflowEditDisable') return 'Disable';
			if (key === 'ewaCompanion.userWorkflowEditEnable') return 'Enable';
			if (key === 'ewaCompanion.userWorkflowEditEdit') return 'Edit';
			if (key === 'ewaCompanion.userWorkflowEditDuplicate') return 'Duplicate';
			if (key === 'ewaCompanion.userWorkflowEditDelete') return 'Delete';
			if (key === 'ewaCompanion.userWorkflowEditEnabled') return 'Enabled';
			if (key === 'ewaCompanion.userWorkflowEditDisabled') return 'Disabled';
			if (key === 'ewaCompanion.userWorkflowEditTrigger')
				return `Trigger: ${params?.phrase ?? ''}`;
			if (key === 'ewaCompanion.userWorkflowEditStepsSummary')
				return `${params?.count ?? ''} steps: ${params?.summary ?? ''}`;
			if (key === 'ewaCompanion.userWorkflowEditActionFailed')
				return 'Could not update workflow';
			return key;
		},
		i18n: { language: 'en' },
	}),
}));

vi.mock('@/services/ewa/companionUserWorkflowsApi', async () => {
	const actual = await vi.importActual<
		typeof import('@/services/ewa/companionUserWorkflowsApi')
	>('@/services/ewa/companionUserWorkflowsApi');
	return {
		...actual,
		fetchCompanionUserWorkflowToolCatalog: vi.fn(),
		listCompanionUserWorkflows: vi.fn(),
		setCompanionUserWorkflowEnabled: vi.fn(),
		deleteCompanionUserWorkflow: vi.fn(),
	};
});

const mockedCatalog = vi.mocked(fetchCompanionUserWorkflowToolCatalog);
const mockedList = vi.mocked(listCompanionUserWorkflows);
const mockedToggle = vi.mocked(setCompanionUserWorkflowEnabled);

const workflow: CompanionUserWorkflow = {
	id: 'wf-1',
	principal_id: 'p1',
	name: 'Morning flow',
	enabled: true,
	trigger_json: { type: 'phrase', patterns: ['start morning'] },
	definition_json: {
		steps: [{ tool_name: 'music_generation', args_template: {} }],
	},
	version: 1,
	created_at: null,
	updated_at: null,
};

function renderMode() {
	return render(
		<CompanionWorkflowEditMode
			onBackToChat={vi.fn()}
			onDuplicateWorkflow={vi.fn()}
			onEditDagWorkflow={vi.fn()}
			onOpenDagBuilder={vi.fn()}
		/>
	);
}

describe('CompanionWorkflowEditMode', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedCatalog.mockResolvedValue([]);
	});

	it('announces loading and empty workflow list states politely', async () => {
		mockedList.mockResolvedValue([]);
		renderMode();

		expect(screen.getByRole('status')).toHaveTextContent('Loading');
		await waitFor(() => {
			expect(screen.getByRole('status')).toHaveTextContent('No workflows yet');
		});
		expect(
			screen.getByTestId('ewa-workflow-edit-new-visual')
		).toHaveTextContent('New visual chain');
		expect(
			screen.getByTestId('ewa-workflow-edit-empty-visual')
		).toHaveTextContent('Start a visual chain');
	});

	it('announces row action failures assertively', async () => {
		mockedList.mockResolvedValue([workflow]);
		mockedToggle.mockRejectedValueOnce(new Error('offline'));
		renderMode();

		await screen.findByText('Morning flow');
		fireEvent.click(screen.getByLabelText('Workflow actions'));
		fireEvent.click(screen.getByRole('menuitem', { name: 'Disable' }));

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveAttribute('aria-live', 'assertive');
		expect(alert).toHaveTextContent('Could not update workflow');
	});

	it('keeps legacy linear rows runnable but hides edit and duplicate actions', async () => {
		mockedList.mockResolvedValue([workflow]);
		renderMode();

		await screen.findByText('Morning flow');
		expect(
			screen.getByText(
				'Legacy linear chain is read-only until rebuilt as a visual DAG chain.'
			)
		).toBeInTheDocument();
		fireEvent.click(screen.getByLabelText('Workflow actions'));
		expect(
			screen.queryByRole('menuitem', { name: 'Edit' })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole('menuitem', { name: 'Duplicate' })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole('menuitem', { name: 'Disable' })
		).toBeInTheDocument();
		expect(
			screen.getByRole('menuitem', { name: 'Delete' })
		).toBeInTheDocument();
	});
});
