/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Operations view controller: React Query, CRUD mutations, form state, URL deep-link
 * filters, and sorted/display lists for tasks and alerts.
 *
 * Invariants:
 * - Public props/behavior match pre-atomization OperationsView.
 * - Queries run only for the active section (tasks vs alerts).
 *
 * Related:
 * - OperationsView.tsx
 * - OperationsTasksSection.tsx
 * - OperationsAlertsSection.tsx
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { marketingCabinetApi } from '../../marketingCabinetApi';
import {
	marketingCabinetAlertsQueryOptions,
	marketingCabinetProjectDashboardInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
	marketingCabinetTasksQueryOptions,
} from '../../marketingCabinetQueryOptions';
import {
	MC_OPS_ALERT_SEVERITY,
	MC_OPS_ALERT_STATUS,
	MC_OPS_TASK_PRIORITY,
	MC_OPS_TASK_STATUS,
} from '../../operationsDeepLink';
import { requireDefined } from '../../utils';
import {
	compareAlerts,
	compareTasks,
	initialAlertForm,
	initialTaskForm,
} from './operationsHelpers';
import type {
	AlertFormState,
	OperationsViewProps,
	TaskFormState,
} from './operationsTypes';
import type { MarketingAlert, MarketingTask } from '../../marketingCabinetApi';

export function useOperationsView({
	selectedProjectId,
	section,
	focusedEntityId = null,
	allowMarketingWrite = true,
}: OperationsViewProps) {
	const { t } = useTranslation('marketing');
	const uid = useId();
	const taskStatusOptions = [
		{ value: 'open', label: t('operationsView.tasks.taskStatus.open') },
		{
			value: 'in_progress',
			label: t('operationsView.tasks.taskStatus.in_progress'),
		},
		{ value: 'blocked', label: t('operationsView.tasks.taskStatus.blocked') },
		{
			value: 'completed',
			label: t('operationsView.tasks.taskStatus.completed'),
		},
	];
	const taskPriorityOptions = [
		{ value: 'low', label: t('operationsView.tasks.priority.low') },
		{ value: 'medium', label: t('operationsView.tasks.priority.medium') },
		{ value: 'high', label: t('operationsView.tasks.priority.high') },
		{ value: 'urgent', label: t('operationsView.tasks.priority.urgent') },
	];
	const alertSeverityOptions = [
		{ value: 'low', label: t('operationsView.alerts.severity.low') },
		{ value: 'medium', label: t('operationsView.alerts.severity.medium') },
		{ value: 'high', label: t('operationsView.alerts.severity.high') },
		{ value: 'critical', label: t('operationsView.alerts.severity.critical') },
	];
	const alertStatusOptions = [
		{ value: 'open', label: t('operationsView.alerts.status.open') },
		{
			value: 'acknowledged',
			label: t('operationsView.alerts.status.acknowledged'),
		},
		{ value: 'resolved', label: t('operationsView.alerts.status.resolved') },
	];
	const taskIds = {
		title: `${uid}-task-title`,
		description: `${uid}-task-desc`,
		status: `${uid}-task-status`,
		priority: `${uid}-task-priority`,
		owner: `${uid}-task-owner`,
		due: `${uid}-task-due`,
	};
	const alertIds = {
		title: `${uid}-alert-title`,
		description: `${uid}-alert-desc`,
		severity: `${uid}-alert-severity`,
		status: `${uid}-alert-status`,
		owner: `${uid}-alert-owner`,
	};
	const queryClient = useQueryClient();
	const [taskForm, setTaskForm] = useState<TaskFormState>(initialTaskForm);
	const [alertForm, setAlertForm] = useState<AlertFormState>(initialAlertForm);
	const [editingTask, setEditingTask] = useState<MarketingTask | null>(null);
	const [editingAlert, setEditingAlert] = useState<MarketingAlert | null>(null);

	const tasksQuery = useQuery({
		...marketingCabinetTasksQueryOptions(selectedProjectId),
		enabled: Boolean(selectedProjectId) && section === 'tasks',
	});
	const alertsQuery = useQuery({
		...marketingCabinetAlertsQueryOptions(selectedProjectId),
		enabled: Boolean(selectedProjectId) && section === 'alerts',
	});

	const createTaskMutation = useMutation({
		mutationFn: () =>
			marketingCabinetApi.createTask({
				project_id: requireDefined(selectedProjectId, 'selectedProjectId'),
				title: taskForm.title.trim(),
				description: taskForm.description.trim() || null,
				status: taskForm.status,
				priority: taskForm.priority,
				owner_name: taskForm.owner_name.trim() || null,
				due_at: taskForm.due_at || null,
			}),
		onSuccess: () => {
			setTaskForm(initialTaskForm);
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'tasks',
					selectedProjectId
				),
			});
			void queryClient.invalidateQueries({
				queryKey:
					marketingCabinetProjectDashboardInvalidationQueryKey(
						selectedProjectId
					),
			});
		},
	});
	const updateTaskMutation = useMutation({
		mutationFn: () => {
			if (!editingTask) throw new Error('Task not selected');
			return marketingCabinetApi.updateTask(editingTask.id, {
				title: taskForm.title.trim(),
				description: taskForm.description.trim() || null,
				status: taskForm.status,
				priority: taskForm.priority,
				owner_name: taskForm.owner_name.trim() || null,
				due_at: taskForm.due_at || null,
			});
		},
		onSuccess: () => {
			setEditingTask(null);
			setTaskForm(initialTaskForm);
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'tasks',
					selectedProjectId
				),
			});
			void queryClient.invalidateQueries({
				queryKey:
					marketingCabinetProjectDashboardInvalidationQueryKey(
						selectedProjectId
					),
			});
		},
	});
	const deleteTaskMutation = useMutation({
		mutationFn: (taskId: string) => marketingCabinetApi.deleteTask(taskId),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'tasks',
					selectedProjectId
				),
			});
			void queryClient.invalidateQueries({
				queryKey:
					marketingCabinetProjectDashboardInvalidationQueryKey(
						selectedProjectId
					),
			});
		},
	});

	const createAlertMutation = useMutation({
		mutationFn: () =>
			marketingCabinetApi.createAlert({
				project_id: requireDefined(selectedProjectId, 'selectedProjectId'),
				title: alertForm.title.trim(),
				description: alertForm.description.trim() || null,
				severity: alertForm.severity,
				status: alertForm.status,
				owner_name: alertForm.owner_name.trim() || null,
			}),
		onSuccess: () => {
			setAlertForm(initialAlertForm);
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'alerts',
					selectedProjectId
				),
			});
			void queryClient.invalidateQueries({
				queryKey:
					marketingCabinetProjectDashboardInvalidationQueryKey(
						selectedProjectId
					),
			});
		},
	});
	const updateAlertMutation = useMutation({
		mutationFn: () => {
			if (!editingAlert) throw new Error('Alert not selected');
			return marketingCabinetApi.updateAlert(editingAlert.id, {
				title: alertForm.title.trim(),
				description: alertForm.description.trim() || null,
				severity: alertForm.severity,
				status: alertForm.status,
				owner_name: alertForm.owner_name.trim() || null,
			});
		},
		onSuccess: () => {
			setEditingAlert(null);
			setAlertForm(initialAlertForm);
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'alerts',
					selectedProjectId
				),
			});
			void queryClient.invalidateQueries({
				queryKey:
					marketingCabinetProjectDashboardInvalidationQueryKey(
						selectedProjectId
					),
			});
		},
	});
	const deleteAlertMutation = useMutation({
		mutationFn: (alertId: string) => marketingCabinetApi.deleteAlert(alertId),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'alerts',
					selectedProjectId
				),
			});
			void queryClient.invalidateQueries({
				queryKey:
					marketingCabinetProjectDashboardInvalidationQueryKey(
						selectedProjectId
					),
			});
		},
	});

	const taskItems = tasksQuery.data?.items ?? [];
	const tasksTotal = tasksQuery.data?.total ?? taskItems.length;
	const tasksTruncated = tasksTotal > taskItems.length;
	const sortedTasks = useMemo(
		() => [...taskItems].sort(compareTasks),
		[taskItems]
	);
	const alertItems = alertsQuery.data?.items ?? [];
	const alertsTotal = alertsQuery.data?.total ?? alertItems.length;
	const alertsTruncated = alertsTotal > alertItems.length;
	const sortedAlerts = useMemo(
		() => [...alertItems].sort(compareAlerts),
		[alertItems]
	);

	const [opsUrlTick, setOpsUrlTick] = useState(0);
	useLayoutEffect(() => {
		setOpsUrlTick((n) => n + 1);
	}, []);

	const dashboardDeepFilters = useMemo(() => {
		void opsUrlTick;
		if (typeof window === 'undefined') {
			return {
				taskStatus: '',
				taskPriority: '',
				alertStatus: '',
				alertSeverity: '',
			};
		}
		const p = new URLSearchParams(window.location.search);
		return {
			taskStatus: p.get(MC_OPS_TASK_STATUS)?.trim() ?? '',
			taskPriority: p.get(MC_OPS_TASK_PRIORITY)?.trim() ?? '',
			alertStatus: p.get(MC_OPS_ALERT_STATUS)?.trim() ?? '',
			alertSeverity: p.get(MC_OPS_ALERT_SEVERITY)?.trim() ?? '',
		};
	}, [opsUrlTick]);

	const displayTasks = useMemo(() => {
		let r = sortedTasks;
		if (
			!dashboardDeepFilters.taskStatus &&
			!dashboardDeepFilters.taskPriority
		) {
			return r;
		}
		if (dashboardDeepFilters.taskStatus) {
			r = r.filter(
				(x) =>
					String(x.status || '').toLowerCase() ===
					dashboardDeepFilters.taskStatus.toLowerCase()
			);
		}
		if (dashboardDeepFilters.taskPriority) {
			r = r.filter(
				(x) =>
					String(x.priority || '').toLowerCase() ===
					dashboardDeepFilters.taskPriority.toLowerCase()
			);
		}
		return r;
	}, [
		sortedTasks,
		dashboardDeepFilters.taskStatus,
		dashboardDeepFilters.taskPriority,
	]);

	const displayAlerts = useMemo(() => {
		let r = sortedAlerts;
		if (
			!dashboardDeepFilters.alertStatus &&
			!dashboardDeepFilters.alertSeverity
		) {
			return r;
		}
		if (dashboardDeepFilters.alertStatus) {
			r = r.filter(
				(x) =>
					String(x.status || '').toLowerCase() ===
					dashboardDeepFilters.alertStatus.toLowerCase()
			);
		}
		if (dashboardDeepFilters.alertSeverity) {
			r = r.filter(
				(x) =>
					String(x.severity || '').toLowerCase() ===
					dashboardDeepFilters.alertSeverity.toLowerCase()
			);
		}
		return r;
	}, [
		sortedAlerts,
		dashboardDeepFilters.alertStatus,
		dashboardDeepFilters.alertSeverity,
	]);

	useEffect(() => {
		if (!focusedEntityId) return;
		const element = document.querySelector(
			`[data-marketing-entity-id="${focusedEntityId}"]`
		);
		if (element instanceof HTMLElement) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}, [focusedEntityId]);

	return {
		t,
		selectedProjectId,
		focusedEntityId,
		allowMarketingWrite,
		taskStatusOptions,
		taskPriorityOptions,
		alertSeverityOptions,
		alertStatusOptions,
		taskIds,
		alertIds,
		taskForm,
		setTaskForm,
		alertForm,
		setAlertForm,
		editingTask,
		setEditingTask,
		editingAlert,
		setEditingAlert,
		tasksQuery,
		alertsQuery,
		createTaskMutation,
		updateTaskMutation,
		deleteTaskMutation,
		createAlertMutation,
		updateAlertMutation,
		deleteAlertMutation,
		taskItems,
		tasksTotal,
		tasksTruncated,
		sortedTasks,
		alertItems,
		alertsTotal,
		alertsTruncated,
		sortedAlerts,
		displayTasks,
		displayAlerts,
	};
}

export type OperationsViewController = ReturnType<typeof useOperationsView>;
