/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composed hook for desktop expansion settings (P31 atomization implementation).
 *
 * Invariants:
 * - Online patches go through scheduleShellStateMutation({ source: 'expansion', merge }).
 * - Conflict/error for expansion PATCH derives from subscribeShellStatePipeline snapshot.
 *
 * Related:
 * - desktopExpansionSettings/* action modules
 * - DesktopSettingsExpansionSection.tsx
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CuratedWorkspaceLayoutTemplateId } from '../../constants/desktopCuratedWorkspaceLayoutTemplates';
import type {
	DesktopItem,
	WidgetsPanelPosition,
	WindowState,
} from '../../types/desktop.types';
import type {
	DesktopExpansionSettings,
	DesktopWindowLayoutPreset,
} from '../../types/desktopExpansion.types';
import { buildExpansionStorageMap } from './expansionStorageMap';
import { useDesktopExpansionDiscoveryActions } from './useDesktopExpansionDiscoveryActions';
import { useDesktopExpansionShellCore } from './useDesktopExpansionShellCore';
import { useDesktopExpansionWidgetActions } from './useDesktopExpansionWidgetActions';
import { useDesktopExpansionWindowLayoutActions } from './useDesktopExpansionWindowLayoutActions';
import { useDesktopExpansionWorkspaceActions } from './useDesktopExpansionWorkspaceActions';

export type UseDesktopExpansionSettingsParams = {
	items: DesktopItem[];
	installedApps: DesktopItem[];
	currentDesktopWindows: WindowState[];
	activeDesktopId: string;
	onApplyWindowLayoutPreset?: (preset: DesktopWindowLayoutPreset) => void;
	onCollectCurrentWorkspaceWindows?: () => void;
	onApplyCuratedWorkspaceLayout?: (
		templateId: CuratedWorkspaceLayoutTemplateId
	) => void;
	/** Угол панели виджетов (desktop_config) — для начальной сетки в режиме free. */
	widgetsPanelPosition?: WidgetsPanelPosition;
	/** Глобальный компакт (desktop_config) — для оценки высот при инициализации free. */
	compactWidgetsGlobal?: boolean;
	/** Сеть: при false shell PATCH ставится в очередь отправки при наличии persistSubjectKey. */
	isOnline?: boolean;
	/**
	 * ID пользователя (auth/backend). Если null — офлайн-очередь shell не используется
	 * (все равно пытаемся PATCH напрямую при сети).
	 */
	persistSubjectKey?: string | null;
};

export function useDesktopExpansionSettings(
	params: UseDesktopExpansionSettingsParams
): DesktopExpansionSettings {
	const {
		items,
		installedApps,
		currentDesktopWindows,
		activeDesktopId,
		onApplyWindowLayoutPreset,
		onCollectCurrentWorkspaceWindows,
		onApplyCuratedWorkspaceLayout,
		widgetsPanelPosition = 'top-right',
		compactWidgetsGlobal = false,
		isOnline = true,
		persistSubjectKey = null,
	} = params;
	const { t } = useTranslation('desktopUi');

	const shell = useDesktopExpansionShellCore({ isOnline, persistSubjectKey });

	const workspaceActions = useDesktopExpansionWorkspaceActions({
		workspaceProfiles: shell.workspaceProfiles,
		setWorkspaceProfiles: shell.setWorkspaceProfiles,
		patchExpansion: shell.patchExpansion,
		items,
		installedApps,
		currentDesktopWindows,
		sessionSnapshotWindows: shell.sessionSnapshotWindows,
		activeDesktopId,
		widgetsLayout: shell.widgetsLayout,
		t,
	});

	const windowLayoutActions = useDesktopExpansionWindowLayoutActions({
		windowLayoutPresets: shell.windowLayoutPresets,
		setWindowLayoutPresets: shell.setWindowLayoutPresets,
		patchExpansion: shell.patchExpansion,
		currentDesktopWindows,
		activeDesktopId,
		onApplyWindowLayoutPreset,
		onCollectCurrentWorkspaceWindows,
		onApplyCuratedWorkspaceLayout,
		t,
	});

	const widgetActions = useDesktopExpansionWidgetActions({
		widgetsLayout: shell.widgetsLayout,
		setWidgetsLayout: shell.setWidgetsLayout,
		patchExpansion: shell.patchExpansion,
		widgetsPanelPosition,
		compactWidgetsGlobal,
	});

	const discoveryActions = useDesktopExpansionDiscoveryActions({
		appCollections: shell.appCollections,
		setAppCollections: shell.setAppCollections,
		contentShortcuts: shell.contentShortcuts,
		setContentShortcuts: shell.setContentShortcuts,
		assistantContextActions: shell.assistantContextActions,
		setAssistantContextActions: shell.setAssistantContextActions,
		visualStylePresets: shell.visualStylePresets,
		setVisualStylePresets: shell.setVisualStylePresets,
		patchExpansion: shell.patchExpansion,
		items,
		installedApps,
		workspaceProfiles: shell.workspaceProfiles,
		t,
	});

	const storageMap = useMemo(() => buildExpansionStorageMap(t), [t]);

	const savedSessionSnapshotWindowCount = useMemo(
		() => shell.sessionSnapshotWindows.length,
		[shell.sessionSnapshotWindows]
	);

	return {
		storageMap,
		workspaceProfiles: shell.workspaceProfiles,
		savedSessionSnapshotWindowCount,
		windowLayoutPresets: shell.windowLayoutPresets,
		widgetsLayout: shell.widgetsLayout,
		appCollections: shell.appCollections,
		contentShortcuts: shell.contentShortcuts,
		assistantContextActions: shell.assistantContextActions,
		visualStylePresets: shell.visualStylePresets,
		isLoading: shell.isLoading,
		isSaving: shell.isSaving,
		error: shell.error,
		...workspaceActions,
		...windowLayoutActions,
		...widgetActions,
		...discoveryActions,
		refresh: shell.refresh,
	};
}
