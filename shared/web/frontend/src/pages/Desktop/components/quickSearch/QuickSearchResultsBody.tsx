/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Scrollable Quick Search results: query matches + browse sections (P23 extract).
 *
 * Invariants:
 * - flatIdx math matches useQuickSearchModel flatRows keyboard order.
 *
 * Related:
 * - components/QuickSearch.tsx
 * - useQuickSearchModel.ts
 */

import type { Variants } from 'framer-motion';
import type { TFunction } from 'i18next';
import type * as React from 'react';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { DesktopIconStyle } from '@/types/profile';
import { cn } from '@/utils/cn';
import {
	DESKTOP_LIBRARY_FEED_CARD_QUICK_SEARCH,
	DESKTOP_LIBRARY_FEED_ICON_WRAP_QUICK_SEARCH,
} from '../../utils/desktopLibraryFeedCard';
import { DesktopAppButton, DesktopAppEmptyState } from '../DesktopAppChrome';
import type { DesktopItem, RecentFile } from '../../types/desktop.types';
import {
	ArrowUpTrayIcon,
	BoltIcon,
	ChevronRightIcon,
	ClockIcon,
	FolderIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	SparklesIcon,
	StarIcon,
} from '@heroicons/react/24/outline';
import { qsLauncherRowClass, quickSearchLauncherTooltipLabel } from './helpers';
import { QuickSearchLauncherRow } from './QuickSearchLauncherRow';
import {
	highlightQuickSearchMatch,
	renderQuickSearchLauncherLeadingIcon,
	renderQuickSearchRecentFileLeadingIcon,
} from './QuickSearchLeadingIcons';
import type {
	BrowseSectionStarts,
	LauncherRow,
	QuickAction,
	SearchResult,
} from './types';

export type QuickSearchResultsBodyProps = {
	query: string;
	flatRows: LauncherRow[];
	results: SearchResult[];
	fileResultsForQuery: RecentFile[];
	actionResultsForQuery: QuickAction[];
	quickActions: QuickAction[];
	recentAppsLimited: DesktopItem[];
	recentDocumentsUnifiedLimited: RecentFile[];
	libraryRecentProjectsLimited: RecentFile[];
	libraryRecentGeneratedLimited: RecentFile[];
	libraryRecentUploadedLimited: RecentFile[];
	libraryRecentAddedLimited: RecentFile[];
	pinnedItems: DesktopItem[];
	contentManagerItem: DesktopItem | null;
	browseSectionStarts: BrowseSectionStarts;
	selectedIndex: number;
	setSelectedIndex: (index: number) => void;
	itemVariants: Variants;
	iconStyle: DesktopIconStyle;
	activateRow: (row: LauncherRow) => void;
	openAppCtx: (e: React.MouseEvent, data: SearchResult | DesktopItem) => void;
	openFileCtx: (e: React.MouseEvent, file: RecentFile) => void;
	openActionCtx: (e: React.MouseEvent, action: QuickAction) => void;
	onOpenRecentFile?: (file: RecentFile) => void;
	onQuickAction?: (actionId: string) => void;
	onOpenItem: (item: DesktopItem) => void;
	t: TFunction;
};

export function QuickSearchResultsBody({
	query,
	flatRows,
	results,
	fileResultsForQuery,
	actionResultsForQuery,
	quickActions,
	recentAppsLimited,
	recentDocumentsUnifiedLimited,
	libraryRecentProjectsLimited,
	libraryRecentGeneratedLimited,
	libraryRecentUploadedLimited,
	libraryRecentAddedLimited,
	pinnedItems,
	contentManagerItem,
	browseSectionStarts,
	selectedIndex,
	setSelectedIndex,
	itemVariants,
	iconStyle,
	activateRow,
	openAppCtx,
	openFileCtx,
	openActionCtx,
	onOpenRecentFile,
	onQuickAction,
	onOpenItem,
	t,
}: QuickSearchResultsBodyProps) {
	return (
		<div className="max-h-[min(60vh,calc(100dvh-13rem),520px)] overflow-y-auto overscroll-y-contain">
			{flatRows.length === 0 && query ? (
				<DesktopAppEmptyState
					className="py-10"
					icon={
						<MagnifyingGlassIcon
							className="h-8 w-8 text-(--desktop-text-muted)"
							strokeWidth={1.75}
							aria-hidden
						/>
					}
					title={t('quickSearch.emptyTitle')}
					description={t('quickSearch.emptyDescription')}
				/>
			) : (
				<div className="p-2 space-y-4">
					{query && results.length > 0 && (
						<section>
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'uppercase tracking-wider px-3 py-2 flex items-center gap-2'
								)}
							>
								<StarIcon className="w-3 h-3" />
								{t('quickSearch.appsHeading')}
							</div>
							{results.map((result, idx) => {
								const flatIdx = idx;
								const item = result.item;
								return (
									<QuickSearchLauncherRow
										key={item.id}
										tooltip={quickSearchLauncherTooltipLabel(
											item.name,
											item.description
										)}
										variants={itemVariants}
										onClick={() => activateRow({ type: 'app', data: result })}
										onContextMenu={(e) => openAppCtx(e, result)}
										onMouseEnter={() => setSelectedIndex(flatIdx)}
										className={qsLauncherRowClass(selectedIndex === flatIdx)}
									>
										{renderQuickSearchLauncherLeadingIcon(item, iconStyle)}
										<div className="flex-1 min-w-0">
											<div className="font-medium truncate">
												{highlightQuickSearchMatch(item.name, query)}
											</div>
											{item.description && (
												<div
													className={cn(DESKTOP_TYPOGRAPHY.meta, 'truncate')}
												>
													{item.description}
												</div>
											)}
										</div>
										<span
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'capitalize shrink-0'
											)}
										>
											{item.type === 'app'
												? t('quickSearch.appKind')
												: item.type === 'folder'
													? t('quickSearch.folderKind')
													: t('quickSearch.fileKind')}
										</span>
										<ChevronRightIcon className="w-4 h-4 text-(--desktop-text-muted) shrink-0" />
									</QuickSearchLauncherRow>
								);
							})}
						</section>
					)}
					{query && fileResultsForQuery.length > 0 && onOpenRecentFile && (
						<section>
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'uppercase tracking-wider px-3 py-2 flex items-center gap-2'
								)}
							>
								<ClockIcon className="w-3 h-3" />
								{t('quickSearch.recentFilesHeading')}
							</div>
							{fileResultsForQuery.map((file, idx) => {
								const flatIdx = results.length + idx;
								return (
									<QuickSearchLauncherRow
										key={file.id}
										tooltip={quickSearchLauncherTooltipLabel(
											file.name,
											file.path
										)}
										variants={itemVariants}
										onClick={() => activateRow({ type: 'file', data: file })}
										onContextMenu={(e) => openFileCtx(e, file)}
										onMouseEnter={() => setSelectedIndex(flatIdx)}
										className={qsLauncherRowClass(selectedIndex === flatIdx)}
									>
										{renderQuickSearchRecentFileLeadingIcon(file)}
										<div className="flex-1 min-w-0">
											<div className="font-medium truncate">{file.name}</div>
											<div className={cn(DESKTOP_TYPOGRAPHY.meta, 'truncate')}>
												{file.path}
											</div>
										</div>
										<ChevronRightIcon className="w-4 h-4 text-(--desktop-text-muted) shrink-0" />
									</QuickSearchLauncherRow>
								);
							})}
						</section>
					)}
					{query && actionResultsForQuery.length > 0 && onQuickAction && (
						<section>
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'uppercase tracking-wider px-3 py-2 flex items-center gap-2'
								)}
							>
								<BoltIcon className="w-3 h-3" />
								{t('quickSearch.quickActionsHeading')}
							</div>
							{actionResultsForQuery.map((action, idx) => {
								const flatIdx =
									results.length + fileResultsForQuery.length + idx;
								return (
									<QuickSearchLauncherRow
										key={action.id}
										tooltip={quickSearchLauncherTooltipLabel(
											action.label,
											action.description
										)}
										variants={itemVariants}
										onClick={() =>
											activateRow({ type: 'action', data: action })
										}
										onContextMenu={(e) => openActionCtx(e, action)}
										onMouseEnter={() => setSelectedIndex(flatIdx)}
										className={qsLauncherRowClass(selectedIndex === flatIdx)}
									>
										<div
											className={cn(
												'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--desktop-accent-rgb)/0.18)] p-2',
												DESKTOP_TYPOGRAPHY.matchHighlight
											)}
										>
											{action.icon ?? <BoltIcon className="h-5 w-5" />}
										</div>
										<div className="flex-1 min-w-0">
											<div className="font-medium truncate">{action.label}</div>
											{action.description && (
												<div
													className={cn(DESKTOP_TYPOGRAPHY.meta, 'truncate')}
												>
													{action.description}
												</div>
											)}
										</div>
										<ChevronRightIcon className="w-4 h-4 text-(--desktop-text-muted) shrink-0" />
									</QuickSearchLauncherRow>
								);
							})}
						</section>
					)}
					{!query && quickActions.length > 0 && onQuickAction && (
						<section>
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'uppercase tracking-wider px-3 py-2 flex items-center gap-2'
								)}
							>
								<BoltIcon className="w-3 h-3" />
								{t('quickSearch.quickActionsHeading')}
							</div>
							{quickActions.map((action, idx) => (
								<QuickSearchLauncherRow
									key={action.id}
									tooltip={quickSearchLauncherTooltipLabel(
										action.label,
										action.description
									)}
									variants={itemVariants}
									onClick={() => activateRow({ type: 'action', data: action })}
									onContextMenu={(e) => openActionCtx(e, action)}
									onMouseEnter={() => setSelectedIndex(idx)}
									className={qsLauncherRowClass(selectedIndex === idx)}
								>
									<div
										className={cn(
											'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--desktop-accent-rgb)/0.18)] p-2',
											DESKTOP_TYPOGRAPHY.matchHighlight
										)}
									>
										{action.icon ?? <BoltIcon className="h-5 w-5" />}
									</div>
									<div className="flex-1 min-w-0">
										<div className="font-medium truncate">{action.label}</div>
										{action.description && (
											<div className={cn(DESKTOP_TYPOGRAPHY.meta, 'truncate')}>
												{action.description}
											</div>
										)}
									</div>
									<ChevronRightIcon className="w-4 h-4 text-(--desktop-text-muted) shrink-0" />
								</QuickSearchLauncherRow>
							))}
						</section>
					)}
					{!query &&
						recentDocumentsUnifiedLimited.length === 0 &&
						onOpenRecentFile &&
						contentManagerItem && (
							<section className="px-3 py-4">
								<DesktopAppEmptyState
									className="py-6"
									title={t('quickSearch.recentFilesHeading')}
									description={t('quickSearch.noRecentFilesHelpDesc')}
								>
									<DesktopAppButton
										type="button"
										variant="neutral"
										size="sm"
										onClick={() => onOpenItem(contentManagerItem)}
									>
										{t('quickSearch.noRecentFilesHelp')}
									</DesktopAppButton>
								</DesktopAppEmptyState>
							</section>
						)}
					{!query &&
						recentDocumentsUnifiedLimited.length > 0 &&
						onOpenRecentFile && (
							<section className={DESKTOP_LIBRARY_FEED_CARD_QUICK_SEARCH}>
								<div className="flex gap-2.5">
									<div
										className={DESKTOP_LIBRARY_FEED_ICON_WRAP_QUICK_SEARCH}
										aria-hidden
									>
										<ClockIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									</div>
									<div className="min-w-0 flex-1">
										<div
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'flex items-center gap-2 py-1.5 uppercase tracking-wider'
											)}
										>
											{t('quickSearch.recentDocumentsUnifiedHeading')}
										</div>
										{recentDocumentsUnifiedLimited.map((file, idx) => {
											const flatIdx =
												browseSectionStarts.unifiedDocsStart + idx;
											return (
												<QuickSearchLauncherRow
													key={`doc-uni-${file.id}`}
													tooltip={quickSearchLauncherTooltipLabel(
														file.name,
														file.path
													)}
													variants={itemVariants}
													onClick={() =>
														activateRow({ type: 'file', data: file })
													}
													onContextMenu={(e) => openFileCtx(e, file)}
													onMouseEnter={() => setSelectedIndex(flatIdx)}
													className={qsLauncherRowClass(
														selectedIndex === flatIdx,
														true
													)}
												>
													{renderQuickSearchRecentFileLeadingIcon(file)}
													<div className="min-w-0 flex-1">
														<div className="truncate font-medium">
															{file.name}
														</div>
														<div
															className={cn(
																DESKTOP_TYPOGRAPHY.meta,
																'truncate'
															)}
														>
															{file.path}
														</div>
													</div>
													<ChevronRightIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
												</QuickSearchLauncherRow>
											);
										})}
									</div>
								</div>
							</section>
						)}
					{!query &&
						libraryRecentProjectsLimited.length > 0 &&
						onOpenRecentFile && (
							<section className={DESKTOP_LIBRARY_FEED_CARD_QUICK_SEARCH}>
								<div className="flex gap-2.5">
									<div
										className={DESKTOP_LIBRARY_FEED_ICON_WRAP_QUICK_SEARCH}
										aria-hidden
									>
										<FolderIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									</div>
									<div className="min-w-0 flex-1">
										<div
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'flex items-center gap-2 py-1.5 uppercase tracking-wider'
											)}
										>
											{t('quickSearch.recentProjectsHeading')}
										</div>
										{libraryRecentProjectsLimited.map((file, idx) => {
											const flatIdx = browseSectionStarts.projectsStart + idx;
											return (
												<QuickSearchLauncherRow
													key={`lib-proj-${file.id}`}
													tooltip={quickSearchLauncherTooltipLabel(
														file.name,
														file.path
													)}
													variants={itemVariants}
													onClick={() =>
														activateRow({ type: 'file', data: file })
													}
													onContextMenu={(e) => openFileCtx(e, file)}
													onMouseEnter={() => setSelectedIndex(flatIdx)}
													className={qsLauncherRowClass(
														selectedIndex === flatIdx,
														true
													)}
												>
													{renderQuickSearchRecentFileLeadingIcon(file)}
													<div className="min-w-0 flex-1">
														<div className="truncate font-medium">
															{file.name}
														</div>
														<div
															className={cn(
																DESKTOP_TYPOGRAPHY.meta,
																'truncate'
															)}
														>
															{file.path}
														</div>
													</div>
													<ChevronRightIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
												</QuickSearchLauncherRow>
											);
										})}
									</div>
								</div>
							</section>
						)}
					{!query &&
						libraryRecentGeneratedLimited.length > 0 &&
						onOpenRecentFile && (
							<section className={DESKTOP_LIBRARY_FEED_CARD_QUICK_SEARCH}>
								<div className="flex gap-2.5">
									<div
										className={DESKTOP_LIBRARY_FEED_ICON_WRAP_QUICK_SEARCH}
										aria-hidden
									>
										<SparklesIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									</div>
									<div className="min-w-0 flex-1">
										<div
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'flex items-center gap-2 py-1.5 uppercase tracking-wider'
											)}
										>
											{t('quickSearch.libraryGeneratedHeading')}
										</div>
										{libraryRecentGeneratedLimited.map((file, idx) => {
											const flatIdx = browseSectionStarts.libGenStart + idx;
											return (
												<QuickSearchLauncherRow
													key={`lib-gen-${file.id}`}
													tooltip={quickSearchLauncherTooltipLabel(
														file.name,
														file.path
													)}
													variants={itemVariants}
													onClick={() =>
														activateRow({ type: 'file', data: file })
													}
													onContextMenu={(e) => openFileCtx(e, file)}
													onMouseEnter={() => setSelectedIndex(flatIdx)}
													className={qsLauncherRowClass(
														selectedIndex === flatIdx,
														true
													)}
												>
													{renderQuickSearchRecentFileLeadingIcon(file)}
													<div className="min-w-0 flex-1">
														<div className="truncate font-medium">
															{file.name}
														</div>
														<div
															className={cn(
																DESKTOP_TYPOGRAPHY.meta,
																'truncate'
															)}
														>
															{file.path}
														</div>
													</div>
													<ChevronRightIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
												</QuickSearchLauncherRow>
											);
										})}
									</div>
								</div>
							</section>
						)}
					{!query &&
						libraryRecentUploadedLimited.length > 0 &&
						onOpenRecentFile && (
							<section className={DESKTOP_LIBRARY_FEED_CARD_QUICK_SEARCH}>
								<div className="flex gap-2.5">
									<div
										className={DESKTOP_LIBRARY_FEED_ICON_WRAP_QUICK_SEARCH}
										aria-hidden
									>
										<ArrowUpTrayIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									</div>
									<div className="min-w-0 flex-1">
										<div
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'flex items-center gap-2 py-1.5 uppercase tracking-wider'
											)}
										>
											{t('quickSearch.libraryUploadedHeading')}
										</div>
										{libraryRecentUploadedLimited.map((file, idx) => {
											const flatIdx = browseSectionStarts.libUpStart + idx;
											return (
												<QuickSearchLauncherRow
													key={`lib-up-${file.id}`}
													tooltip={quickSearchLauncherTooltipLabel(
														file.name,
														file.path
													)}
													variants={itemVariants}
													onClick={() =>
														activateRow({ type: 'file', data: file })
													}
													onContextMenu={(e) => openFileCtx(e, file)}
													onMouseEnter={() => setSelectedIndex(flatIdx)}
													className={qsLauncherRowClass(
														selectedIndex === flatIdx,
														true
													)}
												>
													{renderQuickSearchRecentFileLeadingIcon(file)}
													<div className="min-w-0 flex-1">
														<div className="truncate font-medium">
															{file.name}
														</div>
														<div
															className={cn(
																DESKTOP_TYPOGRAPHY.meta,
																'truncate'
															)}
														>
															{file.path}
														</div>
													</div>
													<ChevronRightIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
												</QuickSearchLauncherRow>
											);
										})}
									</div>
								</div>
							</section>
						)}
					{!query &&
						libraryRecentAddedLimited.length > 0 &&
						onOpenRecentFile && (
							<section className={DESKTOP_LIBRARY_FEED_CARD_QUICK_SEARCH}>
								<div className="flex gap-2.5">
									<div
										className={DESKTOP_LIBRARY_FEED_ICON_WRAP_QUICK_SEARCH}
										aria-hidden
									>
										<PlusIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									</div>
									<div className="min-w-0 flex-1">
										<div
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'flex items-center gap-2 py-1.5 uppercase tracking-wider'
											)}
										>
											{t('quickSearch.libraryAddedHeading')}
										</div>
										{libraryRecentAddedLimited.map((file, idx) => {
											const flatIdx = browseSectionStarts.libAddedStart + idx;
											return (
												<QuickSearchLauncherRow
													key={`lib-added-${file.id}`}
													tooltip={quickSearchLauncherTooltipLabel(
														file.name,
														file.path
													)}
													variants={itemVariants}
													onClick={() =>
														activateRow({ type: 'file', data: file })
													}
													onContextMenu={(e) => openFileCtx(e, file)}
													onMouseEnter={() => setSelectedIndex(flatIdx)}
													className={qsLauncherRowClass(
														selectedIndex === flatIdx,
														true
													)}
												>
													{renderQuickSearchRecentFileLeadingIcon(file)}
													<div className="min-w-0 flex-1">
														<div className="truncate font-medium">
															{file.name}
														</div>
														<div
															className={cn(
																DESKTOP_TYPOGRAPHY.meta,
																'truncate'
															)}
														>
															{file.path}
														</div>
													</div>
													<ChevronRightIcon className="h-4 w-4 shrink-0 text-(--desktop-text-muted)" />
												</QuickSearchLauncherRow>
											);
										})}
									</div>
								</div>
							</section>
						)}
					{!query && recentAppsLimited.length > 0 && (
						<section>
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'uppercase tracking-wider px-3 py-2 flex items-center gap-2'
								)}
							>
								<StarIcon className="w-3 h-3" />
								{t('quickSearch.recentAppsHeading')}
							</div>
							{recentAppsLimited.map((item, idx) => {
								const flatIdx = browseSectionStarts.recentAppsStart + idx;
								return (
									<QuickSearchLauncherRow
										key={item.id}
										tooltip={item.name}
										variants={itemVariants}
										onClick={() => activateRow({ type: 'app', data: item })}
										onContextMenu={(e) => openAppCtx(e, item)}
										onMouseEnter={() => setSelectedIndex(flatIdx)}
										className={qsLauncherRowClass(selectedIndex === flatIdx)}
									>
										{renderQuickSearchLauncherLeadingIcon(item, iconStyle)}
										<div className="flex-1 min-w-0">
											<div className="font-medium truncate">{item.name}</div>
										</div>
										<ChevronRightIcon className="w-4 h-4 text-(--desktop-text-muted) shrink-0" />
									</QuickSearchLauncherRow>
								);
							})}
						</section>
					)}
					{!query && pinnedItems.length > 0 && (
						<section className="border-t border-(--desktop-border-subtle) pt-2">
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'uppercase tracking-wider px-3 py-2 flex items-center gap-2'
								)}
							>
								<StarIcon className="w-3 h-3" />
								{t('quickSearch.pinnedHeading')}
							</div>
							{pinnedItems.map((item, idx) => {
								const flatIdx = browseSectionStarts.pinnedStart + idx;
								return (
									<QuickSearchLauncherRow
										key={item.id}
										tooltip={item.name}
										variants={itemVariants}
										onClick={() => activateRow({ type: 'app', data: item })}
										onContextMenu={(e) => openAppCtx(e, item)}
										onMouseEnter={() => setSelectedIndex(flatIdx)}
										className={qsLauncherRowClass(selectedIndex === flatIdx)}
									>
										{renderQuickSearchLauncherLeadingIcon(item, iconStyle)}
										<div className="flex-1 min-w-0">
											<div className="font-medium truncate">{item.name}</div>
										</div>
										<ChevronRightIcon className="w-4 h-4 text-(--desktop-text-muted) shrink-0" />
									</QuickSearchLauncherRow>
								);
							})}
						</section>
					)}
				</div>
			)}
		</div>
	);
}
