/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * runStream, done-context merge, stream error handling, and RAG verify for
 * Desktop AI Chat SSE orchestration.
 *
 * Invariants:
 * - Token paints rAF-batched; document replace staged then committed before tail merge.
 * - Stream error bubble uses classified copy only (no transport `raw` / API detail).
 *
 * Related:
 * - hooks/desktopAiChatStream/streamEventHandlers.ts
 * - api/desktopChatClient.ts
 */
import * as React from 'react';
import { toast } from 'sonner';
import {
	classifyDesktopStreamError,
	formatDesktopStreamErrorBubble,
	listDesktopAiMessages,
	streamDesktopAiChat,
	verifyDesktopAiChatContext,
	type DesktopAiChatItem,
	type ListDesktopAiMessagesResult,
} from '../../api/desktopChatClient';
import { buildDesktopAiContextFootnote } from '../../desktopChatContextSummary';
import { DESKTOP_AI_MESSAGES_TAIL } from '../../desktopChatMessagesMerge';
import { createDesktopAiChatTokenBatch } from '../../desktopAiChatTokenBatch';
import {
	applyDesktopAiDocumentReplacement,
	isDesktopAiPersistedMessageIdCandidate,
} from '../../desktopChatDocumentReplacement';
import { webSearchSourcesFromDonePayload } from '../../desktopWebSearchSources';
import { persistChatDraft } from '../../utils/desktopAiChatDraft';
import {
	isDesktopAiChatOwnerForStreamLockClear,
	stripDesktopAiOptimisticLocalMessages,
} from '../../utils/desktopAiChatTurnBusyRecover';
import {
	clearDesktopAiChatStreamMetrics,
	markDesktopAiChatStreamFetchStart,
	markDesktopAiChatStreamFirstChunk,
} from '../useDesktopAiChatStreamMetrics';
import { assistantIdsAfterLastUser, isAbortError } from './helpers';
import { createDesktopAiChatStreamEventHandler } from './streamEventHandlers';
import type {
	DesktopAiChatStreamRefs,
	LastFailedSendState,
	RunStreamOptions,
	StreamRunMutableState,
	UseDesktopAiChatStreamParams,
} from './types';

type UseDesktopAiChatStreamRunArgs = {
	params: UseDesktopAiChatStreamParams;
	refs: DesktopAiChatStreamRefs;
	streamStale: (chatId: string, epoch: number) => boolean;
};

export function useDesktopAiChatStreamRun({
	params,
	refs,
	streamStale,
}: UseDesktopAiChatStreamRunArgs) {
	const {
		setSending,
		setComposerHint,
		setShowScrollDown,
		setStreamErrorBanner,
		setEnsembleCouncilUi,
		setEnsembleDocConfirm,
		setMessages,
		setInput,
		setToolsHistory,
		setAssistantContextByMessageId,
		setWebSearchSourcesByMessageId,
		setSoloSlotModalOpen,
		applyTailReplace,
		refreshAttachments,
		useTools,
		chats,
		currentUserId,
		t,
	} = params;

	const {
		streamEpochRef,
		streamAbortRef,
		sendLockRef,
		lastFailedSendRef,
		pendingContextRef,
		ensembleDeliveryModeRef,
		ensembleJointBubbleIdRef,
	} = refs;

	const applyDoneContext = React.useCallback(
		(res: ListDesktopAiMessagesResult) => {
			const ctx = pendingContextRef.current;
			pendingContextRef.current = null;
			if (!ctx) {
				return;
			}
			const footnote = buildDesktopAiContextFootnote(ctx, t);
			const sources = webSearchSourcesFromDonePayload({
				context: ctx,
				web_search_sources: ctx.web_search_sources,
			});
			const targetIds = assistantIdsAfterLastUser(res.items);
			if (footnote && targetIds.length > 0) {
				setAssistantContextByMessageId((prev) => {
					const next = { ...prev };
					for (const id of targetIds) {
						next[id] = footnote;
					}
					return next;
				});
			}
			if (sources.length > 0 && targetIds.length > 0) {
				setWebSearchSourcesByMessageId((prev) => {
					const next = { ...prev };
					for (const id of targetIds) {
						next[id] = sources;
					}
					return next;
				});
			}
		},
		[
			t,
			setAssistantContextByMessageId,
			setWebSearchSourcesByMessageId,
			pendingContextRef,
		]
	);

	const runStream = React.useCallback(
		async (text: string, opts: RunStreamOptions) => {
			const { streamChatId: chatId, streamEpoch } = opts;
			if (!chatId) {
				return '';
			}
			const stale = () => streamStale(chatId, streamEpoch);
			const runState: StreamRunMutableState = {
				acc: '',
				currentAsstId: opts.soloAssistantLocalId,
				stagedReplacement: null,
			};
			if (!stale()) {
				setComposerHint(
					opts.isEnsemble
						? null
						: opts.useToolsFlag
							? t('hintToolsLongWait')
							: null
				);
			}
			if (opts.isEnsemble && !stale()) {
				setEnsembleCouncilUi(null);
				ensembleJointBubbleIdRef.current = null;
				ensembleDeliveryModeRef.current = 'separate';
			}
			pendingContextRef.current = null;
			clearDesktopAiChatStreamMetrics();
			markDesktopAiChatStreamFetchStart();
			let firstChunkMarked = false;
			const tokenBatch = createDesktopAiChatTokenBatch();
			const paintAccumulatedContent = () => {
				const targetId = runState.currentAsstId;
				if (!targetId) {
					return;
				}
				const content = runState.acc;
				setMessages((m) =>
					m.map((row) => (row.id === targetId ? { ...row, content } : row))
				);
			};
			const flushTokenPaint = () => {
				tokenBatch.flushNow();
			};
			const onEvent = createDesktopAiChatStreamEventHandler({
				stale,
				opts,
				runState,
				tokenBatch,
				flushTokenPaint,
				refs: {
					pendingContextRef,
					ensembleDeliveryModeRef,
					ensembleJointBubbleIdRef,
				},
				setSending,
				setComposerHint,
				setEnsembleDocConfirm,
				setEnsembleCouncilUi,
				setMessages,
				setToolsHistory,
				setWebSearchSourcesByMessageId,
				t,
			});
			try {
				await streamDesktopAiChat(
					chatId,
					text,
					opts.useToolsFlag,
					opts.useWebSearchFlag,
					(delta) => {
						if (stale()) {
							tokenBatch.cancel();
							return;
						}
						if (!firstChunkMarked && delta.length > 0) {
							firstChunkMarked = true;
							markDesktopAiChatStreamFirstChunk();
						}
						runState.acc += delta;
						if (!runState.currentAsstId) {
							return;
						}
						tokenBatch.schedule(paintAccumulatedContent);
					},
					onEvent,
					opts.signal,
					opts.documentConfirm
						? {
								regenerate: false,
								ensembleDocumentConfirm: opts.documentConfirm.decision,
								refUserMessageId: opts.documentConfirm.refUserMessageId,
								clientRequestId: opts.clientRequestId,
							}
						: {
								regenerate: opts.regenerate,
								clientRequestId: opts.clientRequestId,
							}
				);
				flushTokenPaint();
				if (!stale() && runState.stagedReplacement && runState.currentAsstId) {
					const serverId = runState.stagedReplacement.message_id;
					const rewriteIdTo = isDesktopAiPersistedMessageIdCandidate(serverId)
						? String(serverId).trim()
						: undefined;
					const previousLocalId = runState.currentAsstId;
					const payloadToCommit = runState.stagedReplacement;
					setMessages(
						(rows) =>
							applyDesktopAiDocumentReplacement(
								rows,
								previousLocalId,
								payloadToCommit,
								{ mode: 'commit', rewriteIdTo }
							).messages
					);
					if (rewriteIdTo && rewriteIdTo !== previousLocalId) {
						runState.currentAsstId = rewriteIdTo;
						if (ensembleJointBubbleIdRef.current === previousLocalId) {
							ensembleJointBubbleIdRef.current = rewriteIdTo;
						}
						setWebSearchSourcesByMessageId((prev) => {
							const existing = prev[previousLocalId];
							if (!existing) {
								return prev;
							}
							const next = { ...prev };
							delete next[previousLocalId];
							next[rewriteIdTo] = existing;
							return next;
						});
					}
					runState.stagedReplacement = null;
				} else if (stale()) {
					tokenBatch.cancel();
					runState.stagedReplacement = null;
				}
			} catch (streamErr) {
				flushTokenPaint();
				tokenBatch.cancel();
				runState.stagedReplacement = null;
				throw streamErr;
			}
			if (!stale()) {
				setComposerHint(null);
			}
			return runState.acc;
		},
		[
			streamStale,
			setComposerHint,
			setEnsembleCouncilUi,
			setMessages,
			setSending,
			setEnsembleDocConfirm,
			setToolsHistory,
			setWebSearchSourcesByMessageId,
			pendingContextRef,
			ensembleJointBubbleIdRef,
			ensembleDeliveryModeRef,
			t,
		]
	);

	const finalizeStreamEpoch = React.useCallback(
		(myEpoch: number) => {
			sendLockRef.current = false;
			streamAbortRef.current = null;
			if (streamEpochRef.current === myEpoch) {
				setSending(false);
				setShowScrollDown(false);
				setComposerHint(null);
			}
		},
		[
			sendLockRef,
			streamAbortRef,
			streamEpochRef,
			setSending,
			setShowScrollDown,
			setComposerHint,
		]
	);

	const handleStreamError = React.useCallback(
		async (opts: {
			e: unknown;
			streamChatId: string;
			myEpoch: number;
			isEnsemble: boolean;
			asstLocalId: string;
			useWebSearchFlag: boolean;
			text: string;
			regenerate: boolean;
			documentConfirm?: LastFailedSendState['documentConfirm'];
		}) => {
			const {
				e,
				streamChatId,
				myEpoch,
				isEnsemble,
				asstLocalId,
				useWebSearchFlag,
				text,
				regenerate,
				documentConfirm,
			} = opts;
			if (streamStale(streamChatId, myEpoch)) {
				return;
			}
			if (isAbortError(e)) {
				toast(t('streamStoppedToast'));
				setStreamErrorBanner(null);
				setEnsembleCouncilUi(null);
				try {
					const res = await listDesktopAiMessages(streamChatId, {
						tail: DESKTOP_AI_MESSAGES_TAIL,
					});
					applyTailReplace(res);
					void refreshAttachments();
				} catch {
					/* keep local */
				}
			} else {
				const cls = classifyDesktopStreamError(e);
				if (cls.soloSlotBlocked) {
					setSoloSlotModalOpen(true);
				}
				if (cls.turnBusy) {
					const chatRow = chats.find((c) => c.id === streamChatId);
					const ownerClear = isDesktopAiChatOwnerForStreamLockClear({
						viewerRole: chatRow?.viewer_role,
						ownerUserId: chatRow?.owner_user_id ?? chatRow?.user_id,
						currentUserId,
					});
					if (text.trim()) {
						setInput(text);
						persistChatDraft(streamChatId, text);
					}
					setMessages((m) => stripDesktopAiOptimisticLocalMessages(m));
					lastFailedSendRef.current = {
						text,
						useTools,
						useWebSearch: useWebSearchFlag,
						regenerate,
						documentConfirm,
					};
					setStreamErrorBanner({
						message: cls.message,
						retryable: false,
						turnBusy: true,
						canClearStreamLock: ownerClear,
					});
					toast.message(t('collabTurnBusyToast'));
					return;
				}
				lastFailedSendRef.current = {
					text,
					useTools,
					useWebSearch: useWebSearchFlag,
					regenerate,
					documentConfirm,
				};
				setStreamErrorBanner({
					message: cls.message,
					retryable: cls.retryable,
					canClearStreamLock: cls.canClearStreamLock === true,
				});
				toast.error(cls.message);
				if (!isEnsemble && asstLocalId) {
					setMessages((m) =>
						m.map((row) =>
							row.id === asstLocalId
								? {
										...row,
										content: formatDesktopStreamErrorBubble(cls.message, t),
									}
								: row
						)
					);
				} else {
					try {
						const res = await listDesktopAiMessages(streamChatId, {
							tail: DESKTOP_AI_MESSAGES_TAIL,
						});
						applyTailReplace(res);
					} catch {
						/* */
					}
				}
			}
		},
		[
			streamStale,
			t,
			setStreamErrorBanner,
			setEnsembleCouncilUi,
			applyTailReplace,
			refreshAttachments,
			useTools,
			setSoloSlotModalOpen,
			setMessages,
			setInput,
			chats,
			currentUserId,
			lastFailedSendRef,
		]
	);

	const verifyProjectRagIfNeeded = React.useCallback(
		async (chatRow: DesktopAiChatItem | undefined, streamChatId: string) => {
			if (chatRow?.use_project_rag && chatRow?.project_id) {
				const v = await verifyDesktopAiChatContext(streamChatId);
				if (!v.ok) {
					const detail =
						typeof v.detail === 'string' && v.detail.trim()
							? v.detail.trim()
							: t('verifyContextFailed');
					throw new Error(detail);
				}
			}
		},
		[t]
	);

	return {
		runStream,
		applyDoneContext,
		finalizeStreamEpoch,
		handleStreamError,
		verifyProjectRagIfNeeded,
	};
}
