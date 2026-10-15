/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Quick Search launcher shell: backdrop, input chrome, results mount (P23 orchestrator).
 *
 * Invariants:
 * - Keyboard/escape logic lives in useQuickSearchModel; results in QuickSearchResultsBody.
 * - data-desktop-shell-keyboard-surface on dialog root for shell capture contract.
 *
 * Related:
 * - quickSearch/useQuickSearchModel.ts
 * - desktopShellSearchAutofocus.ts, useShellCaptureKeyboard.ts
 * - documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md
 */

import { AnimatePresence, m } from 'framer-motion';
import * as React from 'react';
import { useDesktopShellMotionPrefs } from '../context/DesktopShellMotionPrefsContext';
import {
	DESKTOP_LUCIDE,
	DESKTOP_OVERLAY,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import {
	useDesktopWindowPortalStackBase,
	useEmbeddedPortaledModalZIndex,
} from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';
import { applyDesktopContextMenuPolicy } from '../utils/desktopContextMenuPolicy';
import { getDesktopShellPanelClassName } from '../utils/desktopVisualSystem';
import {
	DESKTOP_QUICK_SEARCH_FEED_STATUS_STRIP,
	DESKTOP_QUICK_SEARCH_ROLE_PANEL,
} from '../utils/desktopLibraryFeedCard';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppSectionLabel,
	DesktopAppToolbar,
} from './DesktopAppChrome';
import { DesktopChromeTooltip } from './DesktopChromeTooltip';
import {
	ArrowPathIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import {
	itemVariantsForMotion,
	searchVariantsForMotion,
} from './quickSearch/helpers';
import { QuickSearchContextMenu } from './quickSearch/QuickSearchContextMenu';
import { QuickSearchResultsBody } from './quickSearch/QuickSearchResultsBody';
import type { QuickAction, QuickSearchProps } from './quickSearch/types';
import { useQuickSearchModel } from './quickSearch/useQuickSearchModel';

export type { QuickAction };

export const QuickSearch: React.FC<QuickSearchProps> = ({
	isOpen,
	onClose,
	items,
	onOpenItem,
	recentItems = [],
	recentFiles = [],
	recentLibraryOpened = [],
	recentLibraryAdded = [],
	recentLibraryGenerated = [],
	recentLibraryUploaded = [],
	recentLibraryProjects = [],
	recentContentFeedLoading = false,
	recentContentFeedError = null,
	onRefetchRecentContentFeed,
	onOpenRecentFile,
	removeRecentFile,
	onPinAppToDesktop,
	quickActions = [],
	onQuickAction,
	iconStyle = 'glass',
	shellWindowStyle = 'glass',
}) => {
	const portalStackBase = useDesktopWindowPortalStackBase();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const { reduceMotion, speed } = useDesktopShellMotionPrefs();
	const searchVariants = searchVariantsForMotion(reduceMotion, speed);
	const itemVariants = itemVariantsForMotion(reduceMotion, speed);

	const {
		t,
		query,
		setQuery,
		selectedIndex,
		setSelectedIndex,
		results,
		ctxMenu,
		ctxMenuRef,
		inputRef,
		containerRef,
		closeCtxMenu,
		copyLauncherText,
		openAppCtx,
		openFileCtx,
		openActionCtx,
		fileResultsForQuery,
		actionResultsForQuery,
		recentAppsLimited,
		recentDocumentsUnifiedLimited,
		libraryRecentProjectsLimited,
		libraryRecentGeneratedLimited,
		libraryRecentUploadedLimited,
		libraryRecentAddedLimited,
		pinnedItems,
		contentManagerItem,
		flatRows,
		browseSectionStarts,
		activateRow,
		handleContainerKeyDown,
	} = useQuickSearchModel({
		isOpen,
		onClose,
		items,
		onOpenItem,
		recentItems,
		recentFiles,
		recentLibraryOpened,
		recentLibraryAdded,
		recentLibraryGenerated,
		recentLibraryUploaded,
		recentLibraryProjects,
		onOpenRecentFile,
		onQuickAction,
		quickActions,
	});

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<m.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className={`fixed inset-0 ${DESKTOP_OVERLAY.backdrop}`}
						style={{ zIndex: embeddedModalZ.backdrop }}
						onClick={onClose}
						aria-hidden
					/>

					<m.div
						ref={containerRef}
						role="dialog"
						aria-modal="true"
						aria-label={t('quickSearch.dialogLabel')}
						data-desktop-shell-keyboard-surface=""
						variants={searchVariants}
						initial="hidden"
						animate="visible"
						exit="exit"
						className={cn(
							'fixed top-24 left-1/2 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden',
							getDesktopShellPanelClassName(shellWindowStyle, 'strong')
						)}
						style={{ zIndex: embeddedModalZ.content }}
						onKeyDown={handleContainerKeyDown}
						onContextMenu={(e) =>
							applyDesktopContextMenuPolicy(e, { stopPropagation: false })
						}
					>
						<DesktopAppToolbar
							className={cn(
								'relative gap-3 border-b border-(--desktop-border-subtle) px-4 py-3.5',
								'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_32%,transparent)]'
							)}
						>
							<div
								className="pointer-events-none flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--desktop-surface-soft) text-(--desktop-text-muted) [&_svg]:stroke-[1.35]"
								aria-hidden
							>
								<MagnifyingGlassIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							</div>
							<DesktopAppInput
								ref={inputRef}
								type="text"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder={t('quickSearch.searchPlaceholder')}
								aria-label={t('quickSearch.searchAria')}
								className={cn(
									'min-w-0 flex-1 border-0 bg-transparent py-2 pr-10 shadow-none focus:border-0 focus:bg-transparent focus:ring-0',
									DESKTOP_TYPOGRAPHY.quickSearchInput
								)}
								autoComplete="off"
							/>
							{query ? (
								<DesktopChromeTooltip
									content={t('quickSearch.clearAria')}
									placement="bottom"
									offsetExtra={6}
								>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setQuery('')}
										aria-label={t('quickSearch.clearAria')}
										className="absolute! right-4! min-w-0! rounded-lg! p-1!"
									>
										<XMarkIcon className="h-4 w-4 text-(--desktop-text-muted)" />
									</DesktopAppButton>
								</DesktopChromeTooltip>
							) : null}
						</DesktopAppToolbar>

						<div className={cn(DESKTOP_QUICK_SEARCH_ROLE_PANEL)}>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<DesktopAppSectionLabel className="tracking-[0.16em]">
										{t('quickSearch.roleTitle')}
									</DesktopAppSectionLabel>
									<p
										className={cn(
											DESKTOP_TYPOGRAPHY.meta,
											'mt-1 leading-relaxed'
										)}
									>
										{t('quickSearch.roleDescription')}
									</p>
								</div>
								<span
									className={cn(
										DESKTOP_TYPOGRAPHY.sectionPill,
										'shrink-0 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1'
									)}
									aria-hidden
								>
									{t('quickSearch.roleBadge')}
								</span>
							</div>
						</div>

						{onRefetchRecentContentFeed ||
						recentContentFeedLoading ||
						recentContentFeedError ? (
							<div className={DESKTOP_QUICK_SEARCH_FEED_STATUS_STRIP}>
								<div className="flex flex-wrap items-center gap-2">
									{recentContentFeedLoading ? (
										<span
											className={cn(
												DESKTOP_TYPOGRAPHY.caption,
												'text-(--desktop-text-muted) animate-pulse'
											)}
										>
											{t('quickSearch.libraryFeedLoading')}
										</span>
									) : null}
									{recentContentFeedError ? (
										<p
											className={cn(
												'rounded-md border px-2 py-1.5 text-sm',
												'border-red-500/25 bg-red-500/6 text-(--desktop-text-primary)'
											)}
											role="alert"
										>
											{recentContentFeedError}
										</p>
									) : null}
									{onRefetchRecentContentFeed ? (
										<DesktopAppButton
											type="button"
											variant="ghost"
											size="sm"
											disabled={recentContentFeedLoading}
											onClick={() => void onRefetchRecentContentFeed()}
											className="ms-auto"
										>
											<ArrowPathIcon
												className={cn(
													'h-3.5 w-3.5',
													recentContentFeedLoading && 'animate-spin'
												)}
												strokeWidth={DESKTOP_LUCIDE.stroke}
												aria-hidden
											/>
											<span className="ms-1.5">
												{t('quickSearch.refreshLibrary')}
											</span>
										</DesktopAppButton>
									) : null}
								</div>
							</div>
						) : null}

						<QuickSearchResultsBody
							query={query}
							flatRows={flatRows}
							results={results}
							fileResultsForQuery={fileResultsForQuery}
							actionResultsForQuery={actionResultsForQuery}
							quickActions={quickActions}
							recentAppsLimited={recentAppsLimited}
							recentDocumentsUnifiedLimited={recentDocumentsUnifiedLimited}
							libraryRecentProjectsLimited={libraryRecentProjectsLimited}
							libraryRecentGeneratedLimited={libraryRecentGeneratedLimited}
							libraryRecentUploadedLimited={libraryRecentUploadedLimited}
							libraryRecentAddedLimited={libraryRecentAddedLimited}
							pinnedItems={pinnedItems}
							contentManagerItem={contentManagerItem}
							browseSectionStarts={browseSectionStarts}
							selectedIndex={selectedIndex}
							setSelectedIndex={setSelectedIndex}
							itemVariants={itemVariants}
							iconStyle={iconStyle}
							activateRow={activateRow}
							openAppCtx={openAppCtx}
							openFileCtx={openFileCtx}
							openActionCtx={openActionCtx}
							onOpenRecentFile={onOpenRecentFile}
							onQuickAction={onQuickAction}
							onOpenItem={onOpenItem}
							t={t}
						/>

						<div
							className={cn(
								DESKTOP_TYPOGRAPHY.meta,
								'px-5 py-3 border-t border-(--desktop-border-subtle) flex items-center justify-between'
							)}
						>
							<div className="flex items-center gap-4">
								<span>{t('quickSearch.footerNav')}</span>
								<span>{t('quickSearch.footerOpen')}</span>
								<span>{t('quickSearch.footerClose')}</span>
							</div>
							<div className="text-end">
								{!query ? (
									<span data-testid="quick-search-empty-browse-hint">
										{t('quickSearch.emptyBrowseHint')}
									</span>
								) : (
									t('quickSearch.footerWinS')
								)}
							</div>
						</div>
					</m.div>

					<QuickSearchContextMenu
						ctxMenu={ctxMenu}
						ctxMenuRef={ctxMenuRef}
						t={t}
						portalStackBase={portalStackBase}
						onOpenItem={onOpenItem}
						onClose={onClose}
						onPinAppToDesktop={onPinAppToDesktop}
						onOpenRecentFile={onOpenRecentFile}
						removeRecentFile={removeRecentFile}
						onQuickAction={onQuickAction}
						closeCtxMenu={closeCtxMenu}
						copyLauncherText={copyLauncherText}
					/>
				</>
			)}
		</AnimatePresence>
	);
};
