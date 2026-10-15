/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Props contract for Desktop AI Chat messages pane (facade + View).
 *
 * Invariants:
 * - Stable public type re-exported from DesktopAiChatMessagesPane facade.
 *
 * Related:
 * - DesktopAiChatMessagesPaneView.tsx
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */
import type { TFunction } from 'i18next';
import type * as React from 'react';
import type {
	DesktopAiChatItem,
	DesktopAiMessage,
} from '../../api/desktopChatClient';
import type { MessageListEntry } from '../../buildMessageListWithDays';
import type { DesktopAiChatLoadState } from '../../desktopAiChatSurfaceState';
import type { DesktopAiWebSearchSource } from '../../desktopWebSearchSources';
import type { DesktopAiChatBubbleContextPayload } from '../DesktopAiChatBubbleContextMenu';

export type DesktopAiChatMessagesPaneProps = {
	scrollRef: React.RefObject<HTMLDivElement | null>;
	messagesRegionId: string;
	messagesTestId: string;
	shellMessagesPanelClass: string;
	showLoadOlderMessages: boolean;
	messages: DesktopAiMessage[];
	messagesTotal: number | null;
	messagesLoadingOlder: boolean;
	onLoadOlderMessages: () => void | Promise<void>;
	loadingList: boolean;
	activeId: string | null;
	chatsCount: number;
	messagesLoading: boolean;
	messagesLoadState: DesktopAiChatLoadState;
	onRetryLoadMessages: () => void;
	sending: boolean;
	/** Peer holds stream lock — show busy indicator (no live SSE fan-out). */
	streamLockHeldByOther?: boolean;
	isEnsembleActive: boolean;
	ensembleRosterSubtitle: string;
	messageListEntries: MessageListEntry[];
	activeChat: DesktopAiChatItem | null;
	activeHeroId: string | null;
	assistantHeaderLabel: string;
	ensembleDocConfirm: unknown;
	soloSendsBlocked: boolean;
	canRegenerate: boolean;
	canDeleteMessages: boolean;
	isSharedChat: boolean;
	/** Keycloak subject of the viewing participant — required for shared-chat bubble ownership. */
	currentUserId: string | null;
	ensembleActiveSpeakerId?: string | null;
	webSearchSourcesByMessageId: Record<string, DesktopAiWebSearchSource[]>;
	saveBlueprintToProjectBusyId: string | null;
	showScrollDown: boolean;
	lowGpu: boolean;
	onMessagesScroll: () => void;
	scrollMessagesToBottom: () => void;
	onRegenerate: () => void | Promise<void>;
	onCopyBubble: (content: string) => void | Promise<void>;
	onDeleteUserMessage: (m: DesktopAiMessage) => void;
	onSaveBlueprintToProject: (m: DesktopAiMessage) => void | Promise<void>;
	onStartInterviewFromMessage?: (m: DesktopAiMessage) => void | Promise<void>;
	interviewStartBusy?: boolean;
	onExportAssistantMarkdown: (m: DesktopAiMessage) => void;
	onOpenBubbleHeroDossier: (heroId: string | null) => void;
	onBubbleContextMenu: (payload: DesktopAiChatBubbleContextPayload) => void;
	i18nLanguage: string;
	lucideStroke: number;
	onOpenNewChat: () => void;
	onFocusComposer: () => void;
	t: TFunction<'desktopAiChat'>;
};
