/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * One-shot deep-link bootstrap for GAF Chat: chatId/username open, composer attach/seed,
 * attach-without-chat toast, and open-by-username timeout/retry.
 *
 * Invariants:
 * - initialTargetChatId wins over initialTargetUsername (chatId effect also marks username applied).
 * - Each initial* payload applies at most once per mount (stale one-shot refs).
 *
 * Related:
 * - GAFChatApp.tsx
 * - documentation/product/desktop/DESKTOP-SHELL-FOLLOW-UP-BACKLOG-2026-06-30.md (Wave N5)
 */
import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from 'react';
import { toast } from 'sonner';
import { gafChatQueryKeys, getOrCreateChatByUsername } from '../api/gafChatApi';
import type { GafPendingComposerAttachment } from '../gafChatComposerTypes';
import { mapGafChatUserError } from '../gafChatMapUserError';

export type GafChatDeepLinkComposerAttachment = {
	contentId: string;
	fileName: string;
	size: number | null;
	mimeType?: string | null;
};

export function useGafChatDeepLinkBootstrap(options: {
	t: TFunction<'gafChat'>;
	user: unknown;
	initialTargetChatId?: string;
	initialTargetUsername?: string;
	initialComposerAttachment?: GafChatDeepLinkComposerAttachment;
	initialComposerSeed?: string;
	selectedChatId: string | null;
	setSelectedChatId: Dispatch<SetStateAction<string | null>>;
	setPendingAttachments: Dispatch<
		SetStateAction<GafPendingComposerAttachment[]>
	>;
	setInputText: Dispatch<SetStateAction<string>>;
	chatsLoading: boolean;
	chatsError: unknown;
	chatsLength: number;
}) {
	const {
		t,
		user,
		initialTargetChatId,
		initialTargetUsername,
		initialComposerAttachment,
		initialComposerSeed,
		selectedChatId,
		setSelectedChatId,
		setPendingAttachments,
		setInputText,
		chatsLoading,
		chatsError,
		chatsLength,
	} = options;

	const queryClient = useQueryClient();
	const appliedInitialChatIdRef = useRef(false);
	const appliedInitialUsernameRef = useRef(false);
	const appliedInitialComposerAttachmentRef = useRef(false);
	const warnedGafAttachNoChatRef = useRef(false);
	const appliedInitialComposerSeedRef = useRef(false);

	const [resolvingInitialUsername, setResolvingInitialUsername] =
		useState(false);
	const [openingChatTimedOut, setOpeningChatTimedOut] = useState(false);

	useEffect(() => {
		if (!resolvingInitialUsername) {
			setOpeningChatTimedOut(false);
			return;
		}
		const id = window.setTimeout(() => setOpeningChatTimedOut(true), 15000);
		return () => window.clearTimeout(id);
	}, [resolvingInitialUsername]);

	// Уведомления: targetChatId имеет приоритет над targetUsername (одноразово на монтирование).
	useEffect(() => {
		if (!user) return;
		const chatId = initialTargetChatId?.trim();
		if (!chatId || appliedInitialChatIdRef.current) return;
		appliedInitialChatIdRef.current = true;
		appliedInitialUsernameRef.current = true;
		setSelectedChatId(chatId);
		void queryClient.invalidateQueries({ queryKey: gafChatQueryKeys.chats });
	}, [initialTargetChatId, user, queryClient, setSelectedChatId]);

	const openChatByUsername = useCallback(
		(username: string) => {
			setOpeningChatTimedOut(false);
			setResolvingInitialUsername(true);
			return getOrCreateChatByUsername(username)
				.then((chat) => {
					setSelectedChatId(chat.chat_id);
					return queryClient.invalidateQueries({
						queryKey: gafChatQueryKeys.chats,
					});
				})
				.catch((e: unknown) =>
					toast.error(mapGafChatUserError(e, t, 'openChat'))
				)
				.finally(() => setResolvingInitialUsername(false));
		},
		[queryClient, setSelectedChatId, t]
	);

	const handleRetryOpenChat = useCallback(() => {
		const username = initialTargetUsername?.trim();
		if (!username || !user) return;
		void openChatByUsername(username);
	}, [initialTargetUsername, openChatByUsername, user]);

	useEffect(() => {
		const username = initialTargetUsername?.trim();
		if (!username || !user || appliedInitialUsernameRef.current) return;
		appliedInitialUsernameRef.current = true;
		void openChatByUsername(username);
	}, [initialTargetUsername, openChatByUsername, user]);

	useEffect(() => {
		const att = initialComposerAttachment;
		const cid = att?.contentId?.trim();
		if (!att || !cid || appliedInitialComposerAttachmentRef.current) return;
		if (!selectedChatId) return;
		appliedInitialComposerAttachmentRef.current = true;
		setPendingAttachments([
			{
				contentId: cid,
				fileName: att.fileName?.trim() || 'file',
				size: att.size ?? null,
				mimeType: att.mimeType ?? null,
				kind: 'file',
			},
		]);
	}, [selectedChatId, initialComposerAttachment, setPendingAttachments]);

	useEffect(() => {
		const seed = initialComposerSeed?.trim();
		if (!seed || !selectedChatId || appliedInitialComposerSeedRef.current)
			return;
		appliedInitialComposerSeedRef.current = true;
		setInputText((prev) => {
			const p = prev.trim();
			return p ? `${seed}\n\n${p}` : seed;
		});
	}, [selectedChatId, initialComposerSeed, setInputText]);

	useEffect(() => {
		if (!user || chatsLoading || resolvingInitialUsername || chatsError) return;
		const cid = initialComposerAttachment?.contentId?.trim();
		if (!cid || warnedGafAttachNoChatRef.current || selectedChatId) return;
		if (chatsLength > 0) return;
		warnedGafAttachNoChatRef.current = true;
		toast.info(t('attachNeedsSelectChatHint'));
	}, [
		user,
		chatsLoading,
		resolvingInitialUsername,
		chatsError,
		selectedChatId,
		chatsLength,
		initialComposerAttachment,
		t,
	]);

	return {
		resolvingInitialUsername,
		openingChatTimedOut,
		openChatByUsername,
		handleRetryOpenChat,
		/** Test/debug: one-shot refs (stable identity). */
		appliedInitialChatIdRef,
		appliedInitialUsernameRef,
		appliedInitialComposerAttachmentRef,
		appliedInitialComposerSeedRef,
		warnedGafAttachNoChatRef,
	};
}
