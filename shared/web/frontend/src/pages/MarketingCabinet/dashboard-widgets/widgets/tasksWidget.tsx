/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Marketing dashboard widget for task backlog overview with status/priority filters and optional virtualization.
 *
 * Invariants:
 * - Variable row heights are measured in virtual mode to reduce layout shifts while tasks update.
 * - Virtual rows use task ids as stable item keys.
 *
 * Related:
 * - src/pages/MarketingCabinet/dashboard-widgets/widgets/alertsWidget.tsx
 */
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { MarketingCabinetSelect } from '@/pages/MarketingCabinet/components/MarketingCabinetSelect';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowRightIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	MC_OPS_TASK_PRIORITY,
	MC_OPS_TASK_STATUS,
} from '../../operationsDeepLink';
import { localizePriority, localizeStatus } from '../../locales';
import type { MarketingTask } from '../../marketingCabinetApi';
import { marketingCabinetApi } from '../../marketingCabinetApi';
import { downloadDashboardListCsv } from '../dashboardListCsv';
import {
	DASHBOARD_LIST_ROW_SHELL_FOCUS_WITHIN,
	DASHBOARD_WIDGET_TOOLBAR_META_CLASS,
	dashboardListItemMetaClass,
} from '../desktopListTokens';
import {
	parseSortSelectValue,
	sortSelectValue,
} from '../dashboardWidgetListSort';
import { MC_DASHBOARD_NO_DRAG_CLASS } from '../TileChrome';
import type { MarketingDashboardWidgetBodyProps } from '../widgetBodyProps';
import type { MarketingWidgetConfig } from '../types';

import { DASHBOARD_LIST_VIRTUAL_THRESHOLD } from './dashboardListVirtualThreshold';
import {
	marketingCabinetProjectDashboardInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
} from '../../marketingCabinetQueryOptions';

const DEFAULT_MAX_ITEMS = 4;
const MAX_ITEMS_CAP = 500;

function listLimit(
	widgetConfig: MarketingDashboardWidgetBodyProps['widgetConfig']
): number {
	const raw = widgetConfig.maxItems;
	if (typeof raw === 'number' && Number.isFinite(raw)) {
		const n = Math.trunc(raw);
		if (n >= 1) {
			return Math.min(n, MAX_ITEMS_CAP);
		}
	}
	return DEFAULT_MAX_ITEMS;
}

function TasksWidgetImpl(
	props: MarketingDashboardWidgetBodyProps
): React.ReactElement {
	const {
		dashboard,
		widget,
		widgetConfig,
		onNavigate,
		allowMarketingWrite,
		projectId,
		t,
		onPersistWidgetConfig,
	} = props;
	const { i18n } = useTranslation();
	const intlFmt = React.useMemo(() => {
		const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en';
		return {
			formatInt: (n: number) => new Intl.NumberFormat(lang).format(n),
			formatDateShort: (iso: string | null | undefined) => {
				if (!iso) return null;
				const ms = Date.parse(iso);
				if (!Number.isFinite(ms)) return null;
				return new Intl.DateTimeFormat(lang, { dateStyle: 'short' }).format(ms);
			},
		};
	}, [i18n.resolvedLanguage, i18n.language]);
	const queryClient = useQueryClient();
	const counts = dashboard.counts ?? {};
	const tasksTotal = counts.tasks ?? 0;
	const sliceMeta = dashboard.widget_list_slices?.[widget.id];
	const sliceTasks = sliceMeta?.tasks;
	const filteredListTotal = sliceMeta?.filtered_total;
	const recentTasks = sliceTasks ?? dashboard.tasks ?? [];
	const limit = listLimit(widgetConfig);
	const compact = widgetConfig.density === 'compact';
	const rows = recentTasks.slice(0, limit);

	const rawFilters = (widgetConfig.filters ?? {}) as Record<string, unknown>;
	const filterStatus = String(rawFilters.status ?? '');
	const filterPriority = String(rawFilters.priority ?? '');

	const mergePersist = React.useCallback(
		(patch: MarketingWidgetConfig) => {
			if (!onPersistWidgetConfig) return;
			void onPersistWidgetConfig({
				...(widget.widget_config as MarketingWidgetConfig),
				...patch,
			});
		},
		[onPersistWidgetConfig, widget.widget_config]
	);

	const setFilterStatus = React.useCallback(
		(next: string) => {
			const f = { ...rawFilters };
			if (next) f.status = next;
			else delete f.status;
			mergePersist({ filters: f });
		},
		[mergePersist, rawFilters]
	);

	const setFilterPriority = React.useCallback(
		(next: string) => {
			const f = { ...rawFilters };
			if (next) f.priority = next;
			else delete f.priority;
			mergePersist({ filters: f });
		},
		[mergePersist, rawFilters]
	);

	const setSortValue = React.useCallback(
		(v: string) => {
			const spec = parseSortSelectValue(v);
			if (spec === undefined) {
				const base = { ...(widget.widget_config as Record<string, unknown>) };
				delete base.sort;
				mergePersist(base as MarketingWidgetConfig);
				return;
			}
			mergePersist({ sort: spec });
		},
		[mergePersist, widget.widget_config]
	);

	const taskStatusOptions = React.useMemo(
		() => [
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
		],
		[t]
	);

	const taskStatusFilterOptions = React.useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...taskStatusOptions,
		],
		[t, taskStatusOptions]
	);

	const taskPriorityOptions = React.useMemo(
		() => [
			{ value: 'low', label: t('operationsView.tasks.priority.low') },
			{ value: 'medium', label: t('operationsView.tasks.priority.medium') },
			{ value: 'high', label: t('operationsView.tasks.priority.high') },
			{ value: 'urgent', label: t('operationsView.tasks.priority.urgent') },
		],
		[t]
	);

	const taskPriorityFilterOptions = React.useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...taskPriorityOptions,
		],
		[t, taskPriorityOptions]
	);

	const sortOptions = React.useMemo(
		() => [
			{ value: 'auto', label: t('overview.dashboard.listSort.taskDefault') },
			{ value: 'due_at:asc', label: t('overview.dashboard.listSort.dueAtAsc') },
			{
				value: 'due_at:desc',
				label: t('overview.dashboard.listSort.dueAtDesc'),
			},
			{
				value: 'updated_at:desc',
				label: t('overview.dashboard.listSort.updatedDesc'),
			},
			{
				value: 'priority:asc',
				label: t('overview.dashboard.listSort.priorityUrgentFirst'),
			},
			{ value: 'status:asc', label: t('overview.dashboard.listSort.status') },
		],
		[t]
	);

	const sortPreview = React.useMemo(() => {
		const cur = widgetConfig.sort;
		if (cur == null || sortSelectValue(cur) === 'auto') {
			return t('overview.dashboard.listSort.previewDefault');
		}
		const opt = sortOptions.find((o) => o.value === sortSelectValue(cur));
		return t('overview.dashboard.listSort.preview', {
			label: opt?.label ?? '',
		});
	}, [widgetConfig.sort, sortOptions, t]);

	const invalidateTasksQueries = React.useCallback(() => {
		void queryClient.invalidateQueries({
			queryKey: marketingCabinetProjectDashboardInvalidationQueryKey(projectId),
		});
		void queryClient.invalidateQueries({
			queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
				'tasks',
				projectId
			),
		});
	}, [projectId, queryClient]);

	const patchTaskMutation = useMutation({
		mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
			marketingCabinetApi.updateTask(taskId, { status }),
		onSuccess: invalidateTasksQueries,
	});

	const deleteTaskMutation = useMutation({
		mutationFn: (taskId: string) => marketingCabinetApi.deleteTask(taskId),
		onSuccess: invalidateTasksQueries,
	});

	const bulkCompleteMutation = useMutation({
		mutationFn: async () => {
			for (const task of rows) {
				const st = String(task.status || '').toLowerCase();
				if (st === 'completed') continue;
				await marketingCabinetApi.updateTask(task.id, { status: 'completed' });
			}
		},
		onSuccess: invalidateTasksQueries,
	});

	const [taskToDelete, setTaskToDelete] = React.useState<MarketingTask | null>(
		null
	);

	const confirmDeleteTask = React.useCallback(async () => {
		if (!taskToDelete) return;
		try {
			await deleteTaskMutation.mutateAsync(taskToDelete.id);
		} finally {
			setTaskToDelete(null);
		}
	}, [taskToDelete, deleteTaskMutation]);

	const exportCsv = React.useCallback(() => {
		const header = [
			t('overview.dashboard.csv.title'),
			t('overview.dashboard.csv.status'),
			t('overview.dashboard.csv.priority'),
			t('overview.dashboard.csv.due'),
		];
		const data = rows.map((task) => [
			task.title,
			localizeStatus(task.status),
			localizePriority(task.priority),
			task.due_at ?? '',
		]);
		downloadDashboardListCsv(
			`marketing-tasks-${projectId.slice(0, 8)}.csv`,
			header,
			data
		);
	}, [projectId, rows, t]);

	const listParentRef = React.useRef<HTMLDivElement>(null);
	const rowHeight = compact ? 80 : 98;
	const useVirtualList = rows.length >= DASHBOARD_LIST_VIRTUAL_THRESHOLD;

	const rowVirtualizer = useVirtualizer({
		count: useVirtualList ? rows.length : 0,
		getScrollElement: () => listParentRef.current,
		estimateSize: () => rowHeight,
		getItemKey: (index) => rows[index]?.id ?? index,
		overscan: 6,
	});

	const renderTaskRow = (task: MarketingTask) => {
		const statusVal = task.status || 'open';
		const deletingThis =
			deleteTaskMutation.isPending && deleteTaskMutation.variables === task.id;
		const patchingThis =
			patchTaskMutation.isPending &&
			patchTaskMutation.variables?.taskId === task.id;
		return (
			<div
				className={cn(
					'rounded-[calc(var(--desktop-radius)-4px)] border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)/40 px-2.5 text-(--desktop-text-primary)',
					compact ? 'py-1.5 text-xs' : 'py-2 text-sm',
					DASHBOARD_LIST_ROW_SHELL_FOCUS_WITHIN
				)}
			>
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0 flex-1 space-y-1">
						<div className="font-medium leading-snug">{task.title}</div>
						<div
							className={cn(
								'flex flex-wrap items-center gap-1',
								dashboardListItemMetaClass(compact)
							)}
						>
							<span>{localizeStatus(task.status)}</span>
							<span aria-hidden>·</span>
							<span>{localizePriority(task.priority)}</span>
							{task.due_at && intlFmt.formatDateShort(task.due_at) ? (
								<>
									<span aria-hidden>·</span>
									<time dateTime={task.due_at}>
										{t('overview.dashboard.widget.taskDueShort', {
											date: intlFmt.formatDateShort(task.due_at),
										})}
									</time>
								</>
							) : null}
						</div>
					</div>
					{allowMarketingWrite ? (
						<div
							className={cn(
								'flex shrink-0 items-center gap-1',
								MC_DASHBOARD_NO_DRAG_CLASS
							)}
						>
							<MarketingCabinetSelect
								size="compact"
								className={cn('max-w-38 shrink-0', MC_DASHBOARD_NO_DRAG_CLASS)}
								value={statusVal}
								disabled={patchingThis || deletingThis}
								options={taskStatusOptions}
								aria-label={t(
									'overview.dashboard.widget.tasksChangeStatusAria',
									{
										title: task.title,
									}
								)}
								onChange={(next) => {
									if (next === statusVal) return;
									patchTaskMutation.mutate({ taskId: task.id, status: next });
								}}
							/>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="icon"
								className={cn(
									'h-11 w-11 min-h-11 min-w-11',
									MC_DASHBOARD_NO_DRAG_CLASS
								)}
								disabled={deletingThis || patchingThis}
								aria-label={t('overview.dashboard.widget.tasksDeleteAria', {
									title: task.title,
								})}
								onClick={() => setTaskToDelete(task)}
							>
								{deletingThis ? (
									<ArrowPathIcon
										className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								) : (
									<TrashIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								)}
							</DesktopAppButton>
						</div>
					) : null}
				</div>
			</div>
		);
	};

	const showListTools = allowMarketingWrite && onPersistWidgetConfig;
	const hasTaskFilters = Boolean(filterStatus || filterPriority);
	const listMatchNarrow =
		hasTaskFilters &&
		typeof filteredListTotal === 'number' &&
		filteredListTotal !== tasksTotal;

	return (
		<div className="min-w-0 space-y-2">
			<div
				className={cn(
					'flex flex-wrap items-center justify-between gap-2',
					DASHBOARD_WIDGET_TOOLBAR_META_CLASS
				)}
			>
				<span>
					{listMatchNarrow
						? t('overview.dashboard.widget.listMatchFiltered', {
								shown: intlFmt.formatInt(rows.length),
								matching: intlFmt.formatInt(filteredListTotal),
								total: intlFmt.formatInt(tasksTotal),
							})
						: t('overview.dashboard.widget.tasksTotal', {
								count: intlFmt.formatInt(tasksTotal),
							})}
				</span>
				<div
					className={cn(
						'flex flex-wrap items-center gap-1',
						MC_DASHBOARD_NO_DRAG_CLASS
					)}
				>
					{rows.length > 0 ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="gap-1"
							onClick={exportCsv}
						>
							<ArrowDownTrayIcon
								className="h-3.5 w-3.5"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							{t('overview.dashboard.listExportCsv')}
						</DesktopAppButton>
					) : null}
					{allowMarketingWrite && rows.length > 0 ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							disabled={bulkCompleteMutation.isPending}
							onClick={() => {
								if (
									!window.confirm(
										t('overview.dashboard.widget.tasksBulkCompleteConfirm', {
											count: intlFmt.formatInt(rows.length),
										})
									)
								) {
									return;
								}
								bulkCompleteMutation.mutate();
							}}
						>
							{bulkCompleteMutation.isPending ? (
								<ArrowPathIcon
									className="h-3.5 w-3.5 motion-safe:animate-spin"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : null}
							{t('overview.dashboard.widget.tasksBulkComplete')}
						</DesktopAppButton>
					) : null}
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className={MC_DASHBOARD_NO_DRAG_CLASS}
						onClick={() =>
							onNavigate('tasks', null, {
								urlQuery: {
									[MC_OPS_TASK_STATUS]: filterStatus || null,
									[MC_OPS_TASK_PRIORITY]: filterPriority || null,
								},
							})
						}
					>
						{t('overview.openAction')}
						<ArrowRightIcon
							className="h-3.5 w-3.5"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</DesktopAppButton>
				</div>
			</div>
			{showListTools ? (
				<div
					className={cn(
						'flex flex-col gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/30 p-2',
						MC_DASHBOARD_NO_DRAG_CLASS
					)}
				>
					<div className="flex flex-wrap gap-2">
						<div className="min-w-34 flex-1">
							<MarketingCabinetSelect
								size="compact"
								value={filterStatus}
								aria-label={t('overview.dashboard.listFilter.taskStatusAria')}
								options={taskStatusFilterOptions}
								onChange={setFilterStatus}
							/>
						</div>
						<div className="min-w-34 flex-1">
							<MarketingCabinetSelect
								size="compact"
								value={filterPriority}
								aria-label={t('overview.dashboard.listFilter.taskPriorityAria')}
								options={taskPriorityFilterOptions}
								onChange={setFilterPriority}
							/>
						</div>
						<div className="min-w-44 flex-[1.2]">
							<MarketingCabinetSelect
								size="compact"
								value={sortSelectValue(widgetConfig.sort)}
								aria-label={t('overview.dashboard.listSort.aria')}
								options={sortOptions}
								onChange={setSortValue}
							/>
						</div>
					</div>
					<p className={cn('m-0', DESKTOP_TYPOGRAPHY.caption)}>{sortPreview}</p>
				</div>
			) : null}
			{rows.length === 0 ? (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						MC_DASHBOARD_NO_DRAG_CLASS,
						'm-0 px-0.5'
					)}
				>
					{t('overview.dashboard.widget.tasksListEmpty')}
				</p>
			) : useVirtualList ? (
				<div
					ref={listParentRef}
					className="max-h-[min(28rem,70vh)] min-h-0 overflow-auto rounded-(--desktop-radius) pr-0.5"
				>
					<div
						className="relative w-full"
						style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
					>
						{rowVirtualizer.getVirtualItems().map((vi) => {
							const task = rows[vi.index];
							return (
								<div
									key={task.id}
									data-index={vi.index}
									ref={rowVirtualizer.measureElement}
									className="absolute top-0 left-0 w-full px-0"
									style={{
										transform: `translateY(${vi.start}px)`,
									}}
								>
									<div className="pb-2">{renderTaskRow(task)}</div>
								</div>
							);
						})}
					</div>
				</div>
			) : (
				rows.map((task) => (
					<React.Fragment key={task.id}>{renderTaskRow(task)}</React.Fragment>
				))
			)}

			<ConfirmDeleteModal
				isOpen={taskToDelete !== null}
				onClose={() => setTaskToDelete(null)}
				onConfirm={confirmDeleteTask}
				title={t('overview.dashboard.widget.tasksDeleteModalTitle')}
				warningMessage={
					taskToDelete
						? t('overview.dashboard.widget.tasksDeleteModalBody', {
								title: taskToDelete.title,
							})
						: ''
				}
				confirmButtonLabel={t(
					'overview.dashboard.widget.tasksDeleteModalConfirm'
				)}
				confirmButtonLoadingLabel={t(
					'overview.dashboard.widget.tasksDeleteModalDeleting'
				)}
				cancelButtonLabel={t('common.cancel')}
			/>
		</div>
	);
}

export const TasksWidget = React.memo(TasksWidgetImpl);
