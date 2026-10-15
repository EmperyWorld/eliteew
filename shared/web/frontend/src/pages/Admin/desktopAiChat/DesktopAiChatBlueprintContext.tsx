/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Load/save state for Desktop AI Chat blueprint (ensemble plan drafts) tab.
 *
 * Related:
 * - pages/Admin/desktopAiChat/DesktopAiChatBlueprintTab.tsx
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { log } from '../../../utils/logger';
import {
	fetchEnsemblePlanBuiltins,
	fetchEnsemblePlanDrafts,
	isDesktopAiChatAdminForbidden,
} from './desktopAiChatBlueprintApi';
import type {
	BlueprintAdminActionState,
	BlueprintAdminLoadState,
	BlueprintAdminStatusKind,
	EnsemblePlanBuiltinItem,
	EnsemblePlanDraftRow,
} from './desktopAiChatBlueprintTypes';

export type DesktopAiChatBlueprintContextValue = {
	loadState: BlueprintAdminLoadState;
	actionState: BlueprintAdminActionState;
	drafts: EnsemblePlanDraftRow[];
	builtins: EnsemblePlanBuiltinItem[];
	loadErrorDetail: string | null;
	statusKind: BlueprintAdminStatusKind;
	statusMessage: string | null;
	validationMessage: string | null;
	validationRawJson: string | null;
	lastLoadedAt: number | null;
	refresh: () => Promise<void>;
	setActionState: React.Dispatch<
		React.SetStateAction<BlueprintAdminActionState>
	>;
	setStatus: (kind: BlueprintAdminStatusKind, message: string | null) => void;
	setValidation: (message: string | null, rawJson?: string | null) => void;
	clearStatus: () => void;
};

const DesktopAiChatBlueprintContext =
	React.createContext<DesktopAiChatBlueprintContextValue | null>(null);

export function useDesktopAiChatBlueprint(): DesktopAiChatBlueprintContextValue {
	const ctx = React.useContext(DesktopAiChatBlueprintContext);
	if (!ctx) {
		throw new Error('useDesktopAiChatBlueprint outside provider');
	}
	return ctx;
}

export function DesktopAiChatBlueprintProvider({
	children,
}: {
	children: React.ReactNode;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [loadState, setLoadState] =
		React.useState<BlueprintAdminLoadState>('idle');
	const [actionState, setActionState] =
		React.useState<BlueprintAdminActionState>('idle');
	const [drafts, setDrafts] = React.useState<EnsemblePlanDraftRow[]>([]);
	const [builtins, setBuiltins] = React.useState<EnsemblePlanBuiltinItem[]>([]);
	const [loadErrorDetail, setLoadErrorDetail] = React.useState<string | null>(
		null
	);
	const [statusKind, setStatusKind] =
		React.useState<BlueprintAdminStatusKind>(null);
	const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
	const [validationMessage, setValidationMessage] = React.useState<
		string | null
	>(null);
	const [validationRawJson, setValidationRawJson] = React.useState<
		string | null
	>(null);
	const [lastLoadedAt, setLastLoadedAt] = React.useState<number | null>(null);

	const clearStatus = React.useCallback(() => {
		setStatusKind(null);
		setStatusMessage(null);
		setValidationMessage(null);
		setValidationRawJson(null);
	}, []);

	const setStatus = React.useCallback(
		(kind: BlueprintAdminStatusKind, message: string | null) => {
			setStatusKind(kind);
			setStatusMessage(message);
		},
		[]
	);

	const setValidation = React.useCallback(
		(message: string | null, rawJson: string | null = null) => {
			setValidationMessage(message);
			setValidationRawJson(rawJson);
		},
		[]
	);

	const refresh = React.useCallback(async () => {
		setLoadState('loading');
		setLoadErrorDetail(null);
		clearStatus();
		try {
			const [draftRows, builtinRows] = await Promise.all([
				fetchEnsemblePlanDrafts(),
				fetchEnsemblePlanBuiltins(),
			]);
			setDrafts(draftRows);
			setBuiltins(builtinRows);
			setLoadState('ready');
			setLastLoadedAt(Date.now());
		} catch (e) {
			log.error(
				'DesktopAiChatBlueprint',
				'load failed',
				e instanceof Error ? e : undefined
			);
			if (isDesktopAiChatAdminForbidden(e)) {
				setLoadState('permissionDenied');
			} else {
				setLoadState('error');
			}
			setLoadErrorDetail(
				e instanceof Error ? e.message : t('adminEnsemblePlan.loadError')
			);
		}
	}, [clearStatus, t]);

	React.useEffect(() => {
		void refresh();
	}, [refresh]);

	const value = React.useMemo(
		() => ({
			loadState,
			actionState,
			drafts,
			builtins,
			loadErrorDetail,
			statusKind,
			statusMessage,
			validationMessage,
			validationRawJson,
			lastLoadedAt,
			refresh,
			setActionState,
			setStatus,
			setValidation,
			clearStatus,
		}),
		[
			loadState,
			actionState,
			drafts,
			builtins,
			loadErrorDetail,
			statusKind,
			statusMessage,
			validationMessage,
			validationRawJson,
			lastLoadedAt,
			refresh,
			setStatus,
			setValidation,
			clearStatus,
		]
	);

	return (
		<DesktopAiChatBlueprintContext.Provider value={value}>
			{children}
		</DesktopAiChatBlueprintContext.Provider>
	);
}
