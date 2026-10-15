/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Copy/download conversation and per-message actions with transient flash acks.
 *
 * Invariants:
 * - Clipboard failures surface user i18n toastError, not silent fail.
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx
 * - pages/Desktop/utils/assistantConversationExport.ts
 */
import { safeCopyToClipboard } from '@/utils/clipboard';
import type { TFunction } from 'i18next';
import * as React from 'react';
import { toast } from 'sonner';
import type { AssistantChatMessage } from '../../services/productDesktopApi';
import { buildAssistantFeedbackDraft } from '../../utils/assistantFeedbackDraft';
import { downloadAssistantConversationMarkdown } from '../../utils/assistantConversationExport';
import { formatAssistantConversationForCopy } from '../../utils/assistantLocalFaqStorage';
import { requestOpenDesktopApp } from '../../utils/desktopDeepLink';
import { useAssistantFlashTimeout } from './useAssistantFlashTimeout';

export type UseAssistantConversationActionsInput = {
	displayMessages: AssistantChatMessage[];
	t: TFunction<'desktopUi', 'assistant'>;
};

export function useAssistantConversationActions({
	displayMessages,
	t,
}: UseAssistantConversationActionsInput) {
	const [helpfulAckMessageId, setHelpfulAckMessageId] = React.useState<
		string | null
	>(null);
	const [copiedMessageFlashId, setCopiedMessageFlashId] = React.useState<
		string | null
	>(null);
	const [copyConversationFlash, setCopyConversationFlash] =
		React.useState(false);
	const [downloadConversationFlash, setDownloadConversationFlash] =
		React.useState(false);

	useAssistantFlashTimeout(
		helpfulAckMessageId,
		() => setHelpfulAckMessageId(null),
		2500
	);
	useAssistantFlashTimeout(copiedMessageFlashId, () =>
		setCopiedMessageFlashId(null)
	);
	useAssistantFlashTimeout(copyConversationFlash, () =>
		setCopyConversationFlash(false)
	);
	useAssistantFlashTimeout(downloadConversationFlash, () =>
		setDownloadConversationFlash(false)
	);

	const copyMessageText = React.useCallback(
		async (
			text: string,
			opts?: {
				doneKey?: string;
				flashId?: string;
			}
		) => {
			const doneKey = opts?.doneKey ?? 'copyMessageDone';
			const copied = await safeCopyToClipboard(text);
			if (copied) {
				if (opts?.flashId) {
					setCopiedMessageFlashId(opts.flashId);
				} else {
					toast.success(t(doneKey));
				}
			} else {
				toast.error(t('toastError'));
			}
		},
		[t]
	);

	const copyConversation = React.useCallback(async () => {
		if (displayMessages.length === 0) return;
		const copied = await safeCopyToClipboard(
			formatAssistantConversationForCopy(displayMessages)
		);
		if (copied) {
			setCopyConversationFlash(true);
		} else {
			toast.error(t('toastError'));
		}
	}, [displayMessages, t]);

	const downloadConversation = React.useCallback(() => {
		if (displayMessages.length === 0) return;
		const ok = downloadAssistantConversationMarkdown(displayMessages);
		if (ok) setDownloadConversationFlash(true);
		else toast.error(t('toastError'));
	}, [displayMessages, t]);

	const acknowledgeHelpful = React.useCallback((messageId: string) => {
		setHelpfulAckMessageId(messageId);
	}, []);

	const openFeedbackForExchange = React.useCallback(
		(userQuestion: string, assistantAnswer: string) => {
			requestOpenDesktopApp({
				appComponent: 'FeedbackHubApp',
				feedbackQuickMode: 'text',
				feedbackDraftBody: buildAssistantFeedbackDraft(
					userQuestion,
					assistantAnswer
				),
			});
		},
		[]
	);

	return {
		helpfulAckMessageId,
		copiedMessageFlashId,
		copyConversationFlash,
		downloadConversationFlash,
		copyMessageText,
		copyConversation,
		downloadConversation,
		acknowledgeHelpful,
		openFeedbackForExchange,
	};
}
