/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared config/templates state for Desktop AI Chat admin tabs.
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { log } from '../../../utils/logger';
import {
	fetchDesktopAiChatAdminConfig,
	fetchDesktopAiChatPromptTemplates,
	isDesktopAiChatAdminForbidden,
	patchDesktopAiChatAdminConfig,
} from './desktopAiChatAdminApi';
import type {
	DesktopAiChatAdminLoadState,
	DesktopAiChatAdminSaveState,
	DesktopAiChatAdminStatusKind,
	DesktopAiChatPromptTemplateRow,
} from './desktopAiChatAdminTypes';

export type DesktopAiChatAdminContextValue = {
	loadState: DesktopAiChatAdminLoadState;
	saveState: DesktopAiChatAdminSaveState;
	defaults: Record<string, unknown>;
	templates: DesktopAiChatPromptTemplateRow[];
	loadErrorDetail: string | null;
	statusKind: DesktopAiChatAdminStatusKind;
	statusMessage: string | null;
	lastLoadedAt: number | null;
	refresh: () => Promise<void>;
	saveDefaultsPatch: (patch: Record<string, unknown>) => Promise<boolean>;
	setTemplates: React.Dispatch<
		React.SetStateAction<DesktopAiChatPromptTemplateRow[]>
	>;
	clearStatus: () => void;
};

const DesktopAiChatAdminContext =
	React.createContext<DesktopAiChatAdminContextValue | null>(null);

export function useDesktopAiChatAdmin(): DesktopAiChatAdminContextValue {
	const ctx = React.useContext(DesktopAiChatAdminContext);
	if (!ctx) {
		throw new Error('useDesktopAiChatAdmin outside provider');
	}
	return ctx;
}

export function DesktopAiChatAdminProvider({
	children,
}: {
	children: React.ReactNode;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [loadState, setLoadState] =
		React.useState<DesktopAiChatAdminLoadState>('idle');
	const [saveState, setSaveState] =
		React.useState<DesktopAiChatAdminSaveState>('idle');
	const [defaults, setDefaults] = React.useState<Record<string, unknown>>({});
	const [templates, setTemplates] = React.useState<
		DesktopAiChatPromptTemplateRow[]
	>([]);
	const [loadErrorDetail, setLoadErrorDetail] = React.useState<string | null>(
		null
	);
	const [statusKind, setStatusKind] =
		React.useState<DesktopAiChatAdminStatusKind>(null);
	const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
	const [lastLoadedAt, setLastLoadedAt] = React.useState<number | null>(null);

	const clearStatus = React.useCallback(() => {
		setStatusKind(null);
		setStatusMessage(null);
	}, []);

	const refresh = React.useCallback(async () => {
		setLoadState('loading');
		setLoadErrorDetail(null);
		clearStatus();
		try {
			const [cfg, tpl] = await Promise.all([
				fetchDesktopAiChatAdminConfig(),
				fetchDesktopAiChatPromptTemplates(),
			]);
			setDefaults(cfg);
			setTemplates(tpl);
			setLoadState('ready');
			setLastLoadedAt(Date.now());
		} catch (e) {
			log.error(
				'DesktopAiChatAdmin',
				'load failed',
				e instanceof Error ? e : undefined
			);
			if (isDesktopAiChatAdminForbidden(e)) {
				setLoadState('permissionDenied');
				setLoadErrorDetail(
					e instanceof Error ? e.message : t('adminAiChat.loadError')
				);
			} else {
				setLoadState('error');
				setLoadErrorDetail(
					e instanceof Error ? e.message : t('adminAiChat.loadError')
				);
			}
		}
	}, [clearStatus, t]);

	React.useEffect(() => {
		void refresh();
	}, [refresh]);

	const saveDefaultsPatch = React.useCallback(
		async (patch: Record<string, unknown>): Promise<boolean> => {
			setSaveState('saving');
			clearStatus();
			try {
				const merged = await patchDesktopAiChatAdminConfig(patch);
				setDefaults(merged);
				setStatusKind('success');
				setStatusMessage(t('adminAiChat.saved'));
				setLastLoadedAt(Date.now());
				return true;
			} catch (e) {
				setStatusKind('error');
				setStatusMessage(
					e instanceof Error ? e.message : t('adminAiChat.saveError')
				);
				return false;
			} finally {
				setSaveState('idle');
			}
		},
		[clearStatus, t]
	);

	const value = React.useMemo(
		() => ({
			loadState,
			saveState,
			defaults,
			templates,
			loadErrorDetail,
			statusKind,
			statusMessage,
			lastLoadedAt,
			refresh,
			saveDefaultsPatch,
			setTemplates,
			clearStatus,
		}),
		[
			loadState,
			saveState,
			defaults,
			templates,
			loadErrorDetail,
			statusKind,
			statusMessage,
			lastLoadedAt,
			refresh,
			saveDefaultsPatch,
			clearStatus,
		]
	);

	return (
		<DesktopAiChatAdminContext.Provider value={value}>
			{children}
		</DesktopAiChatAdminContext.Provider>
	);
}
