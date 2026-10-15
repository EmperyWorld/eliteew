/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Assembles GafChatAppWorkspaceModel from GAFChatApp orchestration outputs (send mutation adapter).
 *
 * Invariants:
 * - sendMutation handle exposes only fields required by composer retry UI.
 *
 * Related:
 * - GAFChatApp.tsx · hooks/useGafChatAppOrchestration.ts
 * - components/GafChatAppWorkspace.tsx
 */
import {
	GAF_CHAT_GUIDE_AUDIO_LS_KEY,
	GAF_CHAT_GUIDE_TOUR_FOLDER,
} from '../gafChatGuideConstants';
import type {
	GafChatAppWorkspaceModel,
	GafChatSendMutationHandle,
} from '../components/GafChatAppWorkspace';

/** Structural send-mutation fields needed by composer retry UI (avoids RQ TData invariance). */
type SendMutationSource = {
	isPending: boolean;
	isError: boolean;
	error: unknown;
	variables: unknown;
	reset: () => void;
	/** RQ MutateFunction is invariant in TVariables; adapted below. */
	mutate: unknown;
};

export type BuildGafChatAppWorkspaceModelArgs = Omit<
	GafChatAppWorkspaceModel,
	| 'sendMutation'
	| 'editSavePending'
	| 'guideAudioLocalStorageKey'
	| 'guideTourAudioFolder'
> & {
	sendMutation: SendMutationSource;
	editMessageMutationPending: boolean;
};

function adaptSendMutation(
	sendMutation: SendMutationSource
): GafChatSendMutationHandle {
	return {
		isPending: sendMutation.isPending,
		isError: sendMutation.isError,
		error: sendMutation.error,
		variables: sendMutation.variables,
		reset: sendMutation.reset,
		mutate: sendMutation.mutate as GafChatSendMutationHandle['mutate'],
	};
}

export function buildGafChatAppWorkspaceModel(
	args: BuildGafChatAppWorkspaceModelArgs
): GafChatAppWorkspaceModel {
	const { sendMutation, editMessageMutationPending, ...rest } = args;
	return {
		...rest,
		editSavePending: editMessageMutationPending,
		guideAudioLocalStorageKey: GAF_CHAT_GUIDE_AUDIO_LS_KEY,
		guideTourAudioFolder: GAF_CHAT_GUIDE_TOUR_FOLDER,
		sendMutation: adaptSendMutation(sendMutation),
	};
}
