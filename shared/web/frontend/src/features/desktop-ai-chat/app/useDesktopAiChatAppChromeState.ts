/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Modal / banner / guide chrome state for Desktop AI Chat app compose.
 *
 * Invariants:
 * - Chrome state is UI-only; stream/domain logic stays in hooks/ and shell actions.
 *
 * Related:
 * - useDesktopAiChatAppCompose.ts, DesktopAiChatAppView.tsx
 */
import * as React from 'react';

import type { DesktopEnsembleCouncilUiState } from '../ensemble';
import type { DesktopAiWebSearchSource } from '../desktopWebSearchSources';
import type { DesktopAiChatBubbleContextPayload } from '../components/DesktopAiChatBubbleContextMenu';
import { readHeaderCollapsed } from '../utils/desktopAiChatFormatters';

export function useDesktopAiChatAppChromeState() {
	const [headerCollapsed, setHeaderCollapsed] =
		React.useState(readHeaderCollapsed);
	const [sttBusy, setSttBusy] = React.useState(false);
	const [toolsHistory, setToolsHistory] = React.useState<
		Array<{ at: number; summary: string; sources: DesktopAiWebSearchSource[] }>
	>([]);
	const [deleteChatConfirmOpen, setDeleteChatConfirmOpen] =
		React.useState(false);
	const [deleteChatBusy, setDeleteChatBusy] = React.useState(false);
	const [streamErrorBanner, setStreamErrorBanner] = React.useState<{
		message: string;
		retryable: boolean;
		canClearStreamLock?: boolean;
		turnBusy?: boolean;
	} | null>(null);
	const [streamLockClearBusy, setStreamLockClearBusy] = React.useState(false);
	const [composerHint, setComposerHint] = React.useState<string | null>(null);
	const [ensembleCouncilUi, setEnsembleCouncilUi] =
		React.useState<DesktopEnsembleCouncilUiState | null>(null);
	const [ttsBusy, setTtsBusy] = React.useState(false);
	const [saveBlueprintToProjectBusyId, setSaveBlueprintToProjectBusyId] =
		React.useState<string | null>(null);
	const [bubbleCtxMenu, setBubbleCtxMenu] =
		React.useState<DesktopAiChatBubbleContextPayload | null>(null);
	const [heroDossierOpen, setHeroDossierOpen] = React.useState(false);
	const [dossierHeroId, setDossierHeroId] = React.useState<string | null>(null);
	const [chatGuideOpen, setChatGuideOpen] = React.useState(false);
	const [chatGuideMountKey, setChatGuideMountKey] = React.useState(0);
	const [networkOnline, setNetworkOnline] = React.useState(
		() =>
			typeof navigator === 'undefined' ||
			typeof navigator.onLine !== 'boolean' ||
			navigator.onLine
	);

	React.useEffect(() => {
		const sync = () => setNetworkOnline(navigator.onLine);
		window.addEventListener('online', sync);
		window.addEventListener('offline', sync);
		return () => {
			window.removeEventListener('online', sync);
			window.removeEventListener('offline', sync);
		};
	}, []);

	return {
		headerCollapsed,
		setHeaderCollapsed,
		sttBusy,
		setSttBusy,
		toolsHistory,
		setToolsHistory,
		deleteChatConfirmOpen,
		setDeleteChatConfirmOpen,
		deleteChatBusy,
		setDeleteChatBusy,
		streamErrorBanner,
		setStreamErrorBanner,
		streamLockClearBusy,
		setStreamLockClearBusy,
		composerHint,
		setComposerHint,
		ensembleCouncilUi,
		setEnsembleCouncilUi,
		ttsBusy,
		setTtsBusy,
		saveBlueprintToProjectBusyId,
		setSaveBlueprintToProjectBusyId,
		bubbleCtxMenu,
		setBubbleCtxMenu,
		heroDossierOpen,
		setHeroDossierOpen,
		dossierHeroId,
		setDossierHeroId,
		chatGuideOpen,
		setChatGuideOpen,
		chatGuideMountKey,
		setChatGuideMountKey,
		networkOnline,
	};
}
