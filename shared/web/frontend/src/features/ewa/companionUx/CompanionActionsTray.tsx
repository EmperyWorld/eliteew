/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collapsible companion **actions tray** above the composer (undo desktop window actions, U8.3 slice 6).
 *
 * Invariants:
 * - Parent owns records + undo dispatch; tray only renders visible (non-closed) rows.
 *
 * Related:
 * - src/features/ewa/companionActionsTray.ts
 * - src/features/ewa/companionActionTrayUi.ts
 */

import {
	ArrowUturnLeftIcon,
	ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
	actionTrayOutcomeI18nKey,
	actionsTrayGroupSectionI18nKey,
	buildActionsTrayCollapsedLabelArgs,
	filterVisibleCompanionActions,
	groupCompanionActionsTrayRows,
	shouldShowActionsTrayGroupHeaders,
	shouldShowOutcomeBadge,
} from '@/features/ewa/companionActionsTray';
import type { CompanionActionRecord } from '@/features/ewa/companionActionTrayUi';
import { appDisplayName } from '@/features/ewa/companionOperations/companionOperationsUi';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type CompanionActionsTrayProps = {
	records: readonly CompanionActionRecord[];
	expanded: boolean;
	onToggleExpanded: () => void;
	onUndo: (record: CompanionActionRecord) => void;
	onFocusRun: (runId: string) => void;
};

export function CompanionActionsTray({
	records,
	expanded,
	onToggleExpanded,
	onUndo,
	onFocusRun,
}: CompanionActionsTrayProps) {
	const { t } = useTranslation('marketing');

	const visibleActions = useMemo(
		() => filterVisibleCompanionActions(records),
		[records]
	);
	const collapsedLabel = useMemo(
		() => buildActionsTrayCollapsedLabelArgs(visibleActions.length),
		[visibleActions.length]
	);
	const groups = useMemo(
		() => groupCompanionActionsTrayRows(visibleActions),
		[visibleActions]
	);
	const showGroupHeaders = useMemo(
		() => shouldShowActionsTrayGroupHeaders(groups),
		[groups]
	);

	if (visibleActions.length === 0) return null;

	return (
		<section
			className={cn(
				'shrink-0 overflow-hidden rounded-2xl border border-(--companion-divider)',
				'bg-[radial-gradient(circle_at_0%_0%,var(--companion-bg),transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.48),rgba(15,23,42,0.22))]',
				'shadow-[0_10px_28px_rgba(2,6,23,0.14)]',
				'companion-presence-acting'
			)}
			data-testid="ewa-companion-actions-tray"
		>
			<button
				type="button"
				className={cn(
					'flex w-full items-center justify-between gap-2 px-3 py-2',
					'text-[12px] font-medium text-(--desktop-text-primary)',
					'hover:bg-white/6',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				onClick={onToggleExpanded}
				aria-expanded={expanded}
			>
				<span>{t(collapsedLabel.key, collapsedLabel.options)}</span>
				<ChevronDownIcon
					className={cn('size-3 transition', expanded && 'rotate-180')}
					aria-hidden
				/>
			</button>
			{expanded ? (
				<ul className="flex flex-col gap-1.5 border-t border-white/10 px-2 py-2">
					{groups.map((group) =>
						group.rows.length === 0 ? null : (
							<Fragment key={group.kind}>
								{showGroupHeaders ? (
									<li
										role="presentation"
										className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-(--companion-text-soft)"
									>
										{t(actionsTrayGroupSectionI18nKey(group.kind))}
									</li>
								) : null}
								{group.rows.map((row) => (
									<li
										key={row.id}
										className={cn(
											'flex items-center justify-between gap-2 rounded-xl border border-white/10',
											'bg-white/6 px-2.5 py-2 text-[12px] leading-tight shadow-sm shadow-black/10'
										)}
									>
										<div className="flex min-w-0 flex-col gap-0.5">
											<span className="flex min-w-0 flex-wrap items-center gap-1.5 font-medium text-(--desktop-text-primary)">
												<span className="min-w-0">
													{t(
														row.kind === 'web_search'
															? row.webSearchResult?.status === 'empty'
																? 'ewaCompanion.actionWebSearchEmptyLabel'
																: row.webSearchResult?.status === 'error'
																	? 'ewaCompanion.actionWebSearchErrorLabel'
																	: row.webSearchResult?.status === 'quota'
																		? 'ewaCompanion.actionWebSearchQuotaLabel'
																		: row.webSearchResult?.status === 'skipped'
																			? 'ewaCompanion.actionWebSearchSkippedLabel'
																			: 'ewaCompanion.actionWebSearchResultsLabel'
															: row.kind === 'notice'
																? row.appComponent
																	? 'ewaCompanion.actionNoticeFailedForAppLabel'
																	: 'ewaCompanion.actionNoticeFailedLabel'
																: row.kind === 'open'
																	? 'ewaCompanion.actionOpenedAppLabel'
																	: row.kind === 'close'
																		? 'ewaCompanion.actionClosedAppLabel'
																		: row.kind === 'focus'
																			? 'ewaCompanion.actionFocusedAppLabel'
																			: 'ewaCompanion.actionMinimizedAppLabel',
														row.appComponent
															? {
																	app: appDisplayName(row.appComponent),
																}
															: undefined
													)}
												</span>
												{shouldShowOutcomeBadge(row.outcome) ? (
													<span
														className={cn(
															'inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide',
															row.outcome === 'blocked'
																? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
																: 'bg-red-500/15 text-red-700 dark:text-red-300'
														)}
													>
														{t(actionTrayOutcomeI18nKey(row.outcome))}
													</span>
												) : null}
											</span>
											<span
												className={cn(
													DESKTOP_TYPOGRAPHY.caption,
													'italic text-(--companion-text-soft)'
												)}
											>
												{row.rationale ||
													t(
														row.kind === 'web_search'
															? row.webSearchResult?.status === 'empty'
																? 'ewaCompanion.actionWebSearchEmptyHint'
																: row.webSearchResult?.status === 'error'
																	? 'ewaCompanion.actionWebSearchErrorHint'
																	: row.webSearchResult?.status === 'quota'
																		? 'ewaCompanion.actionWebSearchQuotaHint'
																		: row.webSearchResult?.status === 'skipped'
																			? 'ewaCompanion.actionWebSearchSkippedHint'
																			: 'ewaCompanion.actionWebSearchResultsHint'
															: row.kind === 'notice'
																? 'ewaCompanion.actionNoticeFailedHint'
																: row.kind === 'open'
																	? 'ewaCompanion.actionOpenedAppHint'
																	: row.kind === 'close'
																		? 'ewaCompanion.actionClosedAppHint'
																		: row.kind === 'focus'
																			? 'ewaCompanion.actionFocusedAppHint'
																			: 'ewaCompanion.actionMinimizedAppHint'
													)}
											</span>
											{row.kind === 'web_search' && row.webSearchResult ? (
												<ol className="mt-1 flex flex-col gap-1">
													{row.webSearchResult.results
														.slice(0, 3)
														.map((item) => (
															<li
																key={item.url || item.title || item.snippet}
																className="rounded-lg border border-white/10 bg-black/10 px-2 py-1"
															>
																{item.url ? (
																	<a
																		href={item.url}
																		target="_blank"
																		rel="noreferrer"
																		className="block truncate text-[11px] font-medium text-(--companion-aura) hover:underline"
																	>
																		{item.title || item.url}
																	</a>
																) : (
																	<span className="block truncate text-[11px] font-medium text-(--desktop-text-primary)">
																		{item.title}
																	</span>
																)}
																{item.snippet ? (
																	<span className="mt-0.5 line-clamp-2 block text-[10px] not-italic text-(--companion-text-soft)">
																		{item.snippet}
																	</span>
																) : null}
															</li>
														))}
												</ol>
											) : null}
										</div>
										<div className="flex shrink-0 flex-col items-end gap-1">
											{row.taskRunId ? (
												<button
													type="button"
													className={cn(
														'inline-flex items-center gap-1 rounded-full',
														'border border-(--companion-divider) bg-(--companion-bg)',
														'px-2 py-1 text-[11px] text-(--companion-aura)',
														'hover:bg-(--companion-aura)/10',
														DESKTOP_CHROME_FOCUS_VISIBLE
													)}
													aria-label={t('ewaCompanion.actionViewOperationAria')}
													onClick={() => {
														if (row.taskRunId) onFocusRun(row.taskRunId);
													}}
												>
													{t('ewaCompanion.actionViewOperation')}
												</button>
											) : null}
											{row.kind !== 'notice' &&
											row.kind !== 'web_search' &&
											!shouldShowOutcomeBadge(row.outcome) ? (
												<button
													type="button"
													className={cn(
														'inline-flex items-center gap-1 rounded-full',
														'border border-(--companion-divider) bg-(--companion-bg)',
														'px-2 py-1 text-[11px] text-(--desktop-text-primary)',
														'hover:text-(--companion-aura)',
														DESKTOP_CHROME_FOCUS_VISIBLE
													)}
													aria-label={t('ewaCompanion.actionUndoAria')}
													onClick={() => onUndo(row)}
												>
													<ArrowUturnLeftIcon className="size-3" aria-hidden />
													{t(
														row.kind === 'open'
															? 'ewaCompanion.actionUndoCloseApp'
															: row.kind === 'close'
																? 'ewaCompanion.actionUndoOpenApp'
																: row.kind === 'focus'
																	? 'ewaCompanion.actionUndoFocusApp'
																	: 'ewaCompanion.actionUndoMinimizeApp',
														row.appComponent
															? {
																	app: appDisplayName(row.appComponent),
																}
															: undefined
													)}
												</button>
											) : (
												<button
													type="button"
													className={cn(
														'inline-flex shrink-0 rounded-full px-2 py-1 text-[11px]',
														'text-(--companion-text-soft) hover:bg-white/8 hover:text-(--desktop-text-primary)',
														DESKTOP_CHROME_FOCUS_VISIBLE
													)}
													aria-label={t('ewaCompanion.actionDismissAria')}
													onClick={() => onUndo(row)}
												>
													{t('ewaCompanion.actionDismiss')}
												</button>
											)}
										</div>
									</li>
								))}
							</Fragment>
						)
					)}
				</ul>
			) : null}
		</section>
	);
}
