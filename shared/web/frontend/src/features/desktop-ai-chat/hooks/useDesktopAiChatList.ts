/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Chat list state for Desktop AI Chat: load, filter, pins, title edit, active selection.
 *
 * Invariants:
 * - Pinned chats stay at the top of filteredChats without duplicating rows.
 *
 * Related:
 * - DesktopAiChatApp.tsx, components/DesktopAiChatSidebar.tsx, api/desktopChatClient.ts
 * ---
 */
import type { TFunction } from 'i18next';
import * as React from 'react';
import { toast } from 'sonner';
import {
	fetchDesktopAiEffectiveSettings,
	fetchSoloSlotTariffs,
	listDesktopAiChats,
	patchDesktopAiChat,
	type DesktopAiChatItem,
	type SoloSlotTariffsResponse,
} from '../api/desktopChatClient';
import { desktopChatSideLabel } from '../desktopAiHeroes';
import {
	MAX_CHAT_PINS,
	readChatPins,
	writeChatPins,
} from '../utils/desktopAiChatPins';

import type { DesktopAiChatLoadState } from '../desktopAiChatSurfaceState';

export type UseDesktopAiChatListParams = {
	initialChatId?: string;
	t: TFunction<'desktopAiChat'>;
	onRefreshUgsCredits?: () => void;
};

export function useDesktopAiChatList({
	initialChatId,
	t,
	onRefreshUgsCredits,
}: UseDesktopAiChatListParams) {
	const [settings, setSettings] = React.useState<Record<string, unknown>>({});
	const [chats, setChats] = React.useState<DesktopAiChatItem[]>([]);
	const [chatFilter, setChatFilter] = React.useState('');
	const [activeId, setActiveId] = React.useState<string | null>(
		initialChatId ?? null
	);
	const [loadingList, setLoadingList] = React.useState(true);
	const [listLoadState, setListLoadState] =
		React.useState<DesktopAiChatLoadState>('loading');
	const [chatPins, setChatPins] = React.useState<string[]>(readChatPins);
	const [titleDraft, setTitleDraft] = React.useState('');
	const [titleEditChatId, setTitleEditChatId] = React.useState<string | null>(
		null
	);
	const [soloSlotTariffs, setSoloSlotTariffs] =
		React.useState<SoloSlotTariffsResponse | null>(null);

	const deferredChatFilter = React.useDeferredValue(chatFilter);
	const activeChat = chats.find((c) => c.id === activeId) ?? null;

	const filteredChats = React.useMemo(() => {
		const q = deferredChatFilter.trim().toLowerCase();
		const base = !q
			? chats
			: chats.filter((c) => {
					if (c.title.toLowerCase().includes(q)) {
						return true;
					}
					const hero = desktopChatSideLabel(c.settings);
					return hero?.toLowerCase().includes(q) ?? false;
				});
		const ordered: DesktopAiChatItem[] = [];
		const seen = new Set<string>();
		for (const id of chatPins) {
			const c = base.find((x) => x.id === id);
			if (c) {
				ordered.push(c);
				seen.add(c.id);
			}
		}
		for (const c of base) {
			if (!seen.has(c.id)) {
				ordered.push(c);
			}
		}
		return ordered;
	}, [chats, deferredChatFilter, chatPins]);

	const refreshAll = React.useCallback(async () => {
		setLoadingList(true);
		setListLoadState('loading');
		try {
			const [st, items] = await Promise.all([
				fetchDesktopAiEffectiveSettings(),
				listDesktopAiChats(),
			]);
			setSettings(st.defaults ?? {});
			setChats(items);
			setActiveId((prev) => prev ?? items[0]?.id ?? null);
			setListLoadState('ready');
		} catch {
			toast.error(t('chatListLoadError'));
			setListLoadState('error');
		} finally {
			setLoadingList(false);
		}
		void fetchSoloSlotTariffs()
			.then((data) => setSoloSlotTariffs(data))
			.catch(() => {
				/* keep previous tariffs */
			});
		onRefreshUgsCredits?.();
	}, [t, onRefreshUgsCredits]);

	React.useEffect(() => {
		void refreshAll();
	}, [refreshAll]);

	React.useEffect(() => {
		if (initialChatId?.trim()) {
			setActiveId(initialChatId.trim());
		}
	}, [initialChatId]);

	const togglePinChat = React.useCallback(
		(chatId: string, e: React.MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			setChatPins((prev) => {
				const idx = prev.indexOf(chatId);
				if (idx >= 0) {
					const next = prev.filter((id) => id !== chatId);
					writeChatPins(next);
					return next;
				}
				if (prev.length >= MAX_CHAT_PINS) {
					toast.error(t('maxPinsToast', { max: MAX_CHAT_PINS }));
					return prev;
				}
				const next = [...prev, chatId];
				writeChatPins(next);
				return next;
			});
		},
		[t]
	);

	const saveChatTitle = React.useCallback(async () => {
		const id = titleEditChatId;
		if (!id) {
			return;
		}
		const row = chats.find((x) => x.id === id);
		if (!row) {
			setTitleEditChatId(null);
			setTitleDraft('');
			return;
		}
		const trimmedTitle = titleDraft.trim();
		if (!trimmedTitle || trimmedTitle === row.title) {
			setTitleEditChatId(null);
			setTitleDraft('');
			return;
		}
		try {
			const c = await patchDesktopAiChat(id, { title: trimmedTitle });
			setChats((prev) => prev.map((x) => (x.id === c.id ? c : x)));
			setTitleEditChatId(null);
			setTitleDraft('');
		} catch {
			toast.error(t('titleSaveError'));
		}
	}, [chats, titleDraft, titleEditChatId, t]);

	const cancelTitleEdit = React.useCallback(() => {
		if (!titleEditChatId) {
			return;
		}
		const row = chats.find((x) => x.id === titleEditChatId);
		setTitleDraft(row?.title ?? '');
		setTitleEditChatId(null);
	}, [chats, titleEditChatId]);

	React.useEffect(() => {
		if (!titleEditChatId) {
			return;
		}
		const id = window.requestAnimationFrame(() => {
			const el = document.querySelector<HTMLInputElement>(
				`[data-desktop-ai-chat-title-input="${CSS.escape(titleEditChatId)}"]`
			);
			el?.focus();
		});
		return () => window.cancelAnimationFrame(id);
	}, [titleEditChatId]);

	return {
		settings,
		setSettings,
		chats,
		setChats,
		chatFilter,
		setChatFilter,
		activeId,
		setActiveId,
		activeChat,
		loadingList,
		listLoadState,
		retryListLoad: refreshAll,
		chatPins,
		setChatPins,
		titleDraft,
		setTitleDraft,
		titleEditChatId,
		setTitleEditChatId,
		soloSlotTariffs,
		setSoloSlotTariffs,
		filteredChats,
		refreshAll,
		togglePinChat,
		saveChatTitle,
		cancelTitleEdit,
	};
}
