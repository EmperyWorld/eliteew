/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat thread clear/archive/delete confirm flow and message edit/delete open/confirm/save
 * (mutations supplied from send orchestration).
 *
 * Invariants:
 * - Edit Escape clears editingMessage + editDraft; focus moves to edit textarea when editing opens.
 * - Edit/delete mutate calls go through refs bound after useGafChatSendOrchestration mounts.
 *
 * Related:
 * - GAFChatApp.tsx
 * - useGafChatSendOrchestration.ts
 * - GafChatModalsCluster.tsx
 */
import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react';
import { toast } from 'sonner';
import {
	archiveChat,
	clearChatHistory,
	deleteChatCompletely,
	gafChatQueryKeys,
} from '../api/gafChatApi';
import type { GAFChatConfirmKind } from '../GAFChatConfirmModal';
import type { GafMessageDeleteConfirm } from '../components/GafChatModalsCluster';
import { mapGafChatUserError } from '../gafChatMapUserError';
import type { GAFMessageItem } from '../types';

export type GafChatEditMessageMutationHandle = {
	mutate: (vars: { chatId: string; messageId: string; body: string }) => void;
	isPending: boolean;
};

export type GafChatDeleteMessageMutationHandle = {
	mutate: (vars: {
		chatId: string;
		messageId: string;
		forMeOnly: boolean;
	}) => void;
};

export function useGafChatThreadLifecycleActions(options: {
	t: TFunction<'gafChat'>;
	selectedChatId: string | null;
	setSelectedChatId: Dispatch<SetStateAction<string | null>>;
	chatBlocked: boolean;
	/** Bound after send orchestration; handlers read `.current`. */
	editMessageMutationRef: MutableRefObject<GafChatEditMessageMutationHandle>;
	deleteMessageMutationRef: MutableRefObject<GafChatDeleteMessageMutationHandle>;
}) {
	const {
		t,
		selectedChatId,
		setSelectedChatId,
		chatBlocked,
		editMessageMutationRef,
		deleteMessageMutationRef,
	} = options;

	const queryClient = useQueryClient();
	const editMessageTextareaRef = useRef<HTMLTextAreaElement | null>(null);

	const [confirmKind, setConfirmKind] = useState<GAFChatConfirmKind | null>(
		null
	);
	const [messageDeleteConfirm, setMessageDeleteConfirm] =
		useState<GafMessageDeleteConfirm>(null);
	const [editingMessage, setEditingMessage] = useState<GAFMessageItem | null>(
		null
	);
	const [editDraft, setEditDraft] = useState('');

	const handleClearHistory = useCallback(() => {
		if (!selectedChatId) return;
		setConfirmKind('clear');
	}, [selectedChatId]);

	const handleArchiveChat = useCallback(() => {
		if (!selectedChatId) return;
		setConfirmKind('archive');
	}, [selectedChatId]);

	const handleDeleteForEveryone = useCallback(() => {
		if (!selectedChatId) return;
		setConfirmKind('delete');
	}, [selectedChatId]);

	const executeConfirmedAction = useCallback(() => {
		if (!selectedChatId || !confirmKind) return;
		const chatId = selectedChatId;
		if (confirmKind === 'clear') {
			clearChatHistory(chatId)
				.then(() => {
					queryClient.invalidateQueries({
						queryKey: gafChatQueryKeys.messages(chatId),
					});
					queryClient.invalidateQueries({ queryKey: gafChatQueryKeys.chats });
					toast.success(t('toastHistoryCleared'));
				})
				.catch((e: unknown) => {
					toast.error(mapGafChatUserError(e, t, 'generic'));
				});
			return;
		}
		if (confirmKind === 'archive') {
			archiveChat(chatId)
				.then(() => {
					queryClient.invalidateQueries({ queryKey: gafChatQueryKeys.chats });
					setSelectedChatId(null);
					toast.success(t('toastArchived'));
				})
				.catch((e: unknown) => {
					toast.error(mapGafChatUserError(e, t, 'generic'));
				});
			return;
		}
		deleteChatCompletely(chatId)
			.then(() => {
				queryClient.invalidateQueries({ queryKey: gafChatQueryKeys.chats });
				setSelectedChatId(null);
				toast.success(t('toastDeletedBoth'));
			})
			.catch((e: unknown) => {
				toast.error(mapGafChatUserError(e, t, 'generic'));
			});
	}, [confirmKind, queryClient, selectedChatId, setSelectedChatId, t]);

	const handleOpenEditMessage = useCallback(
		(m: GAFMessageItem) => {
			if (chatBlocked) return;
			setEditingMessage(m);
			setEditDraft(String(m.body ?? ''));
		},
		[chatBlocked]
	);

	const handleMessageDeleteForMe = useCallback(
		(m: GAFMessageItem) => {
			if (chatBlocked) return;
			setMessageDeleteConfirm({ kind: 'me', messageId: m.id });
		},
		[chatBlocked]
	);

	const handleMessageDeleteForEveryone = useCallback(
		(m: GAFMessageItem) => {
			if (chatBlocked) return;
			setMessageDeleteConfirm({ kind: 'everyone', messageId: m.id });
		},
		[chatBlocked]
	);

	const handleConfirmMessageDelete = useCallback(() => {
		if (!selectedChatId || !messageDeleteConfirm) return;
		deleteMessageMutationRef.current.mutate({
			chatId: selectedChatId,
			messageId: messageDeleteConfirm.messageId,
			forMeOnly: messageDeleteConfirm.kind === 'me',
		});
	}, [selectedChatId, messageDeleteConfirm, deleteMessageMutationRef]);

	const handleSaveEditedMessage = useCallback(() => {
		if (!selectedChatId || !editingMessage) return;
		const next = editDraft.trim();
		if (!next) {
			toast.error(t('toastEditEmpty'));
			return;
		}
		editMessageMutationRef.current.mutate({
			chatId: selectedChatId,
			messageId: editingMessage.id,
			body: next,
		});
	}, [selectedChatId, editingMessage, editDraft, editMessageMutationRef, t]);

	useEffect(() => {
		if (!editingMessage) return;
		const id = requestAnimationFrame(() => {
			const el = editMessageTextareaRef.current;
			if (!el) return;
			el.focus({ preventScroll: true });
			const len = el.value.length;
			el.setSelectionRange(len, len);
		});
		return () => cancelAnimationFrame(id);
	}, [editingMessage]);

	useEffect(() => {
		if (!editingMessage) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			setEditingMessage(null);
			setEditDraft('');
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [editingMessage]);

	return {
		confirmKind,
		setConfirmKind,
		messageDeleteConfirm,
		setMessageDeleteConfirm,
		editingMessage,
		setEditingMessage,
		editDraft,
		setEditDraft,
		editMessageTextareaRef,
		handleClearHistory,
		handleArchiveChat,
		handleDeleteForEveryone,
		executeConfirmedAction,
		handleOpenEditMessage,
		handleMessageDeleteForMe,
		handleMessageDeleteForEveryone,
		handleConfirmMessageDelete,
		handleSaveEditedMessage,
	};
}
