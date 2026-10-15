/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ensemble roster, routing mode, doc-confirm sync, and blueprint command loading for Desktop AI Chat.
 *
 * Invariants:
 * - Doc-confirm state clears when chat is not ensemble or last message is not pending confirm.
 *
 * Related:
 * - DesktopAiChatApp.tsx, components/DesktopAiChatEnsembleControls.tsx, ensembleDocConfirmPolicy.ts
 * ---
 */
import type { TFunction } from 'i18next';
import * as React from 'react';
import { toast } from 'sonner';
import {
	fetchEnsembleBlueprintCommands,
	patchDesktopAiChat,
	type DesktopAiChatItem,
	type DesktopAiMessage,
	type EnsembleBlueprintCommandItem,
} from '../api/desktopChatClient';
import {
	DESKTOP_AI_ASSISTANT_HEROES,
	DESKTOP_ENSEMBLE_MAX_ROSTER,
	DESKTOP_ENSEMBLE_MIN_ROSTER,
	type DesktopAiHeroId,
	type DesktopEnsembleRoutingMode,
	desktopEnsembleRosterHeroes,
	isDesktopEnsembleChat,
	resolveDesktopEnsembleRoutingMode,
} from '../desktopAiHeroes';
import { isEnsembleDocConfirmExpired } from '../ensembleDocConfirmPolicy';
import { isPersistedDesktopAiMessageId } from '../utils/desktopAiChatMessageIds';

export type EnsembleDocConfirmState = {
	userMessageId: string;
	reason: string;
} | null;

export type UseDesktopAiChatEnsembleParams = {
	activeChat: DesktopAiChatItem | null;
	activeId: string | null;
	messages: DesktopAiMessage[];
	settings: Record<string, unknown>;
	setChats: React.Dispatch<React.SetStateAction<DesktopAiChatItem[]>>;
	setProjectMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
	t: TFunction<'desktopAiChat'>;
};

export function useDesktopAiChatEnsemble({
	activeChat,
	activeId,
	messages,
	settings,
	setChats,
	setProjectMenuOpen,
	t,
}: UseDesktopAiChatEnsembleParams) {
	const ensembleRoutingMenuRef = React.useRef<HTMLDivElement>(null);
	const [ensembleRoutingMenuOpen, setEnsembleRoutingMenuOpen] =
		React.useState(false);
	const [ensembleDocConfirm, setEnsembleDocConfirm] =
		React.useState<EnsembleDocConfirmState>(null);
	const [ensembleRoutingBusy, setEnsembleRoutingBusy] = React.useState(false);
	const [ensemblePlanCommandsOpen, setEnsemblePlanCommandsOpen] =
		React.useState(false);
	const [ensemblePlanCommands, setEnsemblePlanCommands] = React.useState<
		EnsembleBlueprintCommandItem[]
	>([]);
	const [ensemblePlanCommandsLoading, setEnsemblePlanCommandsLoading] =
		React.useState(false);
	const [ensemblePlanCommandsErr, setEnsemblePlanCommandsErr] = React.useState<
		string | null
	>(null);
	const [ensembleSelectedIds, setEnsembleSelectedIds] = React.useState<
		DesktopAiHeroId[]
	>(() =>
		DESKTOP_AI_ASSISTANT_HEROES.slice(0, DESKTOP_ENSEMBLE_MIN_ROSTER).map(
			(h) => h.id
		)
	);

	const defaultEnsembleHeroIds = React.useCallback(
		() =>
			DESKTOP_AI_ASSISTANT_HEROES.slice(0, DESKTOP_ENSEMBLE_MIN_ROSTER).map(
				(h) => h.id
			),
		[]
	);

	const isEnsembleActive = isDesktopEnsembleChat(activeChat?.settings);

	const ensembleRosterHeroes = React.useMemo(
		() => desktopEnsembleRosterHeroes(activeChat?.settings),
		[activeChat?.settings]
	);

	const ensembleRosterSubtitle = React.useMemo(
		() => ensembleRosterHeroes.map((h) => h.shortLabel).join(' · '),
		[ensembleRosterHeroes]
	);

	const ensembleRoutingMode = resolveDesktopEnsembleRoutingMode(
		activeChat?.settings
	);

	const ensembleRoutingModeLabel = React.useMemo(() => {
		switch (ensembleRoutingMode) {
			case 'auto':
				return t('ensembleRoutingAuto');
			case 'semi':
				return t('ensembleRoutingSemi');
			case 'chat_only':
				return t('ensembleRoutingChatOnly');
			case 'blueprint_only':
				return t('ensembleRoutingBlueprintOnly');
			default:
				return t('ensembleRoutingAuto');
		}
	}, [ensembleRoutingMode, t]);

	React.useEffect(() => {
		if (!isEnsembleActive) {
			setEnsembleDocConfirm(null);
			return;
		}
		const last = messages[messages.length - 1];
		if (last?.role !== 'user') {
			setEnsembleDocConfirm(null);
			return;
		}
		if (!isPersistedDesktopAiMessageId(last.id)) {
			return;
		}
		const st = last.metadata?.ensemble_doc_confirm;
		if (st === 'asked') {
			if (isEnsembleDocConfirmExpired(last, settings)) {
				setEnsembleDocConfirm(null);
				return;
			}
			const persistedReason =
				typeof last.metadata?.ensemble_doc_confirm_reason === 'string'
					? last.metadata.ensemble_doc_confirm_reason.trim()
					: '';
			setEnsembleDocConfirm((prev) =>
				prev?.userMessageId === last.id
					? {
							userMessageId: last.id,
							reason: persistedReason || prev.reason,
						}
					: { userMessageId: last.id, reason: persistedReason }
			);
		} else {
			setEnsembleDocConfirm(null);
		}
	}, [isEnsembleActive, messages, settings]);

	React.useEffect(() => {
		if (!ensembleRoutingMenuOpen) {
			return;
		}
		const onDoc = (e: MouseEvent) => {
			const el = ensembleRoutingMenuRef.current;
			if (el && !el.contains(e.target as Node)) {
				setEnsembleRoutingMenuOpen(false);
			}
		};
		document.addEventListener('mousedown', onDoc);
		return () => document.removeEventListener('mousedown', onDoc);
	}, [ensembleRoutingMenuOpen]);

	React.useEffect(() => {
		if (!isEnsembleActive) {
			setEnsembleRoutingMenuOpen(false);
		}
	}, [isEnsembleActive]);

	React.useEffect(() => {
		if (!isEnsembleActive) {
			setEnsemblePlanCommandsOpen(false);
		}
	}, [isEnsembleActive]);

	const loadEnsemblePlanCommands = React.useCallback(async () => {
		setEnsemblePlanCommandsLoading(true);
		setEnsemblePlanCommandsErr(null);
		try {
			const items = await fetchEnsembleBlueprintCommands();
			setEnsemblePlanCommands(items);
		} catch {
			setEnsemblePlanCommandsErr(t('ensemblePlanCommandsLoadErr'));
			setEnsemblePlanCommands([]);
		} finally {
			setEnsemblePlanCommandsLoading(false);
		}
	}, [t]);

	const applyEnsembleRoutingMode = React.useCallback(
		async (mode: DesktopEnsembleRoutingMode) => {
			if (!activeId || !isEnsembleActive || ensembleRoutingBusy) {
				return;
			}
			setEnsembleRoutingBusy(true);
			try {
				const updated = await patchDesktopAiChat(activeId, {
					settings: { desktop_ensemble_routing_mode: mode },
				});
				setChats((prev) =>
					prev.map((c) => (c.id === updated.id ? updated : c))
				);
				toast.success(t('ensembleRoutingSaved'));
			} catch {
				toast.error(t('ensembleRoutingSaveErr'));
			} finally {
				setEnsembleRoutingBusy(false);
			}
		},
		[activeId, ensembleRoutingBusy, isEnsembleActive, setChats, t]
	);

	const toggleEnsembleHeroPick = React.useCallback(
		(id: DesktopAiHeroId) => {
			setEnsembleSelectedIds((prev) => {
				const i = prev.indexOf(id);
				if (i >= 0) {
					return prev.filter((x) => x !== id);
				}
				if (prev.length >= DESKTOP_ENSEMBLE_MAX_ROSTER) {
					toast.error(
						t('ensembleMaxRosterToast', { max: DESKTOP_ENSEMBLE_MAX_ROSTER })
					);
					return prev;
				}
				return [...prev, id];
			});
		},
		[t]
	);

	const openEnsembleRoutingMenu = React.useCallback(() => {
		setProjectMenuOpen(false);
		setEnsembleRoutingMenuOpen((o) => !o);
	}, [setProjectMenuOpen]);

	return {
		isEnsembleActive,
		ensembleRosterHeroes,
		ensembleRosterSubtitle,
		ensembleRoutingMode,
		ensembleRoutingModeLabel,
		ensembleRoutingMenuRef,
		ensembleRoutingMenuOpen,
		setEnsembleRoutingMenuOpen,
		ensembleDocConfirm,
		setEnsembleDocConfirm,
		ensembleRoutingBusy,
		ensemblePlanCommandsOpen,
		setEnsemblePlanCommandsOpen,
		ensemblePlanCommands,
		ensemblePlanCommandsLoading,
		ensemblePlanCommandsErr,
		ensembleSelectedIds,
		setEnsembleSelectedIds,
		defaultEnsembleHeroIds,
		toggleEnsembleHeroPick,
		loadEnsemblePlanCommands,
		applyEnsembleRoutingMode,
		openEnsembleRoutingMenu,
	};
}
