/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Base companion chat orchestration: layout, i18n, refs, draft/core state, surface bundle,
 * guide prep, left-rail controller, action dispatch, and transform video bridge.
 *
 * Invariants:
 * - Called once from glue before operations/transcript/composer/overlays bundles.
 *
 * Related:
 * - src/features/ewa/companionUx/useEwaCompanionChatPanelOrchestration.tsx
 */

import { useReducedMotion } from '@/features/ewa/companionPresence/useReducedMotion';
import { useCompanionActionDispatch } from '@/features/ewa/companionUx/useCompanionActionDispatch';
import { useCompanionOperationsFocus } from '@/features/ewa/companionOperations/useCompanionOperationsFocus';
import { type PendingCompanionImage } from '@/features/ewa/companionImageAttachment';
import { useCompanionTransformVideo } from '@/features/ewa/useCompanionTransformVideo';
import { useCompanionLeftRailController } from '@/features/ewa/companionUx/useCompanionLeftRailController';
import { useCompanionPresencePresentation } from '@/features/ewa/companionUx/useCompanionPresencePresentation';
import { useCompanionMyPhrasesController } from '@/features/ewa/companionOutputSurface/useCompanionMyPhrasesController';
import { useCompanionMemoryForget } from '@/features/ewa/companionUx/useCompanionMemoryForget';
import {
	DEFAULT_EWA_PERSONA_ID,
	normalizeEwaPersonaId,
} from '@/features/ewa/ewaPersonaCatalog';
import { useEwaCompanionShellBridge } from '@/pages/Desktop/context/EwaCompanionShellBridgeContext';
import {
	useDesktopWindowActive,
	useDesktopWindowSurfaceState,
} from '@/pages/Desktop/context/DesktopWindowActiveContext';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import { MOBILE_EMBEDDED_EWA_COMPOSER_TOOL_BUTTON_CLASS } from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import { isMobileEwaCompanionEmbeddedRoute } from '@/utils/mobileEmbeddedSpaRoute';
import {
	type CompanionChatMessageResponse,
	type CompanionExecutionReport,
	type CompanionProactiveSuggestion,
	type CompanionToolTraceEntry,
	type CompanionTurnStagePayload,
	loadEwaCompanionChatDraft,
	saveEwaCompanionChatDraft,
} from '@/services/ewa/ewaCompanionChatApi';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useNotifications } from '@/notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EwaCompanionChatPanelOrchestrationProps } from '@/features/ewa/companionUx/companionChatOrchestrationShared';
import { enrichCompanionShellContextWithWorkspace } from '@/features/ewa/companionUx/enrichCompanionShellContextWorkspace';
import { useCompanionChatSurfaceBundle } from '@/features/ewa/companionUx/useCompanionChatSurfaceBundle';

export type CompanionChatOrchestrationBaseInput =
	EwaCompanionChatPanelOrchestrationProps;

export function useCompanionChatOrchestrationBase(
	props: CompanionChatOrchestrationBaseInput
) {
	const {
		profile,
		reloadProfile,
		onProfileResetRequired,
		onCompanionRevision,
		refreshDesktopConfigFromServer,
		embeddedMobile,
	} = props;
	const { t, i18n } = useTranslation('marketing');
	const { error, success } = useNotifications();
	const ru = i18n.language.startsWith('ru');
	const reducedMotion = useReducedMotion();
	const { getSnapshot: getDesktopShellSnapshot } = useEwaCompanionShellBridge();
	const isDesktopWindowActive = useDesktopWindowActive();
	const windowSurface = useDesktopWindowSurfaceState();
	const desktopRightRailVisible = useMediaQuery('(min-width: 1024px)');
	const mobileEmbeddedLayout =
		embeddedMobile ?? isMobileEwaCompanionEmbeddedRoute();
	const isCompactLandscape = useMediaQuery(
		'(orientation: landscape) and (max-height: 520px)'
	);
	const mobileEmbeddedLandscape = mobileEmbeddedLayout && isCompactLandscape;
	const hideMobileEmbeddedMetaRail = mobileEmbeddedLayout;
	const mobileEmbeddedComposerLayout = mobileEmbeddedLayout;
	const mobileEdgeRailButtonClass = mobileEmbeddedComposerLayout
		? MOBILE_EMBEDDED_EWA_COMPOSER_TOOL_BUTTON_CLASS
		: 'h-11 w-11 min-h-11 min-w-11 shrink-0 p-0 [&_svg]:size-4';
	const operationsPollEnabled =
		windowSurface.isSurfaceVisible && windowSurface.isTabVisible;
	const inputRef = useRef<HTMLTextAreaElement | null>(null);
	const imageInputRef = useRef<HTMLInputElement | null>(null);
	const pendingImageRef = useRef<PendingCompanionImage | null>(null);
	const forceSpeakNextReplyRef = useRef(false);
	const submitCompanionLineRef = useRef<(text: string) => void | Promise<void>>(
		async () => undefined
	);
	const speakCompanionReplyRef = useRef<(reply: string) => void>(
		() => undefined
	);
	const stopSpeakingRef = useRef<() => void>(() => undefined);
	const openToolsCatalogRef = useRef<() => void>(() => undefined);
	const personaId =
		normalizeEwaPersonaId(profile.seed_persona_id) ?? DEFAULT_EWA_PERSONA_ID;
	const companionPrincipalId = profile.principal_id;

	const [draft, setDraft] = useState(() =>
		loadEwaCompanionChatDraft(profile.principal_id)
	);
	const [pendingImage, setPendingImage] =
		useState<PendingCompanionImage | null>(null);
	const [pending, setPending] = useState(false);
	const [useWebSearch, setUseWebSearch] = useState(false);
	const [copiedMessageKey, setCopiedMessageKey] = useState<string | null>(null);
	const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null
	);
	const [streamingText, setStreamingText] = useState<string>('');
	const [turnStage, setTurnStage] = useState<CompanionTurnStagePayload | null>(
		null
	);
	const [protocolReports, setProtocolReports] = useState<
		CompanionExecutionReport[]
	>([]);
	const [toolTrace, setToolTrace] = useState<CompanionToolTraceEntry[]>([]);
	const [orchestrationOutcome, setOrchestrationOutcome] = useState<
		string | null
	>(null);
	const [proactiveSuggestion, setProactiveSuggestion] =
		useState<CompanionProactiveSuggestion | null>(null);

	const updateDraft = useCallback(
		(next: string) => {
			setDraft(next);
			saveEwaCompanionChatDraft(profile.principal_id, next);
		},
		[profile.principal_id]
	);

	const surface = useCompanionChatSurfaceBundle({
		principalId: profile.principal_id,
		updateDraft,
		inputRef,
		refreshDesktopConfigFromServer,
	});
	const {
		outputSurface,
		composerVisible,
		slimChatDockVisible,
		surfacePanelActive,
		documentEditorSurfaceActive,
		attachDocumentSurfaceActionsHost,
		documentSurfaceActionsHost,
		handleOutputSurfaceChange,
		syncOutputSurfaceFromResponse,
		handleDocumentSurfaceDraftPrompt,
		applyCompanionDesktopConfigPatchSideEffects,
		openEmbeddedDocumentSurface,
		prepareEwaGuideStepSurface,
	} = surface;

	const getSnapshot = useCallback(() => {
		return enrichCompanionShellContextWithWorkspace(getDesktopShellSnapshot(), {
			outputSurface,
		});
	}, [getDesktopShellSnapshot, outputSurface]);

	const {
		operationsExpanded,
		setOperationsExpanded,
		highlightedOperationRunId,
		mobileOperationsOpen,
		setMobileOperationsOpen,
		focusOperationRun,
		handleNewActiveOperationRun,
	} = useCompanionOperationsFocus({
		mobileEmbeddedComposerLayout,
		composerVisible,
		isComposerInputFocused: useCallback(
			() => document.activeElement === inputRef.current,
			[]
		),
	});
	const [ewaGuideOpen, setEwaGuideOpen] = useState(false);
	const openEwaGuideTour = useCallback(() => setEwaGuideOpen(true), []);
	useDesktopGuideTourOpener(openEwaGuideTour);

	const prepareEwaGuideStep = useCallback(
		(stepId: string) => {
			prepareEwaGuideStepSurface(stepId);
			if (stepId === 'operations') {
				setOperationsExpanded(true);
			}
		},
		[prepareEwaGuideStepSurface, setOperationsExpanded]
	);

	const ewaGuideSpotlightLayoutKey = `${outputSurface.mode}-${composerVisible}-${operationsExpanded}-${ewaGuideOpen}`;

	const leftRail = useCompanionLeftRailController({
		profile,
		personaId,
		pending,
		ru,
		t,
		getSnapshot,
		isDesktopWindowActive,
		operationsPollEnabled,
		notifyError: error,
	});

	const refreshActivePlanRef = useRef(leftRail.refreshActivePlan);
	refreshActivePlanRef.current = leftRail.refreshActivePlan;

	const handleOpenCompanionPlan = useCallback(() => {
		void refreshActivePlanRef.current({ silent: true });
		handleOutputSurfaceChange({ mode: 'roadmap' });
	}, [handleOutputSurfaceChange]);

	const myPhrases = useCompanionMyPhrasesController({
		principalId: profile.principal_id,
		draft,
		pending,
		notifyError: error,
		notifySuccess: success,
		t,
	});

	const memoryForget = useCompanionMemoryForget({
		reloadProfile,
		notifySuccess: success,
		notifyError: error,
		t,
	});

	const presencePresentation = useCompanionPresencePresentation({
		profile,
		personaId,
		ru,
		pending,
		reducedMotion,
		streamingText,
		isDesktopWindowActive,
		t,
	});

	const composerRef = useRef<HTMLDivElement | null>(null);
	const bottomRef = useRef<HTMLDivElement | null>(null);
	const companionScrollEpochRef = useRef(0);

	const transformVideo = useCompanionTransformVideo();

	const {
		actionRecords,
		setActionRecords,
		actionsExpanded,
		setActionsExpanded,
		dispatchActions,
		handleUndoAction,
	} = useCompanionActionDispatch({ openEmbeddedDocumentSurface });

	const syncProtocolFromResponse = useCallback(
		(out: CompanionChatMessageResponse) => {
			setProtocolReports(
				Array.isArray(out.execution_reports) ? out.execution_reports : []
			);
			setToolTrace(Array.isArray(out.tool_trace) ? out.tool_trace : []);
			setOrchestrationOutcome(out.orchestration_outcome ?? null);
			setProactiveSuggestion(out.proactive_suggestion ?? null);
		},
		[]
	);

	const applyCompanionProfileReset = useCallback((): void => {
		onProfileResetRequired?.();
	}, [onProfileResetRequired]);

	const clearPendingImage = useCallback(() => {
		setPendingImage((prev) => {
			if (prev?.previewUrl) {
				URL.revokeObjectURL(prev.previewUrl);
			}
			return null;
		});
	}, []);

	useEffect(() => {
		pendingImageRef.current = pendingImage;
	}, [pendingImage]);

	useEffect(() => {
		return () => {
			if (pendingImageRef.current?.previewUrl) {
				URL.revokeObjectURL(pendingImageRef.current.previewUrl);
			}
		};
	}, []);

	return {
		profile,
		reloadProfile,
		onProfileResetRequired,
		onCompanionRevision,
		t,
		ru,
		reducedMotion,
		isDesktopWindowActive,
		desktopRightRailVisible,
		mobileEmbeddedLayout,
		mobileEmbeddedLandscape,
		hideMobileEmbeddedMetaRail,
		mobileEmbeddedComposerLayout,
		mobileEdgeRailButtonClass,
		operationsPollEnabled,
		personaId,
		companionPrincipalId,
		inputRef,
		imageInputRef,
		pendingImageRef,
		forceSpeakNextReplyRef,
		submitCompanionLineRef,
		speakCompanionReplyRef,
		stopSpeakingRef,
		openToolsCatalogRef,
		bottomRef,
		companionScrollEpochRef,
		composerRef,
		getSnapshot,
		notifyError: error,
		notifySuccess: success,
		draft,
		setDraft,
		updateDraft,
		pendingImage,
		setPendingImage,
		pending,
		setPending,
		useWebSearch,
		setUseWebSearch,
		copiedMessageKey,
		setCopiedMessageKey,
		copyFeedbackTimerRef,
		streamingText,
		setStreamingText,
		turnStage,
		setTurnStage,
		protocolReports,
		setProtocolReports,
		toolTrace,
		setToolTrace,
		orchestrationOutcome,
		setOrchestrationOutcome,
		proactiveSuggestion,
		setProactiveSuggestion,
		surface,
		outputSurface,
		composerVisible,
		slimChatDockVisible,
		surfacePanelActive,
		documentEditorSurfaceActive,
		attachDocumentSurfaceActionsHost,
		documentSurfaceActionsHost,
		handleOutputSurfaceChange,
		syncOutputSurfaceFromResponse,
		handleDocumentSurfaceDraftPrompt,
		applyCompanionDesktopConfigPatchSideEffects,
		openEmbeddedDocumentSurface,
		operationsExpanded,
		setOperationsExpanded,
		highlightedOperationRunId,
		mobileOperationsOpen,
		setMobileOperationsOpen,
		focusOperationRun,
		handleNewActiveOperationRun,
		ewaGuideOpen,
		setEwaGuideOpen,
		prepareEwaGuideStep,
		ewaGuideSpotlightLayoutKey,
		leftRail,
		myPhrases,
		memoryForget,
		presencePresentation,
		actionRecords,
		setActionRecords,
		actionsExpanded,
		setActionsExpanded,
		dispatchActions,
		handleUndoAction,
		transformVideo,
		syncProtocolFromResponse,
		applyCompanionProfileReset,
		handleOpenCompanionPlan,
		clearPendingImage,
	};
}

export type CompanionChatOrchestrationBaseResult = ReturnType<
	typeof useCompanionChatOrchestrationBase
>;
