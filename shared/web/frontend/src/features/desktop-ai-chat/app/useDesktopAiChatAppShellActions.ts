/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell action handlers for Desktop AI Chat app compose (delete, export, STT, stream lock).
 *
 * Invariants:
 * - Handlers preserve original side-effect order; no API shape changes.
 *
 * Related:
 * - useDesktopAiChatAppCompose.ts, app/DesktopAiChatAppView.tsx
 */
import * as React from 'react';
import type { DesktopAiChatItem } from '../api/desktopChatClient';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { transcribe } from '@/voice-core';
import {
	deleteDesktopAiChat,
	extractDesktopAiMemoryCell,
	releaseDesktopAiChatStreamLock,
	saveDesktopAiBlueprintToProject,
	type DesktopAiMessage,
} from '../api/desktopChatClient';
import type { DesktopAiWebSearchSource } from '../desktopWebSearchSources';
import {
	appendDesktopAiEvidenceAppendix,
	resolveDesktopAiMessageEvidenceSources,
} from '../desktopAiEvidence';
import { classifyStreamLockClearError } from '../desktopChatStreamLockClear';
import { DESKTOP_AI_CHAT_COMPOSER_TEXTAREA_ID } from '../desktopAiChatDomIds';
import { isPersistedDesktopAiMessageId } from '../utils/desktopAiChatMessageIds';
import { persistChatDraft, removeChatDraft } from '../utils/desktopAiChatDraft';
import {
	buildChatMarkdownExport,
	downloadMarkdownFile,
} from '../utils/desktopAiChatExport';
import { writeHeaderCollapsed } from '../utils/desktopAiChatFormatters';
import { writeChatPins } from '../utils/desktopAiChatPins';
import {
	analyzeDesktopAiExpertDocument,
	desktopAiAnswerArtifactFileStem,
} from '../utils/desktopAiExpertDocument';
import { getContentErrorMessage } from '@/services/contentApi';
import { type DesktopAiChatPanelPrefs } from './desktopAiChatAppPrefs';
import type { useMicRecorder } from '@/voice-core';

type MicRecorder = ReturnType<typeof useMicRecorder>;

export type UseDesktopAiChatAppShellActionsParams = {
	t: TFunction<'desktopAiChat'>;
	i18nLanguage: string;
	activeId: string | null;
	activeChat: DesktopAiChatItem | null;
	sending: boolean;
	messages: DesktopAiMessage[];
	streamLockClearBusy: boolean;
	voiceAllowed: boolean;
	voiceIn: boolean;
	sttBusy: boolean;
	titleEditChatId: string | null;
	webSearchSourcesByMessageId: Record<string, DesktopAiWebSearchSource[]>;
	activeIdRef: React.MutableRefObject<string | null>;
	sttMic: MicRecorder;
	sttCancelNextBlobRef: React.MutableRefObject<boolean>;
	abortActiveStream: () => void;
	setInput: React.Dispatch<React.SetStateAction<string>>;
	setTitleEditChatId: React.Dispatch<React.SetStateAction<string | null>>;
	setTitleDraft: React.Dispatch<React.SetStateAction<string>>;
	setChatPins: React.Dispatch<React.SetStateAction<string[]>>;
	setChats: React.Dispatch<
		React.SetStateAction<import('../api/desktopChatClient').DesktopAiChatItem[]>
	>;
	setPanelPrefsByChatId: React.Dispatch<
		React.SetStateAction<Record<string, DesktopAiChatPanelPrefs>>
	>;
	setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
	setDeleteChatConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
	setDeleteChatBusy: React.Dispatch<React.SetStateAction<boolean>>;
	setStreamErrorBanner: React.Dispatch<
		React.SetStateAction<{
			message: string;
			retryable: boolean;
			canClearStreamLock?: boolean;
			turnBusy?: boolean;
		} | null>
	>;
	setStreamLockClearBusy: React.Dispatch<React.SetStateAction<boolean>>;
	setHeaderCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
	setSaveBlueprintToProjectBusyId: React.Dispatch<
		React.SetStateAction<string | null>
	>;
	setSttBusy: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useDesktopAiChatAppShellActions({
	t,
	i18nLanguage,
	activeId,
	activeChat,
	sending,
	messages,
	streamLockClearBusy,
	voiceAllowed,
	voiceIn,
	sttBusy,
	titleEditChatId,
	webSearchSourcesByMessageId,
	activeIdRef,
	sttMic,
	sttCancelNextBlobRef,
	abortActiveStream,
	setInput,
	setTitleEditChatId,
	setTitleDraft,
	setChatPins,
	setChats,
	setPanelPrefsByChatId,
	setActiveId,
	setDeleteChatConfirmOpen,
	setDeleteChatBusy,
	setStreamErrorBanner,
	setStreamLockClearBusy,
	setHeaderCollapsed,
	setSaveBlueprintToProjectBusyId,
	setSttBusy,
}: UseDesktopAiChatAppShellActionsParams) {
	const toggleHeaderCollapsed = React.useCallback(() => {
		setHeaderCollapsed((v) => {
			const next = !v;
			writeHeaderCollapsed(next);
			return next;
		});
	}, [setHeaderCollapsed]);

	const prepareChatGuideStep = React.useCallback(
		(stepId: string) => {
			if (stepId === 'settings') {
				setHeaderCollapsed(false);
				writeHeaderCollapsed(false);
			}
		},
		[setHeaderCollapsed]
	);

	const handleClearStreamLock = () => {
		if (!activeId || streamLockClearBusy || sending) return;
		setStreamLockClearBusy(true);
		void (async () => {
			try {
				await releaseDesktopAiChatStreamLock(activeId);
				setStreamErrorBanner(null);
				toast.success(t('streamLockClearedToast'));
			} catch (err) {
				const cls = classifyStreamLockClearError(err);
				const msg =
					cls.rawMessage && cls.kind === 'generic'
						? cls.rawMessage
						: t(cls.messageKey);
				toast.error(msg);
			} finally {
				setStreamLockClearBusy(false);
			}
		})();
	};

	const handleDeleteChat = async () => {
		if (!activeId) return;
		setDeleteChatBusy(true);
		try {
			abortActiveStream();
			const id = activeId;
			removeChatDraft(id);
			setInput('');
			if (titleEditChatId === id) {
				setTitleEditChatId(null);
				setTitleDraft('');
			}
			setChatPins((prev) => {
				const next = prev.filter((x) => x !== id);
				if (next.length !== prev.length) writeChatPins(next);
				return next;
			});
			await deleteDesktopAiChat(id);
			setChats((prev) => prev.filter((x) => x.id !== id));
			setPanelPrefsByChatId((prev) => {
				const { [id]: _removed, ...rest } = prev;
				return rest;
			});
			setActiveId(null);
			setDeleteChatConfirmOpen(false);
		} finally {
			setDeleteChatBusy(false);
		}
	};

	const requestDeleteChat = () => {
		if (!activeId || sending) return;
		setDeleteChatConfirmOpen(true);
	};

	const requestExtractMemoryCell = React.useCallback(async () => {
		if (!activeId || !activeChat || sending) return;
		const isOwner =
			activeChat.viewer_role === 'owner' ||
			activeChat.capabilities?.can_delete_chat === true ||
			activeChat.viewer_role == null;
		if (!isOwner) return;
		const mode = activeChat.memory_cell_id ? 'update' : 'create';
		const ok = window.confirm(
			mode === 'update'
				? t('memoryCellExtractConfirmUpdate')
				: t('memoryCellExtractConfirmCreate')
		);
		if (!ok) return;
		try {
			await extractDesktopAiMemoryCell(activeId, {
				mode,
				title: activeChat.title?.trim() || undefined,
			});
			const id = activeId;
			setChats((prev) => prev.filter((x) => x.id !== id));
			setPanelPrefsByChatId((prev) => {
				const { [id]: _removed, ...rest } = prev;
				return rest;
			});
			setActiveId(null);
			removeChatDraft(id);
			toast.success(t('memoryCellExtractSuccess'));
		} catch {
			toast.error(t('memoryCellExtractError'));
		}
	}, [
		activeChat,
		activeId,
		sending,
		setActiveId,
		setChats,
		setPanelPrefsByChatId,
		t,
	]);

	const focusComposer = React.useCallback(() => {
		const el = document.getElementById(DESKTOP_AI_CHAT_COMPOSER_TEXTAREA_ID);
		if (el instanceof HTMLElement) {
			el.focus();
		}
	}, []);

	const handleExportMd = () => {
		if (!activeId || !activeChat) return;
		const md = buildChatMarkdownExport(
			activeChat.title || t('defaultChatTitle'),
			messages,
			t,
			i18nLanguage
		);
		const slug = (activeChat.title || t('exportSlugFallback'))
			.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, '_')
			.slice(0, 72);
		downloadMarkdownFile(
			`desktop-ai-chat_${slug}_${activeId.slice(0, 8)}.md`,
			md
		);
		toast.success(t('exportDownloadedToast'));
	};

	const handleExportAssistantMarkdown = React.useCallback(
		(m: DesktopAiMessage) => {
			const content = (m.content || '').trim();
			if (!content) return;
			const meta = m.metadata;
			const isBlueprint =
				meta?.desktop_ensemble_blueprint === true ||
				(typeof meta?.plan_template_id === 'string' &&
					Boolean(meta.plan_template_id.trim()));
			const tplTitle =
				typeof meta?.plan_template_title === 'string'
					? meta.plan_template_title.trim()
					: '';
			const firstHeading =
				/^#{2,3}\s+(.+?)\s*$/m.exec(content)?.[1]?.trim() ?? '';
			const evidenceSources = resolveDesktopAiMessageEvidenceSources(
				meta,
				webSearchSourcesByMessageId[m.id] ?? []
			);
			const sourceCount = evidenceSources.length;
			const artifactFileStem = isBlueprint
				? 'blueprint'
				: desktopAiAnswerArtifactFileStem(
						analyzeDesktopAiExpertDocument(content, meta, { sourceCount })
							.artifactKind
					);
			const slug = (
				tplTitle ||
				firstHeading ||
				(isBlueprint ? t('structuredPlanFallback') : t('expertAnswerTitle'))
			)
				.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, '_')
				.slice(0, 72);
			downloadMarkdownFile(
				`desktop-ai-${artifactFileStem}_${slug}_${m.id.slice(0, 8)}.md`,
				appendDesktopAiEvidenceAppendix(content, evidenceSources, t, {
					includeEmpty: true,
				})
			);
			toast.success(t('exportDownloadedToast'));
		},
		[t, webSearchSourcesByMessageId]
	);

	const handleSaveBlueprintToProject = React.useCallback(
		async (m: DesktopAiMessage) => {
			if (!activeChat?.project_id || !isPersistedDesktopAiMessageId(m.id))
				return;
			setSaveBlueprintToProjectBusyId(m.id);
			try {
				const meta = m.metadata;
				const tplId =
					typeof meta?.plan_template_id === 'string'
						? meta.plan_template_id.trim()
						: '';
				const tplTitle =
					typeof meta?.plan_template_title === 'string'
						? meta.plan_template_title.trim()
						: '';
				const displayName = t('saveBlueprintContentName', {
					chat: (activeChat.title || t('defaultChatTitle')).slice(0, 80),
					template: tplTitle || tplId || t('saveBlueprintTemplateFallback'),
				});
				const description = t('saveBlueprintDescription', {
					chatId: activeChat.id,
					messageId: m.id,
					templateId: tplId || '—',
				});
				const evidenceSources = resolveDesktopAiMessageEvidenceSources(
					meta,
					webSearchSourcesByMessageId[m.id] ?? []
				);
				const { id } = await saveDesktopAiBlueprintToProject({
					projectId: activeChat.project_id ?? null,
					companyId: activeChat.company_id ?? null,
					displayName,
					description,
					message: {
						...m,
						content: appendDesktopAiEvidenceAppendix(
							m.content,
							evidenceSources,
							t,
							{ includeEmpty: true }
						),
					},
				});
				toast.success(t('saveBlueprintToProjectToast', { id: id.slice(0, 8) }));
			} catch (e) {
				toast.error(
					`${t('saveBlueprintToProjectErr')}: ${getContentErrorMessage(e)}`
				);
			} finally {
				setSaveBlueprintToProjectBusyId(null);
			}
		},
		[
			activeChat,
			t,
			webSearchSourcesByMessageId,
			setSaveBlueprintToProjectBusyId,
		]
	);

	const handleMicStt = async () => {
		if (!voiceAllowed || !voiceIn || sttBusy || sending) return;
		if (sttMic.isRecording) {
			setSttBusy(true);
			const chatWhenStopped = activeIdRef.current;
			try {
				const blob = await sttMic.stop();
				if (sttCancelNextBlobRef.current) {
					sttCancelNextBlobRef.current = false;
					toast.message(t('sttCancelledToast'));
					return;
				}
				if (blob && blob.size > 0) {
					const file = new File(
						[blob],
						`desktop-ai-chat-stt-${Date.now()}.webm`,
						{ type: blob.type || 'audio/webm' }
					);
					const result = await transcribe(file, { language: 'ru' });
					const text = (result.text ?? '').trim();
					if (
						text &&
						chatWhenStopped &&
						chatWhenStopped === activeIdRef.current
					) {
						setInput((x) => {
							const n = x ? `${x}\n${text}` : text;
							persistChatDraft(chatWhenStopped, n);
							return n;
						});
					}
				} else if (blob && blob.size === 0) {
					toast.message(t('sttEmptyToast'));
				}
			} catch {
				toast.error(t('sttFailedToast'));
			} finally {
				setSttBusy(false);
			}
			return;
		}
		await sttMic.start();
		sttCancelNextBlobRef.current = false;
	};

	const copyBubble = async (content: string) => {
		try {
			await navigator.clipboard.writeText(content);
			toast.success(t('copiedToast'));
		} catch {
			toast.error(t('copyFailedToast'));
		}
	};

	return {
		toggleHeaderCollapsed,
		prepareChatGuideStep,
		handleClearStreamLock,
		handleDeleteChat,
		requestDeleteChat,
		requestExtractMemoryCell,
		focusComposer,
		handleExportMd,
		handleExportAssistantMarkdown,
		handleSaveBlueprintToProject,
		handleMicStt,
		copyBubble,
	};
}
