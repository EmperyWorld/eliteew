/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query, local state, and action handlers for the UGS Workflows tab shell.
 *
 * Invariants:
 * - Open execution history polls via React Query (15s active / 30s idle when auto-refresh on) with a panel cap.
 * - Log tags stay `UGSWorkflowsTab` for continuity with existing operator logs.
 *
 * Related:
 * - UGSWorkflowsTab.tsx
 * - ugsWorkflowsFilterUtils.ts
 * - services/api/ugs/ugsWorkflowExecutionPolling.ts
 */

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { createAPIClient } from '../../../services/api/client';
import { ugsQueryKeys } from '../../../services/api/ugs/queryKeys';
import {
	UGS_WORKFLOWS_POLL_MS,
	ugsComfyuiProviderStatusQueryOptions,
	ugsWorkflowExecutionsQueryOptions,
	ugsWorkflowsQueryOptions,
} from '../../../services/api/ugsQueryOptions';
import {
	toggleWorkflowExecutionPanelState,
	ugsWorkflowExecutionsPollIntervalMs,
} from '../../../services/api/ugs/ugsWorkflowExecutionPolling';
import type { NavigationHandler } from '../../../types/navigation';
import { log } from '../../../utils/logger';
import type {
	ErrorResponse,
	ExecuteResponse,
	ExecuteWorkflowResult,
	ExecutionsPayload,
	ProviderRuntimeStatus,
	QuickExecuteFormState,
	UGSWorkflowsTabToast,
	WorkflowDetailsPayload,
	WorkflowExecutionRecord,
	WorkflowRecord,
	WorkflowsPayload,
} from './types';
import {
	DEFAULT_QUICK_EXECUTE_FORM,
	formatRuntimeError,
	getErrorDetail,
	normalizeExecutionList,
	normalizeExecutionTotal,
	normalizeWorkflowList,
} from './utils';
import {
	collectWorkflowProjectIds,
	filterAndSortWorkflows,
	type UgsWorkflowsSortBy,
	workflowsFiltersApplied,
} from './ugsWorkflowsFilterUtils';

export interface UseUgsWorkflowsTabControllerArgs {
	onNavigate?: NavigationHandler;
	ugsClient: ReturnType<typeof createAPIClient>;
	toast: UGSWorkflowsTabToast;
}

export function useUgsWorkflowsTabController({
	onNavigate: _onNavigate,
	ugsClient,
	toast,
}: UseUgsWorkflowsTabControllerArgs) {
	const { t } = useTranslation('ugsHub');
	const queryClient = useQueryClient();
	const [searchQuery, setSearchQuery] = useState('');
	const [showExecutions, setShowExecutions] = useState<Record<string, boolean>>(
		{}
	);

	const [filterPublic, setFilterPublic] = useState<string>('all');
	const [filterProject, setFilterProject] = useState<string>('all');
	const [sortBy, setSortBy] = useState<UgsWorkflowsSortBy>('date');

	const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
	const [quickExecuteWorkflow, setQuickExecuteWorkflow] =
		useState<WorkflowRecord | null>(null);
	const [quickExecuteSubmitting, setQuickExecuteSubmitting] = useState(false);
	const [quickExecuteError, setQuickExecuteError] = useState<string | null>(
		null
	);
	const [quickExecuteForm, setQuickExecuteForm] =
		useState<QuickExecuteFormState>(DEFAULT_QUICK_EXECUTE_FORM);

	const workflowsQuery = useQuery({
		...ugsWorkflowsQueryOptions(async (): Promise<WorkflowRecord[]> => {
			const response = await ugsClient.get<WorkflowsPayload>('/workflows');
			return normalizeWorkflowList(response.data);
		}),
		refetchInterval: autoRefreshEnabled ? UGS_WORKFLOWS_POLL_MS : false,
	});

	const comfyuiStatusQuery = useQuery({
		...ugsComfyuiProviderStatusQueryOptions(
			async (): Promise<ProviderRuntimeStatus | null> => {
				try {
					const response = await ugsClient.get<ProviderRuntimeStatus>(
						'/providers/comfyui/status'
					);
					return response.data ?? null;
				} catch {
					return null;
				}
			}
		),
		refetchInterval: autoRefreshEnabled ? UGS_WORKFLOWS_POLL_MS : false,
	});

	const workflows = workflowsQuery.data ?? [];
	const comfyuiStatus = comfyuiStatusQuery.data ?? null;
	const loading = workflowsQuery.isLoading;
	const isRefreshing = workflowsQuery.isFetching && !workflowsQuery.isLoading;

	useEffect(() => {
		if (!workflowsQuery.error) {
			return;
		}
		const err = workflowsQuery.error;
		const errText = err instanceof Error ? err.message : String(err);
		log.error(
			'UGSWorkflowsTab',
			`Failed to load workflows: ${errText}`,
			err instanceof Error ? err : undefined
		);
		toast.error(
			getErrorDetail(workflowsQuery.error as ErrorResponse) ||
				errText ||
				t('workflows.toastLoadFailed')
		);
	}, [t, toast, workflowsQuery.error]);

	const openExecutionIds = useMemo(
		() =>
			Object.entries(showExecutions)
				.filter(([, isOpen]) => isOpen)
				.map(([workflowId]) => workflowId),
		[showExecutions]
	);

	const executionQueries = useQueries({
		queries: openExecutionIds.map((workflowId) => ({
			...ugsWorkflowExecutionsQueryOptions(
				workflowId,
				async (): Promise<{
					executions: WorkflowExecutionRecord[];
					total: number;
				}> => {
					try {
						const encodedWorkflowId = encodeURIComponent(workflowId);
						const response = await ugsClient.get<ExecutionsPayload>(
							`/workflows/${encodedWorkflowId}/executions?limit=5`
						);
						const list = normalizeExecutionList(response.data).map(
							(execution) => ({
								...execution,
								id: execution.id || execution.execution_id || '',
							})
						);
						const total = normalizeExecutionTotal(response.data);
						return { executions: list, total: total ?? list.length };
					} catch {
						log.warn(
							'UGSWorkflowsTab',
							`Executions endpoint not available (workflowId=${workflowId})`
						);
						return { executions: [], total: 0 };
					}
				}
			),
			refetchInterval: autoRefreshEnabled
				? (query) =>
						ugsWorkflowExecutionsPollIntervalMs(
							query.state.data?.executions,
							autoRefreshEnabled
						)
				: false,
		})),
	});

	const executionStateByWorkflowId = useMemo(() => {
		const map = new Map<
			string,
			{ executions: WorkflowExecutionRecord[]; total: number }
		>();
		openExecutionIds.forEach((workflowId, index) => {
			const query = executionQueries[index];
			if (query?.data) {
				map.set(workflowId, query.data);
			}
		});
		return map;
	}, [executionQueries, openExecutionIds]);

	const handleRefresh = useCallback(async (): Promise<void> => {
		await Promise.all([workflowsQuery.refetch(), comfyuiStatusQuery.refetch()]);
	}, [comfyuiStatusQuery, workflowsQuery]);

	const toggleExecutions = useCallback((workflowId: string): void => {
		setShowExecutions((prev) =>
			toggleWorkflowExecutionPanelState(prev, workflowId)
		);
	}, []);

	const filteredWorkflows = useMemo(
		() =>
			filterAndSortWorkflows(workflows, {
				searchQuery,
				filterPublic,
				filterProject,
				sortBy,
			}),
		[workflows, searchQuery, filterPublic, filterProject, sortBy]
	);

	const availableProjects = useMemo(
		() => collectWorkflowProjectIds(workflows),
		[workflows]
	);

	const filtersApplied = workflowsFiltersApplied({
		searchQuery,
		filterPublic,
		filterProject,
	});

	const resetWorkflowFilters = useCallback((): void => {
		setSearchQuery('');
		setFilterPublic('all');
		setFilterProject('all');
	}, []);

	const handleDelete = (workflowId: string): void => {
		toast.action(
			t('workflows.toastDeleteConfirm'),
			{
				label: t('workflows.toastDeleteLabel'),
				onClick: async () => {
					try {
						await ugsClient.delete(
							`/workflows/${encodeURIComponent(workflowId)}`
						);
						toast.success(t('workflows.toastDeleted'));
						await queryClient.invalidateQueries({
							queryKey: ugsQueryKeys.workflows(),
						});
					} catch (error: unknown) {
						toast.error(
							getErrorDetail(error as ErrorResponse) ||
								t('workflows.toastDeleteError')
						);
					}
				},
			},
			t('workflows.toastDeleteDetail')
		);
	};

	const executeWorkflowRequest = async (
		workflowId: string,
		inputData: Record<string, unknown> = {}
	): Promise<ExecuteWorkflowResult> => {
		try {
			const encodedWorkflowId = encodeURIComponent(workflowId);
			const response = await ugsClient.post<ExecuteResponse>(
				`/workflows/${encodedWorkflowId}/execute`,
				{
					execution_name: `Execution ${new Date().toLocaleString()}`,
					trigger_type: 'manual',
					input_data: inputData,
				}
			);
			const executionId =
				response.data.execution_id ||
				response.data.request_id ||
				response.data.id ||
				'N/A';
			const statusLabel =
				response.data.status === 'queued'
					? t('workflows.toastQueued')
					: t('workflows.toastStarted');
			toast.success(
				statusLabel,
				t('workflows.toastExecutionId', { id: executionId })
			);
			setShowExecutions((prev) => ({ ...prev, [workflowId]: true }));
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ugsQueryKeys.workflows() }),
				queryClient.invalidateQueries({
					queryKey: ugsQueryKeys.workflowExecutions(workflowId),
				}),
			]);
			return { success: true };
		} catch (error: unknown) {
			const err = error as ErrorResponse;
			const errorMessage =
				formatRuntimeError(t, getErrorDetail(err)) ||
				getErrorDetail(err) ||
				t('workflows.toastExecuteError');
			toast.error(errorMessage);
			return { success: false, errorMessage };
		}
	};

	const handleExecute = async (workflow: WorkflowRecord): Promise<void> => {
		if (
			workflow.workflow_source === 'comfyui_catalog' &&
			workflow.execution_mode === 'quick_prompt'
		) {
			setQuickExecuteWorkflow(workflow);
			setQuickExecuteError(null);
			setQuickExecuteForm(DEFAULT_QUICK_EXECUTE_FORM);
			return;
		}

		await executeWorkflowRequest(workflow.id);
	};

	const closeQuickExecuteModal = (): void => {
		if (quickExecuteSubmitting) return;
		setQuickExecuteWorkflow(null);
		setQuickExecuteError(null);
	};

	const submitQuickExecute = async (): Promise<void> => {
		if (!quickExecuteWorkflow) return;
		if (comfyuiStatus && !comfyuiStatus.available) {
			const errorMessage =
				formatRuntimeError(t, comfyuiStatus.error) ||
				t('workflows.toastComfyUnavailable');
			setQuickExecuteError(errorMessage);
			toast.error(errorMessage);
			return;
		}
		if (!quickExecuteForm.prompt.trim()) {
			toast.error(t('workflows.toastPromptRequired'));
			return;
		}

		setQuickExecuteSubmitting(true);
		setQuickExecuteError(null);
		try {
			const result = await executeWorkflowRequest(quickExecuteWorkflow.id, {
				prompt: quickExecuteForm.prompt.trim(),
				negative_prompt: quickExecuteForm.negative_prompt.trim(),
				width: Number.parseInt(quickExecuteForm.width, 10) || 1024,
				height: Number.parseInt(quickExecuteForm.height, 10) || 1024,
				...(quickExecuteForm.seed.trim()
					? { seed: Number.parseInt(quickExecuteForm.seed, 10) || undefined }
					: {}),
			});
			if (result.success) {
				setQuickExecuteWorkflow(null);
				setQuickExecuteError(null);
			} else {
				setQuickExecuteError(
					result.errorMessage || t('workflows.toastExecuteError')
				);
			}
		} finally {
			setQuickExecuteSubmitting(false);
		}
	};

	const handleDuplicate = async (workflow: WorkflowRecord): Promise<void> => {
		try {
			await ugsClient.post(
				`/workflows/${encodeURIComponent(workflow.id)}/duplicate`,
				{
					new_name: `${workflow.workflow_name} ${t('workflows.toastCopyNameSuffix')}`,
					description: workflow.description,
				}
			);
			toast.success(t('workflows.toastDuplicated'));
			await queryClient.invalidateQueries({
				queryKey: ugsQueryKeys.workflows(),
			});
		} catch (error: unknown) {
			toast.error(
				getErrorDetail(error as ErrorResponse) ||
					t('workflows.toastDuplicateError')
			);
		}
	};

	const handleExport = async (workflow: WorkflowRecord): Promise<void> => {
		try {
			const detail = workflow.workflow_data
				? workflow
				: (
						await ugsClient.get<WorkflowDetailsPayload>(
							`/workflows/${encodeURIComponent(workflow.id)}`
						)
					).data;
			const resolvedWorkflow = Array.isArray(detail)
				? workflow
				: 'workflow' in detail && detail.workflow
					? detail.workflow
					: detail;

			const exportData = {
				workflow_name: resolvedWorkflow.workflow_name,
				description: resolvedWorkflow.description,
				workflow_data: resolvedWorkflow.workflow_data,
				exported_at: new Date().toISOString(),
				version: '1.0',
			};
			const blob = new Blob([JSON.stringify(exportData, null, 2)], {
				type: 'application/json',
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${workflow.workflow_name.replace(/\s+/g, '_')}.json`;
			a.click();
			URL.revokeObjectURL(url);
			toast.success(t('workflows.toastExported'));
		} catch (error: unknown) {
			toast.error(
				getErrorDetail(error as ErrorResponse) ||
					t('workflows.toastExportError')
			);
		}
	};

	const handleImport = (): void => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;
			try {
				const text = await file.text();
				const data = JSON.parse(text) as {
					workflow_name?: string;
					workflow_data?: unknown;
					description?: string;
				};
				if (!data.workflow_name || !data.workflow_data) {
					toast.error(t('workflows.toastImportInvalid'));
					return;
				}
				await ugsClient.post('/workflows', {
					workflow_name: data.workflow_name,
					description: data.description || '',
					workflow_data: data.workflow_data,
				});
				toast.success(t('workflows.toastImported'));
				await queryClient.invalidateQueries({
					queryKey: ugsQueryKeys.workflows(),
				});
			} catch (error: unknown) {
				toast.error(
					getErrorDetail(error as ErrorResponse) ||
						t('workflows.toastImportError')
				);
			}
		};
		input.click();
	};

	const patchQuickExecuteForm = useCallback(
		(patch: Partial<QuickExecuteFormState>): void => {
			setQuickExecuteForm((prev) => ({ ...prev, ...patch }));
		},
		[]
	);

	const toggleAutoRefresh = useCallback((): void => {
		setAutoRefreshEnabled((prev) => !prev);
	}, []);

	return {
		workflowsQuery,
		workflows,
		comfyuiStatus,
		loading,
		isRefreshing,
		autoRefreshEnabled,
		toggleAutoRefresh,
		searchQuery,
		setSearchQuery,
		filterPublic,
		setFilterPublic,
		filterProject,
		setFilterProject,
		sortBy,
		setSortBy,
		filteredWorkflows,
		availableProjects,
		filtersApplied,
		resetWorkflowFilters,
		showExecutions,
		executionStateByWorkflowId,
		handleRefresh,
		handleImport,
		handleExecute,
		handleDuplicate,
		handleExport,
		handleDelete,
		toggleExecutions,
		quickExecuteWorkflow,
		quickExecuteForm,
		quickExecuteError,
		quickExecuteSubmitting,
		closeQuickExecuteModal,
		submitQuickExecute,
		patchQuickExecuteForm,
	};
}

export type UgsWorkflowsTabController = ReturnType<
	typeof useUgsWorkflowsTabController
>;
