/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat send/edit/delete/accept mutations, composer send path, and attachment/voice upload handlers.
 *
 * Invariants:
 * - E2EE branch rejects attachments and quoted replies until encrypted variants exist.
 *
 * Related:
 * - GAFChatApp.tsx · GafChatComposerCluster.tsx
 */
import {
	reportProfessionalCrossAppDraftLifecycle,
	shouldReportGafCrossAppDraftPublished,
} from '@/features/professional-worlds/desktop/reportProfessionalCrossAppDraftLifecycle';
import {
	dataTransferHasContentDrag,
	parseContentDragPayloadFromDataTransfer,
	type ContentDragPayload,
	type ContentDragEntry,
} from '@/pages/ContentManager/utils/contentManagerDrag';
import { contentApi } from '@/services/contentApi';
import type { InfiniteData } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import {
	startTransition,
	useCallback,
	useEffect,
	useRef,
	type ChangeEvent,
	type ClipboardEvent,
	type Dispatch,
	type DragEvent,
	type MutableRefObject,
	type RefObject,
	type SetStateAction,
} from 'react';
import { toast } from 'sonner';
import { playGafSendSoundNow } from '../../../utils/gafChatUiSounds';
import {
	acceptGafAttachment,
	deleteGafMessage,
	editGafMessage,
	gafChatQueryKeys,
	getUserPublicKey,
	sendMessageE2E,
	sendMessagePlain,
} from '../api/gafChatApi';
import {
	decryptE2EMessage,
	ensureGafWireIdentityReady,
	prepareE2EMessageForSending,
} from '../GAFChatCrypto';
import { clearGafComposerDraft } from '../gafChatComposerDrafts';
import type { GafPendingComposerAttachment } from '../gafChatComposerTypes';
import { maybeCompressImageForGafUpload } from '../gafChatImageCompress';
import {
	batchUploadProgressPercent,
	nextSteppedUploadProgress,
} from '../gafChatUploadProgress';
import { mapGafChatUserError } from '../gafChatMapUserError';
import {
	GAF_OPTIMISTIC_ID_PREFIX,
	appendGafSocketMessageToInfinitePages,
	makeOptimisticMessage,
	resolveGafChatSendMode,
} from '../gafChatMessageUtils';
import {
	GAF_VOICE_ATTACHMENT_NAME_PREFIX,
	GAF_VOICE_CONTENT_SUBTYPE,
	extensionForRecordedVoiceMime,
} from '../gafVoiceConstants';
import type { GAFChatListItem, GAFMessageItem } from '../types';

export function useGafChatSendOrchestration(options: {
	t: TFunction<'gafChat'>;
	myUserId: string | null;
	selectedChatId: string | null;
	e2eeActive: boolean;
	chatsRef: MutableRefObject<GAFChatListItem[]>;
	chats: GAFChatListItem[];
	inputText: string;
	pendingAttachments: GafPendingComposerAttachment[];
	replyingTo: GAFMessageItem | null;
	composerLocked: boolean;
	professionalWorldsCrossAppLinkId?: string;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	setInputText: Dispatch<SetStateAction<string>>;
	setPendingAttachments: Dispatch<
		SetStateAction<GafPendingComposerAttachment[]>
	>;
	setReplyingTo: Dispatch<SetStateAction<GAFMessageItem | null>>;
	setE2eePlaintextByMessageId: Dispatch<SetStateAction<Record<string, string>>>;
	setAttachmentUploading: Dispatch<SetStateAction<boolean>>;
	setAttachmentUploadPercent: Dispatch<SetStateAction<number | null>>;
	setComposerDragOver: Dispatch<SetStateAction<boolean>>;
	setEditingMessage: Dispatch<SetStateAction<GAFMessageItem | null>>;
	setEditDraft: Dispatch<SetStateAction<string>>;
	setMessageDeleteConfirm: Dispatch<
		SetStateAction<{
			kind: 'me' | 'everyone';
			messageId: string;
		} | null>
	>;
	isVoiceRecording: boolean;
	attachmentUploading: boolean;
}) {
	const {
		t,
		myUserId,
		selectedChatId,
		e2eeActive,
		chatsRef,
		chats,
		inputText,
		pendingAttachments,
		replyingTo,
		composerLocked,
		professionalWorldsCrossAppLinkId,
		inputRef,
		setInputText,
		setPendingAttachments,
		setReplyingTo,
		setE2eePlaintextByMessageId,
		setAttachmentUploading,
		setAttachmentUploadPercent,
		setComposerDragOver,
		setEditingMessage,
		setEditDraft,
		setMessageDeleteConfirm,
		isVoiceRecording,
		attachmentUploading,
	} = options;

	const queryClient = useQueryClient();
	const pwCrossAppPublishedSigRef = useRef<string | null>(null);
	const voiceRecordingCompleteRef = useRef<
		(result: { blob: Blob; mime: string } | null) => void
	>(() => {});

	const sendMutation = useMutation({
		mutationFn: async (vars: {
			chatId: string;
			body: string;
			e2eeActive: boolean;
			attachmentContentId?: string | null;
			attachmentPreview?: {
				fileName: string;
				size: number | null;
				mimeType?: string | null;
			} | null;
			replyToMessageId?: string | null;
		}) => {
			if (vars.e2eeActive) {
				if (vars.replyToMessageId) {
					throw new Error(t('e2eeReplyBlocked'));
				}
				await ensureGafWireIdentityReady();
				const partnerId =
					chatsRef.current.find((c) => c.chat_id === vars.chatId)?.partner
						?.id ?? null;
				const partnerKey = partnerId ? await getUserPublicKey(partnerId) : null;
				const partnerPublicKeyPem =
					partnerKey?.has_key &&
					partnerKey.algorithm === 'rsa_oaep_sha256' &&
					partnerKey.public_key_pem
						? partnerKey.public_key_pem
						: null;
				const prepared = await prepareE2EMessageForSending({
					chatId: vars.chatId,
					plaintext: vars.body,
					partnerPublicKeyPem,
				});
				return sendMessageE2E(vars.chatId, {
					e2e_ciphertext: prepared.ciphertextB64,
					e2e_nonce: prepared.nonceB64,
					e2e_algorithm: prepared.algorithm,
					e2e_encryption_version: prepared.encryptionVersion,
					e2e_session_key_for_recipient:
						prepared.sessionKeyForRecipientB64 ?? undefined,
					e2e_session_key_for_self: prepared.sessionKeyForSelfB64 ?? undefined,
					attachment_content_id: vars.attachmentContentId ?? undefined,
				});
			}
			return sendMessagePlain(vars.chatId, vars.body, undefined, {
				attachmentContentId: vars.attachmentContentId ?? undefined,
				replyToMessageId: vars.replyToMessageId ?? undefined,
			});
		},
		onMutate: async (vars) => {
			const { chatId, body } = vars;
			await queryClient.cancelQueries({
				queryKey: gafChatQueryKeys.messages(chatId),
			});
			const previous = queryClient.getQueryData<InfiniteData<GAFMessageItem[]>>(
				gafChatQueryKeys.messages(chatId)
			);
			const uid = myUserId;
			if (!uid) {
				return { previous, tempId: null as string | null };
			}
			const tempId = `${GAF_OPTIMISTIC_ID_PREFIX}${crypto.randomUUID()}`;
			const optimistic = makeOptimisticMessage(
				chatId,
				uid,
				body,
				tempId,
				vars.attachmentContentId
					? {
							attachment_content_id: vars.attachmentContentId,
							attachment_name: vars.attachmentPreview?.fileName ?? null,
							attachment_size: vars.attachmentPreview?.size ?? null,
							attachment_mime_type: vars.attachmentPreview?.mimeType ?? null,
						}
					: undefined,
				vars.replyToMessageId ?? null
			);
			queryClient.setQueryData<InfiniteData<GAFMessageItem[]>>(
				gafChatQueryKeys.messages(chatId),
				(old) => {
					if (!old) {
						return { pages: [[optimistic]], pageParams: [undefined] };
					}
					const pages = appendGafSocketMessageToInfinitePages(
						old.pages,
						optimistic,
						{ myUserId: uid }
					);
					return { ...old, pages };
				}
			);
			return { previous, tempId };
		},
		onSuccess: (
			serverMsg,
			{ chatId, body, e2eeActive: sentE2ee, attachmentContentId },
			context
		) => {
			const visibleServerMsg =
				sentE2ee && body.trim()
					? { ...serverMsg, body: body.trim() }
					: serverMsg;
			if (
				shouldReportGafCrossAppDraftPublished({
					linkId: professionalWorldsCrossAppLinkId,
					body,
					attachmentContentId,
				})
			) {
				const linkId = professionalWorldsCrossAppLinkId?.trim() ?? '';
				const sig = `${linkId}:${serverMsg.id}`;
				if (pwCrossAppPublishedSigRef.current !== sig) {
					pwCrossAppPublishedSigRef.current = sig;
					reportProfessionalCrossAppDraftLifecycle(linkId, 'published', {
						gaf_message_id: serverMsg.id,
					});
				}
			}
			const tempId = context?.tempId;
			if (tempId) {
				queryClient.setQueryData<InfiniteData<GAFMessageItem[]>>(
					gafChatQueryKeys.messages(chatId),
					(old) => {
						if (!old) return old;
						const pages = old.pages.map((page) =>
							page.map((m) => (m.id === tempId ? visibleServerMsg : m))
						);
						return { ...old, pages };
					}
				);
			}
			if (sentE2ee && serverMsg.e2ee_session_key_envelope) {
				void (async () => {
					const plain = await decryptE2EMessage({
						chatId,
						ciphertextB64: serverMsg.body_ciphertext || '',
						nonceB64: serverMsg.nonce,
						encryptedSessionKeyForMeB64:
							serverMsg.e2ee_session_key_envelope ?? null,
					});
					if (plain !== '[encrypted]') {
						setE2eePlaintextByMessageId((prev) => ({
							...prev,
							[serverMsg.id]: plain,
						}));
					}
				})();
			}
			queryClient.invalidateQueries({ queryKey: gafChatQueryKeys.chats });
			if (myUserId) {
				clearGafComposerDraft(myUserId, chatId);
			}
			setInputText('');
			setPendingAttachments((prev) => prev.slice(1));
			setReplyingTo(null);
			queueMicrotask(() => {
				void playGafSendSoundNow();
				const el = inputRef.current;
				if (el) {
					el.style.height = 'auto';
					el.focus();
				}
			});
		},
		onError: (e: unknown, { chatId }, context) => {
			if (context?.previous !== undefined) {
				queryClient.setQueryData(
					gafChatQueryKeys.messages(chatId),
					context.previous
				);
			}
			toast.error(mapGafChatUserError(e, t, 'send'));
		},
	});

	const editMessageMutation = useMutation({
		mutationFn: (vars: { chatId: string; messageId: string; body: string }) =>
			editGafMessage(vars.chatId, vars.messageId, vars.body),
		onSuccess: (_data, variables) => {
			void queryClient.invalidateQueries({
				queryKey: gafChatQueryKeys.messages(variables.chatId),
			});
			void queryClient.invalidateQueries({ queryKey: gafChatQueryKeys.chats });
			toast.success(t('toastMessageEdited'));
			setEditingMessage(null);
			setEditDraft('');
		},
		onError: (e: unknown) => {
			toast.error(mapGafChatUserError(e, t, 'generic'));
		},
	});

	const deleteMessageMutation = useMutation({
		mutationFn: (vars: {
			chatId: string;
			messageId: string;
			forMeOnly: boolean;
		}) => deleteGafMessage(vars.chatId, vars.messageId, vars.forMeOnly),
		onSuccess: (_data, variables) => {
			void queryClient.invalidateQueries({
				queryKey: gafChatQueryKeys.messages(variables.chatId),
			});
			void queryClient.invalidateQueries({ queryKey: gafChatQueryKeys.chats });
			toast.success(t('toastMessageDeleted'));
			setMessageDeleteConfirm(null);
		},
		onError: (e: unknown) => {
			toast.error(mapGafChatUserError(e, t, 'generic'));
		},
	});

	const acceptMutation = useMutation({
		mutationFn: ({
			chatId,
			messageId,
		}: {
			chatId: string;
			messageId: string;
		}) => acceptGafAttachment(chatId, messageId),
		onSuccess: (_data, variables) => {
			toast.success(t('toastAttachmentAccepted'));
			void queryClient.invalidateQueries({
				queryKey: gafChatQueryKeys.messages(variables.chatId),
			});
		},
		onError: (e: unknown) => {
			toast.error(mapGafChatUserError(e, t, 'attachment'));
		},
	});

	const acceptBusyMessageId =
		acceptMutation.isPending && acceptMutation.variables
			? acceptMutation.variables.messageId
			: null;

	const handleSend = useCallback(() => {
		const text = inputText.trim();
		const firstAttach = pendingAttachments[0];
		const hasFile = Boolean(firstAttach?.contentId);
		if ((!text && !hasFile) || !selectedChatId || sendMutation.isPending)
			return;
		const sendPartner = chats.find(
			(c) => c.chat_id === selectedChatId
		)?.partner;
		if (
			sendPartner?.is_blocked ||
			sendPartner?.blocked_by_partner ||
			sendPartner?.is_system_account
		) {
			return;
		}
		const sendMode = resolveGafChatSendMode({
			e2eeActive,
			hasAttachment: hasFile,
			replyToMessageId: replyingTo?.id ?? null,
		});
		if (sendMode.kind === 'blocked') {
			toast.error(
				sendMode.reason === 'reply'
					? t('e2eeReplyBlocked')
					: t('e2eeAttachmentBlocked')
			);
			return;
		}
		const preview = firstAttach
			? {
					fileName: firstAttach.fileName,
					size: firstAttach.size,
					mimeType: firstAttach.mimeType ?? null,
				}
			: undefined;
		sendMutation.mutate({
			chatId: selectedChatId,
			body: text,
			e2eeActive: sendMode.kind === 'e2ee',
			attachmentContentId: firstAttach?.contentId ?? null,
			attachmentPreview: preview,
			replyToMessageId: replyingTo?.id ?? null,
		});
	}, [
		inputText,
		pendingAttachments,
		replyingTo,
		selectedChatId,
		e2eeActive,
		sendMutation,
		chats,
		t,
	]);

	const finalizeVoiceAfterStop = useCallback(
		async (result: { blob: Blob; mime: string } | null) => {
			if (!result || result.blob.size < 400) {
				toast.error(t('voiceTooShort'));
				return;
			}
			if (!selectedChatId || composerLocked) return;
			if (sendMutation.isPending) return;
			setAttachmentUploading(true);
			setAttachmentUploadPercent(0);
			try {
				const ext = extensionForRecordedVoiceMime(result.mime);
				const name = `${GAF_VOICE_ATTACHMENT_NAME_PREFIX}${Date.now()}.${ext}`;
				const file = new File([result.blob], name, { type: result.mime });
				const created = await contentApi.uploadContent(
					file,
					{
						name: file.name,
						folder_item_id: null,
						sub_type: GAF_VOICE_CONTENT_SUBTYPE,
					},
					{
						onProgress: (raw) => {
							setAttachmentUploadPercent((prev) =>
								nextSteppedUploadProgress(prev ?? 0, raw)
							);
						},
					}
				);
				setAttachmentUploadPercent(100);
				sendMutation.mutate({
					chatId: selectedChatId,
					body: '',
					e2eeActive,
					attachmentContentId: created.id,
					attachmentPreview: {
						fileName: created.name,
						size: file.size,
						mimeType: created.mime_type ?? result.mime ?? null,
					},
					replyToMessageId: replyingTo?.id ?? null,
				});
			} catch (err) {
				toast.error(mapGafChatUserError(err, t, 'attachment'));
			} finally {
				setAttachmentUploading(false);
				setAttachmentUploadPercent(null);
			}
		},
		[
			composerLocked,
			e2eeActive,
			replyingTo,
			selectedChatId,
			sendMutation,
			setAttachmentUploadPercent,
			setAttachmentUploading,
			t,
		]
	);

	useEffect(() => {
		voiceRecordingCompleteRef.current = finalizeVoiceAfterStop;
	}, [finalizeVoiceAfterStop]);

	const enqueueUploadedFiles = useCallback(
		async (files: File[]) => {
			if (!selectedChatId || composerLocked || files.length === 0) return;
			if (e2eeActive) {
				toast.error(t('e2eeAttachmentBlocked'));
				return;
			}
			setAttachmentUploading(true);
			setAttachmentUploadPercent(0);
			try {
				const additions: GafPendingComposerAttachment[] = [];
				const fileCount = files.length;
				for (let i = 0; i < fileCount; i += 1) {
					const file = files[i];
					if (!file) continue;
					const prepared = await maybeCompressImageForGafUpload(file);
					setAttachmentUploadPercent((prev) =>
						nextSteppedUploadProgress(
							prev ?? 0,
							batchUploadProgressPercent(i, fileCount, 0)
						)
					);
					const created = await contentApi.uploadContent(
						prepared,
						{ name: prepared.name, folder_item_id: null },
						{
							onProgress: (raw) => {
								setAttachmentUploadPercent((prev) =>
									nextSteppedUploadProgress(
										prev ?? 0,
										batchUploadProgressPercent(i, fileCount, raw)
									)
								);
							},
						}
					);
					setAttachmentUploadPercent((prev) =>
						nextSteppedUploadProgress(
							prev ?? 0,
							batchUploadProgressPercent(i, fileCount, 100)
						)
					);
					additions.push({
						contentId: created.id,
						fileName: prepared.name,
						size: prepared.size,
						mimeType: created.mime_type ?? prepared.type ?? null,
						kind: 'file',
					});
				}
				setAttachmentUploadPercent(100);
				startTransition(() => {
					setPendingAttachments((prev) => [...prev, ...additions]);
				});
				if (files.length > 1) {
					toast.success(t('composerQueueAddedToast', { count: files.length }));
				}
			} catch (err) {
				toast.error(mapGafChatUserError(err, t, 'attachment'));
			} finally {
				setAttachmentUploading(false);
				setAttachmentUploadPercent(null);
			}
		},
		[
			composerLocked,
			e2eeActive,
			selectedChatId,
			setAttachmentUploadPercent,
			setAttachmentUploading,
			setPendingAttachments,
			t,
		]
	);

	const enqueueLibraryDragPayload = useCallback(
		async (payload: ContentDragPayload) => {
			if (!selectedChatId || composerLocked || payload.ids.length === 0) return;
			if (e2eeActive) {
				toast.error(t('e2eeAttachmentBlocked'));
				return;
			}
			setAttachmentUploading(true);
			setAttachmentUploadPercent(null);
			try {
				const itemById = new Map<string, ContentDragEntry>(
					(payload.items ?? []).map((it) => [it.id, it])
				);
				const additions: GafPendingComposerAttachment[] = [];
				for (const id of payload.ids) {
					const meta = itemById.get(id);
					if (meta) {
						additions.push({
							contentId: id,
							fileName: meta.name,
							size: null,
							mimeType: meta.content_type ?? null,
							kind: 'file',
						});
					} else {
						const row = await contentApi.getContent(id);
						additions.push({
							contentId: row.id,
							fileName: row.name,
							size: row.file_size ?? null,
							mimeType: row.mime_type ?? null,
							kind: 'file',
						});
					}
				}
				startTransition(() => {
					setPendingAttachments((prev) => [...prev, ...additions]);
				});
				if (additions.length > 1) {
					toast.success(
						t('composerQueueAddedToast', { count: additions.length })
					);
				}
			} catch (err) {
				toast.error(mapGafChatUserError(err, t, 'attachment'));
			} finally {
				setAttachmentUploading(false);
				setAttachmentUploadPercent(null);
			}
		},
		[
			composerLocked,
			e2eeActive,
			selectedChatId,
			setAttachmentUploadPercent,
			setAttachmentUploading,
			setPendingAttachments,
			t,
		]
	);

	const composerDragAccepts = useCallback((dt: DataTransfer | null) => {
		if (!dt?.types) return false;
		const types = Array.from(dt.types as unknown as string[]);
		if (types.includes('Files')) return true;
		return dataTransferHasContentDrag(dt);
	}, []);

	const handlePickLocalFile = useCallback(
		async (e: ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			e.target.value = '';
			if (!file) return;
			await enqueueUploadedFiles([file]);
		},
		[enqueueUploadedFiles]
	);

	const handleComposerDragEnter = useCallback(
		(e: DragEvent<HTMLFormElement>) => {
			if (composerLocked || !selectedChatId || e2eeActive) return;
			if (!composerDragAccepts(e.dataTransfer)) return;
			e.preventDefault();
			setComposerDragOver(true);
		},
		[
			composerLocked,
			composerDragAccepts,
			e2eeActive,
			selectedChatId,
			setComposerDragOver,
		]
	);

	const handleComposerDragLeave = useCallback(
		(e: DragEvent<HTMLFormElement>) => {
			const rel = e.relatedTarget as Node | null;
			if (rel && e.currentTarget.contains(rel)) return;
			setComposerDragOver(false);
		},
		[setComposerDragOver]
	);

	const handleComposerDragOver = useCallback(
		(e: DragEvent<HTMLFormElement>) => {
			if (composerLocked || !selectedChatId || e2eeActive) return;
			if (!composerDragAccepts(e.dataTransfer)) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = 'copy';
		},
		[composerLocked, composerDragAccepts, e2eeActive, selectedChatId]
	);

	const handleComposerDrop = useCallback(
		async (e: DragEvent<HTMLFormElement>) => {
			e.preventDefault();
			setComposerDragOver(false);
			if (
				composerLocked ||
				!selectedChatId ||
				e2eeActive ||
				sendMutation.isPending ||
				attachmentUploading ||
				isVoiceRecording
			) {
				return;
			}
			const libraryPayload = parseContentDragPayloadFromDataTransfer(
				e.dataTransfer
			);
			if (libraryPayload?.ids?.length) {
				await enqueueLibraryDragPayload(libraryPayload);
				return;
			}
			const list = e.dataTransfer.files;
			if (!list?.length) return;
			await enqueueUploadedFiles(Array.from(list));
		},
		[
			attachmentUploading,
			composerLocked,
			e2eeActive,
			enqueueLibraryDragPayload,
			enqueueUploadedFiles,
			isVoiceRecording,
			selectedChatId,
			sendMutation.isPending,
			setComposerDragOver,
		]
	);

	const handleComposerPaste = useCallback(
		(e: ClipboardEvent<HTMLTextAreaElement>) => {
			if (
				composerLocked ||
				!selectedChatId ||
				e2eeActive ||
				sendMutation.isPending ||
				attachmentUploading ||
				isVoiceRecording
			) {
				return;
			}
			const files = e.clipboardData?.files;
			if (!files?.length) return;
			e.preventDefault();
			void enqueueUploadedFiles(Array.from(files));
		},
		[
			attachmentUploading,
			composerLocked,
			e2eeActive,
			enqueueUploadedFiles,
			isVoiceRecording,
			selectedChatId,
			sendMutation.isPending,
		]
	);

	const handleAcceptIncomingAttachment = useCallback(
		(m: GAFMessageItem) => {
			if (!selectedChatId || acceptMutation.isPending) return;
			acceptMutation.mutate({ chatId: selectedChatId, messageId: m.id });
		},
		[acceptMutation, selectedChatId]
	);

	return {
		sendMutation,
		editMessageMutation,
		deleteMessageMutation,
		acceptMutation,
		acceptBusyMessageId,
		handleSend,
		voiceRecordingCompleteRef,
		handlePickLocalFile,
		handleComposerDragEnter,
		handleComposerDragLeave,
		handleComposerDragOver,
		handleComposerDrop,
		handleComposerPaste,
		handleAcceptIncomingAttachment,
	};
}
