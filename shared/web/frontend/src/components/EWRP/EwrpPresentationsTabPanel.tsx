/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentational Presentations-tab panel for EWRP (`ewrp-panel-presentations`): toolbar,
 * status column chrome, and composition of slide-editor / outline / idle / PDF extracts.
 * Orchestration (polling, status, save, slide AI) stays in the Main/hook layer.
 *
 * Invariants:
 * - No second state store — values/handlers arrive as props from `EWRPGeneratorMain`.
 * - Public mount path remains `EWRPGenerator.tsx` → `EWRPGeneratorMain.tsx`.
 *
 * Related:
 * - `EwrpPresentationsSlideEditorSurface.tsx`, `EwrpPresentationsStatusOutline.tsx`
 * - `EwrpPresentationsCompletedPdfActions.tsx`, `EwrpPresentationsIdleColumn.tsx`
 * - `EWRPGeneratorMain.tsx`, `EwrpGenerateTabPanel.tsx`, `EwrpGeneratorChunks.tsx`
 * - `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`
 * - `documentation/product/EWRP-EDITOR.md`
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
	type DragEndEvent,
	type SensorDescriptor,
	type SensorOptions,
} from '@dnd-kit/core';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { type VirtualVariableListHandle } from '@/components/shared/VirtualList';
import type {
	EwrpJobListItem,
	EwrpSlide,
	EwrpStatusResponse,
} from '../../services/ewrpApi';
import { EwrpCollapsibleSection } from './EwrpCollapsibleSection';
import { EwrpPresentationJobAdminBlock } from './EwrpPresentationJobAdminBlock';
import { sw, EwrpDraftRestoreBanner } from './EwrpGeneratorChunks';
import type { EwrpHistoryRowEnergyLabels } from './ewrpHistoryRowEnergyLabels';
import { EwrpPipelineSteps } from './EwrpPipelineSteps';
import { EwrpInlineErrorAlert } from './EwrpInlineErrorAlert';
import { EwrpExpandableClampedText } from './EwrpExpandableClampedText';
import { ewrpClampedTextNeedsExpand } from './ewrpExpandableClampedText';
import { EwrpPresentationsMiniStatusBar } from './EwrpPresentationsMiniStatusBar';
import { EwrpPresentationsSlideEditorSurface } from './EwrpPresentationsSlideEditorSurface';
import { EwrpPresentationsCompletedPdfActions } from './EwrpPresentationsCompletedPdfActions';
import { EwrpPresentationsIdleColumn } from './EwrpPresentationsIdleColumn';
import { EwrpPresentationsStatusOutline } from './EwrpPresentationsStatusOutline';
import { EwrpPresentationsScrollButton } from './EwrpPresentationsScrollButton';
import { EwrpStatusPhaseChip } from './EwrpStatusPhaseChip';
import type { EwrpSlideEditorAiControls } from './EwrpSlideEditorPanel';
import {
	ArrowPathIcon,
	ClockIcon,
	PlusIcon,
	PresentationChartBarIcon,
} from '@heroicons/react/24/outline';

export type EwrpPresentationsTabPanelProps = {
	editorFocusMode: boolean;
	statusColumnRef: RefObject<HTMLElement | null>;
	secondaryBtnClass: string;
	primaryBtnClass: string;
	shellPanel: string;
	shellInset: string;
	shellField: string;
	shellSelectClass: string;
	historyJobs: EwrpJobListItem[];
	historyError: string | null;
	historyLoading: boolean;
	draftRestorePrompt: { slides: EwrpSlide[]; savedAt: number } | null;
	showPresentationsScrollToEditor: boolean;
	focusPresentationsSlideEditor: () => void;
	jobId: string | null;
	status: EwrpStatusResponse | null;
	statusPanelVisible: boolean;
	showSlideEditorPanel: boolean;
	focusPresentationsStatusColumn: () => void;
	showPresentationsMiniStatus: boolean;
	statusPresentationLabel: string | null;
	activeJobBannerHeadline: string;
	statusProgressClamped: number;
	draftIsDirty: boolean;
	saving: boolean;
	slideRebuildInProgress: boolean;
	handleSaveSlides: () => void;
	handleCancelEdit: () => void;
	showMiniStatusScrollToEditor: boolean;
	applyDraftRestore: () => void;
	dismissDraftRestoreKeepEditing: () => void;
	isEditing: boolean;
	presentationsStatusFocusAnnouncement: string;
	presentationsEditorFocusAnnouncement: string;
	statusLiveText: string;
	statusPanelAnchorRef: RefObject<HTMLDivElement | null>;
	statusManualPollPending: boolean;
	handleManualPollStatus: () => void;
	canEditSlides: boolean;
	handleStartEdit: () => void;
	editorJobDetailsOpen: boolean;
	setEditorJobDetailsOpen: Dispatch<SetStateAction<boolean>>;
	statusMetaSlideCount: number | null;
	statusMetaThemeLabel: string | null;
	statusSourceLabel: string | null;
	statusSourcePending: boolean;
	statusExtraContextText: string | null;
	statusActionLabels: EwrpHistoryRowEnergyLabels | null;
	statusActionsBusy: boolean;
	jobIdExpanded: boolean;
	jobIdCopied: boolean;
	applyingInputsId: string | null;
	duplicatingId: string | null;
	retryingId: string | null;
	handleCopyJobId: () => void;
	setJobIdExpanded: Dispatch<SetStateAction<boolean>>;
	applyInputsFromJobId: (id: string) => void | Promise<void>;
	retryJobById: (id: string) => void | Promise<void>;
	duplicateJobById: (id: string) => void | Promise<void>;
	setPdfPresentationOpen: Dispatch<SetStateAction<boolean>>;
	copyDone: boolean;
	handleCopyOutline: () => void | Promise<void>;
	handleExportOutlineMarkdown: () => void;
	slidesListKey: string;
	draftSlides: EwrpSlide[] | null;
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
	estimatedSlidesNeedingNewUgs: number;
	estimatedNewImagesEnergy: number;
	handleDraftAddSlide: () => void;
	downloading: boolean;
	handleDownload: () => void | Promise<void>;
	handleOpenPdfNewTab: () => void;
	pdfUrlCopied: boolean;
	handleCopyPdfUrl: () => void | Promise<void>;
	statusPollError: string | null;
	setStatusPollError: Dispatch<SetStateAction<string | null>>;
	setStatusManualPollPending: Dispatch<SetStateAction<boolean>>;
	pollStatus: (id: string) => Promise<unknown>;
	refreshHistory: () => void | Promise<void>;
	setMainTab: Dispatch<SetStateAction<'generate' | 'presentations'>>;
	setIsHistoryModalOpen: Dispatch<SetStateAction<boolean>>;
};

export function EwrpPresentationsTabPanel(
	props: EwrpPresentationsTabPanelProps
) {
	const { t } = useTranslation('ewrp');
	const {
		editorFocusMode,
		statusColumnRef,
		secondaryBtnClass,
		primaryBtnClass,
		shellPanel,
		shellInset,
		shellField,
		shellSelectClass,
		historyJobs,
		historyError,
		historyLoading,
		draftRestorePrompt,
		showPresentationsScrollToEditor,
		focusPresentationsSlideEditor,
		jobId,
		status,
		statusPanelVisible,
		showSlideEditorPanel,
		focusPresentationsStatusColumn,
		showPresentationsMiniStatus,
		statusPresentationLabel,
		activeJobBannerHeadline,
		statusProgressClamped,
		draftIsDirty,
		saving,
		slideRebuildInProgress,
		handleSaveSlides,
		handleCancelEdit,
		showMiniStatusScrollToEditor,
		applyDraftRestore,
		dismissDraftRestoreKeepEditing,
		isEditing,
		presentationsStatusFocusAnnouncement,
		presentationsEditorFocusAnnouncement,
		statusLiveText,
		statusPanelAnchorRef,
		statusManualPollPending,
		handleManualPollStatus,
		canEditSlides,
		handleStartEdit,
		editorJobDetailsOpen,
		setEditorJobDetailsOpen,
		statusMetaSlideCount,
		statusMetaThemeLabel,
		statusSourceLabel,
		statusSourcePending,
		statusExtraContextText,
		statusActionLabels,
		statusActionsBusy,
		jobIdExpanded,
		jobIdCopied,
		applyingInputsId,
		duplicatingId,
		retryingId,
		handleCopyJobId,
		setJobIdExpanded,
		applyInputsFromJobId,
		retryJobById,
		duplicateJobById,
		setPdfPresentationOpen,
		copyDone,
		handleCopyOutline,
		handleExportOutlineMarkdown,
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
		estimatedSlidesNeedingNewUgs,
		estimatedNewImagesEnergy,
		handleDraftAddSlide,
		downloading,
		handleDownload,
		handleOpenPdfNewTab,
		pdfUrlCopied,
		handleCopyPdfUrl,
		statusPollError,
		setStatusPollError,
		setStatusManualPollPending,
		pollStatus,
		refreshHistory,
		setMainTab,
		setIsHistoryModalOpen,
	} = props;

	return (
		<div
			id="ewrp-panel-presentations"
			role="tabpanel"
			aria-labelledby="ewrp-tab-presentations"
			className={cn(
				'flex min-h-0 flex-1 flex-col',
				editorFocusMode
					? 'overflow-hidden px-2 py-2 sm:px-3 lg:px-4'
					: 'overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8'
			)}
		>
			<section
				ref={statusColumnRef}
				className={cn(
					'flex min-h-0 min-w-0 flex-1 flex-col',
					editorFocusMode ? 'gap-2 overflow-hidden' : 'gap-3'
				)}
			>
				{!editorFocusMode ? (
					<div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
						<div className="flex min-w-0 flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={() => setIsHistoryModalOpen(true)}
								className={cn(
									secondaryBtnClass,
									'gap-2 text-[11px] sm:text-xs'
								)}
								title={t('form.historyOpenModalTitle')}
							>
								<ClockIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={sw} />
								{t('form.historyOpenModal')}
								{historyJobs.length > 0 ? (
									<span className="rounded-md bg-(--desktop-surface-soft) px-1.5 py-px text-[10px] font-semibold tabular-nums text-(--desktop-text-dim)">
										{historyJobs.length}
									</span>
								) : null}
							</button>
							{draftRestorePrompt ? (
								<span
									className="inline-flex items-center rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100/95"
									title={t('sticky.metaLocalDraftTitle')}
								>
									{t('sticky.metaLocalDraft')}
								</span>
							) : null}
							{showPresentationsScrollToEditor ? (
								<EwrpPresentationsScrollButton
									variant="editor"
									onClick={focusPresentationsSlideEditor}
									buttonClassName={cn(
										secondaryBtnClass,
										'text-[11px] sm:text-xs'
									)}
								/>
							) : null}
							{jobId &&
							status &&
							!statusPanelVisible &&
							!showSlideEditorPanel ? (
								<EwrpPresentationsScrollButton
									variant="status"
									onClick={focusPresentationsStatusColumn}
									buttonClassName={cn(
										secondaryBtnClass,
										'text-[11px] sm:text-xs'
									)}
								/>
							) : null}
						</div>
						<button
							type="button"
							onClick={() => setMainTab('generate')}
							className={cn(secondaryBtnClass, 'shrink-0 gap-1.5 text-[11px]')}
						>
							<PlusIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={sw} />
							{t('tabs.newPresentation')}
						</button>
					</div>
				) : null}
				{!editorFocusMode ? (
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'shrink-0 text-(--desktop-text-dim)'
						)}
					>
						{t('tabs.workspaceLead')}
					</p>
				) : null}
				{showPresentationsMiniStatus && status ? (
					<EwrpPresentationsMiniStatusBar
						headline={statusPresentationLabel || activeJobBannerHeadline}
						status={status.status}
						statusUpdatedAt={status.updated_at}
						progressPercent={statusProgressClamped}
						draftIsDirty={draftIsDirty}
						saving={saving}
						slideRebuildInProgress={slideRebuildInProgress}
						onSave={() => handleSaveSlides()}
						onCancel={handleCancelEdit}
						onScrollToStatus={focusPresentationsStatusColumn}
						onScrollToEditor={
							showMiniStatusScrollToEditor
								? focusPresentationsSlideEditor
								: undefined
						}
						secondaryBtnClass={secondaryBtnClass}
						primaryBtnClass={primaryBtnClass}
					/>
				) : null}
				{draftRestorePrompt ? (
					<EwrpDraftRestoreBanner
						variant="sticky"
						slideCount={draftRestorePrompt.slides.length}
						savedAt={draftRestorePrompt.savedAt}
						onRestore={applyDraftRestore}
						onDismiss={dismissDraftRestoreKeepEditing}
						secondaryBtnClass={secondaryBtnClass}
					/>
				) : null}
				<div
					className={cn(
						'flex min-h-0 min-w-0 flex-1 flex-col',
						editorFocusMode ? 'gap-2 overflow-hidden' : isEditing && 'gap-3'
					)}
				>
					<div className="sr-only" aria-live="polite" aria-atomic="true">
						{presentationsStatusFocusAnnouncement ||
							presentationsEditorFocusAnnouncement ||
							statusLiveText}
					</div>
					{status ? (
						<div
							ref={statusPanelAnchorRef}
							className={cn(
								editorFocusMode
									? 'flex min-h-0 flex-1 flex-col gap-2 overflow-hidden'
									: cn(
											shellPanel,
											'flex min-h-[280px] flex-col overflow-x-hidden ring-1 ring-black/4'
										)
							)}
						>
							{!editorFocusMode ? (
								<div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-(--desktop-border-subtle)/50 pb-3">
									<div className="flex min-w-0 flex-1 flex-col gap-1">
										<div className="flex min-w-0 items-center gap-2">
											<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--desktop-accent-rgb)/0.12)] ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.2)]">
												<PresentationChartBarIcon
													className="h-4 w-4 text-[rgb(var(--desktop-accent-rgb)/0.95)]"
													strokeWidth={sw}
													aria-hidden
												/>
											</div>
											<span className="text-[11px] font-semibold uppercase tracking-wide text-(--desktop-text-dim)">
												{t('form.statusHeading')}
											</span>
										</div>
										{statusPresentationLabel ? (
											ewrpClampedTextNeedsExpand(statusPresentationLabel) ? (
												<EwrpExpandableClampedText
													text={statusPresentationLabel}
													tone="secondary"
													className="mt-0 pl-10"
													textClassName="text-sm font-medium leading-snug text-(--desktop-text-primary)"
													expandLabelKey="form.statusTopicExpand"
													collapseLabelKey="form.statusTopicCollapse"
												/>
											) : (
												<p className="truncate pl-10 text-sm font-medium text-(--desktop-text-primary)">
													{statusPresentationLabel}
												</p>
											)
										) : null}
									</div>
									<div className="flex flex-wrap items-center gap-2">
										{status ? (
											<EwrpStatusPhaseChip
												status={status.status}
												updatedAt={status.updated_at}
												size="md"
											/>
										) : null}
										{jobId && status.status !== 'completed' && (
											<button
												type="button"
												onClick={() => void handleManualPollStatus()}
												disabled={statusManualPollPending}
												aria-busy={statusManualPollPending || undefined}
												className={cn(
													'rounded-lg p-2 text-(--desktop-text-secondary)',
													DESKTOP_INTERACTIVE.btnRounded,
													statusManualPollPending && 'opacity-70'
												)}
												title={t('form.refreshStatusTitle')}
												aria-label={t('form.refreshStatusAria')}
											>
												{statusManualPollPending ? (
													<ArrowPathIcon
														className="h-4 w-4 animate-spin"
														strokeWidth={sw}
													/>
												) : (
													<ArrowPathIcon className="h-4 w-4" strokeWidth={sw} />
												)}
											</button>
										)}
										{isEditing ? (
											<button
												type="button"
												onClick={handleCancelEdit}
												className={secondaryBtnClass}
											>
												{t('form.exitEditMode')}
											</button>
										) : canEditSlides ? (
											<button
												type="button"
												onClick={handleStartEdit}
												className={cn(
													secondaryBtnClass,
													'border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-(--desktop-surface-accent)'
												)}
											>
												{t('form.editSlides')}
											</button>
										) : null}
									</div>
								</div>
							) : null}
							{editorFocusMode ? (
								<EwrpCollapsibleSection
									open={editorJobDetailsOpen}
									onOpenChange={setEditorJobDetailsOpen}
									title={t('form.jobDetailsCollapsibleTitle')}
									summary={
										statusPresentationLabel
											? t('form.jobDetailsCollapsibleSummaryWithTopic', {
													topic: statusPresentationLabel,
												})
											: t('form.jobDetailsCollapsibleSummary')
									}
									className="shrink-0"
								>
									<div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--desktop-border-subtle)/40 pb-3">
										<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
											{status ? (
												<EwrpStatusPhaseChip
													status={status.status}
													updatedAt={status.updated_at}
													size="md"
												/>
											) : null}
											{statusPresentationLabel ? (
												<p className="min-w-0 truncate text-sm font-medium text-(--desktop-text-primary)">
													{statusPresentationLabel}
												</p>
											) : null}
										</div>
										<button
											type="button"
											onClick={handleCancelEdit}
											className={cn(secondaryBtnClass, 'text-[11px]')}
										>
											{t('form.exitEditMode')}
										</button>
									</div>
									<EwrpPipelineSteps
										className="mb-3"
										progress={status.progress ?? 0}
										status={status.status}
									/>
									{jobId ? (
										<EwrpPresentationJobAdminBlock
											jobId={jobId}
											status={status}
											statusMetaSlideCount={statusMetaSlideCount}
											statusMetaThemeLabel={statusMetaThemeLabel}
											statusSourceLabel={statusSourceLabel}
											statusSourcePending={statusSourcePending}
											statusExtraContextText={statusExtraContextText}
											statusActionLabels={statusActionLabels}
											statusActionsBusy={statusActionsBusy}
											jobIdExpanded={jobIdExpanded}
											jobIdCopied={jobIdCopied}
											applyingInputsId={applyingInputsId}
											duplicatingId={duplicatingId}
											retryingId={retryingId}
											secondaryBtnClass={secondaryBtnClass}
											onCopyJobId={handleCopyJobId}
											onToggleJobIdExpanded={() => setJobIdExpanded((v) => !v)}
											onApplyInputs={() => void applyInputsFromJobId(jobId)}
											onRetry={() => void retryJobById(jobId)}
											onDuplicate={() => void duplicateJobById(jobId)}
										/>
									) : null}
									{status.status === 'completed' && status.pdf_url ? (
										<button
											type="button"
											onClick={() => setPdfPresentationOpen(true)}
											className={cn(
												secondaryBtnClass,
												'w-full justify-center gap-2 text-[11px]'
											)}
										>
											<PresentationChartBarIcon
												className="h-3.5 w-3.5 shrink-0"
												strokeWidth={sw}
											/>
											{t('form.previewPdfWhileEditing')}
										</button>
									) : null}
								</EwrpCollapsibleSection>
							) : !isEditing ? (
								<>
									<EwrpPipelineSteps
										className="mb-3"
										progress={status.progress ?? 0}
										status={status.status}
									/>
									{jobId ? (
										<EwrpPresentationJobAdminBlock
											jobId={jobId}
											status={status}
											statusMetaSlideCount={statusMetaSlideCount}
											statusMetaThemeLabel={statusMetaThemeLabel}
											statusSourceLabel={statusSourceLabel}
											statusSourcePending={statusSourcePending}
											statusExtraContextText={statusExtraContextText}
											statusActionLabels={statusActionLabels}
											statusActionsBusy={statusActionsBusy}
											jobIdExpanded={jobIdExpanded}
											jobIdCopied={jobIdCopied}
											applyingInputsId={applyingInputsId}
											duplicatingId={duplicatingId}
											retryingId={retryingId}
											secondaryBtnClass={secondaryBtnClass}
											onCopyJobId={handleCopyJobId}
											onToggleJobIdExpanded={() => setJobIdExpanded((v) => !v)}
											onApplyInputs={() => void applyInputsFromJobId(jobId)}
											onRetry={() => void retryJobById(jobId)}
											onDuplicate={() => void duplicateJobById(jobId)}
										/>
									) : null}
								</>
							) : null}
							{status.content_warning &&
							status.content_quality === 'degraded' &&
							!editorFocusMode ? (
								<EwrpInlineErrorAlert
									className="mb-3 border-amber-500/40 bg-amber-950/40 px-3 py-2.5 text-amber-100"
									message={status.content_warning}
								/>
							) : null}
							{status.error_message && !editorFocusMode ? (
								<EwrpInlineErrorAlert
									className="mb-3 px-3 py-2.5"
									message={status.error_message}
								>
									{status.status === 'failed' &&
									statusActionLabels?.showRetry ? (
										<p
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'mt-2 border-t border-red-500/25 pt-2 text-red-200/85'
											)}
										>
											{t('form.failureRetrySameJobHint')}
										</p>
									) : null}
									{status.status === 'failed' &&
									Array.isArray(status.slides) &&
									status.slides.length > 0 ? (
										<p
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'mt-2 border-t border-red-500/25 pt-2 text-red-200/85'
											)}
										>
											{t('form.failureRetryEditorHint')}
										</p>
									) : null}
								</EwrpInlineErrorAlert>
							) : null}
							{!isEditing &&
								status.status !== 'completed' &&
								status.status !== 'failed' && (
									<div className="mb-1 shrink-0">
										<progress
											className={cn(
												'h-2.5 w-full appearance-none overflow-hidden rounded-full',
												'bg-(--desktop-surface-soft) shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] ring-1 ring-inset ring-white/6',
												'[&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-(--desktop-surface-soft)',
												'[&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:shadow-[0_0_12px_rgb(var(--desktop-accent-rgb)/0.45)]',
												'[&::-webkit-progress-value]:bg-[linear-gradient(to_right,rgb(var(--desktop-accent-rgb)/0.75),rgb(var(--desktop-accent-rgb)))]',
												'[&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-500 [&::-webkit-progress-value]:ease-out motion-reduce:[&::-webkit-progress-value]:transition-none',
												'[&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-[linear-gradient(to_right,rgb(var(--desktop-accent-rgb)/0.75),rgb(var(--desktop-accent-rgb)))] [&::-moz-progress-bar]:shadow-[0_0_12px_rgb(var(--desktop-accent-rgb)/0.45)]'
											)}
											value={statusProgressClamped}
											max={100}
											aria-valuenow={statusProgressClamped}
											aria-valuemin={0}
											aria-valuemax={100}
											aria-label={t('form.progressAria', {
												n: statusProgressClamped,
											})}
										/>
										<p className="mt-1.5 text-right text-[11px] tabular-nums text-(--desktop-text-dim)">
											{statusProgressClamped}%
										</p>
									</div>
								)}
							<EwrpPresentationsStatusOutline
								isEditing={isEditing}
								status={status}
								jobId={jobId}
								shellPanel={shellPanel}
								shellInset={shellInset}
								secondaryBtnClass={secondaryBtnClass}
								slidesListKey={slidesListKey}
								copyDone={copyDone}
								handleCopyOutline={handleCopyOutline}
								handleExportOutlineMarkdown={handleExportOutlineMarkdown}
							/>
							{showSlideEditorPanel && draftSlides ? (
								<EwrpPresentationsSlideEditorSurface
									editorFocusMode={editorFocusMode}
									secondaryBtnClass={secondaryBtnClass}
									primaryBtnClass={primaryBtnClass}
									shellPanel={shellPanel}
									shellInset={shellInset}
									shellField={shellField}
									shellSelectClass={shellSelectClass}
									jobId={jobId}
									status={status}
									slidesListKey={slidesListKey}
									draftSlides={draftSlides}
									slideEditorAnchorRef={slideEditorAnchorRef}
									handleExpandAllSlides={handleExpandAllSlides}
									handleCollapseAllSlides={handleCollapseAllSlides}
									slideListLayout={slideListLayout}
									setSlideListLayout={setSlideListLayout}
									slideEditorSearch={slideEditorSearch}
									setSlideEditorSearch={setSlideEditorSearch}
									slideFilterQuery={slideFilterQuery}
									visibleSlideIndices={visibleSlideIndices}
									editorChromeOpen={editorChromeOpen}
									setEditorChromeOpen={setEditorChromeOpen}
									editorOnboardingDismissed={editorOnboardingDismissed}
									setEditorOnboardingDismissed={setEditorOnboardingDismissed}
									virtualizeEditorSlides={virtualizeEditorSlides}
									editorStructureOpen={editorStructureOpen}
									setEditorStructureOpen={setEditorStructureOpen}
									editorTipsOpen={editorTipsOpen}
									setEditorTipsOpen={setEditorTipsOpen}
									editorQuickNavIndices={editorQuickNavIndices}
									editorNavActiveIndex={editorNavActiveIndex}
									setEditorNavActiveIndex={setEditorNavActiveIndex}
									scrollToDraftSlide={scrollToDraftSlide}
									slideEditorScrollRef={slideEditorScrollRef}
									editorListMeasureRef={editorListMeasureRef}
									handleChangeTitle={handleChangeTitle}
									handleChangeBullets={handleChangeBullets}
									handleChangeLayout={handleChangeLayout}
									handleDraftMoveUp={handleDraftMoveUp}
									handleDraftMoveDown={handleDraftMoveDown}
									handleDraftRemove={handleDraftRemove}
									slideAi={slideAi}
									slidePanelOpen={slidePanelOpen}
									handleSlidePanelOpenChange={handleSlidePanelOpenChange}
									editorVirtualListRef={editorVirtualListRef}
									estimateDraftSlideVirtualSize={estimateDraftSlideVirtualSize}
									editorVirtualListHeight={editorVirtualListHeight}
									draftDndSensors={draftDndSensors}
									handleDraftDragEnd={handleDraftDragEnd}
									draftSortIds={draftSortIds}
									draftIsDirty={draftIsDirty}
									saving={saving}
									slideRebuildInProgress={slideRebuildInProgress}
									estimatedSlidesNeedingNewUgs={estimatedSlidesNeedingNewUgs}
									estimatedNewImagesEnergy={estimatedNewImagesEnergy}
									handleDraftAddSlide={handleDraftAddSlide}
									handleCancelEdit={handleCancelEdit}
									handleSaveSlides={handleSaveSlides}
									setPdfPresentationOpen={setPdfPresentationOpen}
								/>
							) : null}
							{status.status === 'completed' && !isEditing ? (
								<EwrpPresentationsCompletedPdfActions
									jobId={jobId}
									status={status}
									secondaryBtnClass={secondaryBtnClass}
									primaryBtnClass={primaryBtnClass}
									downloading={downloading}
									handleDownload={handleDownload}
									handleOpenPdfNewTab={handleOpenPdfNewTab}
									pdfUrlCopied={pdfUrlCopied}
									handleCopyPdfUrl={handleCopyPdfUrl}
									statusManualPollPending={statusManualPollPending}
									handleManualPollStatus={handleManualPollStatus}
									setPdfPresentationOpen={setPdfPresentationOpen}
								/>
							) : null}
						</div>
					) : (
						<EwrpPresentationsIdleColumn
							shellPanel={shellPanel}
							secondaryBtnClass={secondaryBtnClass}
							primaryBtnClass={primaryBtnClass}
							jobId={jobId}
							statusPollError={statusPollError}
							setStatusPollError={setStatusPollError}
							setStatusManualPollPending={setStatusManualPollPending}
							statusManualPollPending={statusManualPollPending}
							pollStatus={pollStatus}
							historyError={historyError}
							historyJobs={historyJobs}
							historyLoading={historyLoading}
							refreshHistory={refreshHistory}
							setMainTab={setMainTab}
							setIsHistoryModalOpen={setIsHistoryModalOpen}
						/>
					)}
				</div>
			</section>
		</div>
	);
}
