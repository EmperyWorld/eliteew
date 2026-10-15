/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Per-chat panel preference keys and defaults for Desktop AI Chat shell wiring.
 *
 * Invariants:
 * - Panel prefs defaults stay conservative (tools/voice off until user opts in).
 *
 * Related:
 * - useDesktopAiChatAppCompose.ts, app/DesktopAiChatAppView.tsx
 */

export type DesktopAiChatPanelPrefs = {
	useTools: boolean;
	useWebSearch: boolean;
	voiceIn: boolean;
	voiceOut: boolean;
};

export const DEFAULT_DESKTOP_AI_CHAT_PANEL_PREFS: DesktopAiChatPanelPrefs = {
	useTools: false,
	useWebSearch: false,
	voiceIn: false,
	voiceOut: false,
};
