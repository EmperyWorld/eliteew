/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentational overlays for EWRP Main: history / document-picker modals, lazy PDF
 * viewer host, confirm dialogs, and the spotlight guide. Props-driven — no local SoT.
 *
 * Invariants:
 * - Orchestration state stays in `useEwrpGeneratorOrchestration`; this file only renders.
 * - Heavy PDF viewer stays lazy via Suspense.
 *
 * Related:
 * - `EWRPGeneratorMain.tsx`, `useEwrpGeneratorOrchestration.tsx`
 * - `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`
 */

import { cn } from '@/utils/cn';
import { lazy, Suspense, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_OVERLAY,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import {
	VirtualList,
	VirtualVariableList,
} from '@/components/shared/VirtualList';
import {
	SpotlightGuideModal,
	type SpotlightGuideModalLabels,
	type SpotlightGuideStep,
} from '@/components/guided-tour/SpotlightGuideModal';
import {
	EWRP_GUIDE_AUDIO_LS_KEY,
	EWRP_GUIDE_ROOT_ID,
	EWRP_GUIDE_TOUR_FOLDER,
} from './ewrpGuideConstants';
import {
	EWRP_HISTORY_VIRTUAL_HEIGHT_PX,
	EWRP_DOC_PICKER_VIRTUAL_HEIGHT_PX,
	EwrpHistoryListSkeleton,
	formatEwrpDocPickerDate,
	sw,
	contentTypeBadgeShort,
	type ContentItem,
} from './EwrpGeneratorChunks';
import { EwrpInlineErrorAlert } from './EwrpInlineErrorAlert';
import { ewrpZIndexClass } from './ewrpZIndex';
import { EwrpExpandableClampedText } from './EwrpExpandableClampedText';
import type { EwrpJobListItem } from '../../services/ewrpApi';
import {
	ArrowPathIcon,
	CheckIcon,
	ClockIcon,
	DocumentTextIcon,
	ExclamationTriangleIcon,
	MagnifyingGlassIcon,
	SparklesIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

const EwrpPdfPresentationViewer = lazy(async () => {
	const m = await import('./EwrpPdfPresentationViewer');
	return { default: m.EwrpPdfPresentationViewer };
});

export type EwrpGeneratorModalsProps = {
	shellField: string;
	shellPanel: string;
	secondaryBtnClass: string;
	historySearchInputRef: RefObject<HTMLInputElement | null>;
	docPickerSearchInputRef: RefObject<HTMLInputElement | null>;
	historyModalPanelRef: RefObject<HTMLDivElement | null>;
	docPickerModalPanelRef: RefObject<HTMLDivElement | null>;
	closeHistoryModal: () => void;
	closeDocPickerModal: () => void;
	refreshHistory: () => Promise<void> | void;
	loadMoreHistory: () => Promise<void> | void;
	retryDocPickerLoad: () => void;
	executePendingDelete: () => Promise<void> | void;
	performCancelEdit: () => void;
	runSaveSlides: () => Promise<void> | void;
	handlePickDocFromModal: (item: ContentItem) => void;
	renderVirtualHistoryRow: (row: EwrpJobListItem, index: number) => ReactNode;
	handleHistoryListEndReached: () => void;
	renderDocPickerVirtualItem: (item: ContentItem) => ReactNode;
	prepareGuideStep: (stepId: string) => void;
	guideSpotlightLayoutKey: string;
	guideOpen: boolean;
	setGuideOpen: (open: boolean) => void;
	guideSteps: SpotlightGuideStep[];
	guideLabels: SpotlightGuideModalLabels;
	isHistoryModalOpen: boolean;
	historyLoading: boolean;
	historyLoadingMore: boolean;
	historyHasMore: boolean;
	historyError: string | null;
	historyJobs: EwrpJobListItem[];
	filteredHistoryJobs: EwrpJobListItem[];
	historyListVirtualized: boolean;
	historyListSummary: string | null;
	historySearch: string;
	setHistorySearch: (value: string) => void;
	isDocPickerOpen: boolean;
	docPickerLoading: boolean;
	docPickerError: string | null;
	docItems: ContentItem[];
	filteredDocItems: ContentItem[];
	docPickerListVirtualized: boolean;
	docListSummary: string | null;
	docPickerSearch: string;
	setDocPickerSearch: (value: string) => void;
	sourceDocument: ContentItem | null;
	pdfPresentationOpen: boolean;
	setPdfPresentationOpen: (open: boolean) => void;
	jobId: string | null;
	presentationTitle: string;
	deleteTarget: { id: string; label: string } | null;
	setDeleteTarget: (target: { id: string; label: string } | null) => void;
	cancelEditConfirmOpen: boolean;
	setCancelEditConfirmOpen: (open: boolean) => void;
	saveMultiUgsConfirmOpen: boolean;
	setSaveMultiUgsConfirmOpen: (open: boolean) => void;
	estimatedSlidesNeedingNewUgs: number;
	estimatedNewImagesEnergy: number;
};

export function EwrpGeneratorModals({
	shellField,
	shellPanel,
	secondaryBtnClass,
	historySearchInputRef,
	docPickerSearchInputRef,
	historyModalPanelRef,
	docPickerModalPanelRef,
	closeHistoryModal,
	closeDocPickerModal,
	refreshHistory,
	loadMoreHistory,
	retryDocPickerLoad,
	executePendingDelete,
	performCancelEdit,
	runSaveSlides,
	handlePickDocFromModal,
	renderVirtualHistoryRow,
	handleHistoryListEndReached,
	renderDocPickerVirtualItem,
	prepareGuideStep,
	guideSpotlightLayoutKey,
	guideOpen,
	setGuideOpen,
	guideSteps,
	guideLabels,
	isHistoryModalOpen,
	historyLoading,
	historyLoadingMore,
	historyHasMore,
	historyError,
	historyJobs,
	filteredHistoryJobs,
	historyListVirtualized,
	historyListSummary,
	historySearch,
	setHistorySearch,
	isDocPickerOpen,
	docPickerLoading,
	docPickerError,
	docItems,
	filteredDocItems,
	docPickerListVirtualized,
	docListSummary,
	docPickerSearch,
	setDocPickerSearch,
	sourceDocument,
	pdfPresentationOpen,
	setPdfPresentationOpen,
	jobId,
	presentationTitle,
	deleteTarget,
	setDeleteTarget,
	cancelEditConfirmOpen,
	setCancelEditConfirmOpen,
	saveMultiUgsConfirmOpen,
	setSaveMultiUgsConfirmOpen,
	estimatedSlidesNeedingNewUgs,
	estimatedNewImagesEnergy,
}: EwrpGeneratorModalsProps) {
	const { t } = useTranslation('ewrp');

	return (
		<>
			{isHistoryModalOpen && (
				<div
					className={cn(
						'fixed inset-0 flex items-center justify-center px-4 py-6',
						ewrpZIndexClass.overlayModal,
						DESKTOP_OVERLAY.backdrop
					)}
					data-ewrp-ignore-hotkey
				>
					<button
						type="button"
						className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
						aria-label={t('form.closeAria')}
						onClick={closeHistoryModal}
						tabIndex={-1}
					/>
					<div
						ref={historyModalPanelRef}
						className={cn(
							DESKTOP_OVERLAY.panelSurfaceStrong,
							'relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col rounded-2xl p-6 shadow-[0_24px_64px_rgba(0,0,0,0.45)]'
						)}
						role="dialog"
						aria-modal="true"
						aria-labelledby="ewrp-history-modal-title"
						aria-describedby="ewrp-history-modal-desc"
						aria-busy={historyLoading || undefined}
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					>
						<div className="mb-4 flex shrink-0 items-center justify-between gap-3 border-b border-(--desktop-border-subtle)/60 pb-4">
							<div className="flex min-w-0 items-start gap-3">
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--desktop-accent-rgb)/0.1)] ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.18)]">
									<ClockIcon
										className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb)/0.95)]"
										strokeWidth={sw}
										aria-hidden
									/>
								</div>
								<div className="min-w-0">
									<p
										id="ewrp-history-modal-title"
										className="truncate text-sm font-semibold text-(--desktop-text-primary)"
									>
										{t('form.historySectionTitle')}
									</p>
									<p
										id="ewrp-history-modal-desc"
										className={cn(
											DESKTOP_TYPOGRAPHY.small,
											'mt-0.5 text-(--desktop-text-dim)'
										)}
									>
										{t('form.historyModalSubtitle')}
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={closeHistoryModal}
								className={cn(
									'rounded-lg p-2 text-(--desktop-text-muted)',
									DESKTOP_INTERACTIVE.btnRounded
								)}
								aria-label={t('form.closeAria')}
							>
								<XMarkIcon className="h-4 w-4" strokeWidth={sw} />
							</button>
						</div>
						<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
							<div className="flex shrink-0 flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={() => void refreshHistory()}
									disabled={historyLoading}
									aria-busy={historyLoading || undefined}
									className={cn(
										secondaryBtnClass,
										'gap-2 text-[11px]',
										historyLoading && 'pointer-events-none opacity-60'
									)}
									title={t('form.historyRefreshTitle')}
								>
									{historyLoading ? (
										<ArrowPathIcon
											className="h-3.5 w-3.5 shrink-0 animate-spin"
											strokeWidth={sw}
										/>
									) : (
										<ArrowPathIcon className="h-3.5 w-3.5" strokeWidth={sw} />
									)}
									{historyLoading
										? t('form.historyRefreshing')
										: t('form.historyRefreshButton')}
								</button>
							</div>
							<div className="relative shrink-0">
								<MagnifyingGlassIcon
									className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--desktop-text-dim)"
									strokeWidth={sw}
									aria-hidden
								/>
								<input
									ref={historySearchInputRef}
									id="ewrp-history-search"
									type="search"
									value={historySearch}
									onChange={(e) => setHistorySearch(e.target.value)}
									placeholder={t('form.historySearchPlaceholder')}
									title={t('form.historySearchTitle')}
									className={cn(
										shellField,
										'py-2 pl-9 text-sm',
										historySearch.trim() ? 'pr-9' : null
									)}
									aria-label={t('form.historySearchAria')}
								/>
								{historySearch.trim() ? (
									<button
										type="button"
										className={cn(
											'absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-(--desktop-text-dim)',
											'hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-secondary)',
											DESKTOP_CHROME_FOCUS_VISIBLE
										)}
										aria-label={t('form.historySearchClearAria')}
										onClick={() => setHistorySearch('')}
									>
										<XMarkIcon className="h-3.5 w-3.5" strokeWidth={sw} />
									</button>
								) : null}
							</div>
							{historyListSummary ? (
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.meta,
										'shrink-0 text-(--desktop-text-dim)'
									)}
									aria-live="polite"
								>
									{historyListSummary}
								</p>
							) : null}
							<div className="min-h-0 flex-1 overflow-hidden">
								{historyLoading && historyJobs.length === 0 ? (
									<EwrpHistoryListSkeleton />
								) : historyError && historyJobs.length === 0 ? (
									<EwrpInlineErrorAlert
										message={historyError}
										retryLabel={t('form.historyRetryLoad')}
										onRetry={() => void refreshHistory()}
										retryLoading={historyLoading}
										retryButtonClassName={cn(
											secondaryBtnClass,
											'self-start gap-2 text-[11px]'
										)}
									/>
								) : historyJobs.length === 0 ? (
									<div className="flex flex-col gap-3 rounded-xl border border-dashed border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/20 px-4 py-6">
										<p
											className={cn(
												DESKTOP_TYPOGRAPHY.body,
												'font-semibold text-(--desktop-text-primary)'
											)}
										>
											{t('form.historyEmptyTitle')}
										</p>
										<ol
											className={cn(
												DESKTOP_TYPOGRAPHY.small,
												'list-decimal space-y-2 pl-5 text-(--desktop-text-secondary)'
											)}
										>
											<li>{t('form.historyEmptyStep1')}</li>
											<li>{t('form.historyEmptyStep2')}</li>
											<li>{t('form.historyEmptyStep3')}</li>
										</ol>
									</div>
								) : filteredHistoryJobs.length === 0 ? (
									<div className="flex flex-col items-stretch gap-3">
										<p
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'rounded-lg border border-(--desktop-border-subtle)/60 bg-(--desktop-surface-soft)/30 px-3 py-4 text-center text-(--desktop-text-dim)'
											)}
										>
											{t('form.historyNoMatches')}
										</p>
										<button
											type="button"
											onClick={() => setHistorySearch('')}
											className={cn(
												secondaryBtnClass,
												'self-center text-[11px]'
											)}
										>
											{t('form.historyResetSearch')}
										</button>
									</div>
								) : historyListVirtualized ? (
									<div className="flex h-full min-h-0 flex-col gap-2">
										<div
											className={cn(
												shellPanel,
												'min-h-0 flex-1 overflow-hidden [contain-intrinsic-size:auto_3rem] [content-visibility:auto]'
											)}
										>
											<VirtualVariableList
												items={filteredHistoryJobs}
												estimateSize={() => 200}
												getItemKey={(index) =>
													filteredHistoryJobs[index]?.id ?? `ewrp-hist-${index}`
												}
												height={EWRP_HISTORY_VIRTUAL_HEIGHT_PX}
												overscanCount={5}
												className="text-sm"
												renderItem={renderVirtualHistoryRow}
												onEndReached={handleHistoryListEndReached}
												endReachedThreshold={8}
											/>
										</div>
										<p
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'shrink-0 text-center text-(--desktop-text-dim)'
											)}
										>
											{t('form.historyScrollHint')}
										</p>
									</div>
								) : (
									<div className="flex h-full min-h-0 flex-col gap-2">
										<div
											className={cn(
												shellPanel,
												'max-h-[min(52vh,480px)] min-h-0 flex-1 overflow-y-auto overscroll-contain [contain-intrinsic-size:auto_3rem] [content-visibility:auto]'
											)}
										>
											{filteredHistoryJobs.map((row, idx) => (
												<div key={row.id}>
													{renderVirtualHistoryRow(row, idx)}
												</div>
											))}
										</div>
										{historyHasMore ? (
											<button
												type="button"
												onClick={() => void loadMoreHistory()}
												disabled={historyLoadingMore || historyLoading}
												className={cn(
													secondaryBtnClass,
													'shrink-0 gap-2 self-center text-[11px]',
													(historyLoadingMore || historyLoading) &&
														'pointer-events-none opacity-60'
												)}
											>
												{historyLoadingMore ? (
													<ArrowPathIcon
														className="h-3.5 w-3.5 shrink-0 animate-spin"
														strokeWidth={sw}
													/>
												) : null}
												{t('form.historyLoadMore')}
											</button>
										) : null}
									</div>
								)}
							</div>
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'shrink-0 text-center text-(--desktop-text-dim)'
								)}
							>
								{t('form.historyModalFootnote')}
							</p>
						</div>
					</div>
				</div>
			)}
			{isDocPickerOpen && (
				<div
					className={cn(
						'fixed inset-0 flex items-center justify-center px-4',
						ewrpZIndexClass.overlayModal,
						DESKTOP_OVERLAY.backdrop
					)}
					data-ewrp-ignore-hotkey
				>
					<button
						type="button"
						className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
						aria-label={t('form.closeAria')}
						onClick={closeDocPickerModal}
						tabIndex={-1}
					/>
					<div
						ref={docPickerModalPanelRef}
						className={cn(
							DESKTOP_OVERLAY.panelSurfaceStrong,
							'relative z-10 w-full max-w-3xl rounded-2xl p-6 shadow-[0_24px_64px_rgba(0,0,0,0.45)]'
						)}
						role="dialog"
						aria-modal="true"
						aria-labelledby="ewrp-doc-picker-title"
						aria-describedby="ewrp-doc-picker-desc"
						aria-busy={docPickerLoading || undefined}
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					>
						<div className="mb-4 flex items-center justify-between gap-3 border-b border-(--desktop-border-subtle)/60 pb-4">
							<div className="flex min-w-0 items-start gap-3">
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--desktop-accent-rgb)/0.1)] ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.18)]">
									<DocumentTextIcon
										className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb)/0.95)]"
										strokeWidth={sw}
										aria-hidden
									/>
								</div>
								<div className="min-w-0">
									<p
										id="ewrp-doc-picker-title"
										className="truncate text-sm font-semibold text-(--desktop-text-primary)"
									>
										{t('form.docPickerTitle')}
									</p>
									<p
										id="ewrp-doc-picker-desc"
										className={cn(
											DESKTOP_TYPOGRAPHY.small,
											'mt-0.5 text-(--desktop-text-dim)'
										)}
									>
										{t('form.docPickerSubtitle')}
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={closeDocPickerModal}
								className={cn(
									'rounded-lg p-2 text-(--desktop-text-muted)',
									DESKTOP_INTERACTIVE.btnRounded
								)}
								aria-label={t('form.closeAria')}
							>
								<XMarkIcon className="h-4 w-4" strokeWidth={sw} />
							</button>
						</div>
						{docPickerLoading ? (
							<div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-(--desktop-border-subtle)/50 bg-(--desktop-surface-soft)/30 py-12 text-sm text-(--desktop-text-muted) antialiased">
								<ArrowPathIcon
									className="h-6 w-6 animate-spin text-[rgb(var(--desktop-accent-rgb)/0.85)]"
									strokeWidth={sw}
								/>
								<span>{t('form.docPickerLoading')}</span>
							</div>
						) : docPickerError ? (
							<EwrpInlineErrorAlert
								message={docPickerError}
								retryLabel={t('form.docPickerRetry')}
								onRetry={retryDocPickerLoad}
								retryLoading={docPickerLoading}
								retryButtonClassName={cn(
									secondaryBtnClass,
									'self-start gap-2 text-[11px]'
								)}
							/>
						) : docItems.length === 0 ? (
							<div className="flex flex-col items-center rounded-xl border border-dashed border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/20 px-6 py-10 text-center text-sm text-(--desktop-text-muted) antialiased">
								<div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-(--desktop-surface-accent) ring-1 ring-(--desktop-border-subtle)/80">
									<DocumentTextIcon
										className="h-6 w-6 text-(--desktop-text-dim)"
										strokeWidth={sw}
										aria-hidden
									/>
								</div>
								<p className="max-w-md leading-relaxed">
									{t('form.docPickerEmpty')}
								</p>
							</div>
						) : (
							<>
								<div className="relative mb-3">
									<MagnifyingGlassIcon
										className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--desktop-text-dim)"
										strokeWidth={sw}
										aria-hidden
									/>
									<input
										ref={docPickerSearchInputRef}
										id="ewrp-doc-picker-search"
										type="search"
										value={docPickerSearch}
										onChange={(e) => setDocPickerSearch(e.target.value)}
										placeholder={t('form.docSearchPlaceholder')}
										className={cn(
											shellField,
											'py-2 pl-9 text-sm',
											docPickerSearch.trim() ? 'pr-9' : null
										)}
										aria-label={t('form.docSearchAria')}
									/>
									{docPickerSearch.trim() ? (
										<button
											type="button"
											className={cn(
												'absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-(--desktop-text-dim)',
												'hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-secondary)',
												DESKTOP_CHROME_FOCUS_VISIBLE
											)}
											aria-label={t('form.docSearchClearAria')}
											onClick={() => setDocPickerSearch('')}
										>
											<XMarkIcon className="h-3.5 w-3.5" strokeWidth={sw} />
										</button>
									) : null}
								</div>
								{docListSummary ? (
									<p
										className={cn(
											DESKTOP_TYPOGRAPHY.meta,
											'mb-3 text-(--desktop-text-dim)'
										)}
										aria-live="polite"
									>
										{docListSummary}
									</p>
								) : null}
								{filteredDocItems.length === 0 ? (
									<div className="flex flex-col items-stretch gap-3">
										<p
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'rounded-lg border border-(--desktop-border-subtle)/60 bg-(--desktop-surface-soft)/30 px-3 py-4 text-center text-(--desktop-text-dim)'
											)}
										>
											{t('form.docNoMatches')}
										</p>
										{docPickerSearch.trim() ? (
											<button
												type="button"
												onClick={() => setDocPickerSearch('')}
												className={cn(
													secondaryBtnClass,
													'self-center text-[11px]'
												)}
											>
												{t('form.docSearchReset')}
											</button>
										) : null}
									</div>
								) : docPickerListVirtualized ? (
									<div
										className={cn(
											shellPanel,
											'overflow-hidden [contain-intrinsic-size:auto_3rem] [content-visibility:auto]'
										)}
									>
										<VirtualList
											items={filteredDocItems}
											itemHeight={56}
											height={EWRP_DOC_PICKER_VIRTUAL_HEIGHT_PX}
											overscanCount={6}
											className="text-sm"
											renderItem={renderDocPickerVirtualItem}
										/>
									</div>
								) : (
									<div
										className={cn(
											shellPanel,
											'max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain [contain-intrinsic-size:auto_3rem] [content-visibility:auto]'
										)}
									>
										<ul className="divide-y divide-(--desktop-border-subtle) text-sm">
											{filteredDocItems.map((item) => {
												const selected = sourceDocument?.id === item.id;
												return (
													<li key={item.id}>
														<button
															type="button"
															onClick={() => handlePickDocFromModal(item)}
															aria-current={selected ? 'true' : undefined}
															className={cn(
																'flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-(--desktop-surface-soft-hover)',
																selected &&
																	'bg-[rgb(var(--desktop-accent-rgb)/0.07)] ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.22)]'
															)}
														>
															<div className="flex min-w-0 flex-1 items-start gap-2">
																<span
																	className="mt-0.5 inline-flex h-6 min-w-7 shrink-0 items-center justify-center rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-accent) px-0.5 text-[10px] font-semibold tabular-nums text-(--desktop-text-secondary)"
																	title={item.content_type}
																>
																	{contentTypeBadgeShort(item.content_type)}
																</span>
																<EwrpExpandableClampedText
																	embedded
																	tone="secondary"
																	text={item.name}
																	textClassName="text-sm text-(--desktop-text-primary)"
																	expandLabelKey="form.docPickerFileNameExpand"
																	collapseLabelKey="form.docPickerFileNameCollapse"
																	stopTogglePropagation
																	maxLines={1}
																	className="min-w-0 flex-1"
																/>
															</div>
															<div className="mt-0.5 flex shrink-0 items-center gap-2">
																{selected ? (
																	<CheckIcon
																		className="h-4 w-4 text-[rgb(var(--desktop-accent-rgb)/0.95)]"
																		strokeWidth={sw}
																		aria-hidden
																	/>
																) : null}
																<span className="text-[11px] text-(--desktop-text-dim)">
																	{formatEwrpDocPickerDate(item.created_at)}
																</span>
															</div>
														</button>
													</li>
												);
											})}
										</ul>
									</div>
								)}
							</>
						)}
					</div>
				</div>
			)}
			{pdfPresentationOpen && jobId ? (
				<Suspense fallback={null}>
					<EwrpPdfPresentationViewer
						open={pdfPresentationOpen}
						onClose={() => setPdfPresentationOpen(false)}
						jobId={jobId}
						presentationTitle={presentationTitle}
					/>
				</Suspense>
			) : null}
			<ConfirmDeleteModal
				isOpen={deleteTarget !== null}
				onClose={() => setDeleteTarget(null)}
				onConfirm={executePendingDelete}
				title={t('form.deleteTitle')}
				warningMessage={
					deleteTarget
						? t('form.deleteWarning', { label: deleteTarget.label })
						: ''
				}
				confirmButtonLabel={t('historyList.delete')}
				cancelButtonLabel={t('form.deleteCancel')}
				confirmButtonLoadingLabel={t('form.deleteLoading')}
			/>
			<ConfirmDeleteModal
				isOpen={cancelEditConfirmOpen}
				onClose={() => setCancelEditConfirmOpen(false)}
				onConfirm={() => {
					performCancelEdit();
				}}
				title={t('form.cancelUnsavedTitle')}
				warningMessage={t('form.cancelUnsavedBody')}
				confirmButtonLabel={t('form.discardChanges')}
				cancelButtonLabel={t('form.cancel')}
				confirmIcon={<ExclamationTriangleIcon width={18} height={18} />}
				isDangerous={false}
			/>
			<ConfirmDeleteModal
				isOpen={saveMultiUgsConfirmOpen}
				onClose={() => setSaveMultiUgsConfirmOpen(false)}
				onConfirm={() => void runSaveSlides()}
				title={t('form.saveMultiUgsTitle')}
				warningMessage={t('form.saveMultiUgsBody', {
					count: estimatedSlidesNeedingNewUgs,
					energy: estimatedNewImagesEnergy,
				})}
				confirmButtonLabel={t('form.savePdfIdle')}
				cancelButtonLabel={t('form.cancel')}
				confirmIcon={<SparklesIcon className="h-4 w-4" strokeWidth={sw} />}
				isDangerous={false}
			/>
			<SpotlightGuideModal
				open={guideOpen}
				onClose={() => setGuideOpen(false)}
				rootId={EWRP_GUIDE_ROOT_ID}
				steps={guideSteps}
				audioLocalStorageKey={EWRP_GUIDE_AUDIO_LS_KEY}
				tourAudioFolder={EWRP_GUIDE_TOUR_FOLDER}
				labels={guideLabels}
				onPrepareStep={prepareGuideStep}
				spotlightLayoutKey={guideSpotlightLayoutKey}
				dialogTitleId="ewrp-guide-title"
			/>
		</>
	);
}
