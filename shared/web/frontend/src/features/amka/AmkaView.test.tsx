/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for the AMKA cabinet run view (master plan, steps, destructive ops, AI child jobs).
 *
 * Invariants:
 * - Mocks mirror `useAmka` surface used by `AmkaView` (including core alignment query).
 * - Cabinet modules are stubbed via `marketingCabinetAmkaBridge` because `AmkaView` imports through it.
 *
 * Related:
 * - `./AmkaView`
 */
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
	return {
		runsQuery: {
			data: { items: [], total: 0 },
			isLoading: false,
			isError: false,
			error: null,
			refetch: vi.fn(),
		},
		detailQuery: {
			data: null,
			isLoading: false,
			isError: false,
			error: null,
			refetch: vi.fn(),
		},
		createMutation: { isPending: false, mutate: vi.fn() },
		approveMutation: { isPending: false, mutate: vi.fn() },
		resumeMutation: { isPending: false, mutate: vi.fn() },
		continueMutation: { isPending: false, mutate: vi.fn() },
		cancelMutation: { isPending: false, mutate: vi.fn() },
		coreAlignmentQuery: {
			data: null,
			isLoading: false,
			isError: false,
			error: null,
			refetch: vi.fn(),
		},
	};
});

function makeRun(
	overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
	return {
		id: 'run-1',
		project_id: 'project-1',
		company_id: 'company-1',
		created_by_user_id: 'user-1',
		scope_key: 'all_visible',
		status: 'awaiting_approval',
		current_stage: 'approval',
		progress: 30,
		progress_message: 'plan ready',
		master_plan_summary: 'Master plan summary',
		master_plan: [
			{
				step_key: 'execute_segments',
				section_key: 'segments',
				title: 'Segments stage',
				rationale: 'Need stronger segment coverage',
				depends_on: ['jtbd'],
				write_policy: 'apply_if_empty',
				autofill_targets: ['segments'],
				operations: [
					{
						operation_key: 'op-segment-1',
						kind: 'replace',
						entity_type: 'segment',
						entity_id: 'segment-1',
						title: 'Replace ICP segment',
						reason: 'Current segment is too generic',
						destructive: true,
						source_refs: [
							{ type: 'imc_run', id: 'run-1', title: 'IMC segment audit' },
						],
					},
				],
			},
		],
		final_summary_markdown: null,
		final_assessment: {},
		metrics_before: {},
		metrics_after: {},
		error_payload: {},
		approved_at: null,
		started_at: null,
		completed_at: null,
		created_at: '2026-04-14T12:00:00Z',
		updated_at: '2026-04-14T12:05:00Z',
		...overrides,
	};
}

function makeStep(
	overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
	return {
		id: 'step-1',
		run_id: 'run-1',
		ordinal: 1,
		stage_kind: 'section_audit',
		section_key: 'overview',
		title: 'Overview audit',
		status: 'completed',
		plan_payload: {},
		report_markdown: 'Audit report text',
		report_payload: {},
		applied_entities: [{ title: 'Saved alert' }],
		operation_trail: [],
		metrics_before: {},
		metrics_after: {},
		error_payload: {},
		created_at: null,
		updated_at: null,
		started_at: null,
		completed_at: null,
		...overrides,
	};
}

function setMocks(options?: {
	run?: Record<string, unknown>;
	steps?: Record<string, unknown>[];
	pollAfterMs?: number;
}) {
	const run = options?.run ?? makeRun();
	const steps = options?.steps ?? [makeStep()];
	hoisted.runsQuery.data = { items: [run as never], total: 1 };
	hoisted.detailQuery.data = {
		run: run as never,
		steps: steps as never,
		poll_after_ms: options?.pollAfterMs ?? 4000,
	} as never;
}

vi.mock('@/hooks/api/useAmka', () => ({
	useAmkaRuns: () => hoisted.runsQuery,
	useAmkaRunDetail: () => hoisted.detailQuery,
	useAmkaPresetTemplates: () => ({
		data: { items: [], total: 0 },
		isLoading: false,
		isError: false,
		error: null,
		refetch: vi.fn(),
	}),
	useAmkaPresets: () => ({
		data: { items: [], total: 0 },
		isLoading: false,
		isError: false,
		error: null,
		refetch: vi.fn(),
		isFetching: false,
	}),
	useCreateAmkaRun: () => hoisted.createMutation,
	useApproveAmkaRun: () => hoisted.approveMutation,
	useResumeAmkaRun: () => hoisted.resumeMutation,
	useContinueAmkaStep: () => hoisted.continueMutation,
	useCancelAmkaRun: () => hoisted.cancelMutation,
	useAmkaCoreAlignment: () => hoisted.coreAlignmentQuery,
}));

vi.mock('@/notifications', () => ({
	useNotifications: () => ({
		success: vi.fn(),
		error: vi.fn(),
	}),
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) => {
			if (params?.defaultValue) return String(params.defaultValue);
			if (params?.progress) return `Done: ${params.progress}%`;
			if (params?.value) return String(params.value);
			return key;
		},
	}),
}));

vi.mock('@/pages/Desktop/components/DesktopAppChrome', () => ({
	DESKTOP_CHROME_FOCUS_VISIBLE: '',
	DesktopAppButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{props.children}
		</button>
	),
	DesktopAppInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
		<input {...props} />
	),
	DesktopAppEmptyState: ({
		title,
		description,
	}: {
		title: string;
		description: string;
	}) => (
		<div>
			<div>{title}</div>
			<div>{description}</div>
		</div>
	),
	DesktopAppErrorState: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock(
	'@/services/amka/marketingCabinetAmkaBridge',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('@/services/amka/marketingCabinetAmkaBridge')
			>();
		return {
			...actual,
			extractApiErrorMessage: () => 'error',
			openDesktopApp: vi.fn(),
			ImcResearchResultMarkdown: ({ markdown }: { markdown: string }) => (
				<div>{markdown}</div>
			),
			SectionPanel: ({
				title,
				actions,
				children,
			}: {
				title: string;
				actions?: React.ReactNode;
				children: React.ReactNode;
			}) => (
				<section>
					<h2>{title}</h2>
					{actions}
					{children}
				</section>
			),
			EmptyProjectState: ({
				title,
				description,
			}: {
				title: string;
				description: string;
			}) => (
				<div>
					<div>{title}</div>
					<div>{description}</div>
				</div>
			),
			marketingCabinetApi: {
				...actual.marketingCabinetApi,
				exportAmkaRunMarkdown: vi.fn().mockResolvedValue('# AMKA export mock'),
			},
		};
	}
);

vi.mock('@/hooks/api/useImcResearch', () => ({
	useImcTypes: () => ({
		data: { types: [{ type_key: 'imc_rag_jtbd', display_name: 'JTBD RAG' }] },
		isLoading: false,
	}),
}));

import { AmkaView } from './AmkaView';

describe('AmkaView', () => {
	beforeEach(() => {
		setMocks();
	});

	it('renders master plan, step report, approve action, timeline and destructive banner', () => {
		render(
			<AmkaView selectedProjectId="project-1" selectedCompanyId="company-1" />
		);

		expect(
			screen.getByRole('region', { name: 'amkaView.timelineAria' })
		).toBeInTheDocument();
		expect(
			screen.getByText('amkaView.destructiveApprovalBannerTitle')
		).toBeInTheDocument();
		expect(screen.getByText('Segments stage')).toBeInTheDocument();
		expect(screen.getByText('Audit report text')).toBeInTheDocument();
		expect(screen.getByText('Saved alert')).toBeInTheDocument();
		expect(screen.getByText('Replace ICP segment')).toBeInTheDocument();
		expect(
			screen.getAllByText('amkaView.pendingOperationsTitle').length
		).toBeGreaterThan(0);
		expect(screen.getByText('amkaView.approveButton')).toBeInTheDocument();
	});

	it('shows plan source and child AI jobs with link to AI Job Center', () => {
		setMocks({
			run: makeRun({ plan_source: 'llm' }),
			steps: [
				makeStep({
					id: 'step-exec',
					ordinal: 3,
					stage_kind: 'execute_section',
					section_key: 'analysis',
					title: 'Analysis stage',
					status: 'running',
					report_markdown: null,
					applied_entities: [],
					report_payload: {
						child_jobs: [
							{
								kind: 'marketing_ai_run',
								external_id: 'child-run-uuid',
								target_section: 'swot',
								status: 'processing',
							},
						],
					},
				}),
			],
		});

		const openStudio = vi.fn();
		render(
			<AmkaView
				selectedProjectId="project-1"
				selectedCompanyId="company-1"
				onOpenAiStudio={openStudio}
			/>
		);

		expect(screen.getByText('amkaView.planSourceLabel')).toBeInTheDocument();
		expect(
			screen.getAllByText('amkaView.planSourceLlm').length
		).toBeGreaterThan(0);
		expect(screen.getByText('amkaView.childJobsTitle')).toBeInTheDocument();
		expect(screen.getByText('child-run-uuid')).toBeInTheDocument();
		const linkBtn = screen.getByText('amkaView.openAiStudio');
		linkBtn.click();
		expect(openStudio).toHaveBeenCalledTimes(1);
	});

	it('shows IMC type key for execute step details', () => {
		setMocks({
			steps: [
				makeStep({
					id: 'step-imc',
					ordinal: 4,
					stage_kind: 'execute_section',
					section_key: 'imc',
					title: 'IMC stage',
					status: 'completed',
					plan_payload: { imc_type_key: 'imc_rag_swot' },
					report_markdown: 'IMC report',
					applied_entities: [],
				}),
			],
		});

		render(
			<AmkaView selectedProjectId="project-1" selectedCompanyId="company-1" />
		);

		expect(
			screen.getByText('amkaView.imcTypeKeyStepLabel')
		).toBeInTheDocument();
		expect(screen.getByText('imc_rag_swot')).toBeInTheDocument();
	});

	it('selects newly started run in history without manual pick', () => {
		const oldRun = makeRun({
			id: 'run-old',
			status: 'completed',
			created_at: '2026-06-02T01:52:00Z',
		});
		hoisted.runsQuery.data = { items: [oldRun as never], total: 1 };
		hoisted.detailQuery.data = {
			run: oldRun as never,
			steps: [],
			poll_after_ms: 4000,
		} as never;
		hoisted.createMutation.mutate.mockImplementation(
			(_payload, options?: { onSuccess?: (data: unknown) => void }) => {
				const newRun = makeRun({
					id: 'run-new',
					status: 'running',
					created_at: '2026-06-06T02:01:00Z',
					run_mode: 'auto',
				});
				hoisted.runsQuery.data = {
					items: [newRun as never, oldRun as never],
					total: 2,
				};
				hoisted.detailQuery.data = {
					run: newRun as never,
					steps: [],
					poll_after_ms: 2000,
				} as never;
				options?.onSuccess?.({
					run: newRun,
					poll_after_ms: 2000,
				});
			}
		);

		const { container } = render(
			<AmkaView selectedProjectId="project-1" selectedCompanyId="company-1" />
		);

		screen.getByText('amkaView.startButton').click();

		const historyButtons = container.querySelectorAll(
			'section button[type="button"]'
		);
		const newRunButton = [...historyButtons].find((node) =>
			node.className.includes('border-(--desktop-border-strong)')
		);
		expect(newRunButton).toBeTruthy();
		expect(hoisted.createMutation.mutate).toHaveBeenCalled();
	});

	it('starts audit with auto run mode by default', () => {
		hoisted.runsQuery.data = { items: [], total: 0 };
		hoisted.detailQuery.data = null;
		hoisted.createMutation.mutate.mockClear();

		render(
			<AmkaView selectedProjectId="project-1" selectedCompanyId="company-1" />
		);

		expect(
			screen.getByRole('radio', { name: 'amkaView.runModeAuto' })
		).toHaveAttribute('aria-checked', 'true');
		screen.getByText('amkaView.startButton').click();
		expect(hoisted.createMutation.mutate).toHaveBeenCalledWith(
			expect.objectContaining({
				project_id: 'project-1',
				company_id: 'company-1',
				run_mode: 'auto',
				auto_cycle_count: 1,
			}),
			expect.any(Object)
		);
	});

	it('renders run error, final metrics, and failed step details', () => {
		setMocks({
			run: makeRun({
				status: 'failed',
				error_payload: {
					stage: 'execution',
					message: 'LLM timeout during execution.',
				},
				final_assessment: {
					readiness_score: 71,
					strategy_integrity_score: 66,
					completed_steps_count: 4,
					gaps_count: 2,
				},
				approved_at: '2026-04-14T12:06:00Z',
				started_at: '2026-04-14T12:07:00Z',
				completed_at: '2026-04-14T12:20:00Z',
			}),
			steps: [
				makeStep({
					id: 'step-failed',
					status: 'failed',
					report_markdown: null,
					applied_entities: [],
					operation_trail: [
						{
							kind: 'replace',
							entity_type: 'task',
							entity_id: 'task-1',
							title: 'Replace generated task',
							destructive: true,
							before_snapshot: { title: 'Old task' },
							after_snapshot: { title: 'New task' },
							source_refs: [
								{
									type: 'unified_content',
									id: 'doc-1',
									title: 'Research brief',
								},
							],
							result: { mutated_entity_ids: ['task-2'] },
						},
					],
					metrics_after: { applied_count: 3 },
					error_payload: {
						stage: 'execute_section',
						message: 'Could not save generated tasks.',
					},
					started_at: '2026-04-14T12:08:00Z',
					completed_at: '2026-04-14T12:10:00Z',
				}),
			],
		});

		render(
			<AmkaView selectedProjectId="project-1" selectedCompanyId="company-1" />
		);

		expect(screen.getByText('amkaView.runErrorTitle')).toBeInTheDocument();
		expect(
			screen.getAllByText('LLM timeout during execution.').length
		).toBeGreaterThan(0);
		expect(
			screen.getByText('amkaView.finalAssessmentTitle')
		).toBeInTheDocument();
		expect(screen.getByText('71%')).toBeInTheDocument();
		expect(screen.getByText('66%')).toBeInTheDocument();
		expect(
			screen.getAllByText('Could not save generated tasks.').length
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText('amkaView.stepErrorTitle').length
		).toBeGreaterThan(0);
		expect(
			screen.getByText('amkaView.operationTrailTitle')
		).toBeInTheDocument();
		expect(screen.getByText('Replace generated task')).toBeInTheDocument();
	});
});
