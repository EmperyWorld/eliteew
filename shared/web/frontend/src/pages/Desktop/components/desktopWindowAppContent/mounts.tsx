/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop window mount adapters — payload mapping local to each app interior.
 *
 * Invariants:
 * - Professional Worlds cross-app draft keys are consumed here, never auto-published.
 * - EWRP/Presentations mounts forward onUpdatePayload for companion shell_context listings.
 *
 * Related:
 * - desktopWindowAppContent/lazyImports.ts
 * - desktopWindowAppContent/renderDesktopWindowAppContent.tsx
 */

import * as React from 'react';
import { memo, useMemo } from 'react';
import {
	consumeProfessionalWorldsCrossAppDraft,
	professionalWorldsDraftToEwDesk,
	professionalWorldsDraftToGaf,
	professionalWorldsDraftToSiteStudio,
	type ProfessionalWorldsEwDeskSuggestion,
	type ProfessionalWorldsGafDraft,
	type ProfessionalWorldsSiteStudioDraft,
} from '@/features/professional-worlds/desktop/professionalWorldsCrossAppDraft';
import { reportProfessionalCrossAppDraftLifecycle } from '@/features/professional-worlds/desktop/reportProfessionalCrossAppDraftLifecycle';
import type { WindowInitialPayload } from '../../types/desktop.types';
import { normalizeContentManagerInitialFilterPayload } from '../../utils/contentManagerFilterShortcut';
import { resolveContentManagerInitialTab } from '@/services/contentApi/contentStorageBroken';
import type { DesktopWindowAppCallbacks } from './types';
import {
	ContentManagerPro,
	DesktopAiChatAppLazy,
	EWDeskAppLazy,
	EWRPGeneratorLazy,
	GAFChatAppLazy,
	UserSiteStudioAppLazy,
	VideoCallAppLazy,
} from './lazyImports';

export const ContentManagerDesktopMount: React.FC<{
	initialPayload?: WindowInitialPayload;
	onUpdatePayload?: DesktopWindowAppCallbacks['onUpdatePayload'];
}> = memo(({ initialPayload, onUpdatePayload }) => {
	const initialCabinetScope = useMemo(() => {
		const projectId =
			typeof initialPayload?.contentManagerProjectId === 'string'
				? initialPayload.contentManagerProjectId.trim()
				: '';
		const companyId =
			typeof initialPayload?.contentManagerCompanyId === 'string'
				? initialPayload.contentManagerCompanyId.trim()
				: '';
		const projectName =
			typeof initialPayload?.contentManagerProjectName === 'string'
				? initialPayload.contentManagerProjectName.trim()
				: '';
		const cabinetView = initialPayload?.contentManagerCabinetView === true;
		if (!projectId || !companyId) return undefined;
		return {
			projectId,
			companyId,
			cabinetView,
			...(projectName ? { projectName } : {}),
		};
	}, [
		initialPayload?.contentManagerCabinetView,
		initialPayload?.contentManagerCompanyId,
		initialPayload?.contentManagerProjectId,
		initialPayload?.contentManagerProjectName,
	]);

	const initialDesktopFolderItemId = useMemo(() => {
		const v = initialPayload?.contentManagerFolderItemId;
		if (typeof v !== 'string') return null;
		const t = v.trim();
		return t !== '' ? t : null;
	}, [initialPayload?.contentManagerFolderItemId]);

	const initialFilterSnapshot = useMemo(
		() =>
			normalizeContentManagerInitialFilterPayload(
				initialPayload?.contentManagerInitialFilter
			) ?? null,
		[initialPayload?.contentManagerInitialFilter]
	);

	const initialFocusUnifiedContentId = useMemo(() => {
		const v = initialPayload?.contentManagerFocusUnifiedContentId;
		if (typeof v !== 'string') return null;
		const t = v.trim();
		return t !== '' ? t : null;
	}, [initialPayload?.contentManagerFocusUnifiedContentId]);

	const initialOpenAssignProject =
		initialPayload?.contentManagerOpenAssignProject === true;

	const initialActiveTab = useMemo(
		() =>
			resolveContentManagerInitialTab(
				initialPayload?.contentManagerInitialTab
			) ?? null,
		[initialPayload?.contentManagerInitialTab]
	);

	return (
		<ContentManagerPro
			embedded
			initialCabinetScope={initialCabinetScope}
			initialDesktopFolderItemId={initialDesktopFolderItemId}
			initialFilterSnapshot={initialFilterSnapshot}
			initialFocusUnifiedContentId={initialFocusUnifiedContentId}
			initialOpenAssignProject={initialOpenAssignProject}
			initialActiveTab={initialActiveTab}
			onWindowPayloadChange={onUpdatePayload}
		/>
	);
});
ContentManagerDesktopMount.displayName = 'ContentManagerDesktopMount';

export const GAFChatAppDesktopMount: React.FC<{
	initialPayload?: WindowInitialPayload;
}> = memo(({ initialPayload }) => {
	const professionalWorldsDraftKey =
		typeof initialPayload?.professionalWorldsCrossAppDraftKey === 'string'
			? initialPayload.professionalWorldsCrossAppDraftKey.trim() || undefined
			: undefined;
	const [professionalWorldsDraft, setProfessionalWorldsDraft] =
		React.useState<ProfessionalWorldsGafDraft | null>(null);
	React.useEffect(() => {
		if (!professionalWorldsDraftKey) {
			setProfessionalWorldsDraft(null);
			return;
		}
		const capsule = consumeProfessionalWorldsCrossAppDraft(
			professionalWorldsDraftKey
		);
		const draft = professionalWorldsDraftToGaf(capsule);
		setProfessionalWorldsDraft(draft);
		if (draft?.crossAppLinkId) {
			reportProfessionalCrossAppDraftLifecycle(draft.crossAppLinkId, 'opened');
		}
	}, [professionalWorldsDraftKey]);
	const initialTargetUsername =
		typeof initialPayload?.targetUsername === 'string'
			? initialPayload.targetUsername.trim() || undefined
			: undefined;
	const initialTargetChatId =
		typeof initialPayload?.targetChatId === 'string'
			? initialPayload.targetChatId.trim() || undefined
			: undefined;
	const initialComposerAttachment = useMemo(() => {
		const cid =
			initialPayload?.gafComposerAttachmentContentId?.trim() ||
			professionalWorldsDraft?.attachment?.contentId;
		if (!cid) return undefined;
		const draftAttachment = professionalWorldsDraft?.attachment;
		return {
			contentId: cid,
			fileName:
				typeof initialPayload?.gafComposerAttachmentFileName === 'string' &&
				initialPayload.gafComposerAttachmentFileName.trim()
					? initialPayload.gafComposerAttachmentFileName.trim()
					: (draftAttachment?.fileName ?? 'file'),
			size:
				typeof initialPayload?.gafComposerAttachmentSize === 'number'
					? initialPayload.gafComposerAttachmentSize
					: (draftAttachment?.size ?? null),
			mimeType:
				initialPayload?.gafComposerAttachmentMimeType ??
				draftAttachment?.mimeType ??
				null,
		};
	}, [
		initialPayload?.gafComposerAttachmentContentId,
		initialPayload?.gafComposerAttachmentFileName,
		initialPayload?.gafComposerAttachmentMimeType,
		initialPayload?.gafComposerAttachmentSize,
		professionalWorldsDraft?.attachment,
	]);
	const explicitComposerSeed =
		typeof initialPayload?.gafComposerSeed === 'string'
			? initialPayload.gafComposerSeed.trim() || undefined
			: undefined;
	const initialComposerSeed = [
		professionalWorldsDraft?.seed,
		explicitComposerSeed,
	]
		.filter(Boolean)
		.join('\n\n');
	return (
		<GAFChatAppLazy
			initialTargetUsername={initialTargetUsername}
			initialTargetChatId={initialTargetChatId}
			initialComposerAttachment={initialComposerAttachment}
			initialComposerSeed={initialComposerSeed || undefined}
			professionalWorldsCrossAppLinkId={professionalWorldsDraft?.crossAppLinkId}
		/>
	);
});
GAFChatAppDesktopMount.displayName = 'GAFChatAppDesktopMount';

export const EWDeskDesktopMount: React.FC<{
	initialPayload?: WindowInitialPayload;
}> = memo(({ initialPayload }) => {
	const professionalWorldsDraftKey =
		typeof initialPayload?.professionalWorldsCrossAppDraftKey === 'string'
			? initialPayload.professionalWorldsCrossAppDraftKey.trim() || undefined
			: undefined;
	const [professionalWorldsSuggestion, setProfessionalWorldsSuggestion] =
		React.useState<ProfessionalWorldsEwDeskSuggestion | null>(null);
	React.useEffect(() => {
		if (!professionalWorldsDraftKey) {
			setProfessionalWorldsSuggestion(null);
			return;
		}
		const capsule = consumeProfessionalWorldsCrossAppDraft(
			professionalWorldsDraftKey
		);
		const suggestion = professionalWorldsDraftToEwDesk(capsule);
		setProfessionalWorldsSuggestion(suggestion);
		if (suggestion?.crossAppLinkId) {
			reportProfessionalCrossAppDraftLifecycle(
				suggestion.crossAppLinkId,
				'opened'
			);
		}
	}, [professionalWorldsDraftKey]);
	return (
		<EWDeskAppLazy
			initialNewsId={initialPayload?.ewDeskNewsId ?? undefined}
			initialProfessionalWorldsDraft={professionalWorldsSuggestion}
		/>
	);
});
EWDeskDesktopMount.displayName = 'EWDeskDesktopMount';

export const UserSiteStudioDesktopMount: React.FC<{
	initialPayload?: WindowInitialPayload;
}> = memo(({ initialPayload }) => {
	const professionalWorldsDraftKey =
		typeof initialPayload?.professionalWorldsCrossAppDraftKey === 'string'
			? initialPayload.professionalWorldsCrossAppDraftKey.trim() || undefined
			: undefined;
	const [professionalWorldsDraft, setProfessionalWorldsDraft] =
		React.useState<ProfessionalWorldsSiteStudioDraft | null>(null);
	React.useEffect(() => {
		if (!professionalWorldsDraftKey) {
			setProfessionalWorldsDraft(null);
			return;
		}
		const capsule = consumeProfessionalWorldsCrossAppDraft(
			professionalWorldsDraftKey
		);
		const draft = professionalWorldsDraftToSiteStudio(capsule);
		setProfessionalWorldsDraft(draft);
		if (draft?.crossAppLinkId) {
			reportProfessionalCrossAppDraftLifecycle(draft.crossAppLinkId, 'opened');
		}
	}, [professionalWorldsDraftKey]);
	return (
		<UserSiteStudioAppLazy
			initialProfessionalWorldsDraft={professionalWorldsDraft}
		/>
	);
});
UserSiteStudioDesktopMount.displayName = 'UserSiteStudioDesktopMount';

export const VideoCallAppDesktopMount: React.FC<{
	initialPayload?: WindowInitialPayload;
}> = memo(({ initialPayload }) => {
	const callId =
		typeof initialPayload?.videoCallId === 'string'
			? initialPayload.videoCallId.trim() || undefined
			: undefined;
	const initialJoinUrl =
		typeof initialPayload?.videoCallJoinUrl === 'string'
			? initialPayload.videoCallJoinUrl.trim() || undefined
			: undefined;
	const title =
		typeof initialPayload?.videoCallTitle === 'string'
			? initialPayload.videoCallTitle.trim() || undefined
			: undefined;
	return (
		<VideoCallAppLazy
			callId={callId}
			initialJoinUrl={initialJoinUrl}
			title={title}
		/>
	);
});
VideoCallAppDesktopMount.displayName = 'VideoCallAppDesktopMount';

export const DesktopAiChatAppDesktopMount: React.FC<{
	initialPayload?: WindowInitialPayload;
}> = memo(({ initialPayload }) => {
	const initialChatId =
		typeof initialPayload?.desktopAiChatId === 'string'
			? initialPayload.desktopAiChatId.trim() || undefined
			: undefined;
	const initialAttachUnifiedContentId =
		typeof initialPayload?.desktopAiAttachContentId === 'string'
			? initialPayload.desktopAiAttachContentId.trim() || undefined
			: undefined;
	const initialAttachSourceLabel =
		typeof initialPayload?.desktopAiAttachSourceLabel === 'string'
			? initialPayload.desktopAiAttachSourceLabel
			: null;
	const initialComposerSeed =
		typeof initialPayload?.desktopAiComposerSeed === 'string'
			? initialPayload.desktopAiComposerSeed.trim() || undefined
			: undefined;
	return (
		<DesktopAiChatAppLazy
			initialChatId={initialChatId}
			initialAttachUnifiedContentId={initialAttachUnifiedContentId}
			initialAttachSourceLabel={initialAttachSourceLabel}
			initialComposerSeed={initialComposerSeed}
		/>
	);
});
DesktopAiChatAppDesktopMount.displayName = 'DesktopAiChatAppDesktopMount';

export const EwrpDesktopMount: React.FC<{
	onUpdatePayload?: DesktopWindowAppCallbacks['onUpdatePayload'];
	initialPayload?: WindowInitialPayload;
}> = memo(({ onUpdatePayload, initialPayload }) => {
	const crossAppDraftKey =
		typeof initialPayload?.professionalWorldsCrossAppDraftKey === 'string'
			? initialPayload.professionalWorldsCrossAppDraftKey.trim() || undefined
			: undefined;
	const ewrpJobId =
		typeof initialPayload?.ewrpJobId === 'string'
			? initialPayload.ewrpJobId.trim() || undefined
			: undefined;
	return (
		<EWRPGeneratorLazy
			onWindowPayloadChange={onUpdatePayload}
			professionalWorldsCrossAppDraftKey={crossAppDraftKey}
			ewrpJobId={ewrpJobId}
		/>
	);
});
EwrpDesktopMount.displayName = 'EwrpDesktopMount';
