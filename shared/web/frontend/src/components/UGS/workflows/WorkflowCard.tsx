/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single workflow card in UGS Workflows tab (execute, history, and actions menu).
 *
 * Invariants:
 * - User-visible labels use `ugsHub.workflows.card*` and shared `status.*` / `category.*` keys.
 *
 * Related:
 * - UGSWorkflowsTab.tsx, ugsWorkflowsSharedUi.ts, i18n/locales/en|ru/ugsHub.json
 */

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type {
	ProviderRuntimeStatus,
	WorkflowExecutionRecord,
	WorkflowRecord,
} from './types';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	CalendarIcon,
	CheckCircleIcon,
	ChevronRightIcon,
	ClockIcon,
	DocumentDuplicateIcon,
	EllipsisVerticalIcon,
	GlobeAltIcon,
	LockClosedIcon,
	PlayIcon,
	RectangleGroupIcon,
	Squares2X2Icon,
	TrashIcon,
	XCircleIcon,
} from '@heroicons/react/24/outline';

import {
	cn,
	formatDateTime,
	formatEstimatedTime,
	formatRuntimeError,
} from './utils';
import { ugsHubCategoryLabel } from '../hub/ugsHubTaskListMeta';
import { useUgsHubShellTheme } from '../hub/ugsHubShellThemeContext';
import {
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubTextSecondary,
	workflowCardClasses,
	workflowCardCatalogNoteClasses,
	workflowCardDeleteMenuItemClasses,
	workflowCardExecuteBtnClasses,
	workflowCardExecutionEmptyClasses,
	workflowCardExecutionErrorClasses,
	workflowCardExecutionRowClasses,
	workflowCardExecutionStatusBadgeClasses,
	workflowCardFooterDividerClasses,
	workflowCardIconBtnClasses,
	workflowCardIconWrapClasses,
	workflowCardMenuItemClasses,
	workflowCardMenuPanelClasses,
	workflowCardMetaBadgeClasses,
	workflowCardPublicBadgeClasses,
	workflowCardSourceBadgeClasses,
	workflowCardStatClasses,
} from './ugsWorkflowsSharedUi';

function workflowCardExecutionStatusLabel(
	t: TFunction<'ugsHub'>,
	status: string
): string {
	switch (status) {
		case 'completed':
			return t('status.completed');
		case 'failed':
			return t('status.failed');
		case 'running':
			return t('status.processing');
		case 'pending':
			return t('workflows.cardExecPending');
		case 'cancelled':
			return t('status.cancelled');
		default:
			return status;
	}
}

function workflowCardDisabledExecuteLabel(
	t: TFunction<'ugsHub'>,
	workflow: WorkflowRecord
): string {
	switch (workflow.execution_mode) {
		case 'requires_image_input':
			return t('workflows.cardDisabledNeedsFile');
		case 'requires_audio_input':
			return t('workflows.cardDisabledNeedsAudio');
		case 'requires_specialized_form':
			return t('workflows.cardDisabledNeedsForm');
		default:
			return t('workflows.cardDisabledCatalogOnly');
	}
}

function executionStatusIcon(status: string): React.ReactNode {
	switch (status) {
		case 'completed':
			return (
				<CheckCircleIcon
					width={10}
					height={10}
					className="shrink-0"
					aria-hidden
				/>
			);
		case 'failed':
			return (
				<XCircleIcon width={10} height={10} className="shrink-0" aria-hidden />
			);
		case 'running':
			return (
				<ArrowPathIcon
					width={10}
					height={10}
					className="shrink-0 animate-spin"
					aria-hidden
				/>
			);
		case 'pending':
			return (
				<ClockIcon width={10} height={10} className="shrink-0" aria-hidden />
			);
		case 'cancelled':
			return (
				<XCircleIcon
					width={10}
					height={10}
					className="shrink-0 opacity-80"
					aria-hidden
				/>
			);
		default:
			return null;
	}
}

interface WorkflowCardProps {
	workflow: WorkflowRecord;
	executions: WorkflowExecutionRecord[] | undefined;
	executionTotal?: number;
	showExecutions: boolean;
	comfyuiStatus: ProviderRuntimeStatus | null;
	onExecute: (workflow: WorkflowRecord) => void;
	onToggleExecutions: (workflowId: string) => void;
	onDuplicate: (workflow: WorkflowRecord) => void;
	onExport: (workflow: WorkflowRecord) => void;
	onDelete: (workflowId: string) => void;
}

const WorkflowCard: React.FC<WorkflowCardProps> = ({
	workflow,
	executions,
	executionTotal,
	showExecutions,
	comfyuiStatus,
	onExecute,
	onToggleExecutions,
	onDuplicate,
	onExport,
	onDelete,
}) => {
	const { t, i18n } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();
	const canDuplicate = workflow.supports_duplicate ?? true;
	const canDelete = workflow.supports_delete ?? true;
	const canExport = workflow.supports_export ?? true;
	const canHistory = workflow.supports_history ?? true;
	const historyCount = Math.max(
		executionTotal ?? 0,
		executions?.length ?? 0,
		workflow.execution_count ?? 0
	);
	const categoryLabel = workflow.category
		? ugsHubCategoryLabel(t, workflow.category)
		: null;
	const sourceLabel = workflow.source_label;
	const providerUnavailableForWorkflow =
		workflow.workflow_source === 'comfyui_catalog' &&
		workflow.execution_mode === 'quick_prompt' &&
		comfyuiStatus !== null &&
		!comfyuiStatus.available;
	const canExecute =
		(workflow.supports_execute ?? true) && !providerUnavailableForWorkflow;
	const executeLabel =
		workflow.workflow_source === 'comfyui_catalog'
			? providerUnavailableForWorkflow
				? t('workflows.cardImageServiceUnavailable')
				: canExecute
					? t('workflows.cardQuickLaunch')
					: workflowCardDisabledExecuteLabel(t, workflow)
			: t('workflows.cardRun');
	const disabledHint =
		workflow.workflow_source === 'comfyui_catalog'
			? providerUnavailableForWorkflow
				? formatRuntimeError(t, comfyuiStatus?.error) ||
					t('workflows.cardImageServiceDisabledHint')
				: workflow.execution_hint
			: null;

	return (
		<motion.div
			role="article"
			aria-labelledby={`ugs-wfcard-title-${workflow.id}`}
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className={workflowCardClasses(theme)}
		>
			<div className="mb-4 flex items-start justify-between">
				<div className="flex items-center gap-3">
					<div className={workflowCardIconWrapClasses(theme)}>
						<Squares2X2Icon
							className="h-6 w-6 text-(--desktop-text-muted)"
							strokeWidth={1.35}
							aria-hidden
						/>
					</div>
					<div className="min-w-0">
						<h4
							id={`ugs-wfcard-title-${workflow.id}`}
							className={cn(
								'line-clamp-1 font-semibold',
								ugsHubTextPrimary(theme)
							)}
						>
							{workflow.workflow_name}
						</h4>
						{workflow.description && (
							<p
								className={cn(
									'mt-1 line-clamp-2 text-xs',
									ugsHubTextSecondary(theme)
								)}
							>
								{workflow.description}
							</p>
						)}
					</div>
				</div>
				<div className="flex shrink-0 flex-col items-end gap-2">
					{workflow.is_public && (
						<span className={workflowCardPublicBadgeClasses(theme)}>
							<GlobeAltIcon
								width={10}
								height={10}
								className="shrink-0"
								aria-hidden
							/>
							{t('workflows.cardPublic')}
						</span>
					)}
					{sourceLabel && (
						<span className={workflowCardSourceBadgeClasses(theme)}>
							<RectangleGroupIcon
								width={10}
								height={10}
								className="shrink-0"
								aria-hidden
							/>
							{sourceLabel}
						</span>
					)}
				</div>
			</div>

			{(categoryLabel || workflow.estimated_time) && (
				<div className="mb-4 flex flex-wrap gap-2">
					{categoryLabel && (
						<span className={workflowCardMetaBadgeClasses(theme)}>
							{categoryLabel}
						</span>
					)}
					{workflow.estimated_time ? (
						<span className={workflowCardMetaBadgeClasses(theme)}>
							{formatEstimatedTime(t, workflow.estimated_time)}
						</span>
					) : null}
					{workflow.workflow_slug && (
						<span className={workflowCardMetaBadgeClasses(theme)}>
							{t('workflows.cardSlug', { slug: workflow.workflow_slug })}
						</span>
					)}
				</div>
			)}

			<div className="mb-4 grid grid-cols-2 gap-2">
				<div className={workflowCardStatClasses(theme)}>
					<div className={cn('mb-1 text-[10px]', ugsHubTextMuted(theme))}>
						{t('workflows.cardStatNodes')}
					</div>
					<div
						className={cn('text-sm font-semibold', ugsHubTextPrimary(theme))}
					>
						{workflow.workflow_data?.nodes?.length ?? workflow.node_count ?? 0}
					</div>
				</div>
				<div className={workflowCardStatClasses(theme)}>
					<div className={cn('mb-1 text-[10px]', ugsHubTextMuted(theme))}>
						{t('workflows.cardStatConnections')}
					</div>
					<div
						className={cn('text-sm font-semibold', ugsHubTextPrimary(theme))}
					>
						{workflow.workflow_data?.edges?.length ??
							workflow.connection_count ??
							0}
					</div>
				</div>
				{workflow.execution_count !== undefined && (
					<>
						<div className={workflowCardStatClasses(theme)}>
							<div className={cn('mb-1 text-[10px]', ugsHubTextMuted(theme))}>
								{t('workflows.cardStatRuns')}
							</div>
							<div
								className={cn(
									'text-sm font-semibold',
									ugsHubTextPrimary(theme)
								)}
							>
								{workflow.execution_count}
							</div>
						</div>
						<div className={workflowCardStatClasses(theme)}>
							<div className={cn('mb-1 text-[10px]', ugsHubTextMuted(theme))}>
								{t('workflows.cardStatSuccessRate')}
							</div>
							<div
								className={cn(
									'text-sm font-semibold',
									ugsHubTextPrimary(theme)
								)}
							>
								{workflow.success_rate !== undefined
									? `${Math.round(workflow.success_rate * 100)}%`
									: '—'}
							</div>
						</div>
					</>
				)}
			</div>

			{canHistory &&
				(historyCount > 0 || showExecutions || executions !== undefined) && (
					<button
						type="button"
						onClick={() => onToggleExecutions(workflow.id)}
						className={cn(
							'mb-4 flex w-full items-center gap-2 text-left text-xs transition',
							ugsHubTextMuted(theme),
							'hover:text-(--desktop-text-primary) dark:hover:text-(--desktop-text-secondary)'
						)}
					>
						<ClockIcon width={12} height={12} />
						<span>
							{t('workflows.cardExecutionHistory', { count: historyCount })}
						</span>
						<ChevronRightIcon
							width={12}
							height={12}
							className={cn(
								'transition-transform',
								showExecutions && 'rotate-90'
							)}
						/>
					</button>
				)}

			<AnimatePresence>
				{canHistory && showExecutions && executions !== undefined && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						className="mb-4 space-y-2 overflow-hidden"
					>
						{executions.length === 0 && (
							<div className={workflowCardExecutionEmptyClasses(theme)}>
								{t('workflows.cardExecutionHistoryEmpty')}
							</div>
						)}
						{executions.map((exec) => (
							<div
								key={exec.id}
								className={workflowCardExecutionRowClasses(theme)}
							>
								<div className="mb-1 flex items-center justify-between">
									<span className={ugsHubTextSecondary(theme)}>
										{exec.execution_name || t('workflows.cardUnnamedExecution')}
									</span>
									<span
										className={workflowCardExecutionStatusBadgeClasses(
											exec.status
										)}
									>
										{executionStatusIcon(exec.status)}
										{workflowCardExecutionStatusLabel(t, exec.status)}
									</span>
								</div>
								<div
									className={cn(
										'flex items-center gap-2',
										ugsHubTextMuted(theme)
									)}
								>
									<span>
										{formatDateTime(
											exec.started_at || exec.created_at,
											i18n.language
										)}
									</span>
									{exec.total_duration_ms && (
										<span className="flex items-center gap-1">
											<ClockIcon width={10} height={10} />
											{t('workflows.cardDurationSeconds', {
												seconds: Math.round(exec.total_duration_ms / 1000),
											})}
										</span>
									)}
									{exec.success_count !== undefined &&
										exec.error_count !== undefined && (
											<span>
												✓{exec.success_count} ✗{exec.error_count}
											</span>
										)}
									{exec.credits_used && <span>⚡{exec.credits_used}</span>}
								</div>
								{exec.error_message && exec.status === 'failed' && (
									<div
										role="alert"
										className={workflowCardExecutionErrorClasses(theme)}
									>
										{formatRuntimeError(t, exec.error_message) ||
											exec.error_message}
									</div>
								)}
							</div>
						))}
					</motion.div>
				)}
			</AnimatePresence>

			<div
				className={cn(
					'mb-4 flex flex-wrap gap-2 text-xs',
					ugsHubTextMuted(theme)
				)}
			>
				<span className="flex items-center gap-1">
					<CalendarIcon width={12} height={12} />
					{formatDateTime(
						workflow.updated_at || workflow.created_at,
						i18n.language
					)}
				</span>
				{workflow.is_public ? (
					<span className="flex items-center gap-1">
						<GlobeAltIcon width={12} height={12} />
						{t('workflows.cardPublic')}
					</span>
				) : (
					<span className="flex items-center gap-1">
						<LockClosedIcon width={12} height={12} />
						{t('workflows.cardPrivate')}
					</span>
				)}
			</div>

			{!canExecute && disabledHint && (
				<div role="status" className={workflowCardCatalogNoteClasses(theme)}>
					{disabledHint}
				</div>
			)}

			<div
				className={cn(
					'flex flex-wrap items-center gap-2 border-t pt-4',
					workflowCardFooterDividerClasses(theme)
				)}
			>
				<button
					type="button"
					disabled={!canExecute}
					onClick={() => onExecute(workflow)}
					aria-label={`${executeLabel}: ${workflow.workflow_name}`}
					className={workflowCardExecuteBtnClasses(canExecute)}
				>
					<PlayIcon width={14} height={14} aria-hidden />
					<span className="truncate">{executeLabel}</span>
				</button>
				<div className="relative group">
					<button
						type="button"
						aria-label={t('workflows.cardMoreActionsAria')}
						className={workflowCardIconBtnClasses(theme)}
					>
						<EllipsisVerticalIcon width={14} height={14} />
					</button>
					<div className="invisible absolute right-0 top-full z-10 mt-1 opacity-0 transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
						<div className={workflowCardMenuPanelClasses(theme)}>
							{canDuplicate && (
								<button
									type="button"
									onClick={() => onDuplicate(workflow)}
									className={workflowCardMenuItemClasses(theme)}
								>
									<DocumentDuplicateIcon width={12} height={12} />
									{t('workflows.cardDuplicate')}
								</button>
							)}
							{canExport && (
								<button
									type="button"
									onClick={() => onExport(workflow)}
									className={workflowCardMenuItemClasses(theme)}
								>
									<ArrowDownTrayIcon width={12} height={12} />
									{t('workflows.cardExport')}
								</button>
							)}
							{canHistory && (
								<button
									type="button"
									onClick={() => onToggleExecutions(workflow.id)}
									className={workflowCardMenuItemClasses(theme)}
								>
									<ClockIcon width={12} height={12} />
									{t('workflows.cardHistory')}
								</button>
							)}
							{canDelete && (
								<>
									<div
										className={cn(
											'my-1 border-t',
											workflowCardFooterDividerClasses(theme)
										)}
									/>
									<button
										type="button"
										onClick={() => onDelete(workflow.id)}
										className={workflowCardDeleteMenuItemClasses(theme)}
									>
										<TrashIcon width={12} height={12} />
										{t('workflows.cardDelete')}
									</button>
								</>
							)}
							{!canDuplicate && !canExport && !canHistory && !canDelete && (
								<div
									className={cn('px-3 py-2 text-xs', ugsHubTextMuted(theme))}
								>
									{t('workflows.cardDbFirstActionsNote')}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</motion.div>
	);
};

export default WorkflowCard;
