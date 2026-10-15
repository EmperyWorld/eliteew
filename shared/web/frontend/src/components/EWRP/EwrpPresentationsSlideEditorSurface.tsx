/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Slide-editor surface for the EWRP Presentations tab: chrome, search, structure/tips collapsibles, virtual/DnD slide list, and sticky footer.
 *
 * Invariants:
 * - Props-driven presentational extract — no local orchestration SoT.
 * - Parent `EwrpPresentationsTabPanel` remains the Presentations tab orchestrator.
 * - In `editorFocusMode`, the slide list is the sole vertical scroll owner:
 *   `flex-1 min-h-0` (never `min-h-[…vh…]`) so sticky footer and last slides stay reachable.
 *
 * Related:
 * - `EwrpPresentationsTabPanel.tsx`
 * - `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`
 * - `documentation/product/EWRP-EDITOR.md`
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	type SensorDescriptor,
	type SensorOptions,
} from '@dnd-kit/core';
import {
	SortableContext,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	VirtualVariableList,
	type VirtualVariableListHandle,
} from '@/components/shared/VirtualList';
import type { EwrpSlide, EwrpStatusResponse } from '../../services/ewrpApi';
import { EwrpCollapsibleSection } from './EwrpCollapsibleSection';
import { EwrpSlideEditorQuickNav } from './EwrpSlideEditorQuickNav';
import { EwrpSlideEditorStickyFooter } from './EwrpSlideEditorStickyFooter';
import {
	EWRP_MAX_SLIDES_EDITOR,
	EWRP_MIN_SLIDES_EDITOR,
	sw,
	EwrpSlideOutlineRow,
	EwrpDraftSlideRow,
	EwrpSortableDraftSlideRow,
} from './EwrpGeneratorChunks';
import type { EwrpSlideEditorAiControls } from './EwrpSlideEditorPanel';
import {
	ArrowPathIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

export type EwrpPresentationsSlideEditorSurfaceProps = {
	editorFocusMode: boolean;
	secondaryBtnClass: string;
	primaryBtnClass: string;
	shellPanel: string;
	shellInset: string;
	shellField: string;
	shellSelectClass: string;
	jobId: string | null;
	status: EwrpStatusResponse;
	slidesListKey: string;
	draftSlides: EwrpSlide[];
	slideEditorAnchorRef: RefObject<HTMLDivElement | null>;
	handleExpandAllSlides: () => void;
	handleCollapseAllSlides: () => void;
	slideListLayout: 'comfortable' | 'compact';
	setSlideListLayout: Dispatch<SetStateAction<'comfortable' | 'compact'>>;
	slideEditorSearch: string;
	setSlideEditorSearch: Dispatch<SetStateAction<string>>;
	slideFilterQuery: string;
	visibleSlideIndices: number[];
	editorChromeOpen: boolean;
	setEditorChromeOpen: Dispatch<SetStateAction<boolean>>;
	editorOnboardingDismissed: boolean;
	setEditorOnboardingDismissed: Dispatch<SetStateAction<boolean>>;
	virtualizeEditorSlides: boolean;
	editorStructureOpen: boolean;
	setEditorStructureOpen: Dispatch<SetStateAction<boolean>>;
	editorTipsOpen: boolean;
	setEditorTipsOpen: Dispatch<SetStateAction<boolean>>;
	editorQuickNavIndices: number[];
	editorNavActiveIndex: number;
	setEditorNavActiveIndex: Dispatch<SetStateAction<number>>;
	scrollToDraftSlide: (index: number) => void;
	slideEditorScrollRef: RefObject<HTMLDivElement | null>;
	editorListMeasureRef: RefObject<HTMLDivElement | null>;
	handleChangeTitle: (index: number, title: string) => void;
	handleChangeBullets: (index: number, text: string) => void;
	handleChangeLayout: (index: number, layout: string) => void;
	handleDraftMoveUp: (index: number) => void;
	handleDraftMoveDown: (index: number) => void;
	handleDraftRemove: (index: number) => void;
	slideAi: EwrpSlideEditorAiControls;
	slidePanelOpen: boolean[];
	handleSlidePanelOpenChange: (index: number, open: boolean) => void;
	editorVirtualListRef: RefObject<VirtualVariableListHandle | null>;
	estimateDraftSlideVirtualSize: (index: number) => number;
	editorVirtualListHeight: number;
	draftDndSensors: SensorDescriptor<SensorOptions>[];
	handleDraftDragEnd: (event: DragEndEvent) => void;
	draftSortIds: string[];
	draftIsDirty: boolean;
	saving: boolean;
	slideRebuildInProgress: boolean;
	estimatedSlidesNeedingNewUgs: number;
	estimatedNewImagesEnergy: number;
	handleDraftAddSlide: () => void;
	handleCancelEdit: () => void;
	handleSaveSlides: () => void;
	setPdfPresentationOpen: Dispatch<SetStateAction<boolean>>;
};

export function EwrpPresentationsSlideEditorSurface(
	props: EwrpPresentationsSlideEditorSurfaceProps
) {
	const { t } = useTranslation('ewrp');
	const {
		editorFocusMode,
		secondaryBtnClass,
		primaryBtnClass,
		shellPanel,
		shellInset,
		shellField,
		shellSelectClass,
		jobId,
		status,
		slidesListKey,
		draftSlides,
		slideEditorAnchorRef,
		handleExpandAllSlides,
		handleCollapseAllSlides,
		slideListLayout,
		setSlideListLayout,
		slideEditorSearch,
		setSlideEditorSearch,
		slideFilterQuery,
		visibleSlideIndices,
		editorChromeOpen,
		setEditorChromeOpen,
		editorOnboardingDismissed,
		setEditorOnboardingDismissed,
		virtualizeEditorSlides,
		editorStructureOpen,
		setEditorStructureOpen,
		editorTipsOpen,
		setEditorTipsOpen,
		editorQuickNavIndices,
		editorNavActiveIndex,
		setEditorNavActiveIndex,
		scrollToDraftSlide,
		slideEditorScrollRef,
		editorListMeasureRef,
		handleChangeTitle,
		handleChangeBullets,
		handleChangeLayout,
		handleDraftMoveUp,
		handleDraftMoveDown,
		handleDraftRemove,
		slideAi,
		slidePanelOpen,
		handleSlidePanelOpenChange,
		editorVirtualListRef,
		estimateDraftSlideVirtualSize,
		editorVirtualListHeight,
		draftDndSensors,
		handleDraftDragEnd,
		draftSortIds,
		draftIsDirty,
		saving,
		slideRebuildInProgress,
		estimatedSlidesNeedingNewUgs,
		estimatedNewImagesEnergy,
		handleDraftAddSlide,
		handleCancelEdit,
		handleSaveSlides,
		setPdfPresentationOpen,
	} = props;

	return (
		<div
			ref={slideEditorAnchorRef}
			className={cn(
				editorFocusMode
					? 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-(--glass-border) bg-(--desktop-surface-panel)/40 ring-1 ring-black/4'
					: cn(
							shellPanel,
							'mt-4 flex flex-col overflow-x-hidden rounded-xl p-0 ring-1 ring-black/4'
						)
			)}
		>
			<div
				className={cn(
					'shrink-0 border-b border-(--desktop-border-subtle)',
					editorFocusMode ? 'px-2 py-1.5 sm:px-3' : 'px-3 py-2 sm:px-4'
				)}
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<p className="text-[11px] font-semibold uppercase tracking-wide text-(--desktop-text-secondary)">
						{t('form.textEditorTitle')}
						<span className="ml-2 text-[10px] font-medium tabular-nums text-(--desktop-text-dim)">
							{draftSlides.length}
						</span>
					</p>
					{!editorFocusMode ? (
						<div className="flex flex-wrap items-center gap-2">
							{draftSlides.length > 1 ? (
								<div className="flex flex-wrap gap-1">
									<button
										type="button"
										onClick={handleExpandAllSlides}
										className={cn(secondaryBtnClass, 'px-2 py-1 text-[10px]')}
									>
										{t('form.expandAllSlides')}
									</button>
									<button
										type="button"
										onClick={handleCollapseAllSlides}
										className={cn(secondaryBtnClass, 'px-2 py-1 text-[10px]')}
									>
										{t('form.collapseAllSlides')}
									</button>
								</div>
							) : null}
							<ToggleGroup.Root
								type="single"
								value={slideListLayout}
								onValueChange={(v) => {
									if (v === 'comfortable' || v === 'compact') {
										setSlideListLayout(v);
									}
								}}
								className="inline-flex gap-0.5 rounded-lg border border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/35 p-0.5"
								aria-label={t('draftSlide.listModeGroupAria')}
							>
								<ToggleGroup.Item
									value="comfortable"
									className={cn(
										'rounded-md px-2 py-1 text-[10px] font-semibold outline-none transition-colors',
										'text-(--desktop-text-muted) hover:text-(--desktop-text-secondary)',
										'data-[state=on]:bg-(--desktop-surface-panel) data-[state=on]:text-(--desktop-text-primary) data-[state=on]:shadow-sm',
										DESKTOP_CHROME_FOCUS_VISIBLE
									)}
								>
									{t('draftSlide.listModeComfortable')}
								</ToggleGroup.Item>
								<ToggleGroup.Item
									value="compact"
									className={cn(
										'rounded-md px-2 py-1 text-[10px] font-semibold outline-none transition-colors',
										'text-(--desktop-text-muted) hover:text-(--desktop-text-secondary)',
										'data-[state=on]:bg-(--desktop-surface-panel) data-[state=on]:text-(--desktop-text-primary) data-[state=on]:shadow-sm',
										DESKTOP_CHROME_FOCUS_VISIBLE
									)}
								>
									{t('draftSlide.listModeCompact')}
								</ToggleGroup.Item>
							</ToggleGroup.Root>
							<span
								className="shrink-0 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-200/95"
								title={t('form.rebuildSameVisualTitle')}
							>
								{t('form.rebuildPdfFreeLine')}
							</span>
						</div>
					) : (
						<span
							className="shrink-0 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-200/95"
							title={t('form.rebuildSameVisualTitle')}
						>
							{t('form.rebuildPdfFreeLine')}
						</span>
					)}
				</div>
				<div
					className={cn(
						'flex min-w-0 items-center gap-2',
						editorFocusMode ? 'mt-1.5' : 'mt-3'
					)}
				>
					<div className="relative min-w-0 flex-1">
						<MagnifyingGlassIcon
							className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--desktop-text-dim)"
							strokeWidth={sw}
							aria-hidden
						/>
						<input
							id="ewrp-slide-editor-search"
							type="search"
							value={slideEditorSearch}
							onChange={(e) => setSlideEditorSearch(e.target.value)}
							placeholder={t('form.slideSearchPlaceholder')}
							aria-label={t('form.slideSearchAria')}
							aria-describedby={
								slideFilterQuery ? 'ewrp-slide-search-count' : undefined
							}
							className={cn(
								shellField,
								'w-full py-2 pl-9 text-xs',
								slideEditorSearch.trim() ? 'pr-9' : null
							)}
						/>
						{slideEditorSearch.trim() ? (
							<button
								type="button"
								className={cn(
									'absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-(--desktop-text-dim)',
									'hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-secondary)',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								aria-label={t('form.slideSearchClearAria')}
								onClick={() => setSlideEditorSearch('')}
							>
								<XMarkIcon className="h-3.5 w-3.5" strokeWidth={sw} />
							</button>
						) : null}
					</div>
					{slideFilterQuery ? (
						<span
							id="ewrp-slide-search-count"
							className="shrink-0 tabular-nums text-[10px] text-(--desktop-text-dim)"
							aria-live="polite"
						>
							{visibleSlideIndices.length}/{draftSlides.length}
						</span>
					) : null}
				</div>
				{slideRebuildInProgress ? (
					<div
						role="status"
						className={cn(
							'mt-1.5 flex gap-2.5 rounded-lg border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] px-3 py-2 text-[11px]',
							editorFocusMode ? 'mb-1' : 'mt-3'
						)}
					>
						<ArrowPathIcon
							className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[rgb(var(--desktop-accent-rgb)/0.95)]"
							strokeWidth={sw}
							aria-hidden
						/>
						<div className="min-w-0">
							<p className="font-semibold text-(--desktop-text-primary)">
								{t('notify.waitForRebuild')}
							</p>
							<p className="mt-0.5 leading-relaxed text-(--desktop-text-dim)">
								{t('notify.waitForRebuildSub')}
							</p>
						</div>
					</div>
				) : null}
				{editorFocusMode ? (
					<EwrpCollapsibleSection
						open={editorChromeOpen}
						onOpenChange={setEditorChromeOpen}
						title={t('form.editorChromeCollapsibleTitle')}
						summary={t('form.editorChromeCollapsibleSummary', {
							count: draftSlides.length,
						})}
						className="mt-1.5 border-0 bg-transparent"
					>
						{draftSlides.length > 1 ? (
							<div className="flex flex-wrap gap-1">
								<button
									type="button"
									onClick={handleExpandAllSlides}
									className={cn(secondaryBtnClass, 'px-2 py-1 text-[10px]')}
								>
									{t('form.expandAllSlides')}
								</button>
								<button
									type="button"
									onClick={handleCollapseAllSlides}
									className={cn(secondaryBtnClass, 'px-2 py-1 text-[10px]')}
								>
									{t('form.collapseAllSlides')}
								</button>
							</div>
						) : null}
						<ToggleGroup.Root
							type="single"
							value={slideListLayout}
							onValueChange={(v) => {
								if (v === 'comfortable' || v === 'compact') {
									setSlideListLayout(v);
								}
							}}
							className="inline-flex gap-0.5 rounded-lg border border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/35 p-0.5"
							aria-label={t('draftSlide.listModeGroupAria')}
						>
							<ToggleGroup.Item
								value="comfortable"
								className={cn(
									'rounded-md px-2 py-1 text-[10px] font-semibold outline-none transition-colors',
									'text-(--desktop-text-muted) hover:text-(--desktop-text-secondary)',
									'data-[state=on]:bg-(--desktop-surface-panel) data-[state=on]:text-(--desktop-text-primary) data-[state=on]:shadow-sm',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
							>
								{t('draftSlide.listModeComfortable')}
							</ToggleGroup.Item>
							<ToggleGroup.Item
								value="compact"
								className={cn(
									'rounded-md px-2 py-1 text-[10px] font-semibold outline-none transition-colors',
									'text-(--desktop-text-muted) hover:text-(--desktop-text-secondary)',
									'data-[state=on]:bg-(--desktop-surface-panel) data-[state=on]:text-(--desktop-text-primary) data-[state=on]:shadow-sm',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
							>
								{t('draftSlide.listModeCompact')}
							</ToggleGroup.Item>
						</ToggleGroup.Root>
						<div className="space-y-2">
							<p className="text-[10px] font-semibold uppercase tracking-wide text-(--desktop-text-dim)">
								{t('form.draftStructureTitle')}
							</p>
							<ul className="max-h-40 divide-y divide-(--desktop-border-subtle) overflow-y-auto rounded-lg border border-(--desktop-border-subtle)/50 text-xs [contain-intrinsic-size:auto_3rem] [content-visibility:auto]">
								{draftSlides.map((slide, idx) => (
									<EwrpSlideOutlineRow
										// biome-ignore lint/suspicious/noArrayIndexKey: draft order is fixed
										key={`${slidesListKey}-edit-outline-${idx}`}
										index={idx}
										slide={slide}
										jobId={jobId}
									/>
								))}
							</ul>
						</div>
						<div className="space-y-2 border-t border-(--desktop-border-subtle)/40 pt-3">
							<p className="text-[10px] font-semibold uppercase tracking-wide text-(--desktop-text-dim)">
								{t('form.editorTipsTitle')}
							</p>
							{!editorOnboardingDismissed ? (
								<div
									role="note"
									className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[rgb(var(--desktop-accent-rgb)/0.22)] bg-[rgb(var(--desktop-accent-rgb)/0.06)] px-3 py-2.5"
								>
									<div className="min-w-0 flex-1">
										<p className="text-[11px] font-semibold text-(--desktop-text-primary)">
											{t('form.editorOnboardingTitle')}
										</p>
										<p className="mt-1 text-[11px] leading-relaxed text-(--desktop-text-secondary)">
											{t('form.editorOnboardingBody')}
										</p>
									</div>
									<button
										type="button"
										className={cn(secondaryBtnClass, 'shrink-0 text-[10px]')}
										onClick={() => {
											try {
												localStorage.setItem('ewrp-editor-onboarding-v1', '1');
											} catch {
												/* ignore */
											}
											setEditorOnboardingDismissed(true);
										}}
									>
										{t('form.editorOnboardingDismiss')}
									</button>
								</div>
							) : null}
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.small,
									'text-(--desktop-text-dim)'
								)}
							>
								{t('form.editorHelp')}
							</p>
							{virtualizeEditorSlides ? (
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.small,
										'text-(--desktop-text-dim)'
									)}
								>
									{t('form.editorVirtualListDndOff')}
								</p>
							) : !slideFilterQuery && draftSlides.length > 1 ? (
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.small,
										'text-(--desktop-text-dim)'
									)}
								>
									{t('form.dndHint')}
								</p>
							) : null}
						</div>
					</EwrpCollapsibleSection>
				) : (
					<>
						{draftSlides.length > 0 ? (
							<EwrpCollapsibleSection
								open={editorStructureOpen}
								onOpenChange={setEditorStructureOpen}
								title={t('form.draftStructureTitle')}
								summary={t('form.editorStructureSummary', {
									count: draftSlides.length,
								})}
								className="mt-3 border-0 bg-transparent"
							>
								<ul className="max-h-48 divide-y divide-(--desktop-border-subtle) overflow-y-auto rounded-lg border border-(--desktop-border-subtle)/50 text-xs [contain-intrinsic-size:auto_3rem] [content-visibility:auto]">
									{draftSlides.map((slide, idx) => (
										<EwrpSlideOutlineRow
											// biome-ignore lint/suspicious/noArrayIndexKey: draft order is fixed
											key={`${slidesListKey}-edit-outline-${idx}`}
											index={idx}
											slide={slide}
											jobId={jobId}
										/>
									))}
								</ul>
							</EwrpCollapsibleSection>
						) : null}
						<EwrpCollapsibleSection
							open={editorTipsOpen}
							onOpenChange={setEditorTipsOpen}
							title={t('form.editorTipsTitle')}
							summary={t('form.editorTipsSummary')}
							className="mt-3"
						>
							{!editorOnboardingDismissed ? (
								<div
									role="note"
									className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[rgb(var(--desktop-accent-rgb)/0.22)] bg-[rgb(var(--desktop-accent-rgb)/0.06)] px-3 py-2.5"
								>
									<div className="min-w-0 flex-1">
										<p className="text-[11px] font-semibold text-(--desktop-text-primary)">
											{t('form.editorOnboardingTitle')}
										</p>
										<p className="mt-1 text-[11px] leading-relaxed text-(--desktop-text-secondary)">
											{t('form.editorOnboardingBody')}
										</p>
									</div>
									<button
										type="button"
										className={cn(secondaryBtnClass, 'shrink-0 text-[10px]')}
										onClick={() => {
											try {
												localStorage.setItem('ewrp-editor-onboarding-v1', '1');
											} catch {
												/* ignore */
											}
											setEditorOnboardingDismissed(true);
										}}
									>
										{t('form.editorOnboardingDismiss')}
									</button>
								</div>
							) : null}
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.small,
									'text-(--desktop-text-dim)'
								)}
							>
								{t('form.editorHelp')}
							</p>
							{virtualizeEditorSlides ? (
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.small,
										'text-(--desktop-text-dim)'
									)}
								>
									{t('form.editorVirtualListDndOff')}
								</p>
							) : !slideFilterQuery && draftSlides.length > 1 ? (
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.small,
										'text-(--desktop-text-dim)'
									)}
								>
									{t('form.dndHint')}
								</p>
							) : null}
						</EwrpCollapsibleSection>
					</>
				)}
			</div>
			{editorQuickNavIndices.length > 1 ? (
				<EwrpSlideEditorQuickNav
					indices={editorQuickNavIndices}
					titles={draftSlides.map((s) => s.title)}
					activeIndex={editorNavActiveIndex}
					onGoToSlide={scrollToDraftSlide}
					onScrollActiveIndex={setEditorNavActiveIndex}
					trackScrollPosition={!virtualizeEditorSlides && !slideFilterQuery}
					scrollContainerRef={slideEditorScrollRef}
				/>
			) : null}
			<div
				ref={
					editorFocusMode && virtualizeEditorSlides
						? editorListMeasureRef
						: slideEditorScrollRef
				}
				className={cn(
					editorFocusMode
						? // Focus mode: fill remaining column height; never force vh min-height
							// (that overflowed overflow-hidden ancestors and clipped sticky footer).
							virtualizeEditorSlides
							? 'min-h-0 flex-1 overflow-hidden px-3 pb-4 sm:px-4'
							: 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 sm:px-4'
						: cn(
								'px-4 pb-2',
								virtualizeEditorSlides
									? 'min-h-0'
									: 'min-h-[200px] max-h-[min(65vh,640px)] overflow-y-auto overscroll-contain'
							)
				)}
			>
				<div className="space-y-3 pt-3 [content-visibility:auto]">
					{slideFilterQuery && visibleSlideIndices.length === 0 ? (
						<div className="flex flex-col items-center gap-3 py-6">
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.small,
									'text-center text-(--desktop-text-dim)'
								)}
							>
								{t('form.slideSearchEmpty')}
							</p>
							<button
								type="button"
								onClick={() => setSlideEditorSearch('')}
								className={cn(secondaryBtnClass, 'text-[11px]')}
							>
								{t('form.slideSearchReset')}
							</button>
						</div>
					) : slideFilterQuery ? (
						visibleSlideIndices.map((idx) => {
							const slide = draftSlides[idx];
							return (
								<EwrpDraftSlideRow
									key={`${slidesListKey}-draft-${idx}`}
									index={idx}
									slide={slide}
									shellInset={shellInset}
									shellField={shellField}
									shellSelectClass={shellSelectClass}
									onTitleChange={handleChangeTitle}
									onBulletsChange={handleChangeBullets}
									onLayoutChange={handleChangeLayout}
									isFirstSlide={idx === 0}
									onMoveUp={handleDraftMoveUp}
									onMoveDown={handleDraftMoveDown}
									onRemove={handleDraftRemove}
									canMoveUp={idx > 0}
									canMoveDown={idx < draftSlides.length - 1}
									canRemove={draftSlides.length > EWRP_MIN_SLIDES_EDITOR}
									slideActions={slideAi.renderSlideActions(idx, slide)}
									slideExpandedOpen={slidePanelOpen[idx] ?? true}
									onSlideExpandedChange={(open) =>
										handleSlidePanelOpenChange(idx, open)
									}
									jobId={jobId}
								/>
							);
						})
					) : virtualizeEditorSlides ? (
						<VirtualVariableList
							virtualListRef={editorVirtualListRef}
							items={draftSlides}
							estimateSize={estimateDraftSlideVirtualSize}
							height={editorFocusMode ? editorVirtualListHeight : 560}
							className={
								editorFocusMode
									? 'min-h-[200px] h-full'
									: 'max-h-[min(65vh,640px)] min-h-[200px]'
							}
							getItemKey={(i) => `ewrp-slide-pos-${i}`}
							onVisibleIndexChange={setEditorNavActiveIndex}
							renderItem={(slide, idx) => (
								<EwrpDraftSlideRow
									key={`${slidesListKey}-draft-v-${idx}`}
									index={idx}
									slide={slide}
									shellInset={shellInset}
									shellField={shellField}
									shellSelectClass={shellSelectClass}
									onTitleChange={handleChangeTitle}
									onBulletsChange={handleChangeBullets}
									onLayoutChange={handleChangeLayout}
									isFirstSlide={idx === 0}
									onMoveUp={handleDraftMoveUp}
									onMoveDown={handleDraftMoveDown}
									onRemove={handleDraftRemove}
									canMoveUp={idx > 0}
									canMoveDown={idx < draftSlides.length - 1}
									canRemove={draftSlides.length > EWRP_MIN_SLIDES_EDITOR}
									slideActions={slideAi.renderSlideActions(idx, slide)}
									slideExpandedOpen={slidePanelOpen[idx] ?? true}
									onSlideExpandedChange={(open) =>
										handleSlidePanelOpenChange(idx, open)
									}
									jobId={jobId}
								/>
							)}
						/>
					) : draftSlides.length > 1 ? (
						<DndContext
							sensors={draftDndSensors}
							collisionDetection={closestCenter}
							onDragEnd={handleDraftDragEnd}
						>
							<SortableContext
								items={draftSortIds}
								strategy={verticalListSortingStrategy}
							>
								{draftSlides.map((slide, idx) => (
									<EwrpSortableDraftSlideRow
										key={draftSortIds[idx]}
										sortableId={draftSortIds[idx]}
										index={idx}
										slide={slide}
										shellInset={shellInset}
										shellField={shellField}
										shellSelectClass={shellSelectClass}
										onTitleChange={handleChangeTitle}
										onBulletsChange={handleChangeBullets}
										onLayoutChange={handleChangeLayout}
										isFirstSlide={idx === 0}
										onMoveUp={handleDraftMoveUp}
										onMoveDown={handleDraftMoveDown}
										onRemove={handleDraftRemove}
										canMoveUp={idx > 0}
										canMoveDown={idx < draftSlides.length - 1}
										canRemove={draftSlides.length > EWRP_MIN_SLIDES_EDITOR}
										slideActions={slideAi.renderSlideActions(idx, slide)}
										slideExpandedOpen={slidePanelOpen[idx] ?? true}
										onSlideExpandedChange={(open) =>
											handleSlidePanelOpenChange(idx, open)
										}
										jobId={jobId}
									/>
								))}
							</SortableContext>
						</DndContext>
					) : (
						draftSlides.map((slide, idx) => (
							<EwrpDraftSlideRow
								// biome-ignore lint/suspicious/noArrayIndexKey: slide order is fixed; no stable id
								key={`${slidesListKey}-draft-${idx}`}
								index={idx}
								slide={slide}
								shellInset={shellInset}
								shellField={shellField}
								shellSelectClass={shellSelectClass}
								onTitleChange={handleChangeTitle}
								onBulletsChange={handleChangeBullets}
								onLayoutChange={handleChangeLayout}
								isFirstSlide={idx === 0}
								onMoveUp={handleDraftMoveUp}
								onMoveDown={handleDraftMoveDown}
								onRemove={handleDraftRemove}
								canMoveUp={idx > 0}
								canMoveDown={idx < draftSlides.length - 1}
								canRemove={draftSlides.length > EWRP_MIN_SLIDES_EDITOR}
								slideActions={slideAi.renderSlideActions(idx, slide)}
								slideExpandedOpen={slidePanelOpen[idx] ?? true}
								onSlideExpandedChange={(open) =>
									handleSlidePanelOpenChange(idx, open)
								}
								jobId={jobId}
							/>
						))
					)}
				</div>
			</div>
			<EwrpSlideEditorStickyFooter
				slideCount={draftSlides.length}
				maxSlides={EWRP_MAX_SLIDES_EDITOR}
				draftIsDirty={draftIsDirty}
				saving={saving}
				slideRebuildInProgress={slideRebuildInProgress}
				estimatedSlidesNeedingNewUgs={estimatedSlidesNeedingNewUgs}
				estimatedNewImagesEnergy={estimatedNewImagesEnergy}
				showPdfPreview={
					status.status === 'completed' && Boolean(status.pdf_url)
				}
				onAddSlide={handleDraftAddSlide}
				onCancel={handleCancelEdit}
				onSave={handleSaveSlides}
				onPreviewPdf={
					status.pdf_url ? () => setPdfPresentationOpen(true) : undefined
				}
				secondaryBtnClass={secondaryBtnClass}
				primaryBtnClass={primaryBtnClass}
			/>
		</div>
	);
}
