/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Send, regenerate, ensemble document confirm, stop, abort, and retry actions
 * for Desktop AI Chat SSE stream hook.
 *
 * Invariants:
 * - sendLockRef prevents double-send; epoch bumps invalidate stale callbacks.
 *
 * Related:
 * - hooks/desktopAiChatStream/useDesktopAiChatStreamRun.ts
 * - DesktopAiChatApp.tsx
 */
import * as React from 'react';
import { toast } from 'sonner';
import {
	classifyDesktopStreamError,
	listDesktopAiMessages,
	type DesktopAiMessage,
} from '../../api/desktopChatClient';
import { DESKTOP_AI_MESSAGES_TAIL } from '../../desktopChatMessagesMerge';
import { isDesktopEnsembleChat } from '../../desktopAiHeroes';
import { persistChatDraft } from '../../utils/desktopAiChatDraft';
import { isAbortError, resolveUseWebSearchFlag } from './helpers';
import type {
	DesktopAiChatStreamRefs,
	UseDesktopAiChatStreamParams,
} from './types';

type StreamRunApi = {
	runStream: (
		text: string,
		opts: import('./types').RunStreamOptions
	) => Promise<string>;
	applyDoneContext: (
		res: import('../../api/desktopChatClient').ListDesktopAiMessagesResult
	) => void;
	finalizeStreamEpoch: (myEpoch: number) => void;
	handleStreamError: (opts: {
		e: unknown;
		streamChatId: string;
		myEpoch: number;
		isEnsemble: boolean;
		asstLocalId: string;
		useWebSearchFlag: boolean;
		text: string;
		regenerate: boolean;
		documentConfirm?: import('./types').LastFailedSendState['documentConfirm'];
	}) => Promise<void>;
	verifyProjectRagIfNeeded: (
		chatRow:
			| import('../../api/desktopChatClient').DesktopAiChatItem
			| undefined,
		streamChatId: string
	) => Promise<void>;
};

type UseDesktopAiChatStreamActionsArgs = {
	params: UseDesktopAiChatStreamParams;
	refs: DesktopAiChatStreamRefs;
	streamStale: (chatId: string, epoch: number) => boolean;
	streamRun: StreamRunApi;
};

export function useDesktopAiChatStreamActions({
	params,
	refs,
	streamStale,
	streamRun,
}: UseDesktopAiChatStreamActionsArgs) {
	const {
		activeId,
		featureOn,
		sending,
		input,
		messages,
		chats,
		settings,
		useTools,
		useWebSearch,
		consumeWebSearchArm,
		ensembleDocConfirm,
		setEnsembleDocConfirm,
		soloSendsBlocked,
		setSoloSlotModalOpen,
		setStreamErrorBanner,
		setComposerHint,
		setToolsHistory,
		setEnsembleCouncilUi,
		setSending,
		setInput,
		setMessages,
		stickToBottomRef,
		skipTtsRef,
		remoteStreamBusyRef,
		applyTailMergeAfterStream,
		applyTailReplace,
		refreshAttachments,
		playTts,
		t,
	} = params;
	const currentUserId = params.currentUserId ?? null;

	const {
		streamEpochRef,
		streamAbortRef,
		sendLockRef,
		lastFailedSendRef,
		ensembleDeliveryModeRef,
		ensembleJointBubbleIdRef,
	} = refs;

	const {
		runStream,
		applyDoneContext,
		finalizeStreamEpoch,
		handleStreamError,
		verifyProjectRagIfNeeded,
	} = streamRun;

	const handleSend = React.useCallback(
		async (options?: {
			textOverride?: string;
			useWebSearchOverride?: boolean;
		}) => {
			const text = (options?.textOverride ?? input).trim();
			if (!text || !activeId || !featureOn || sending) {
				return;
			}
			if (sendLockRef.current) {
				return;
			}
			if (remoteStreamBusyRef.current) {
				toast.message(t('collabTurnBusyToast'));
				return;
			}
			if (ensembleDocConfirm) {
				toast.message(t('docConfirmBlockedSend'));
				return;
			}
			if (soloSendsBlocked) {
				toast.message(t('soloSlotBlockedToast'));
				setSoloSlotModalOpen(true);
				return;
			}
			const streamChatId = activeId;
			const myEpoch = ++streamEpochRef.current;
			sendLockRef.current = true;
			const chatRow = chats.find((c) => c.id === activeId);
			const isEnsemble = isDesktopEnsembleChat(chatRow?.settings);
			const useToolsFlag = useTools && !isEnsemble;
			const webSearchAdminOn = settings.tools_web_search_enabled === true;
			const useWebSearchFlag = resolveUseWebSearchFlag({
				useWebSearch,
				useTools: useToolsFlag,
				isEnsemble,
				adminEnabled: webSearchAdminOn,
				override: options?.useWebSearchOverride,
			});
			// One-shot arm: next user send must re-enable «Веб-поиск» deliberately.
			if (useWebSearch) {
				consumeWebSearchArm();
			}
			lastFailedSendRef.current = {
				text,
				useTools,
				useWebSearch: useWebSearchFlag,
				regenerate: false,
			};
			streamAbortRef.current?.abort();
			const ac = new AbortController();
			streamAbortRef.current = ac;
			setToolsHistory([]);
			setStreamErrorBanner(null);
			setComposerHint(null);
			if (isEnsemble) {
				setEnsembleCouncilUi(null);
				setEnsembleDocConfirm(null);
			}
			stickToBottomRef.current = true;
			setSending(true);
			setInput('');
			persistChatDraft(activeId, '');
			const optimistic: DesktopAiMessage = {
				id: `local-${Date.now()}`,
				role: 'user',
				content: text,
				created_at: new Date().toISOString(),
				...(currentUserId ? { author_user_id: currentUserId } : {}),
			};
			const soloAssistantLocalId = isEnsemble ? null : `local-a-${Date.now()}`;
			const asstLocalId = soloAssistantLocalId ?? '';
			if (!isEnsemble && soloAssistantLocalId) {
				const asstLocal: DesktopAiMessage = {
					id: soloAssistantLocalId,
					role: 'assistant',
					content: '',
					created_at: new Date().toISOString(),
				};
				setMessages((m) => [...m, optimistic, asstLocal]);
			} else {
				setMessages((m) => [...m, optimistic]);
			}
			try {
				const clientRequestId = crypto.randomUUID();
				await verifyProjectRagIfNeeded(chatRow, streamChatId);
				const acc = await runStream(text, {
					regenerate: false,
					signal: ac.signal,
					soloAssistantLocalId,
					isEnsemble,
					useToolsFlag,
					useWebSearchFlag,
					streamChatId,
					streamEpoch: myEpoch,
					clientRequestId,
				});
				if (streamStale(streamChatId, myEpoch)) {
					return;
				}
				if (!isEnsemble) {
					void playTts(acc);
				}
				const res = await listDesktopAiMessages(streamChatId, {
					tail: DESKTOP_AI_MESSAGES_TAIL,
				});
				applyDoneContext(res);
				applyTailMergeAfterStream(res);
				void refreshAttachments();
				lastFailedSendRef.current = null;
			} catch (e) {
				await handleStreamError({
					e,
					streamChatId,
					myEpoch,
					isEnsemble,
					asstLocalId,
					useWebSearchFlag,
					text,
					regenerate: false,
				});
			} finally {
				finalizeStreamEpoch(myEpoch);
			}
		},
		[
			input,
			activeId,
			featureOn,
			sending,
			ensembleDocConfirm,
			soloSendsBlocked,
			streamEpochRef,
			sendLockRef,
			streamAbortRef,
			lastFailedSendRef,
			remoteStreamBusyRef,
			chats,
			useTools,
			useWebSearch,
			consumeWebSearchArm,
			settings.tools_web_search_enabled,
			currentUserId,
			setToolsHistory,
			setStreamErrorBanner,
			setComposerHint,
			setEnsembleCouncilUi,
			setEnsembleDocConfirm,
			stickToBottomRef,
			setSending,
			setInput,
			setMessages,
			verifyProjectRagIfNeeded,
			runStream,
			streamStale,
			playTts,
			applyDoneContext,
			applyTailMergeAfterStream,
			refreshAttachments,
			handleStreamError,
			finalizeStreamEpoch,
			setSoloSlotModalOpen,
			t,
		]
	);

	const handleRegenerate = React.useCallback(async () => {
		if (!activeId || !featureOn || sending) {
			return;
		}
		if (sendLockRef.current) {
			return;
		}
		if (remoteStreamBusyRef.current) {
			toast.message(t('collabTurnBusyToast'));
			return;
		}
		if (ensembleDocConfirm) {
			return;
		}
		if (soloSendsBlocked) {
			toast.message(t('soloSlotBlockedToast'));
			setSoloSlotModalOpen(true);
			return;
		}
		const last = messages[messages.length - 1];
		if (last?.role !== 'assistant') {
			return;
		}
		const streamChatId = activeId;
		const myEpoch = ++streamEpochRef.current;
		sendLockRef.current = true;
		const chatRow = chats.find((c) => c.id === activeId);
		const isEnsemble = isDesktopEnsembleChat(chatRow?.settings);
		const useToolsFlag = useTools && !isEnsemble;
		const webSearchAdminOn = settings.tools_web_search_enabled === true;
		const useWebSearchFlag = resolveUseWebSearchFlag({
			useWebSearch,
			useTools: useToolsFlag,
			isEnsemble,
			adminEnabled: webSearchAdminOn,
		});
		if (useWebSearch) {
			consumeWebSearchArm();
		}
		lastFailedSendRef.current = {
			text: '',
			useTools,
			useWebSearch: useWebSearchFlag,
			regenerate: true,
		};
		streamAbortRef.current?.abort();
		const ac = new AbortController();
		streamAbortRef.current = ac;
		setToolsHistory([]);
		setStreamErrorBanner(null);
		if (isEnsemble) {
			setEnsembleCouncilUi(null);
			setEnsembleDocConfirm(null);
		}
		stickToBottomRef.current = true;
		setSending(true);
		setMessages((m) => {
			let out = [...m];
			if (isEnsemble) {
				while (out.length && out[out.length - 1]?.role === 'assistant') {
					out = out.slice(0, -1);
				}
			} else {
				out = out.slice(0, -1);
			}
			return out;
		});
		const soloAssistantLocalId = isEnsemble ? null : `local-a-${Date.now()}`;
		const asstLocalId = soloAssistantLocalId ?? '';
		if (!isEnsemble && soloAssistantLocalId) {
			const asstLocal: DesktopAiMessage = {
				id: soloAssistantLocalId,
				role: 'assistant',
				content: '',
				created_at: new Date().toISOString(),
			};
			setMessages((m) => [...m, asstLocal]);
		}
		try {
			const clientRequestId = crypto.randomUUID();
			await verifyProjectRagIfNeeded(chatRow, streamChatId);
			const acc = await runStream('', {
				regenerate: true,
				signal: ac.signal,
				soloAssistantLocalId,
				isEnsemble,
				useToolsFlag,
				useWebSearchFlag,
				streamChatId,
				streamEpoch: myEpoch,
				clientRequestId,
			});
			if (streamStale(streamChatId, myEpoch)) {
				return;
			}
			if (!isEnsemble) {
				void playTts(acc);
			}
			const res = await listDesktopAiMessages(streamChatId, {
				tail: DESKTOP_AI_MESSAGES_TAIL,
			});
			applyDoneContext(res);
			applyTailMergeAfterStream(res);
			void refreshAttachments();
			lastFailedSendRef.current = null;
		} catch (e) {
			await handleStreamError({
				e,
				streamChatId,
				myEpoch,
				isEnsemble,
				asstLocalId,
				useWebSearchFlag,
				text: '',
				regenerate: true,
			});
		} finally {
			finalizeStreamEpoch(myEpoch);
		}
	}, [
		activeId,
		featureOn,
		sending,
		ensembleDocConfirm,
		soloSendsBlocked,
		messages,
		streamEpochRef,
		sendLockRef,
		streamAbortRef,
		lastFailedSendRef,
		remoteStreamBusyRef,
		chats,
		useTools,
		useWebSearch,
		consumeWebSearchArm,
		settings.tools_web_search_enabled,
		setToolsHistory,
		setStreamErrorBanner,
		setEnsembleCouncilUi,
		setEnsembleDocConfirm,
		stickToBottomRef,
		setSending,
		setMessages,
		verifyProjectRagIfNeeded,
		runStream,
		streamStale,
		playTts,
		applyDoneContext,
		applyTailMergeAfterStream,
		refreshAttachments,
		handleStreamError,
		finalizeStreamEpoch,
		setSoloSlotModalOpen,
		t,
	]);

	const handleEnsembleDocumentConfirm = React.useCallback(
		async (
			decision: 'accept' | 'decline',
			options?: { refUserMessageIdOverride?: string }
		) => {
			const refUserMessageId =
				options?.refUserMessageIdOverride ?? ensembleDocConfirm?.userMessageId;
			if (!activeId || !featureOn || sending || !refUserMessageId) {
				return;
			}
			if (sendLockRef.current) {
				return;
			}
			const streamChatId = activeId;
			const myEpoch = ++streamEpochRef.current;
			sendLockRef.current = true;
			lastFailedSendRef.current = {
				text: '',
				useTools: false,
				useWebSearch: false,
				regenerate: false,
				documentConfirm: { decision, refUserMessageId },
			};
			streamAbortRef.current?.abort();
			const ac = new AbortController();
			streamAbortRef.current = ac;
			setToolsHistory([]);
			setStreamErrorBanner(null);
			setComposerHint(null);
			setEnsembleCouncilUi(null);
			stickToBottomRef.current = true;
			setSending(true);
			try {
				const clientRequestId = crypto.randomUUID();
				const chatRowConfirm = chats.find((c) => c.id === activeId);
				await verifyProjectRagIfNeeded(chatRowConfirm, streamChatId);
				await runStream('', {
					regenerate: false,
					signal: ac.signal,
					soloAssistantLocalId: null,
					isEnsemble: true,
					useToolsFlag: false,
					useWebSearchFlag: false,
					streamChatId,
					streamEpoch: myEpoch,
					clientRequestId,
					documentConfirm: { decision, refUserMessageId },
				});
				if (streamStale(streamChatId, myEpoch)) {
					return;
				}
				const res = await listDesktopAiMessages(streamChatId, {
					tail: DESKTOP_AI_MESSAGES_TAIL,
				});
				applyTailMergeAfterStream(res);
				void refreshAttachments();
				setEnsembleDocConfirm(null);
				lastFailedSendRef.current = null;
			} catch (e) {
				if (streamStale(streamChatId, myEpoch)) {
					return;
				}
				if (isAbortError(e)) {
					toast(t('streamStoppedToast'));
					setStreamErrorBanner(null);
					try {
						const res = await listDesktopAiMessages(streamChatId, {
							tail: DESKTOP_AI_MESSAGES_TAIL,
						});
						applyTailReplace(res);
					} catch {
						/* */
					}
				} else {
					const cls = classifyDesktopStreamError(e);
					lastFailedSendRef.current = {
						text: '',
						useTools: false,
						useWebSearch: false,
						regenerate: false,
						documentConfirm: { decision, refUserMessageId },
					};
					setStreamErrorBanner({
						message: cls.message,
						retryable: cls.retryable,
						canClearStreamLock: cls.canClearStreamLock === true,
					});
					toast.error(cls.message);
				}
			} finally {
				finalizeStreamEpoch(myEpoch);
			}
		},
		[
			ensembleDocConfirm?.userMessageId,
			activeId,
			featureOn,
			sending,
			streamEpochRef,
			sendLockRef,
			streamAbortRef,
			lastFailedSendRef,
			chats,
			setToolsHistory,
			setStreamErrorBanner,
			setComposerHint,
			setEnsembleCouncilUi,
			stickToBottomRef,
			setSending,
			verifyProjectRagIfNeeded,
			runStream,
			streamStale,
			applyTailMergeAfterStream,
			refreshAttachments,
			setEnsembleDocConfirm,
			applyTailReplace,
			finalizeStreamEpoch,
			t,
		]
	);

	const abortActiveStream = React.useCallback(() => {
		streamAbortRef.current?.abort();
		streamEpochRef.current += 1;
		sendLockRef.current = false;
		setSending(false);
		setStreamErrorBanner(null);
		setComposerHint(null);
		setEnsembleCouncilUi(null);
		ensembleJointBubbleIdRef.current = null;
		ensembleDeliveryModeRef.current = 'separate';
	}, [
		streamAbortRef,
		streamEpochRef,
		sendLockRef,
		setSending,
		setStreamErrorBanner,
		setComposerHint,
		setEnsembleCouncilUi,
		ensembleJointBubbleIdRef,
		ensembleDeliveryModeRef,
	]);

	const handleStopStream = React.useCallback(() => {
		skipTtsRef.current = true;
		streamAbortRef.current?.abort();
		setEnsembleCouncilUi(null);
		ensembleJointBubbleIdRef.current = null;
		ensembleDeliveryModeRef.current = 'separate';
	}, [
		skipTtsRef,
		streamAbortRef,
		setEnsembleCouncilUi,
		ensembleJointBubbleIdRef,
		ensembleDeliveryModeRef,
	]);

	const handleRetryLastStream = React.useCallback(() => {
		const fb = lastFailedSendRef.current;
		if (!fb || !activeId || sending) {
			return;
		}
		setStreamErrorBanner(null);
		void (async () => {
			try {
				const res = await listDesktopAiMessages(activeId, {
					tail: DESKTOP_AI_MESSAGES_TAIL,
				});
				applyTailReplace(res);
			} catch {
				/* */
			}
			if (fb.documentConfirm) {
				await handleEnsembleDocumentConfirm(fb.documentConfirm.decision, {
					refUserMessageIdOverride: fb.documentConfirm.refUserMessageId,
				});
				return;
			}
			if (fb.regenerate) {
				await handleRegenerate();
				return;
			}
			await handleSend({
				textOverride: fb.text,
				useWebSearchOverride: fb.useWebSearch,
			});
		})();
	}, [
		activeId,
		sending,
		lastFailedSendRef,
		setStreamErrorBanner,
		applyTailReplace,
		handleEnsembleDocumentConfirm,
		handleRegenerate,
		handleSend,
	]);

	return {
		handleSend,
		handleRegenerate,
		handleEnsembleDocumentConfirm,
		handleStopStream,
		handleRetryLastStream,
		abortActiveStream,
	};
}
