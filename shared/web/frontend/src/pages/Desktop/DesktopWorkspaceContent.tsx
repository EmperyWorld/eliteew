/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Main desktop workspace router: windows, virtual desktops, installed apps, overlays, and **`EwaCompanionShellBridge`**
 * snapshots for **`/ewa/companion-chat`** (`includeAllVirtualDesktops`) — lazy-loaded from `DesktopWorkspace`.
 * Wave A1.1: hook orchestration lives in head/tail/view-model clusters; this file is render branches only.
 *
 * Invariants:
 * - Lazy-loaded chunk (avoid TDZ / circular imports with `DesktopWorkspace`).
 * - Deferred overlays (maintenance, layout preset, widgets/GAF tray) stay dynamic imports.
 * - Deferred expansion + extras runtimes mount after `deferredRuntimeReady` and must not
 *   remount `#desktop-main`, taskbar, icons, or frames.
 *
 * Related:
 * - `DesktopWorkspace.tsx`, `DesktopWorkspaceShellProviders.tsx`, `useDesktopWorkspaceContentViewModel.ts`
 * - `runtime/DesktopDeferredWorkspaceRuntimes.tsx`
 */

import * as React from 'react';
import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { EliteRecoveryScreen } from '@/components/ui/EliteRecoveryScreen';
import { MOBILE_EMBEDDED_APP_ROOT_CLASS } from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import { cn } from '@/utils/cn';
import { performRecoveryConnectionCheck } from '@/services/maintenance/reloadCircuitBreaker';
import { DesktopWorkspaceLoadingShell } from './components/DesktopWorkspaceLoadingShell';
import { DesktopWorkspaceShellLayout } from './components/DesktopWorkspaceShellLayout';
import { DesktopModalSuspenseFallback } from './components/DesktopModalSuspenseFallback';
import { DesktopShellMotionPrefsProvider } from './context/DesktopShellMotionPrefsContext';
import { DesktopWorkspaceShellProviders } from './components/DesktopWorkspaceShellProviders';
import type { UseDesktopStorageReturn } from './hooks/useDesktopStorage';
import { useDesktopWorkspaceContentViewModel } from './hooks/useDesktopWorkspaceContentViewModel';
import type { DesktopWorkspaceContentViewModel } from './hooks/useDesktopWorkspaceContentViewModel';
import { DesktopTaskbarShellPrefsProvider } from './hooks/useDesktopTaskbarShellPrefs';
import { DesktopClipboardHistoryProvider } from './context/DesktopClipboardHistoryContext';
import {
	DesktopDeferredShellExtrasProvider,
	useDesktopDeferredShellExtras,
} from './context/DesktopDeferredShellExtrasContext';
import {
	DesktopDeferredExpansionProvider,
	useDesktopDeferredExpansion,
} from './context/DesktopDeferredExpansionContext';
import {
	DesktopDeferredCompanionProvider,
	useDesktopDeferredCompanion,
} from './context/DesktopDeferredCompanionContext';
import { DesktopDeferredMount } from './components/DesktopDeferredMount';
import { useDesktopWorkspaceExpansionLaunchActions } from './hooks/useDesktopWorkspaceExpansionLaunchActions';
import { useDesktopWorkspaceShellCanvasSyncChip } from './hooks/useDesktopWorkspaceContentOrchestration';
import type { DesktopWorkspaceExpansionLaunchActionsInput } from './types/desktopWorkspaceExpansionLaunchActions.types';

const DesktopSettingsPanel = lazy(() =>
	import('./components/DesktopSettingsPanel').then((m) => ({
		default: m.DesktopSettingsPanel,
	}))
);
const DesktopModalsLayer = lazy(() =>
	import('./components/DesktopModalsLayer').then((m) => ({
		default: m.DesktopModalsLayer,
	}))
);
const NewFolderDialog = lazy(() =>
	import('./components/NewFolderDialog').then((m) => ({
		default: m.NewFolderDialog,
	}))
);
const DesktopWindowLayoutPresetApplyDialog = lazy(() =>
	import('./components/DesktopWindowLayoutPresetApplyDialog').then((m) => ({
		default: m.DesktopWindowLayoutPresetApplyDialog,
	}))
);
const DesktopMaintenanceOverlay = lazy(() =>
	import('./components/DesktopMaintenanceOverlay').then((m) => ({
		default: m.DesktopMaintenanceOverlay,
	}))
);
const DesktopDeferredWorkspaceRuntimes = lazy(() =>
	import('./runtime/DesktopDeferredWorkspaceRuntimes').then((m) => ({
		default: m.DesktopDeferredWorkspaceRuntimes,
	}))
);

/** Re-exports for tests and callers that imported from this module. */
export {
	buildContentManagerOpenPayload,
	buildGafChatOpenPayload,
	canResolveInstalledDesktopApps,
	filterRestoredWindows,
	findVoiceCommandLauncherItem,
} from './utils/desktopOpenPayloads';

type DesktopWorkspaceShellLayoutProps = React.ComponentProps<
	typeof DesktopWorkspaceShellLayout
>;

type DesktopWorkspaceShellDeferredOverlayProps = {
	expansionLaunchActionsInput: Omit<
		DesktopWorkspaceExpansionLaunchActionsInput,
		'expansion'
	>;
	canvasSyncChipInput: {
		combinedDesktopPersistenceError: string | null | undefined;
		staleShellStateConflict: boolean;
		refreshStorage: () => Promise<void>;
		clearPersistPatchConflict: () => void;
	};
};

type DesktopWorkspaceShellLayoutWithDeferredProps =
	DesktopWorkspaceShellLayoutProps & DesktopWorkspaceShellDeferredOverlayProps;

function DesktopWorkspaceShellLayoutWithExtras(
	props: DesktopWorkspaceShellLayoutWithDeferredProps
) {
	const extras = useDesktopDeferredShellExtras();
	const expansion = useDesktopDeferredExpansion();
	const {
		expansionLaunchActionsInput,
		canvasSyncChipInput,
		...layoutProps
	} = props;
	const expansionLaunch = useDesktopWorkspaceExpansionLaunchActions({
		...expansionLaunchActionsInput,
		expansion: {
			workspaceProfiles: expansion.workspaceProfiles,
			appCollections: expansion.appCollections,
			contentShortcuts: expansion.contentShortcuts,
			assistantContextActions: expansion.assistantContextActions,
		},
	});
	const { canvasSyncPersistenceError, recoverStaleShellState } =
		useDesktopWorkspaceShellCanvasSyncChip({
			combinedDesktopPersistenceError:
				canvasSyncChipInput.combinedDesktopPersistenceError,
			expansionError: expansion.error,
			staleShellStateConflict: canvasSyncChipInput.staleShellStateConflict,
			refreshStorage: canvasSyncChipInput.refreshStorage,
			expansionRefresh: expansion.refresh,
			clearPersistPatchConflict: canvasSyncChipInput.clearPersistPatchConflict,
		});
	const canvas = React.useMemo(
		() => ({
			...layoutProps.canvas,
			widgetsPanel: extras.desktopWidgetsPanelProps,
			iconLayer: {
				...layoutProps.canvas.iconLayer,
				itemBadgeCounts: extras.desktopItemBadgeCounts,
				folderChildCounts: extras.folderChildCounts,
				folderPreviewByFolderId: extras.folderPreviewByFolderId,
			},
			sync: {
				...layoutProps.canvas.sync,
				error: canvasSyncPersistenceError ?? layoutProps.canvas.sync.error,
				onRecoverStaleShellState: recoverStaleShellState,
			},
			properties: {
				...layoutProps.canvas.properties,
				assistantActions: expansionLaunch.assistantPropertiesPanelActions,
				onAssistantAction: expansionLaunch.onAssistantPropertiesPanelAction,
			},
			floatingWidget: {
				...layoutProps.canvas.floatingWidget,
				notifications: {
					...layoutProps.canvas.floatingWidget.notifications,
					unreadCount: extras.desktopUnreadCount,
					markAllAsRead: extras.markAllAsRead,
				},
			},
		}),
		[
			canvasSyncPersistenceError,
			extras.desktopItemBadgeCounts,
			extras.desktopUnreadCount,
			extras.desktopWidgetsPanelProps,
			extras.folderChildCounts,
			extras.folderPreviewByFolderId,
			extras.markAllAsRead,
			expansionLaunch.assistantPropertiesPanelActions,
			expansionLaunch.onAssistantPropertiesPanelAction,
			layoutProps.canvas,
			recoverStaleShellState,
		]
	);
	const taskbar = React.useMemo(
		() => ({
			...layoutProps.taskbar,
			appBadgeCounts: extras.taskbarAppBadgeCounts,
			recentLibraryOpened: extras.recentLibraryOpened,
			recentLibraryAdded: extras.recentLibraryAdded,
			recentLibraryGenerated: extras.recentLibraryGenerated,
			recentLibraryUploaded: extras.recentLibraryUploaded,
			recentLibraryProjects: extras.recentLibraryProjects,
			recentContentFeedLoading: extras.recentContentFeedLoading,
			recentContentFeedError: extras.recentContentFeedError,
			recentContentFeedLoadedAt: extras.recentContentFeedLoadedAt,
			hasRecentContentFeedItems: extras.hasRecentContentFeedItems,
			onRefetchRecentContentFeed: extras.refetchRecentContentFeed,
			expansionState: expansion,
			expansionLaunchActions: {
				onOpenWorkspaceProfile: expansionLaunch.openWorkspaceProfile,
				onAddWorkspaceProfileFromTemplate: (templateId) => {
					void expansion.addWorkspaceProfileFromTemplate(templateId);
				},
				onAddAppCollectionFromTemplate: (templateId) => {
					void expansion.addAppCollectionFromTemplate(templateId);
				},
				onOpenAppCollection: expansionLaunch.openAppCollection,
				onOpenContentShortcut: expansionLaunch.openContentShortcut,
				onOpenAssistantAction: expansionLaunch.openAssistantContextAction,
				onOpenGafChatById: expansionLaunch.openGafChatBySession,
			},
		}),
		[
			extras.hasRecentContentFeedItems,
			extras.recentContentFeedError,
			extras.recentContentFeedLoadedAt,
			extras.recentContentFeedLoading,
			extras.recentLibraryAdded,
			extras.recentLibraryGenerated,
			extras.recentLibraryOpened,
			extras.recentLibraryProjects,
			extras.recentLibraryUploaded,
			extras.refetchRecentContentFeed,
			extras.taskbarAppBadgeCounts,
			expansion,
			expansionLaunch.openAppCollection,
			expansionLaunch.openAssistantContextAction,
			expansionLaunch.openContentShortcut,
			expansionLaunch.openGafChatBySession,
			expansionLaunch.openWorkspaceProfile,
			layoutProps.taskbar,
		]
	);
	const searchOverlays = React.useMemo(
		() => ({
			...layoutProps.searchOverlays,
			quickSearch: {
				...layoutProps.searchOverlays.quickSearch,
				recentLibraryOpened: extras.recentLibraryOpened,
				recentLibraryAdded: extras.recentLibraryAdded,
				recentLibraryGenerated: extras.recentLibraryGenerated,
				recentLibraryUploaded: extras.recentLibraryUploaded,
				recentLibraryProjects: extras.recentLibraryProjects,
				recentContentFeedLoading: extras.recentContentFeedLoading,
				recentContentFeedError: extras.recentContentFeedError,
				onRefetchRecentContentFeed: extras.refetchRecentContentFeed,
			},
		}),
		[
			extras.recentContentFeedError,
			extras.recentContentFeedLoading,
			extras.recentLibraryAdded,
			extras.recentLibraryGenerated,
			extras.recentLibraryOpened,
			extras.recentLibraryProjects,
			extras.recentLibraryUploaded,
			extras.refetchRecentContentFeed,
			layoutProps.searchOverlays,
		]
	);
	const shellSettingsBridge = React.useMemo(
		() => ({
			...layoutProps.shellSettingsBridge,
			expansionSettings: expansion,
		}),
		[expansion, layoutProps.shellSettingsBridge]
	);
	const appStoreLayer = React.useMemo(
		() => ({
			...layoutProps.appStoreLayer,
			expansionState: expansion,
		}),
		[expansion, layoutProps.appStoreLayer]
	);
	return (
		<DesktopWorkspaceShellLayout
			{...layoutProps}
			shellSettingsBridge={shellSettingsBridge}
			canvas={canvas}
			taskbar={taskbar}
			searchOverlays={searchOverlays}
			appStoreLayer={appStoreLayer}
		/>
	);
}

type DesktopWorkspaceDeferredShellTreeProps = {
	deferredRuntimeReady: boolean;
	performance: DesktopWorkspaceContentViewModel['performance'];
	desktopGafOpenActions: DesktopWorkspaceContentViewModel['desktopGafOpenActions'];
	appPropsValue: DesktopWorkspaceContentViewModel['appPropsValue'];
	editFolderIconTarget: DesktopWorkspaceContentViewModel['editFolderIconTarget'];
	onCloseEditFolderIcon: DesktopWorkspaceContentViewModel['onCloseEditFolderIcon'];
	handleSaveFolderIcon: DesktopWorkspaceContentViewModel['handleSaveFolderIcon'];
	layoutPresetApplyPrompt: DesktopWorkspaceContentViewModel['layoutPresetApplyPrompt'];
	setLayoutPresetApplyPrompt: DesktopWorkspaceContentViewModel['setLayoutPresetApplyPrompt'];
	currentDesktopWindows: DesktopWorkspaceContentViewModel['currentDesktopWindows'];
	executeApplyWindowLayoutPreset: DesktopWorkspaceContentViewModel['executeApplyWindowLayoutPreset'];
	shellLayoutRootProps: DesktopWorkspaceContentViewModel['shellLayoutRootProps'];
	shellCanvasProps: DesktopWorkspaceContentViewModel['shellCanvasProps'];
	windowContextMenuProps: DesktopWorkspaceContentViewModel['windowContextMenuProps'];
	windowLayerProps: DesktopWorkspaceContentViewModel['windowLayerProps'];
	shellTaskbarProps: DesktopWorkspaceContentViewModel['shellTaskbarProps'];
	helpAndSessionProps: DesktopWorkspaceContentViewModel['helpAndSessionProps'];
	appStoreLayerProps: DesktopWorkspaceContentViewModel['appStoreLayerProps'];
	shellSearchOverlaysProps: DesktopWorkspaceContentViewModel['shellSearchOverlaysProps'];
	shellModalsProps: DesktopWorkspaceContentViewModel['shellModalsProps'];
	expansionLaunchActionsInput: DesktopWorkspaceShellDeferredOverlayProps['expansionLaunchActionsInput'];
	canvasSyncChipInput: DesktopWorkspaceShellDeferredOverlayProps['canvasSyncChipInput'];
	deferredExpansionInput: DesktopWorkspaceContentViewModel['deferredExpansionInput'];
	deferredCompanionInput: DesktopWorkspaceContentViewModel['deferredCompanionInput'];
	deferredVoiceCommandsInput: DesktopWorkspaceContentViewModel['deferredVoiceCommandsInput'];
	deferredShellExtrasInput: DesktopWorkspaceContentViewModel['deferredShellExtrasInput'];
	desktopMaintenanceOverlay: DesktopWorkspaceContentViewModel['desktopMaintenanceOverlay'];
	loadRecoveryFootnote: string;
};

function DesktopWorkspaceDeferredShellTree(
	props: DesktopWorkspaceDeferredShellTreeProps
): React.JSX.Element {
	const { companionShellBridge, assistantSelectionRail } =
		useDesktopDeferredCompanion();
	const {
		deferredRuntimeReady,
		performance,
		desktopGafOpenActions,
		appPropsValue,
		editFolderIconTarget,
		onCloseEditFolderIcon,
		handleSaveFolderIcon,
		layoutPresetApplyPrompt,
		setLayoutPresetApplyPrompt,
		currentDesktopWindows,
		executeApplyWindowLayoutPreset,
		shellLayoutRootProps,
		shellCanvasProps,
		windowContextMenuProps,
		windowLayerProps,
		shellTaskbarProps,
		helpAndSessionProps,
		appStoreLayerProps,
		shellSearchOverlaysProps,
		shellModalsProps,
		expansionLaunchActionsInput,
		canvasSyncChipInput,
		deferredExpansionInput,
		deferredCompanionInput,
		deferredVoiceCommandsInput,
		deferredShellExtrasInput,
		desktopMaintenanceOverlay,
		loadRecoveryFootnote,
	} = props;

	return (
		<DesktopWorkspaceShellProviders
			aggressiveBackgroundSuspend={performance.preferAggressiveBackgroundSuspend}
			gafActions={desktopGafOpenActions}
			appProps={appPropsValue}
			companionShellBridge={companionShellBridge}
		>
			{editFolderIconTarget != null ? (
				<Suspense fallback={<DesktopModalSuspenseFallback />}>
					<NewFolderDialog
						isOpen
						onClose={onCloseEditFolderIcon}
						mode="editIcon"
						initialName={editFolderIconTarget.name}
						initialIconId={editFolderIconTarget.folderIconId}
						onSaveIcon={handleSaveFolderIcon}
					/>
				</Suspense>
			) : null}
			{layoutPresetApplyPrompt != null ? (
				<Suspense fallback={<DesktopModalSuspenseFallback />}>
					<DesktopWindowLayoutPresetApplyDialog
						isOpen
						preset={layoutPresetApplyPrompt}
						openWindowCount={currentDesktopWindows.length}
						onClose={() => setLayoutPresetApplyPrompt(null)}
						onReplace={(preset) => {
							executeApplyWindowLayoutPreset(preset, 'replace');
							setLayoutPresetApplyPrompt(null);
						}}
						onAdd={(preset) => {
							executeApplyWindowLayoutPreset(preset, 'add');
							setLayoutPresetApplyPrompt(null);
						}}
					/>
				</Suspense>
			) : null}
			<DesktopWorkspaceShellLayoutWithExtras
				{...shellLayoutRootProps}
				canvas={shellCanvasProps}
				windowContextMenu={windowContextMenuProps}
				windowLayer={windowLayerProps}
				taskbar={shellTaskbarProps}
				helpAndSession={helpAndSessionProps}
				appStoreLayer={appStoreLayerProps}
				searchOverlays={shellSearchOverlaysProps}
				modals={shellModalsProps}
				assistantSelectionRail={assistantSelectionRail}
				deferredRuntimeReady={deferredRuntimeReady}
				expansionLaunchActionsInput={expansionLaunchActionsInput}
				canvasSyncChipInput={canvasSyncChipInput}
			/>
			<DesktopDeferredMount active={deferredRuntimeReady}>
				<DesktopDeferredWorkspaceRuntimes
					expansionInput={deferredExpansionInput}
					companionInput={deferredCompanionInput}
					voiceCommandsInput={deferredVoiceCommandsInput}
					extrasInput={deferredShellExtrasInput}
				/>
			</DesktopDeferredMount>
			{desktopMaintenanceOverlay ? (
				<Suspense fallback={null}>
					<DesktopMaintenanceOverlay
						windowId={desktopMaintenanceOverlay.windowId}
						title={desktopMaintenanceOverlay.title}
						message={desktopMaintenanceOverlay.message}
						statusLabel={desktopMaintenanceOverlay.statusLabel}
						footnote={loadRecoveryFootnote}
					/>
				</Suspense>
			) : null}
		</DesktopWorkspaceShellProviders>
	);
}

/** Inner content that consumes DesktopStateContext */
const DesktopWorkspaceContentInner: React.FC<{
	storage: UseDesktopStorageReturn;
	embeddedMobileSettingsOnly?: boolean;
	deferredRuntimeReady?: boolean;
}> = ({
	storage,
	embeddedMobileSettingsOnly = false,
	deferredRuntimeReady = false,
}) => {
	const vm = useDesktopWorkspaceContentViewModel({ storage });
	const { t } = useTranslation('desktopUi');

	const {
		showStoragePreloader,
		loadingShellProps,
		loadFailure,
		config,
		loadFailureMessage,
		clearLoadFailure,
		refreshForPersistenceShell,
		performance,
		desktopGafOpenActions,
		appPropsValue,
		shellSettingsBridge,
		showWP,
		setShowWP,
		wallpaper,
		handleWallpaperChange,
		handleRemoveUserWallpaper,
		desktopWindowStyle,
		layoutPresetApplyPrompt,
		setLayoutPresetApplyPrompt,
		currentDesktopWindows,
		executeApplyWindowLayoutPreset,
		shellMotionPrefs,
		editFolderIconTarget,
		onCloseEditFolderIcon,
		handleSaveFolderIcon,
		shellLayoutRootProps,
		shellCanvasProps,
		windowContextMenuProps,
		windowLayerProps,
		shellTaskbarProps,
		helpAndSessionProps,
		appStoreLayerProps,
		shellSearchOverlaysProps,
		shellModalsProps,
		desktopMaintenanceOverlay,
		deferredShellExtrasInput,
		deferredExpansionInput,
		deferredCompanionInput,
		deferredVoiceCommandsInput,
		expansionLaunchActionsInput,
		canvasSyncChipInput,
	} = vm;

	if (showStoragePreloader) {
		return <DesktopWorkspaceLoadingShell {...loadingShellProps} />;
	}

	if (loadFailure && !config) {
		return (
			<EliteRecoveryScreen
				title={t('workspace.loadRecoveryTitle')}
				description={loadFailureMessage ?? t('workspace.loadError.unknown')}
				statusLabel={t('workspace.loadRecoveryStatus')}
				panelVariant="recovery"
				actionLabel={t('workspace.checkConnection')}
				actionPendingLabel={t('workspace.checkConnectionPending')}
				onAction={async () => {
					const ready = await performRecoveryConnectionCheck();
					if (ready) {
						clearLoadFailure();
						await refreshForPersistenceShell();
					}
				}}
				footnote={t('workspace.loadRecoveryFootnote')}
			/>
		);
	}

	if (embeddedMobileSettingsOnly) {
		return (
			<DesktopWorkspaceShellProviders
				aggressiveBackgroundSuspend={
					performance.preferAggressiveBackgroundSuspend
				}
				gafActions={desktopGafOpenActions}
				appProps={appPropsValue}
			>
				<div
					data-embedded-mobile="1"
					data-desktop-settings-root="1"
					className={cn(
						'flex h-full min-h-0 flex-col overflow-hidden',
						MOBILE_EMBEDDED_APP_ROOT_CLASS
					)}
				>
					<Suspense fallback={<DesktopModalSuspenseFallback />}>
						<DesktopSettingsPanel
							{...shellSettingsBridge}
							isOpen
							onClose={() => {}}
							presentation="embedded"
							embeddedMobile
						/>
					</Suspense>
				</div>
				<Suspense fallback={<DesktopModalSuspenseFallback />}>
					<DesktopModalsLayer
						showWallpaper={showWP}
						onCloseWallpaper={() => setShowWP(false)}
						wallpaper={wallpaper}
						wallpaperHistory={config?.wallpaper_history}
						onWallpaperChange={handleWallpaperChange}
						onRemoveUserWallpaper={handleRemoveUserWallpaper}
						onOpenWallpaperPicker={() => setShowWP(true)}
						showNewFolder={false}
						onCloseNewFolder={() => {}}
						onCreateFolder={async () => {}}
						desktopWindowStyle={desktopWindowStyle}
						showCommandPalette={false}
						onCloseCommandPalette={() => {}}
						onCommandAction={() => {}}
						showClipboard={false}
						onCloseClipboard={() => {}}
					/>
				</Suspense>
				{layoutPresetApplyPrompt != null ? (
					<Suspense fallback={<DesktopModalSuspenseFallback />}>
						<DesktopWindowLayoutPresetApplyDialog
							isOpen
							preset={layoutPresetApplyPrompt}
							openWindowCount={currentDesktopWindows.length}
							onClose={() => setLayoutPresetApplyPrompt(null)}
							onReplace={(preset) => {
								executeApplyWindowLayoutPreset(preset, 'replace');
								setLayoutPresetApplyPrompt(null);
							}}
							onAdd={(preset) => {
								executeApplyWindowLayoutPreset(preset, 'add');
								setLayoutPresetApplyPrompt(null);
							}}
						/>
					</Suspense>
				) : null}
			</DesktopWorkspaceShellProviders>
		);
	}

	return (
		<DesktopShellMotionPrefsProvider value={shellMotionPrefs}>
			<DesktopDeferredExpansionProvider>
				<DesktopDeferredShellExtrasProvider>
					<DesktopDeferredCompanionProvider>
						<DesktopWorkspaceDeferredShellTree
							deferredRuntimeReady={deferredRuntimeReady}
							performance={performance}
							desktopGafOpenActions={desktopGafOpenActions}
							appPropsValue={appPropsValue}
							editFolderIconTarget={editFolderIconTarget}
							onCloseEditFolderIcon={onCloseEditFolderIcon}
							handleSaveFolderIcon={handleSaveFolderIcon}
							layoutPresetApplyPrompt={layoutPresetApplyPrompt}
							setLayoutPresetApplyPrompt={setLayoutPresetApplyPrompt}
							currentDesktopWindows={currentDesktopWindows}
							executeApplyWindowLayoutPreset={executeApplyWindowLayoutPreset}
							shellLayoutRootProps={shellLayoutRootProps}
							shellCanvasProps={shellCanvasProps}
							windowContextMenuProps={windowContextMenuProps}
							windowLayerProps={windowLayerProps}
							shellTaskbarProps={shellTaskbarProps}
							helpAndSessionProps={helpAndSessionProps}
							appStoreLayerProps={appStoreLayerProps}
							shellSearchOverlaysProps={shellSearchOverlaysProps}
							shellModalsProps={shellModalsProps}
							expansionLaunchActionsInput={expansionLaunchActionsInput}
							canvasSyncChipInput={canvasSyncChipInput}
							deferredExpansionInput={deferredExpansionInput}
							deferredCompanionInput={deferredCompanionInput}
							deferredVoiceCommandsInput={deferredVoiceCommandsInput}
							deferredShellExtrasInput={deferredShellExtrasInput}
							desktopMaintenanceOverlay={desktopMaintenanceOverlay}
							loadRecoveryFootnote={t('workspace.loadRecoveryFootnote')}
						/>
					</DesktopDeferredCompanionProvider>
				</DesktopDeferredShellExtrasProvider>
			</DesktopDeferredExpansionProvider>
		</DesktopShellMotionPrefsProvider>
	);
};

const DesktopWorkspaceContentWithShellPrefs: React.FC<{
	storage: UseDesktopStorageReturn;
	embeddedMobileSettingsOnly?: boolean;
	deferredRuntimeReady?: boolean;
}> = (props) => {
	const { user: authUser } = useAuth();
	return (
		<DesktopTaskbarShellPrefsProvider userId={authUser?.id}>
			<DesktopClipboardHistoryProvider persistSubjectKey={authUser?.id ?? null}>
				<DesktopWorkspaceContentInner {...props} />
			</DesktopClipboardHistoryProvider>
		</DesktopTaskbarShellPrefsProvider>
	);
};

const DesktopWorkspaceContent: React.FC<{
	storage: UseDesktopStorageReturn;
	embeddedMobileSettingsOnly?: boolean;
	deferredRuntimeReady?: boolean;
}> = (props) => <DesktopWorkspaceContentWithShellPrefs {...props} />;

export default DesktopWorkspaceContent;
