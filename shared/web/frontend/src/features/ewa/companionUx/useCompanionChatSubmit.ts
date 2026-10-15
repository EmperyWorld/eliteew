/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Companion chat submit orchestration: SSE stream with sync fallback (U8.1 slice 4 extract).
 *
 * Invariants:
 * - Stream `actions` events dispatch before `final`; sync fallback only when stream returns false.
 * - Inflight stream aborts on unmount and before a new submit.
 * - Profile-not-initialized errors reset via injected callback without generic send toast.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/services/ewa/ewaCompanionChatApi.ts
 */

import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useCallback,
	useEffect,
	useRef,
} from 'react';
import type { TFunction } from 'i18next';

import type { PendingCompanionImage } from '@/features/ewa/companionImageAttachment';
import { toCompanionImageAttachmentPayload } from '@/features/ewa/companionImageAttachment';
import { pendingUserTurnLabel } from '@/features/ewa/companionUx/companionPendingTurnUi';
import type { CompanionActionRecord } from '@/features/ewa/companionActionTrayUi';
import type { CompanionTurnPlanHintState } from '@/features/ewa/companionUx/useCompanionLeftRailController';
import type { EwaCompanionShellContextV1 } from '@/pages/Desktop/utils/buildEwaCompanionShellContext';
import { requestContentManagerLibraryRefresh } from '@/services/unifiedContentEvents';
import {
	type CompanionChatAction,
	type CompanionChatMessageResponse,
	type CompanionChatRequestBody,
	type CompanionChatTransformPayload,
	type CompanionChatMessageRow,
	type CompanionTurnStagePayload,
	type EwaCompanionTaskRun,
	clearEwaCompanionChatDraft,
	coerceTaskRun,
	companionTaskRunImpliesContentLibraryMutation,
	newCompanionClientTurnId,
	postEwaCompanionChatMessage,
	streamEwaCompanionChatMessage,
	type CompanionChatStreamHandlers,
} from '@/services/ewa/ewaCompanionChatApi';
import { isCompanionProfileNotInitializedError } from '@/services/ewa/ewaCompanionProfileApi';

export type UseCompanionChatSubmitOptions = {
	principalId: string;
	pending: boolean;
	useWebSearch?: boolean;
	setUseWebSearch?: Dispatch<SetStateAction<boolean>>;
	setPending: Dispatch<SetStateAction<boolean>>;
	setPendingTurn: Dispatch<SetStateAction<CompanionChatMessageRow[] | null>>;
	setStreamingText: Dispatch<SetStateAction<string>>;
	setTurnStage: Dispatch<SetStateAction<CompanionTurnStagePayload | null>>;
	setActionRecords: Dispatch<SetStateAction<CompanionActionRecord[]>>;
	setTurnPlanHintState: Dispatch<
		SetStateAction<CompanionTurnPlanHintState | null>
	>;
	pendingImageRef: RefObject<PendingCompanionImage | null>;
	getSnapshot: () => EwaCompanionShellContextV1 | null;
	dispatchActions: (
		actions: CompanionChatAction[] | undefined,
		taskRun?: EwaCompanionTaskRun | null
	) => void;
	syncTurnPlanHintFromResponse: (out: CompanionChatMessageResponse) => void;
	syncProtocolFromResponse: (out: CompanionChatMessageResponse) => void;
	syncOutputSurfaceFromResponse: (out: CompanionChatMessageResponse) => void;
	syncTaskRunSnapshot: (taskRun: unknown) => void;
	applyCompanionDesktopConfigPatchSideEffects: () => void;
	applyCompanionProfileReset: () => void;
	showCompanionTransformVideo: (kind: string | null | undefined) => void;
	speakCompanionReply: (reply: string) => void;
	onCompanionRevision?: (revision: number) => void;
	taskEventHandlers: Pick<
		CompanionChatStreamHandlers,
		| 'onTaskAccepted'
		| 'onTaskStep'
		| 'onTaskCompleted'
		| 'onTaskFailed'
		| 'onTaskAwaitingConfirmation'
	>;
	updateDraft: (text: string) => void;
	clearPendingImage: () => void;
	reloadProfile: () => Promise<void>;
	refreshOperationRuns: () => Promise<void>;
	refreshActivePlan: (opts?: { silent?: boolean }) => Promise<void>;
	stopSpeaking: () => void;
	notifyError: (message: string) => void;
	t: TFunction<'marketing'>;
};

export function useCompanionChatSubmit({
	principalId,
	pending,
	useWebSearch = false,
	setUseWebSearch,
	setPending,
	setPendingTurn,
	setStreamingText,
	setTurnStage,
	setActionRecords,
	setTurnPlanHintState,
	pendingImageRef,
	getSnapshot,
	dispatchActions,
	syncTurnPlanHintFromResponse,
	syncProtocolFromResponse,
	syncOutputSurfaceFromResponse,
	syncTaskRunSnapshot,
	applyCompanionDesktopConfigPatchSideEffects,
	applyCompanionProfileReset,
	showCompanionTransformVideo,
	speakCompanionReply,
	onCompanionRevision,
	taskEventHandlers,
	updateDraft,
	clearPendingImage,
	reloadProfile,
	refreshOperationRuns,
	refreshActivePlan,
	stopSpeaking,
	notifyError,
	t,
}: UseCompanionChatSubmitOptions) {
	const abortRef = useRef<AbortController | null>(null);
	const pendingClientTurnIdRef = useRef<string | null>(null);
	const imageAttachedHint = t('ewaCompanion.chatImageAttachedHint');

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	const handleCompanionChatProfileError = useCallback(
		(e: unknown): boolean => {
			if (!isCompanionProfileNotInitializedError(e)) return false;
			applyCompanionProfileReset();
			setPendingTurn(null);
			return true;
		},
		[applyCompanionProfileReset, setPendingTurn]
	);

	const pushWebSearchResultRecord = useCallback(
		(out: CompanionChatMessageResponse) => {
			const result = out.web_search_result;
			if (!result) return;
			const status = result.status ?? (result.results.length > 0 ? 'ok' : null);
			if (!status) return;
			const outcome =
				status === 'error' || status === 'quota'
					? 'failed'
					: status === 'skipped' || status === 'empty'
						? 'blocked'
						: 'ok';
			setActionRecords((prev) =>
				[
					...prev,
					{
						id: `web-search-${Date.now()}`,
						kind: 'web_search',
						appComponent: '',
						// Keep query as caption only for successful hits; otherwise tray shows status i18n hints.
						rationale: status === 'ok' ? result.query : undefined,
						closed: false,
						outcome,
						webSearchResult: result,
					} satisfies CompanionActionRecord,
				].slice(-3)
			);
		},
		[setActionRecords]
	);

	const sendViaSync = useCallback(
		async (
			text: string,
			clientTurnId?: string | null,
			image?: PendingCompanionImage | null
		): Promise<void> => {
			const snap = getSnapshot();
			const turnId =
				clientTurnId ?? pendingClientTurnIdRef.current ?? undefined;
			const attachment = toCompanionImageAttachmentPayload(image ?? null);
			const body: CompanionChatRequestBody = {
				message: text,
				...(attachment ? { image_attachment: attachment } : {}),
				...(snap ? { shell_context: snap } : {}),
				...(useWebSearch ? { use_web_search: true } : {}),
				...(turnId ? { client_turn_id: turnId } : {}),
			};
			const out = await postEwaCompanionChatMessage(body);
			syncTurnPlanHintFromResponse(out);
			syncProtocolFromResponse(out);
			syncOutputSurfaceFromResponse(out);
			pushWebSearchResultRecord(out);
			setPendingTurn([
				{
					role: 'user',
					content: pendingUserTurnLabel(
						text,
						Boolean(attachment),
						imageAttachedHint
					),
				},
				{ role: 'assistant', content: out.reply },
			]);
			void speakCompanionReply(out.reply);
			dispatchActions(out.actions, coerceTaskRun(out.task_run));
			syncTaskRunSnapshot(out.task_run);
			if (out.desktop_config_patch_applied) {
				applyCompanionDesktopConfigPatchSideEffects();
			}
			if (out.transformed_this_turn) {
				showCompanionTransformVideo(out.transform_event_kind);
			}
			if (companionTaskRunImpliesContentLibraryMutation(out.task_run)) {
				queueMicrotask(() => requestContentManagerLibraryRefresh());
			}
			onCompanionRevision?.(out.companion_revision);
		},
		[
			applyCompanionDesktopConfigPatchSideEffects,
			dispatchActions,
			getSnapshot,
			imageAttachedHint,
			onCompanionRevision,
			pushWebSearchResultRecord,
			useWebSearch,
			showCompanionTransformVideo,
			syncTaskRunSnapshot,
			syncTurnPlanHintFromResponse,
			syncProtocolFromResponse,
			syncOutputSurfaceFromResponse,
			speakCompanionReply,
			setPendingTurn,
		]
	);

	// Order is intentional: stream `actions` events arrive *before* `final`, so we dispatch them eagerly. The
	// sync fallback dispatches in its own callback below.
	const sendViaStream = useCallback(
		async (
			text: string,
			clientTurnId?: string | null,
			image?: PendingCompanionImage | null
		): Promise<boolean> => {
			const controller = new AbortController();
			abortRef.current?.abort();
			abortRef.current = controller;
			const attachment = toCompanionImageAttachmentPayload(image ?? null);
			setPendingTurn([
				{
					role: 'user',
					content: pendingUserTurnLabel(
						text,
						Boolean(attachment),
						imageAttachedHint
					),
				},
				{ role: 'assistant', content: '' },
			]);
			setStreamingText('');
			setTurnStage(null);
			let accumulated = '';
			let finalReply: string | null = null;
			let finalRevision: number | null = null;
			let streamErrorCode: string | null = null;

			try {
				const snap = getSnapshot();
				const turnId =
					clientTurnId ?? pendingClientTurnIdRef.current ?? undefined;
				const body: CompanionChatRequestBody = {
					message: text,
					...(attachment ? { image_attachment: attachment } : {}),
					...(snap ? { shell_context: snap } : {}),
					...(useWebSearch ? { use_web_search: true } : {}),
					...(turnId ? { client_turn_id: turnId } : {}),
				};
				await streamEwaCompanionChatMessage(body, {
					signal: controller.signal,
					...taskEventHandlers,
					onTransform: (payload: CompanionChatTransformPayload) => {
						showCompanionTransformVideo(payload.kind);
					},
					onTurnStage: (payload) => {
						setTurnStage(payload);
					},
					onDelta: (chunk) => {
						accumulated += chunk;
						setStreamingText(accumulated);
						setTurnStage((prev) =>
							prev?.stage === 'composing_reply'
								? prev
								: { stage: 'composing_reply' }
						);
						setPendingTurn([
							{ role: 'user', content: text },
							{ role: 'assistant', content: accumulated },
						]);
					},
					onActions: (actions) => {
						dispatchActions(actions);
					},
					onFinal: (data) => {
						finalReply = data.reply;
						finalRevision = data.companion_revision;
						syncTurnPlanHintFromResponse(data);
						syncProtocolFromResponse(data);
						syncOutputSurfaceFromResponse(data);
						pushWebSearchResultRecord(data);
						syncTaskRunSnapshot(data.task_run);
						const runId = coerceTaskRun(data.task_run)?.id?.trim();
						if (runId) {
							setActionRecords((prev) =>
								prev.map((row) =>
									row.taskRunId ? row : { ...row, taskRunId: runId }
								)
							);
						}
						if (data.desktop_config_patch_applied) {
							applyCompanionDesktopConfigPatchSideEffects();
						}
						if (data.transformed_this_turn) {
							showCompanionTransformVideo(data.transform_event_kind);
						}
						if (companionTaskRunImpliesContentLibraryMutation(data.task_run)) {
							queueMicrotask(() => requestContentManagerLibraryRefresh());
						}
					},
					onError: (code) => {
						streamErrorCode = code;
					},
				});
			} catch (e: unknown) {
				if (handleCompanionChatProfileError(e)) return true;
				return false;
			}
			if (controller.signal.aborted) return true;
			if (
				streamErrorCode === 'companion_profile_not_initialized' ||
				streamErrorCode === 'companion_profile_not_found'
			) {
				applyCompanionProfileReset();
				setPendingTurn(null);
				return true;
			}
			if (streamErrorCode) {
				return false;
			}
			if (finalReply !== null && finalRevision !== null) {
				setPendingTurn([
					{
						role: 'user',
						content: pendingUserTurnLabel(
							text,
							Boolean(attachment),
							imageAttachedHint
						),
					},
					{ role: 'assistant', content: finalReply },
				]);
				onCompanionRevision?.(finalRevision);
				setStreamingText('');
				setTurnStage(null);
				void speakCompanionReply(finalReply);
				return true;
			}
			return false;
		},
		[
			applyCompanionDesktopConfigPatchSideEffects,
			applyCompanionProfileReset,
			dispatchActions,
			getSnapshot,
			handleCompanionChatProfileError,
			imageAttachedHint,
			onCompanionRevision,
			pushWebSearchResultRecord,
			showCompanionTransformVideo,
			syncTaskRunSnapshot,
			syncTurnPlanHintFromResponse,
			syncProtocolFromResponse,
			syncOutputSurfaceFromResponse,
			speakCompanionReply,
			taskEventHandlers,
			useWebSearch,
			setActionRecords,
			setPendingTurn,
			setStreamingText,
			setTurnStage,
		]
	);

	const submitCompanionLine = useCallback(
		async (text: string) => {
			const trimmed = text.trim();
			const image = pendingImageRef.current;
			if ((!trimmed && !image) || pending) return;
			stopSpeaking();
			setTurnPlanHintState(null);
			setPending(true);
			const webSearchThisTurn = useWebSearch;
			const clientTurnId = newCompanionClientTurnId();
			pendingClientTurnIdRef.current = clientTurnId;
			try {
				const ok = await sendViaStream(trimmed, clientTurnId, image);
				if (!ok) {
					await sendViaSync(trimmed, clientTurnId, image);
				}
				updateDraft('');
				clearPendingImage();
				clearEwaCompanionChatDraft(principalId);
				await reloadProfile();
				await refreshOperationRuns();
				await refreshActivePlan({ silent: true });
				if (webSearchThisTurn) {
					setUseWebSearch?.(false);
				}
			} catch (e: unknown) {
				if (handleCompanionChatProfileError(e)) return;
				const msg =
					e && typeof e === 'object' && 'message' in e
						? String((e as { message: unknown }).message)
						: String(e);
				notifyError(msg || t('ewaCompanion.chatSendFailed'));
				setPendingTurn(null);
			} finally {
				pendingClientTurnIdRef.current = null;
				setStreamingText('');
				setTurnStage(null);
				setPending(false);
			}
		},
		[
			clearPendingImage,
			handleCompanionChatProfileError,
			notifyError,
			pending,
			pendingImageRef,
			principalId,
			reloadProfile,
			refreshActivePlan,
			refreshOperationRuns,
			sendViaStream,
			sendViaSync,
			stopSpeaking,
			t,
			updateDraft,
			setPending,
			setPendingTurn,
			setStreamingText,
			setTurnStage,
			setTurnPlanHintState,
			setUseWebSearch,
			useWebSearch,
		]
	);

	return {
		handleCompanionChatProfileError,
		submitCompanionLine,
	};
}
