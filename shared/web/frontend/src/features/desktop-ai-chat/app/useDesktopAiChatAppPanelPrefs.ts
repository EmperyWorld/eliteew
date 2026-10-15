/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Per-chat panel prefs state (tools / web-search / voice toggles) for Desktop AI Chat compose.
 *
 * Invariants:
 * - Prefs are scoped by activeId; defaults stay conservative until user opts in.
 *
 * Related:
 * - useDesktopAiChatAppCompose.ts, desktopAiChatAppPrefs.ts
 */
import * as React from 'react';

import {
	DEFAULT_DESKTOP_AI_CHAT_PANEL_PREFS,
	type DesktopAiChatPanelPrefs,
} from './desktopAiChatAppPrefs';

export function useDesktopAiChatAppPanelPrefs(activeId: string | null) {
	const [panelPrefsByChatId, setPanelPrefsByChatId] = React.useState<
		Record<string, DesktopAiChatPanelPrefs>
	>({});

	const setPanelPref = React.useCallback(
		(patch: Partial<DesktopAiChatPanelPrefs>) => {
			if (!activeId) return;
			setPanelPrefsByChatId((prev) => ({
				...prev,
				[activeId]: {
					...(prev[activeId] ?? DEFAULT_DESKTOP_AI_CHAT_PANEL_PREFS),
					...patch,
				},
			}));
		},
		[activeId]
	);

	const consumeWebSearchArm = React.useCallback(() => {
		setPanelPref({ useWebSearch: false });
	}, [setPanelPref]);

	const panelPrefs = React.useMemo(
		() =>
			activeId
				? (panelPrefsByChatId[activeId] ?? DEFAULT_DESKTOP_AI_CHAT_PANEL_PREFS)
				: DEFAULT_DESKTOP_AI_CHAT_PANEL_PREFS,
		[activeId, panelPrefsByChatId]
	);

	return {
		panelPrefsByChatId,
		setPanelPrefsByChatId,
		setPanelPref,
		consumeWebSearchArm,
		panelPrefs,
		useTools: panelPrefs.useTools,
		useWebSearch: panelPrefs.useWebSearch,
		voiceIn: panelPrefs.voiceIn,
		voiceOut: panelPrefs.voiceOut,
	};
}
