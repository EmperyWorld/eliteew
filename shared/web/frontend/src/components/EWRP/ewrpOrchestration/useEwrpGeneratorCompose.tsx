/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP generator orchestration compose — wires atomized hooks; flat return for Main UI.
 *
 * Invariants:
 * - One hook instance per Main; no parallel state SoT.
 * - Public facade re-exports via `useEwrpGeneratorOrchestration.tsx`.
 *
 * Related:
 * - `EWRPGeneratorMain.tsx`, `ewrpOrchestration/*`, `documentation/product/EWRP-EDITOR.md`
 */

import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellHeaderStripClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import type { VirtualVariableListHandle } from '@/components/shared/VirtualList';
import type {
	EwrpJobListItem,
	EwrpSlide,
	EwrpStatusResponse,
} from '@/services/ewrpApi';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ContentItem } from '../EwrpGeneratorChunks';
import { ewrpFormLockedFromJob } from '../ewrpClientJobPolicy';
import { EWRP_GUIDE_STEP_DEFS } from '../ewrpGuideConstants';
import { clampEwrpStatusProgress } from '../ewrpStatusPolling';
import {
	type EwrpWebSearchQuality,
	readStoredEwrpWebSearchQuality,
} from '../ewrpWebSearchQuality';
import { useEwrpDialogFocusTrap } from '../useEwrpDialogFocusTrap';
import { useEwrpGeneratorDerivedState } from './useEwrpGeneratorDerivedState';
import { useEwrpGeneratorBootstrap } from './useEwrpGeneratorBootstrap';
import type { EWRPGeneratorProps } from './ewrpOrchestrationTypes';
import {
	buildEwrpPrimaryBtnClass,
	buildEwrpSecondaryBtnClass,
	buildEwrpShellFieldClass,
	buildEwrpShellSelectClass,
} from './ewrpShellChromeClasses';
import { buildEwrpStatusLiveText } from './ewrpStatusLiveText';
import { useEwrpDraftEditor } from './useEwrpDraftEditor';
import {
	useEwrpJobActions,
	type EwrpJobActionsBundle,
} from './useEwrpJobActions';
import { useEwrpGeneratorDocPicker } from './useEwrpGeneratorDocPicker';
import {
	ewrpGuideSpotlightLayoutKey,
	useEwrpGeneratorGuide,
} from './useEwrpGeneratorGuide';
import { useEwrpGeneratorHistory } from './useEwrpGeneratorHistory';
import { useEwrpGeneratorKeyboard } from './useEwrpGeneratorKeyboard';
import { useEwrpGeneratorPolling } from './useEwrpGeneratorPolling';
import { useEwrpGeneratorSubmit } from './useEwrpGeneratorSubmit';
import { useEwrpPdfActions } from './useEwrpPdfActions';

export function useEwrpGeneratorCompose(props?: EWRPGeneratorProps) {
	const emitCompanionListing = props?.onWindowPayloadChange;
	const crossAppDraftKey = props?.professionalWorldsCrossAppDraftKey;
	const companionEwrpJobId = props?.ewrpJobId;
	const { t } = useTranslation('ewrp');
	const guideLabels = useMemo(() => guideTourLabelsFromI18n(t, 'guide'), [t]);
	const guideSteps = useBuiltGuideSteps(t, 'guide.steps', EWRP_GUIDE_STEP_DEFS);

	const [topic, setTopic] = useState('');
	const [title, setTitle] = useState('');
	const [numSlides, setNumSlides] = useState(5);
	const [presentationTheme, setPresentationTheme] = useState('classic');
	const [firstSlideStyle, setFirstSlideStyle] = useState('standard');
	const [webSearchQuality, setWebSearchQuality] =
		useState<EwrpWebSearchQuality>(readStoredEwrpWebSearchQuality);
	const [extraContext, setExtraContext] = useState('');
	const [sourceDocument, setSourceDocument] = useState<ContentItem | null>(
		null
	);
	const [
		presentationsStatusFocusAnnouncement,
		setPresentationsStatusFocusAnnouncement,
	] = useState('');
	const [
		presentationsEditorFocusAnnouncement,
		setPresentationsEditorFocusAnnouncement,
	] = useState('');
	const [sourceDocumentLoading, setSourceDocumentLoading] = useState(false);
	const [isDocPickerOpen, setIsDocPickerOpen] = useState(false);
	const [docPickerLoading, setDocPickerLoading] = useState(false);
	const [docPickerError, setDocPickerError] = useState<string | null>(null);
	const [docItems, setDocItems] = useState<ContentItem[]>([]);
	const [jobId, setJobId] = useState<string | null>(null);
	const [status, setStatus] = useState<EwrpStatusResponse | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [draftSlides, setDraftSlides] = useState<EwrpSlide[] | null>(null);
	const [slideListLayout, setSlideListLayout] = useState<
		'comfortable' | 'compact'
	>('comfortable');
	const [slidePanelOpen, setSlidePanelOpen] = useState<boolean[]>([]);
	const [copyDone, setCopyDone] = useState(false);
	const [historyJobs, setHistoryJobs] = useState<EwrpJobListItem[]>([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
	const [historyHasMore, setHistoryHasMore] = useState(false);
	const [historyOffset, setHistoryOffset] = useState(0);
	const [historyError, setHistoryError] = useState<string | null>(null);
	const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(
		null
	);
	const [applyingInputsId, setApplyingInputsId] = useState<string | null>(null);
	const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
	const [retryingId, setRetryingId] = useState<string | null>(null);
	const [statusManualPollPending, setStatusManualPollPending] = useState(false);
	const [statusPollError, setStatusPollError] = useState<string | null>(null);
	const [statusSourceLabel, setStatusSourceLabel] = useState<string | null>(
		null
	);
	const [statusSourceLoading, setStatusSourceLoading] = useState(false);
	const [docItemsPrefetchLoading, setDocItemsPrefetchLoading] = useState(false);
	const [historySearch, setHistorySearch] = useState('');
	const [docPickerSearch, setDocPickerSearch] = useState('');
	const [jobIdCopied, setJobIdCopied] = useState(false);
	const [jobIdExpanded, setJobIdExpanded] = useState(false);
	const [pdfUrlCopied, setPdfUrlCopied] = useState(false);
	const [pdfPresentationOpen, setPdfPresentationOpen] = useState(false);
	const [mainTab, setMainTab] = useState<'generate' | 'presentations'>(
		'generate'
	);
	const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<{
		id: string;
		label: string;
	} | null>(null);
	const [slideEditorSearch, setSlideEditorSearch] = useState('');
	const [cancelEditConfirmOpen, setCancelEditConfirmOpen] = useState(false);
	const [saveMultiUgsConfirmOpen, setSaveMultiUgsConfirmOpen] = useState(false);
	const [draftRestorePrompt, setDraftRestorePrompt] = useState<{
		slides: EwrpSlide[];
		savedAt: number;
	} | null>(null);
	const [editorOnboardingDismissed, setEditorOnboardingDismissed] =
		useState(true);
	const [editorJobDetailsOpen, setEditorJobDetailsOpen] = useState(false);
	const [editorTipsOpen, setEditorTipsOpen] = useState(false);
	const [editorStructureOpen, setEditorStructureOpen] = useState(false);
	const [editorChromeOpen, setEditorChromeOpen] = useState(false);
	const [editorNavActiveIndex, setEditorNavActiveIndex] = useState(0);

	const slideEditorScrollRef = useRef<HTMLDivElement>(null);
	const editorListMeasureRef = useRef<HTMLDivElement>(null);
	const editorVirtualListRef = useRef<VirtualVariableListHandle>(null);
	const historySearchInputRef = useRef<HTMLInputElement>(null);
	const docPickerSearchInputRef = useRef<HTMLInputElement>(null);
	const historyModalPanelRef = useRef<HTMLDivElement>(null);
	const docPickerModalPanelRef = useRef<HTMLDivElement>(null);
	const statusColumnRef = useRef<HTMLElement | null>(null);
	const statusRef = useRef(status);
	const expectPdfRebuildToastRef = useRef(false);
	const pwDraftHydratedKeyRef = useRef<string | null>(null);
	const pwCrossAppLinkIdRef = useRef<string | null>(null);
	const pwPublishedReportSigRef = useRef<string | null>(null);
	const jobActionsRef = useRef<EwrpJobActionsBundle | null>(null);

	const { guideOpen, setGuideOpen, prepareGuideStep } = useEwrpGeneratorGuide({
		setMainTab,
	});
	const guideSpotlightLayoutKey = ewrpGuideSpotlightLayoutKey(
		mainTab,
		guideOpen
	);

	const focusPresentationsStatusColumn = useCallback(() => {
		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				statusColumnRef.current?.scrollIntoView({
					behavior: 'smooth',
					block: 'start',
				});
				setPresentationsStatusFocusAnnouncement(
					t('a11y.presentationsStatusFocused')
				);
				window.setTimeout(
					() => setPresentationsStatusFocusAnnouncement(''),
					2000
				);
			});
		});
	}, [t]);

	const openPresentationsStatus = useCallback(() => {
		setMainTab('presentations');
		focusPresentationsStatusColumn();
	}, [focusPresentationsStatusColumn]);

	useEwrpDialogFocusTrap(historyModalPanelRef, isHistoryModalOpen);
	useEwrpDialogFocusTrap(docPickerModalPanelRef, isDocPickerOpen);

	const shellFrame = useDesktopShellFrame();
	const shellPanel = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);
	const shellHeader = useMemo(
		() => getDesktopShellHeaderStripClassName(shellFrame),
		[shellFrame]
	);
	const shellInset = useMemo(
		() => getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
		[shellFrame]
	);
	const shellField = useMemo(
		() => buildEwrpShellFieldClass(shellInset),
		[shellInset]
	);
	const shellSelectClass = useMemo(
		() => buildEwrpShellSelectClass(shellField),
		[shellField]
	);
	const primaryBtnClass = useMemo(() => buildEwrpPrimaryBtnClass(), []);
	const secondaryBtnClass = useMemo(
		() => buildEwrpSecondaryBtnClass(shellInset),
		[shellInset]
	);

	const {
		perSlideCredits,
		presentationEnergyCost,
		ugsAvailableCredits,
		insufficientEnergy,
		statusActionLabels,
		statusIndicator,
		statusPresentationLabel,
		activeJobBannerHeadline,
		statusMetaSlideCount,
		statusMetaThemeLabel,
		statusActionsBusy,
		estimatedSlidesNeedingNewUgs,
		estimatedNewImagesEnergy,
	} = useEwrpGeneratorDerivedState({
		t,
		topic,
		title,
		numSlides,
		status,
		draftSlides,
		jobId,
		applyingInputsId,
		duplicatingId,
		retryingId,
	});

	useEffect(() => {
		if (!jobId) return;
		if (
			typeof window === 'undefined' ||
			!window.matchMedia('(max-width: 1023px)').matches
		) {
			return;
		}
		const timerId = window.setTimeout(() => {
			statusColumnRef.current?.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
			});
		}, 80);
		return () => clearTimeout(timerId);
	}, [jobId]);

	const history = useEwrpGeneratorHistory({
		t,
		jobId,
		shellInset,
		secondaryBtnClass,
		perSlideCredits,
		historyJobs,
		setHistoryJobs,
		historyLoading,
		setHistoryLoading,
		historyLoadingMore,
		setHistoryLoadingMore,
		historyHasMore,
		setHistoryHasMore,
		historyOffset,
		setHistoryOffset,
		historyError,
		setHistoryError,
		historySearch,
		setHistorySearch,
		isHistoryModalOpen,
		setIsHistoryModalOpen,
		deletingHistoryId,
		applyingInputsId,
		duplicatingId,
		retryingId,
		deleteTarget,
		setDeleteTarget,
		historySearchInputRef,
		historyModalPanelRef,
		getJobActions: () => jobActionsRef.current,
	});

	const polling = useEwrpGeneratorPolling({
		jobId,
		status,
		setStatus,
		statusRef,
		setStatusPollError,
		refreshHistory: history.refreshHistory,
		t,
	});

	const jobActions = useEwrpJobActions({
		t,
		jobId,
		status,
		numSlides,
		perSlideCredits,
		historyJobs,
		deleteTarget,
		setTopic,
		setTitle,
		setNumSlides,
		setExtraContext,
		setWebSearchQuality,
		setPresentationTheme,
		setFirstSlideStyle,
		setSourceDocument,
		setSourceDocumentLoading,
		setApplyingInputsId,
		setDuplicatingId,
		setRetryingId,
		setDeletingHistoryId,
		setDeleteTarget,
		setJobId,
		setStatus,
		setMainTab,
		setIsEditing,
		setDraftSlides,
		setIsHistoryModalOpen,
		stopPolling: polling.stopPolling,
		refreshHistory: history.refreshHistory,
		focusPresentationsStatusColumn,
	});
	jobActionsRef.current = jobActions;

	const handleManualPollStatus = useCallback(async () => {
		if (!jobId) return;
		if (polling.pollInFlightRef.current) return;
		setStatusManualPollPending(true);
		try {
			await polling.pollStatus(jobId);
		} finally {
			setStatusManualPollPending(false);
		}
	}, [jobId, polling]);

	const docPicker = useEwrpGeneratorDocPicker({
		t,
		mainTab,
		status,
		sourceDocument,
		setSourceDocument,
		docItems,
		setDocItems,
		isDocPickerOpen,
		setIsDocPickerOpen,
		docPickerLoading,
		setDocPickerLoading,
		docPickerError,
		setDocPickerError,
		docPickerSearch,
		setDocPickerSearch,
		docItemsPrefetchLoading,
		setDocItemsPrefetchLoading,
		docPickerSearchInputRef,
		docPickerModalPanelRef,
	});

	const { statusSourcePending } = useEwrpGeneratorBootstrap({
		emitCompanionListing,
		crossAppDraftKey,
		companionEwrpJobId,
		t,
		jobId,
		status,
		docItems,
		mainTab,
		historyLoading,
		historyJobs,
		historyHasMore,
		filteredHistoryJobs: history.filteredHistoryJobs,
		filteredDocItems: docPicker.filteredDocItems,
		deferredDocSearch: docPicker.deferredDocSearch,
		setTopic,
		setTitle,
		setExtraContext,
		setMainTab,
		setSourceDocument,
		setSourceDocumentLoading,
		setJobId,
		setStatusSourceLabel,
		setStatusSourceLoading,
		setEditorOnboardingDismissed,
		setJobIdExpanded,
		setStatusPollError,
		setJobIdCopied,
		statusRef,
		expectPdfRebuildToastRef,
		pwDraftHydratedKeyRef,
		pwCrossAppLinkIdRef,
		pwPublishedReportSigRef,
		docItemsPrefetchLoading,
		statusSourceLabel,
		statusSourceLoading,
	});

	const draftEditor = useEwrpDraftEditor({
		t,
		jobId,
		status,
		setStatus,
		isEditing,
		setIsEditing,
		saving,
		setSaving,
		draftSlides,
		setDraftSlides,
		slideListLayout,
		setSlideListLayout,
		slidePanelOpen,
		setSlidePanelOpen,
		slideEditorSearch,
		setSlideEditorSearch,
		cancelEditConfirmOpen,
		setCancelEditConfirmOpen,
		saveMultiUgsConfirmOpen,
		setSaveMultiUgsConfirmOpen,
		draftRestorePrompt,
		setDraftRestorePrompt,
		editorJobDetailsOpen,
		setEditorJobDetailsOpen,
		editorTipsOpen,
		setEditorTipsOpen,
		editorStructureOpen,
		setEditorStructureOpen,
		editorChromeOpen,
		setEditorChromeOpen,
		editorNavActiveIndex,
		setEditorNavActiveIndex,
		pdfPresentationOpen,
		setPdfPresentationOpen,
		presentationsEditorFocusAnnouncement,
		setPresentationsEditorFocusAnnouncement,
		slideEditorScrollRef,
		editorListMeasureRef,
		editorVirtualListRef,
		expectPdfRebuildToastRef,
		primaryBtnClass,
		secondaryBtnClass,
		pollStatus: polling.pollStatus,
		resumeActivePolling: polling.resumeActivePolling,
		refreshHistory: history.refreshHistory,
	});

	const pdfActions = useEwrpPdfActions({
		jobId,
		status,
		topic,
		title,
		downloading,
		setDownloading,
		setCopyDone,
		setJobIdCopied,
		setPdfUrlCopied,
		t,
	});

	const { handleSubmit } = useEwrpGeneratorSubmit({
		topic,
		title,
		numSlides,
		presentationTheme,
		firstSlideStyle,
		webSearchQuality,
		extraContext,
		sourceDocument,
		insufficientEnergy,
		presentationEnergyCost,
		ugsAvailableCredits,
		submitting,
		setSubmitting,
		setJobId,
		setMainTab,
		setStatus,
		pwCrossAppLinkIdRef,
		refreshHistory: history.refreshHistory,
		t,
	});

	const formLocked = useMemo(
		() => ewrpFormLockedFromJob(jobId, status?.status),
		[jobId, status?.status]
	);

	useEwrpGeneratorKeyboard({
		mainTab,
		isHistoryModalOpen,
		isDocPickerOpen,
		submitting,
		formLocked,
		deleteTarget,
		historySearch,
		docPickerSearch,
		isEditing,
		draftSlides,
		saving,
		slideRebuildInProgress: draftEditor.slideRebuildInProgress,
		closeHistoryModal: history.closeHistoryModal,
		closeDocPickerModal: docPicker.closeDocPickerModal,
		setHistorySearch,
		setDocPickerSearch,
		setIsHistoryModalOpen,
		refreshHistory: history.refreshHistory,
		handleSaveSlides: draftEditor.handleSaveSlides,
		historySearchInputRef,
	});

	const statusLiveText = useMemo(
		() =>
			buildEwrpStatusLiveText(status, statusIndicator?.label, {
				noActiveJob: () => t('statusColumn.noActiveJob'),
				progressSuffix: (p) => t('statusColumn.progressSuffix', p),
				errorSuffix: (p) => t('statusColumn.errorSuffix', p),
				lead: (p) => t('statusColumn.lead', p),
			}),
		[status, statusIndicator, t]
	);
	const statusProgressClamped = useMemo(
		() => clampEwrpStatusProgress(status?.progress),
		[status?.progress]
	);
	const slidesListKey = jobId ?? 'draft';
	const statusExtraContextText = useMemo(
		() => (status?.extra_context ?? '').trim(),
		[status?.extra_context]
	);

	return {
		guideLabels,
		guideSteps,
		slideEditorScrollRef,
		editorListMeasureRef,
		editorVirtualListRef,
		historySearchInputRef,
		docPickerSearchInputRef,
		historyModalPanelRef,
		docPickerModalPanelRef,
		statusColumnRef,
		closeHistoryModal: history.closeHistoryModal,
		closeDocPickerModal: docPicker.closeDocPickerModal,
		focusPresentationsStatusColumn,
		openPresentationsStatus,
		shellFrame,
		shellPanel,
		shellHeader,
		shellInset,
		perSlideCredits,
		presentationEnergyCost,
		ugsAvailableCredits,
		insufficientEnergy,
		statusActionLabels,
		statusIndicator,
		statusPresentationLabel,
		activeJobBannerHeadline,
		statusMetaSlideCount,
		statusMetaThemeLabel,
		statusActionsBusy,
		estimatedSlidesNeedingNewUgs,
		estimatedNewImagesEnergy,
		shellField,
		shellSelectClass,
		primaryBtnClass,
		secondaryBtnClass,
		refreshHistory: history.refreshHistory,
		loadMoreHistory: history.loadMoreHistory,
		openDocPicker: docPicker.openDocPicker,
		retryDocPickerLoad: docPicker.retryDocPickerLoad,
		pollStatus: polling.pollStatus,
		slideAi: draftEditor.slideAi,
		handleManualPollStatus,
		applyInputsFromJobId: jobActions.applyInputsFromJobId,
		duplicateJobById: jobActions.duplicateJobById,
		retryJobById: jobActions.retryJobById,
		executePendingDelete: jobActions.executePendingDelete,
		handleSubmit,
		handleDownload: pdfActions.handleDownload,
		handleOpenPdfNewTab: pdfActions.handleOpenPdfNewTab,
		handleCopyPdfUrl: pdfActions.handleCopyPdfUrl,
		canEditSlides: draftEditor.canEditSlides,
		slideRebuildInProgress: draftEditor.slideRebuildInProgress,
		showSlideEditorPanel: draftEditor.showSlideEditorPanel,
		editorFocusMode: draftEditor.editorFocusMode,
		editorVirtualListHeight: draftEditor.editorVirtualListHeight,
		showPresentationsMiniStatus: draftEditor.showPresentationsMiniStatus,
		slideFilterQuery: draftEditor.slideFilterQuery,
		visibleSlideIndices: draftEditor.visibleSlideIndices,
		editorQuickNavIndices: draftEditor.editorQuickNavIndices,
		estimateDraftSlideVirtualSize: draftEditor.estimateDraftSlideVirtualSize,
		virtualizeEditorSlides: draftEditor.virtualizeEditorSlides,
		draftIsDirty: draftEditor.draftIsDirty,
		performCancelEdit: draftEditor.performCancelEdit,
		handleStartEdit: draftEditor.handleStartEdit,
		handleCancelEdit: draftEditor.handleCancelEdit,
		focusPresentationsSlideEditor: draftEditor.focusPresentationsSlideEditor,
		showPresentationsScrollToEditor:
			draftEditor.showPresentationsScrollToEditor,
		showMiniStatusScrollToEditor: draftEditor.showMiniStatusScrollToEditor,
		applyDraftRestore: draftEditor.applyDraftRestore,
		dismissDraftRestoreKeepEditing: draftEditor.dismissDraftRestoreKeepEditing,
		handleChangeTitle: draftEditor.handleChangeTitle,
		handleChangeBullets: draftEditor.handleChangeBullets,
		handleChangeLayout: draftEditor.handleChangeLayout,
		handleDraftMoveUp: draftEditor.handleDraftMoveUp,
		handleDraftMoveDown: draftEditor.handleDraftMoveDown,
		handleDraftRemove: draftEditor.handleDraftRemove,
		handleDraftAddSlide: draftEditor.handleDraftAddSlide,
		draftDndSensors: draftEditor.draftDndSensors,
		handleDraftDragEnd: draftEditor.handleDraftDragEnd,
		handleSlidePanelOpenChange: draftEditor.handleSlidePanelOpenChange,
		handleExpandAllSlides: draftEditor.handleExpandAllSlides,
		handleCollapseAllSlides: draftEditor.handleCollapseAllSlides,
		scrollToDraftSlide: draftEditor.scrollToDraftSlide,
		runSaveSlides: draftEditor.runSaveSlides,
		handleSaveSlides: draftEditor.handleSaveSlides,
		formLocked,
		statusLiveText,
		statusProgressClamped,
		slidesListKey,
		filteredHistoryJobs: history.filteredHistoryJobs,
		filteredDocItems: docPicker.filteredDocItems,
		historyListVirtualized: history.historyListVirtualized,
		docPickerListVirtualized: docPicker.docPickerListVirtualized,
		historyListSummary: history.historyListSummary,
		docListSummary: docPicker.docListSummary,
		statusExtraContextText,
		statusSourcePending,
		draftSortIds: draftEditor.draftSortIds,
		handleCopyOutline: pdfActions.handleCopyOutline,
		handleExportOutlineMarkdown: pdfActions.handleExportOutlineMarkdown,
		handleCopyJobId: pdfActions.handleCopyJobId,
		handlePickDocFromModal: docPicker.handlePickDocFromModal,
		renderVirtualHistoryRow: history.renderVirtualHistoryRow,
		handleHistoryListEndReached: history.handleHistoryListEndReached,
		renderDocPickerVirtualItem: docPicker.renderDocPickerVirtualItem,
		prepareGuideStep,
		guideSpotlightLayoutKey,
		guideOpen,
		setGuideOpen,
		topic,
		setTopic,
		title,
		setTitle,
		numSlides,
		setNumSlides,
		presentationTheme,
		setPresentationTheme,
		firstSlideStyle,
		setFirstSlideStyle,
		webSearchQuality,
		setWebSearchQuality,
		extraContext,
		setExtraContext,
		sourceDocument,
		setSourceDocument,
		sourceDocumentLoading,
		isDocPickerOpen,
		docPickerLoading,
		docPickerError,
		docItems,
		jobId,
		status,
		submitting,
		downloading,
		isEditing,
		saving,
		draftSlides,
		slideListLayout,
		setSlideListLayout,
		slidePanelOpen,
		copyDone,
		historyJobs,
		historyLoading,
		historyLoadingMore,
		historyHasMore,
		historyError,
		applyingInputsId,
		duplicatingId,
		retryingId,
		statusManualPollPending,
		setStatusManualPollPending,
		statusPollError,
		setStatusPollError,
		statusSourceLabel,
		historySearch,
		setHistorySearch,
		docPickerSearch,
		setDocPickerSearch,
		jobIdCopied,
		jobIdExpanded,
		setJobIdExpanded,
		pdfUrlCopied,
		pdfPresentationOpen,
		setPdfPresentationOpen,
		mainTab,
		setMainTab,
		isHistoryModalOpen,
		setIsHistoryModalOpen,
		deleteTarget,
		setDeleteTarget,
		slideEditorSearch,
		setSlideEditorSearch,
		cancelEditConfirmOpen,
		setCancelEditConfirmOpen,
		saveMultiUgsConfirmOpen,
		setSaveMultiUgsConfirmOpen,
		draftRestorePrompt,
		editorOnboardingDismissed,
		setEditorOnboardingDismissed,
		editorJobDetailsOpen,
		setEditorJobDetailsOpen,
		editorTipsOpen,
		setEditorTipsOpen,
		editorStructureOpen,
		setEditorStructureOpen,
		editorChromeOpen,
		setEditorChromeOpen,
		editorNavActiveIndex,
		setEditorNavActiveIndex,
		t,
		statusPanelAnchorRef: draftEditor.statusPanelAnchorRef,
		slideEditorAnchorRef: draftEditor.slideEditorAnchorRef,
		statusPanelVisible: draftEditor.statusPanelVisible,
		presentationsStatusFocusAnnouncement,
		presentationsEditorFocusAnnouncement,
	};
}
