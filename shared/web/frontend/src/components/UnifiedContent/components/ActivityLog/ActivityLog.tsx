/**
 * ActivityLog - Компонент истории действий
 *
 * Показывает последние действия пользователя с возможностью отмены
 */

import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
	ArrowTopRightOnSquareIcon,
	ArrowUpTrayIcon,
	ArrowUturnLeftIcon,
	ArrowsPointingOutIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	ClockIcon,
	LinkIcon,
	PencilSquareIcon,
	StarIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { ButtonV2 } from '../../../ui/ButtonV2';
import { DesktopAppSkeleton } from '../../../../pages/Desktop/components/DesktopAppChrome';
import type { Activity, ActivityType } from '../../hooks/useActivityLog';
import { resolveIntlDateLocale } from '../../utils/contentUtils';

interface ActivityLogProps {
	activities: Activity[];
	canUndo: boolean;
	onUndo: (activityId?: string) => Promise<boolean>;
	/** Omitted when the feed is server-side (audit) and cannot be cleared from the client. */
	onClear?: () => void;
	loading?: boolean;
	/** Override subtext under the empty state (e.g. audit vs local). */
	emptyHint?: string;
	maxVisible?: number;
	/** Tighter timeline rows and smaller chrome */
	dense?: boolean;
}

/** Descriptions longer than this get an expand/collapse control (compact default). */
const DESCRIPTION_EXPAND_THRESHOLD = 96;

const getActivityIcon = (
	type: ActivityType
): React.ComponentType<{ size?: number; className?: string }> => {
	switch (type) {
		case 'upload':
			return ArrowUpTrayIcon;
		case 'delete':
		case 'batch_delete':
			return TrashIcon;
		case 'edit':
			return PencilSquareIcon;
		case 'share':
			return ArrowTopRightOnSquareIcon;
		case 'move':
		case 'batch_move':
			return ArrowsPointingOutIcon;
		case 'batch_assign_project':
			return LinkIcon;
		case 'favorite':
			return StarIcon;
		case 'unfavorite':
			return StarIcon;
		default:
			return ClockIcon;
	}
};

const getActivityColor = (type: ActivityType): string => {
	switch (type) {
		case 'upload':
			return 'text-green-400';
		case 'delete':
		case 'batch_delete':
			return 'text-red-400';
		case 'edit':
			return 'text-blue-400';
		case 'share':
			return 'text-purple-400';
		case 'move':
		case 'batch_move':
			return 'text-yellow-400';
		case 'batch_assign_project':
			return 'text-cyan-400';
		case 'favorite':
			return 'text-yellow-400';
		case 'unfavorite':
			return 'text-(--desktop-text-dim)';
		default:
			return 'text-(--desktop-text-dim)';
	}
};

export const ActivityLog: React.FC<ActivityLogProps> = ({
	activities,
	canUndo,
	onUndo,
	onClear,
	loading = false,
	emptyHint: emptyHintProp,
	maxVisible = 10,
	dense = false,
}) => {
	const { t, i18n } = useTranslation('contentManager');
	const [panelOpen, setPanelOpen] = useState(true);
	const [expandedDescIds, setExpandedDescIds] = useState<ReadonlySet<string>>(
		() => new Set()
	);

	const formatRelativeTime = useCallback(
		(date: Date): string => {
			const now = new Date();
			const diffInMs = now.getTime() - date.getTime();
			const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
			const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
			const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

			if (diffInMinutes < 1) return t('fileCard.relativeJustNow');
			if (diffInMinutes < 60)
				return t('fileCard.relativeMinutes', { n: diffInMinutes });
			if (diffInHours < 24)
				return t('fileCard.relativeHours', { n: diffInHours });
			if (diffInDays === 1) return t('fileCard.relativeYesterday');
			if (diffInDays < 7) return t('fileCard.relativeDays', { n: diffInDays });

			return date.toLocaleDateString(resolveIntlDateLocale(i18n.language), {
				day: 'numeric',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit',
			});
		},
		[t, i18n.language]
	);

	const visibleActivities = useMemo(
		() => activities.slice(0, maxVisible),
		[activities, maxVisible]
	);

	const toggleDescExpanded = useCallback((id: string) => {
		setExpandedDescIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	const showMoreLabel = t('activityLog.showMore');
	const showLessLabel = t('activityLog.showLess');
	const collapseTimelineLabel = t('activityLog.collapseTimeline');
	const expandTimelineLabel = t('activityLog.expandTimeline');
	const emptyHint = emptyHintProp ?? t('activityLog.emptyHint');

	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex items-center justify-between gap-2">
				{activities.length > 0 ? (
					<button
						type="button"
						onClick={() => setPanelOpen((o) => !o)}
						className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left outline-none transition hover:bg-(--desktop-surface-soft)/35 focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.4)]"
						aria-expanded={panelOpen}
						aria-controls="activity-log-timeline"
						title={panelOpen ? collapseTimelineLabel : expandTimelineLabel}
					>
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--desktop-accent-rgb)/0.15)] text-[rgb(var(--desktop-accent-rgb)/0.95)]">
							<ClockIcon className="h-4 w-4" aria-hidden />
						</span>
						<span className="min-w-0 flex-1">
							<span className="flex items-center gap-2">
								<h3 className="truncate text-base font-semibold text-(--desktop-text-primary)">
									{t('activityLog.title')}
								</h3>
								<span className="shrink-0 rounded border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-(--desktop-text-secondary)">
									{activities.length}
								</span>
							</span>
						</span>
						<span className="shrink-0 text-(--desktop-text-muted)">
							{panelOpen ? (
								<ChevronUpIcon className="h-4 w-4" aria-hidden />
							) : (
								<ChevronDownIcon className="h-4 w-4" aria-hidden />
							)}
						</span>
					</button>
				) : (
					<div className="flex min-w-0 flex-1 items-center gap-2 py-1">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--desktop-accent-rgb)/0.15)] text-[rgb(var(--desktop-accent-rgb)/0.95)]">
							<ClockIcon className="h-4 w-4" aria-hidden />
						</span>
						<h3 className="truncate text-base font-semibold text-(--desktop-text-primary)">
							{t('activityLog.title')}
						</h3>
					</div>
				)}
				{activities.length > 0 && onClear ? (
					<ButtonV2
						variant="ghost"
						size="sm"
						onClick={onClear}
						iconLeft={<XMarkIcon className="h-4 w-4" />}
					>
						{t('activityLog.clear')}
					</ButtonV2>
				) : null}
			</div>

			{loading ? (
				<div className="space-y-3 px-1 py-4" role="status" aria-busy="true">
					<DesktopAppSkeleton className="h-14 w-full" />
					<DesktopAppSkeleton className="h-14 w-full" />
					<DesktopAppSkeleton className="h-14 w-full" />
				</div>
			) : activities.length === 0 ? (
				<div
					className="rounded-xl border border-dashed border-(--desktop-border-subtle)/55 bg-(--desktop-surface-soft)/25 px-4 py-10 text-center"
					role="status"
					id="activity-log-timeline"
				>
					<div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-(--desktop-surface-soft)/50 ring-1 ring-(--desktop-border-subtle)/50">
						<ClockIcon
							className="h-7 w-7 text-(--desktop-text-dim)"
							strokeWidth={1.25}
							aria-hidden
						/>
					</div>
					<p className="text-sm font-medium text-(--desktop-text-secondary)">
						{t('activityLog.empty')}
					</p>
					<p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-(--desktop-text-muted)">
						{emptyHint}
					</p>
				</div>
			) : (
				<AnimatePresence initial={false}>
					{panelOpen && (
						<motion.div
							id="activity-log-timeline"
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: 'auto', opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: 0.2, ease: 'easeInOut' }}
							className="overflow-hidden"
						>
							<div className="relative max-h-80 overflow-y-auto pr-1">
								<div
									className={
										dense
											? 'pointer-events-none absolute bottom-1.5 left-[13px] top-1.5 w-px bg-linear-to-b from-[rgb(var(--desktop-fg-primary-rgb)/0.06)] via-[rgb(var(--desktop-fg-primary-rgb)/0.14)] to-[rgb(var(--desktop-fg-primary-rgb)/0.06)]'
											: 'pointer-events-none absolute bottom-2 left-[15px] top-2 w-px bg-linear-to-b from-[rgb(var(--desktop-fg-primary-rgb)/0.06)] via-[rgb(var(--desktop-fg-primary-rgb)/0.14)] to-[rgb(var(--desktop-fg-primary-rgb)/0.06)]'
									}
									aria-hidden
								/>
								<ul
									className={
										dense ? 'relative space-y-0' : 'relative space-y-0.5'
									}
								>
									<AnimatePresence>
										{visibleActivities.map((activity) => {
											const Icon = getActivityIcon(activity.type);
											const colorClass = getActivityColor(activity.type);
											const isLong =
												activity.description.length >
												DESCRIPTION_EXPAND_THRESHOLD;
											const descExpanded = expandedDescIds.has(activity.id);
											const showClamp = isLong && !descExpanded;

											return (
												<motion.li
													key={activity.id}
													initial={{ opacity: 0, y: 6 }}
													animate={{ opacity: 1, y: 0 }}
													exit={{ opacity: 0, y: -4 }}
													className={
														dense
															? 'relative flex gap-2 py-0.5 pl-6'
															: 'relative flex gap-2.5 py-1 pl-7'
													}
												>
													<span
														className={
															dense
																? 'absolute left-[9px] top-[11px] z-1 h-1.5 w-1.5 shrink-0 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) shadow-[0_0_0_2px_var(--desktop-surface-panel-strong)] ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.35)]'
																: 'absolute left-[11px] top-[13px] z-1 h-2 w-2 shrink-0 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) shadow-[0_0_0_3px_var(--desktop-surface-panel-strong)] ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.35)]'
														}
														aria-hidden
													/>
													<div
														className={`shrink-0 items-center justify-center rounded-md bg-[rgb(var(--desktop-fg-primary-rgb)/0.06)] ${dense ? 'flex h-6 w-6' : 'flex h-7 w-7'} ${colorClass}`}
													>
														<Icon
															className={dense ? 'h-3 w-3' : 'h-3.5 w-3.5'}
															aria-hidden
														/>
													</div>

													<div
														className={
															dense
																? 'min-w-0 flex-1 pb-0'
																: 'min-w-0 flex-1 pb-0.5'
														}
													>
														<p
															className={`leading-snug text-(--desktop-text-primary) ${dense ? 'text-[11px]' : 'text-xs'} ${showClamp ? 'line-clamp-2' : ''}`}
														>
															{activity.description}
														</p>
														<div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
															<time
																className="text-[10px] tabular-nums text-(--desktop-text-muted)"
																dateTime={activity.timestamp.toISOString()}
															>
																{formatRelativeTime(activity.timestamp)}
															</time>
															{isLong && (
																<button
																	type="button"
																	onClick={() =>
																		toggleDescExpanded(activity.id)
																	}
																	className="text-[10px] font-medium text-[rgb(var(--desktop-accent-rgb)/0.92)] underline-offset-2 hover:text-[rgb(var(--desktop-accent-rgb))] hover:underline"
																>
																	{descExpanded ? showLessLabel : showMoreLabel}
																</button>
															)}
														</div>
													</div>

													{activity.undoable && canUndo && (
														<div
															className={
																dense
																	? 'shrink-0 self-start pt-0'
																	: 'shrink-0 self-start pt-0.5'
															}
														>
															<ButtonV2
																variant="ghost"
																size="icon"
																onClick={() => onUndo(activity.id)}
																iconLeft={
																	<ArrowUturnLeftIcon
																		className={
																			dense ? 'h-3 w-3' : 'h-3.5 w-3.5'
																		}
																	/>
																}
																className={
																	dense
																		? 'h-6 w-6 min-h-6 min-w-6'
																		: 'h-7 w-7 min-h-7 min-w-7'
																}
																title={t('activityLog.undo')}
																aria-label={t('activityLog.undoAria')}
															/>
														</div>
													)}
												</motion.li>
											);
										})}
									</AnimatePresence>
								</ul>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			)}
		</div>
	);
};
