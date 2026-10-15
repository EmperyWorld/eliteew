/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single memoized UGS Hub task row (actions, progress, admin previews).
 *
 * Invariants:
 * - Does not call UGS APIs; handlers come from parent list.
 *
 * Related:
 * - UgsHubTaskList.tsx, useUgsHubRenderTaskList.tsx
 */

import {
	ArrowDownTrayIcon,
	CheckCircleIcon,
	ClockIcon,
	DocumentTextIcon,
	ExclamationTriangleIcon,
	EyeIcon,
	SignalIcon,
	XCircleIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { memo, type FC, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { UGSTask } from '../../../hooks/api/useUgsDashboard';
import { DESKTOP_LUCIDE } from '../../../pages/Desktop/constants';
import { cn } from '../../../utils/cn';
import { formatDateTime } from '../../../utils/dateTime';
import type { UgsHubTaskListConfig } from './types';
import {
	UGS_HUB_CATEGORY_META,
	UGS_HUB_STATUS_DOT_CLASSES,
	ugsHubCategoryLabel,
	ugsHubStatusLabel,
} from './ugsHubTaskListMeta';
import { useUgsHubShellTheme } from './ugsHubShellThemeContext';
import {
	ugsHubHeaderBtnClasses,
	ugsHubTaskCardClasses,
	ugsHubTaskCategoryBadgeClasses,
	ugsHubTaskCategoryIconWrapClasses,
	ugsHubTaskCheckboxClasses,
	ugsHubTaskErrorPanelClasses,
	ugsHubTaskErrorTitleClasses,
	ugsHubTaskPreviewPanelClasses,
	ugsHubTaskPriorityBadgeClasses,
	ugsHubTaskProgressFillClasses,
	ugsHubTaskProgressTrackClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubTextSecondary,
} from './ugsHubSharedUi';

export interface UgsHubTaskRowProps {
	task: UGSTask;
	config: UgsHubTaskListConfig;
	category: string;
	providerShown: string;
	displayName: string;
	inputPreview: string;
	bulkActionMode: boolean;
	isSelected: boolean;
	showUgsAdminLink: boolean;
	onToggleTaskSelection: (taskId: string) => void;
	onViewResult: (task: UGSTask) => void;
	onDownloadResult: (task: UGSTask) => void;
	onCancelTask: (task: UGSTask) => void;
	onOpenDocEditor: (contentId: string) => void;
	getContentIdFromResult: (result: UGSTask['result']) => string | null;
	getTaskIcon: (typeKey: string) => ReactNode;
	getStatusColor: (status: UGSTask['status']) => string;
}

function rowPropsEqual(
	prev: UgsHubTaskRowProps,
	next: UgsHubTaskRowProps
): boolean {
	return (
		prev.task === next.task &&
		prev.config === next.config &&
		prev.isSelected === next.isSelected &&
		prev.bulkActionMode === next.bulkActionMode &&
		prev.showUgsAdminLink === next.showUgsAdminLink &&
		prev.category === next.category &&
		prev.displayName === next.displayName &&
		prev.providerShown === next.providerShown &&
		prev.inputPreview === next.inputPreview
	);
}

export const UgsHubTaskRow: FC<UgsHubTaskRowProps> = memo(
	function UgsHubTaskRow({
		task,
		config,
		category,
		providerShown,
		displayName,
		inputPreview,
		bulkActionMode,
		isSelected,
		showUgsAdminLink,
		onToggleTaskSelection,
		onViewResult,
		onDownloadResult,
		onCancelTask,
		onOpenDocEditor,
		getContentIdFromResult,
		getTaskIcon,
		getStatusColor,
	}) {
		const { t, i18n } = useTranslation('ugsHub');
		const theme = useUgsHubShellTheme();
		const btn = ugsHubHeaderBtnClasses(theme);
		const categoryMeta =
			UGS_HUB_CATEGORY_META[category as keyof typeof UGS_HUB_CATEGORY_META] ??
			UGS_HUB_CATEGORY_META.default;
		const categoryLabel = ugsHubCategoryLabel(t, category);
		const statusLabel = ugsHubStatusLabel(t, task.status);

		const taskProgressPct =
			typeof task.progress === 'number'
				? task.progress
				: typeof task.metadata?.progress === 'number'
					? (task.metadata.progress as number)
					: undefined;
		const taskProgressMsg =
			typeof task.progress_message === 'string'
				? task.progress_message
				: typeof task.metadata?.progress_message === 'string'
					? (task.metadata.progress_message as string)
					: null;

		return (
			<motion.div
				layout
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -8 }}
				transition={{ duration: 0.18 }}
				className={ugsHubTaskCardClasses(theme, isSelected)}
			>
				<div className="flex min-w-0 flex-col gap-4 md:flex-row md:justify-between md:gap-6">
					<div className="flex min-w-0 flex-1 gap-3">
						{(bulkActionMode || isSelected) && (
							<button
								type="button"
								onClick={() => onToggleTaskSelection(task.id)}
								className={ugsHubTaskCheckboxClasses(theme, isSelected)}
								aria-label={
									isSelected
										? t('taskRow.deselectTask')
										: t('taskRow.selectTask')
								}
							>
								{isSelected ? <CheckCircleIcon width={14} height={14} /> : null}
							</button>
						)}
						<div
							className={cn(
								ugsHubTaskCategoryIconWrapClasses(theme),
								categoryMeta?.accent || 'bg-(--desktop-surface-panel)/60'
							)}
						>
							<motion.div
								animate={task.status === 'processing' ? { rotate: 360 } : {}}
								transition={{
									duration: 2,
									repeat: task.status === 'processing' ? Infinity : 0,
									ease: 'linear',
								}}
							>
								{getTaskIcon(task.type_key)}
							</motion.div>
						</div>
						<div className="min-w-0 flex-1 space-y-2">
							<div className="flex flex-wrap items-center gap-2">
								<h3
									className={cn(
										'min-w-0 text-sm font-semibold tracking-tight md:text-base',
										ugsHubTextPrimary(theme)
									)}
								>
									{displayName}
								</h3>
								<span
									className={cn(
										'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
										getStatusColor(task.status)
									)}
								>
									<span
										className={cn(
											'h-2 w-2 rounded-full',
											UGS_HUB_STATUS_DOT_CLASSES[task.status]
										)}
									/>
									{statusLabel}
								</span>
								<span className={ugsHubTaskCategoryBadgeClasses(theme)}>
									{categoryLabel}
								</span>
							</div>
							<div
								className={cn(
									'flex flex-wrap gap-3 text-xs',
									ugsHubTextMuted(theme)
								)}
							>
								<span className="font-mono">ID: {task.id.slice(0, 8)}...</span>
								{showUgsAdminLink && task.user_id ? (
									<span className="font-mono text-amber-600 dark:text-amber-200/80">
										User: {String(task.user_id).slice(0, 8)}…
									</span>
								) : null}
								<span>{t('taskRow.channel', { provider: providerShown })}</span>
								<span className="flex items-center gap-1">
									{t('taskRow.priority')}
									<span
										className={ugsHubTaskPriorityBadgeClasses(
											theme,
											task.priority
										)}
									>
										{task.priority}
									</span>
								</span>
								{task.project_id ? (
									<span>
										{t('taskRow.project', {
											id: task.project_id.slice(0, 8),
										})}
									</span>
								) : null}
							</div>
							<div
								className={cn(
									'flex flex-wrap gap-3 text-xs',
									ugsHubTextMuted(theme)
								)}
							>
								<span className="flex items-center gap-1">
									<ClockIcon width={12} height={12} />
									{t('taskRow.created', {
										time: formatDateTime(task.created_at, i18n.language),
									})}
								</span>
								{task.status === 'processing' ? (
									<motion.span
										className={cn(
											'flex items-center gap-1',
											ugsHubTextSecondary(theme)
										)}
										animate={{ opacity: [1, 0.5, 1] }}
										transition={{ duration: 1.5, repeat: Infinity }}
									>
										<SignalIcon
											width={12}
											height={12}
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{t('taskRow.inProgress')}
									</motion.span>
								) : null}
							</div>
							{task.status === 'processing' && taskProgressPct !== undefined ? (
								<div className="mt-2">
									<div className={ugsHubTaskProgressTrackClasses(theme)}>
										<motion.div
											className={ugsHubTaskProgressFillClasses(theme)}
											initial={{ width: 0 }}
											animate={{ width: `${taskProgressPct}%` }}
											transition={{ duration: 0.5 }}
										/>
									</div>
									<div
										className={cn(
											'mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs',
											ugsHubTextMuted(theme)
										)}
									>
										<span>
											{t('taskRow.progress', {
												pct: Math.round(taskProgressPct),
											})}
										</span>
										{taskProgressMsg ? (
											<span
												className="max-w-full truncate text-[11px]"
												title={taskProgressMsg}
											>
												{taskProgressMsg}
											</span>
										) : null}
									</div>
								</div>
							) : null}
						</div>
					</div>
					<div className="flex min-w-0 shrink-0 flex-wrap items-start gap-2 md:flex-col md:items-end">
						{config.showViewAction && task.status === 'completed' ? (
							<button
								type="button"
								onClick={() => onViewResult(task)}
								className={cn(btn, 'px-3 py-2 text-xs')}
							>
								<EyeIcon width={14} height={14} />
								{t('taskRow.view')}
							</button>
						) : null}
						{config.showDownloadAction && task.status === 'completed' ? (
							<button
								type="button"
								onClick={() => onDownloadResult(task)}
								className={cn(
									'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition',
									task.result
										? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-700 hover:border-emerald-400/60 hover:bg-emerald-500/30 dark:text-emerald-200 dark:hover:text-(--desktop-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/45'
										: cn(btn, 'cursor-not-allowed opacity-50')
								)}
								disabled={!task.result}
							>
								<ArrowDownTrayIcon width={14} height={14} />
								{t('taskRow.download')}
							</button>
						) : null}
						{task.status === 'completed' &&
						getContentIdFromResult(task.result) ? (
							<button
								type="button"
								onClick={() => {
									const cid = getContentIdFromResult(task.result);
									if (cid) onOpenDocEditor(cid);
								}}
								className={cn(btn, 'px-3 py-2 text-xs')}
							>
								<DocumentTextIcon width={14} height={14} />
								{t('taskRow.openEditor')}
							</button>
						) : null}
						{(task.status === 'pending' ||
							task.status === 'queued' ||
							task.status === 'processing' ||
							task.status === 'retrying') && (
							<button
								type="button"
								onClick={() => onCancelTask(task)}
								className={cn(
									'inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-800 transition hover:border-amber-400/60 hover:bg-amber-500/30 dark:text-amber-200 dark:hover:text-(--desktop-text-primary)',
									'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/45'
								)}
							>
								<XCircleIcon width={14} height={14} />
								{t('taskRow.cancel')}
							</button>
						)}
					</div>
				</div>

				<div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
					{showUgsAdminLink ? (
						<>
							<div className={ugsHubTaskPreviewPanelClasses(theme)}>
								<div
									className={cn(
										'mb-1 text-xs font-semibold',
										ugsHubTextMuted(theme)
									)}
								>
									{t('taskRow.inputData')}
								</div>
								<pre
									className={cn(
										'max-h-36 overflow-auto whitespace-pre-wrap wrap-break-word text-xs leading-relaxed',
										ugsHubTextSecondary(theme)
									)}
								>
									{inputPreview || '—'}
								</pre>
							</div>
							{task.metadata ? (
								<div className={ugsHubTaskPreviewPanelClasses(theme)}>
									<div
										className={cn(
											'mb-1 text-xs font-semibold',
											ugsHubTextMuted(theme)
										)}
									>
										{t('taskRow.metadata')}
									</div>
									<pre
										className={cn(
											'max-h-36 overflow-auto whitespace-pre-wrap wrap-break-word text-xs leading-relaxed',
											ugsHubTextSecondary(theme)
										)}
									>
										{JSON.stringify(task.metadata, null, 2)}
									</pre>
								</div>
							) : null}
						</>
					) : null}

					{config.highlightErrors && task.status === 'failed' ? (
						<div className={ugsHubTaskErrorPanelClasses(theme)}>
							<div className={ugsHubTaskErrorTitleClasses(theme)}>
								<ExclamationTriangleIcon width={14} height={14} />
								{t('taskRow.generationError')}
							</div>
							<p>{task.error || t('taskRow.unknownError')}</p>
						</div>
					) : null}
				</div>
			</motion.div>
		);
	},
	rowPropsEqual
);
