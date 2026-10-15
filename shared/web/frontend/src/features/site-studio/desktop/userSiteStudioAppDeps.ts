/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed dependency bags for Site Studio controller hook modules (handlers, effects, voice, apply).
 *
 * Invariants:
 * - Shapes mirror fields passed from `useUserSiteStudioAppController`; no `any` escape hatches.
 *
 * Related:
 * - features/site-studio/desktop/useUserSiteStudioAppController.tsx
 */
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type { ProfessionalWorldsSiteStudioDraft } from '@/features/professional-worlds/desktop/professionalWorldsCrossAppDraft';
import type { DesktopWindowSurfaceState } from '@/pages/Desktop/context/DesktopWindowActiveContext';
import type {
	SiteStudioAiCatalog,
	SiteStudioApplyReport,
	SiteStudioDraftState,
	SiteStudioHealth,
	SiteStudioInstance,
} from './api';
import type {
	SiteStudioFirstRunForm,
	SiteStudioPanelKey,
	SiteStudioTab,
	VoiceTarget,
} from './userSiteStudioAppModel';

export type SiteStudioNoticeState = {
	tone: 'success' | 'error';
	message: string;
} | null;

export type SiteStudioRunPanelTask = (
	panel: SiteStudioPanelKey,
	key: string,
	task: () => Promise<unknown>,
	fallbackMessage: string
) => Promise<unknown | null>;

export type SiteStudioRefreshWorkspace =
	() => Promise<SiteStudioInstance | null>;

export type UserSiteStudioAppVoiceDeps = {
	t: TFunction<'siteStudio'>;
	setForm: Dispatch<SetStateAction<SiteStudioFirstRunForm>>;
	setAssistantInput: Dispatch<SetStateAction<string>>;
	setRecordingTarget: Dispatch<SetStateAction<VoiceTarget | null>>;
	setNotice: Dispatch<SetStateAction<SiteStudioNoticeState>>;
	setBusyKey: (key: string, busy: boolean) => void;
	setPanelError: (panel: SiteStudioPanelKey, message: string | null) => void;
	mediaRecorderRef: MutableRefObject<MediaRecorder | null>;
	mediaStreamRef: MutableRefObject<MediaStream | null>;
	recordedChunksRef: MutableRefObject<Blob[]>;
	cleanupVoiceResources: () => void;
	recordingTarget: VoiceTarget | null;
};

export type UserSiteStudioAppApplyDeps = {
	t: TFunction<'siteStudio'>;
	setDraftApplyReports: Dispatch<
		SetStateAction<Record<string, SiteStudioApplyReport>>
	>;
	setNotice: Dispatch<SetStateAction<SiteStudioNoticeState>>;
	runPanelTask: SiteStudioRunPanelTask;
	refreshWorkspace: SiteStudioRefreshWorkspace;
};

export type UserSiteStudioAppEffectsDeps = {
	t: TFunction<'siteStudio'>;
	loading: boolean;
	instance: SiteStudioInstance | null;
	health: SiteStudioHealth | null;
	catalog: SiteStudioAiCatalog | null;
	setForm: Dispatch<SetStateAction<SiteStudioFirstRunForm>>;
	setLoading: Dispatch<SetStateAction<boolean>>;
	setNotice: Dispatch<SetStateAction<SiteStudioNoticeState>>;
	setPanelError: (panel: SiteStudioPanelKey, message: string | null) => void;
	setDeployLiveText: Dispatch<SetStateAction<string>>;
	setAssistantInput: Dispatch<SetStateAction<string>>;
	setActiveTab: Dispatch<SetStateAction<SiteStudioTab>>;
	setImagePrompts: Dispatch<SetStateAction<Record<string, string>>>;
	deploySigRef: MutableRefObject<string>;
	appliedProfessionalWorldsDraftRef: MutableRefObject<boolean>;
	pwPublishedReportSigRef: MutableRefObject<string | null>;
	initialProfessionalWorldsDraft?: ProfessionalWorldsSiteStudioDraft | null;
	refreshWorkspace: SiteStudioRefreshWorkspace;
	cleanupVoiceResources: () => void;
	safeDrafts: SiteStudioDraftState;
	windowSurface: DesktopWindowSurfaceState;
	activeTab: SiteStudioTab;
};

export type UserSiteStudioAppHandlerDeps = UserSiteStudioAppVoiceDeps & {
	form: SiteStudioFirstRunForm;
	instance: SiteStudioInstance | null;
	setInstance: Dispatch<SetStateAction<SiteStudioInstance | null>>;
	setHealth: Dispatch<SetStateAction<SiteStudioHealth | null>>;
	setCatalog: Dispatch<SetStateAction<SiteStudioAiCatalog | null>>;
	setDrafts: Dispatch<SetStateAction<SiteStudioDraftState | null>>;
	assistantInput: string;
	aiProgressCallbacks: {
		onStarted: () => void;
		onProgress: (payload: { progress_message?: string | null }) => void;
	};
	imagePrompts: Record<string, string>;
	setImageProgress: Dispatch<SetStateAction<Record<string, string>>>;
	deleteConfirmationValue: string;
	setAiProgress: Dispatch<SetStateAction<string | null>>;
	setActiveTab: Dispatch<SetStateAction<SiteStudioTab>>;
	safeDrafts: SiteStudioDraftState;
	setDraftApplyReports: Dispatch<
		SetStateAction<Record<string, SiteStudioApplyReport>>
	>;
	clearNotice: () => void;
	syncDraftsIntoState: (
		nextDrafts: SiteStudioDraftState,
		nextInstance?: SiteStudioInstance | null
	) => void;
	refreshWorkspace: SiteStudioRefreshWorkspace;
	runPanelTask: SiteStudioRunPanelTask;
	recoverExistingInstance: () => Promise<SiteStudioInstance | null>;
	closeDeleteConfirm: () => void;
};
