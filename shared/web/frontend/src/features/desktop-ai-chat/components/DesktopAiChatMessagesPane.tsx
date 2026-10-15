/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable import facade for Desktop AI Chat messages pane (`./messagesPane/*`).
 *
 * Invariants:
 * - Public path re-export only (≤50 LOC); no thread JSX body here.
 *
 * Related:
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 * - documentation/platform/PRODUCT-AUDIT-STABILITY-BACKLOG.md (desktop-ai-chat-011)
 */

export type { DesktopAiChatMessagesPaneProps } from './messagesPane/desktopAiChatMessagesPaneTypes';
export { DesktopAiChatMessagesPaneView as DesktopAiChatMessagesPane } from './messagesPane/DesktopAiChatMessagesPaneView';
