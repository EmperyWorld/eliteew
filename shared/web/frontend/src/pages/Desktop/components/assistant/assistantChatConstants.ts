/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared constants for Assistant chat thread and composer (limits, shortcuts panel).
 *
 * Invariants:
 * - ASSISTANT_CHAT_MESSAGE_MAX_CHARS matches product_desktop.py AssistantChatBody max_length.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantChatThreadPanel.tsx
 * - pages/Desktop/components/assistant/AssistantComposerCluster.tsx
 */

/** Visible message window before older history collapses into details. */
export const ASSISTANT_CHAT_VISIBLE_COUNT = 10;

/** Matches `AssistantChatBody.message` max_length in product_desktop.py */
export const ASSISTANT_CHAT_MESSAGE_MAX_CHARS = 4000;

export const ASSISTANT_CHAT_COUNTER_THRESHOLD = 3500;

export const ASSISTANT_CHAT_COUNTER_WARN_CHARS = 3800;

export const ASSISTANT_COMPOSER_MAX_HEIGHT_PX = 120;

export const ASSISTANT_SHORTCUTS_PANEL_ITEMS = [
	{ id: 'send', kbdKey: 'shortcutsKbdEnter', labelKey: 'shortcutsPanelSend' },
	{
		id: 'sendCtrl',
		kbdKey: 'shortcutsKbdCtrlEnter',
		labelKey: 'shortcutsPanelSendCtrl',
	},
	{
		id: 'newline',
		kbdKey: 'shortcutsKbdShiftEnter',
		labelKey: 'shortcutsPanelNewline',
	},
	{
		id: 'focus',
		kbdKey: 'shortcutsKbdCtrlDot',
		labelKey: 'shortcutsPanelFocus',
	},
	{ id: 'faq', kbdKey: 'shortcutsKbdSlash', labelKey: 'shortcutsPanelFaq' },
	{
		id: 'faqClear',
		kbdKey: 'shortcutsKbdEscape',
		labelKey: 'shortcutsPanelFaqClear',
	},
] as const;

export const ASSISTANT_SHORTCUTS_OPEN_STORAGE_KEY =
	'eliteew.assistant.shortcutsOpen.v2';

/**
 * Legacy first-visit auto-open gate (retired 2026-08-05).
 * Shortcuts stay collapsed by default; key may linger in sessionStorage.
 */
export const ASSISTANT_SHORTCUTS_INTRO_STORAGE_KEY =
	'eliteew.assistant.shortcutsIntro.v1';

/** FAQ panel open/collapsed — remembered for the browser session. */
export const ASSISTANT_FAQ_OPEN_STORAGE_KEY = 'eliteew.assistant.faqOpen.v1';

/** Dismissible FAQ/chat mode explainer (session). */
export const ASSISTANT_MODE_EXPLAINER_DISMISS_KEY =
	'eliteew.assistant.modeExplainerDismiss.v1';

/** Below this inner width, FAQ defaults collapsed on desktop split layout. */
export const ASSISTANT_COMPACT_SPLIT_WIDTH_PX = 768;

/** Virtualize recent message list when count exceeds this threshold. */
export const ASSISTANT_CHAT_VIRTUALIZE_THRESHOLD = 50;
