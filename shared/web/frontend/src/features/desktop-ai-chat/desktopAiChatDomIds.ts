/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable DOM ids and data-testid values for Desktop AI Chat E2E and a11y anchors.
 *
 * Invariants:
 * - Keep in sync with Playwright specs under e2e/desktop-ai-chat-*.spec.ts.
 *
 * Related:
 * - DesktopAiChatApp.tsx, components/DesktopAiChatComposer.tsx, DesktopAiChatMessagesPane.tsx
 * ---
 */

export const DESKTOP_AI_CHAT_COMPOSER_ID = 'desktop-ai-chat-composer';
export const DESKTOP_AI_CHAT_COMPOSER_TESTID = 'desktop-ai-chat-composer';
export const DESKTOP_AI_CHAT_COMPOSER_TEXTAREA_ID =
	'desktop-ai-chat-composer-textarea';
export const DESKTOP_AI_CHAT_COMPOSER_TEXTAREA_TESTID =
	'desktop-ai-chat-composer-textarea';
/** File input for attach; opened via native `<label htmlFor>` (not JS `.click()`). */
export const DESKTOP_AI_CHAT_COMPOSER_ATTACH_INPUT_ID =
	'desktop-ai-chat-composer-attach-input';
export const DESKTOP_AI_CHAT_MESSAGES_ID = 'desktop-ai-chat-messages';
export const DESKTOP_AI_CHAT_MESSAGES_TESTID = 'desktop-ai-chat-messages';
export const DESKTOP_AI_CHAT_MESSAGES_ERROR_TESTID =
	'desktop-ai-chat-messages-error';
export const DESKTOP_AI_CHAT_COMPOSER_OFFLINE_DESC_ID =
	'desktop-ai-chat-composer-offline-desc';
export const DESKTOP_AI_CHAT_PROJECT_MENU_ID = 'desktop-ai-chat-project-menu';
