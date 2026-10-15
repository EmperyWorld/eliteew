/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 23: pure builders for TailCluster deferred runtime inputs + expansion
 * launch actions input (dedupes field lists that were duplicated in Tail).
 *
 * Invariants:
 * - Pass-through maps to existing deferred / launch input contracts.
 * - widgetsPanelPosition normalized; compactWidgetsGlobal defaults false.
 *
 * Related:
 * - runtime/desktopDeferred*.ts
 * - types/desktopWorkspaceExpansionLaunchActions.types.ts
 * - hooks/useDesktopWorkspaceContentTailCluster.ts
 * - documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md
 */

import type { DesktopDeferredCompanionInput } from '../runtime/desktopDeferredCompanionInput';
import type { DesktopDeferredExpansionSettingsInput } from '../runtime/desktopDeferredExpansionSettingsInput';
import type { DesktopDeferredShellExtrasInput } from '../runtime/desktopDeferredShellExtrasInput';
import type { DesktopDeferredVoiceCommandsInput } from '../runtime/desktopDeferredVoiceCommandsInput';
import type { DesktopWorkspaceExpansionLaunchActionsInput } from '../types/desktopWorkspaceExpansionLaunchActions.types';
import { normalizeDesktopWidgetsPanelPosition } from './normalizeDesktopWidgetsPanelPosition';

export type DesktopWorkspaceExpansionLaunchActionsInputParts = Omit<
	DesktopWorkspaceExpansionLaunchActionsInput,
	'expansion'
> & {
	expansion: DesktopWorkspaceExpansionLaunchActionsInput['expansion'];
};

export function buildDesktopWorkspaceExpansionLaunchActionsInput(
	parts: DesktopWorkspaceExpansionLaunchActionsInputParts
): DesktopWorkspaceExpansionLaunchActionsInput {
	return {
		items: parts.items,
		installedApps: parts.installedApps,
		selected: parts.selected,
		activeDesktopId: parts.activeDesktopId,
		activeDesktopWindow: parts.activeDesktopWindow,
		windows: parts.windows,
		expansion: parts.expansion,
		handleOpenWindow: parts.handleOpenWindow,
		openDesktopAppByComponent: parts.openDesktopAppByComponent,
		switchToDesktop: parts.switchToDesktop,
		updateDesktopWallpaper: parts.updateDesktopWallpaper,
		recordRecentAppOnVirtualDesktop: parts.recordRecentAppOnVirtualDesktop,
		addRecentFile: parts.addRecentFile,
		propertiesItem: parts.propertiesItem,
		setPropertiesItem: parts.setPropertiesItem,
		t: parts.t,
	};
}

export function omitDesktopWorkspaceExpansionLaunchExpansion(
	input: DesktopWorkspaceExpansionLaunchActionsInput
): Omit<DesktopWorkspaceExpansionLaunchActionsInput, 'expansion'> {
	const { expansion: _expansion, ...rest } = input;
	return rest;
}

export type DesktopDeferredExpansionSettingsInputParts = {
	items: DesktopDeferredExpansionSettingsInput['items'];
	installedApps: DesktopDeferredExpansionSettingsInput['installedApps'];
	currentDesktopWindows: DesktopDeferredExpansionSettingsInput['currentDesktopWindows'];
	activeDesktopId: DesktopDeferredExpansionSettingsInput['activeDesktopId'];
	onApplyWindowLayoutPreset: DesktopDeferredExpansionSettingsInput['onApplyWindowLayoutPreset'];
	onCollectCurrentWorkspaceWindows: DesktopDeferredExpansionSettingsInput['onCollectCurrentWorkspaceWindows'];
	onApplyCuratedWorkspaceLayout: DesktopDeferredExpansionSettingsInput['onApplyCuratedWorkspaceLayout'];
	widgetsPanelPositionRaw: string | null | undefined;
	compactWidgetsGlobal: boolean | null | undefined;
	isOnline: DesktopDeferredExpansionSettingsInput['isOnline'];
	persistSubjectKey: DesktopDeferredExpansionSettingsInput['persistSubjectKey'];
};

export function buildDesktopDeferredExpansionSettingsInput(
	parts: DesktopDeferredExpansionSettingsInputParts
): DesktopDeferredExpansionSettingsInput {
	return {
		items: parts.items,
		installedApps: parts.installedApps,
		currentDesktopWindows: parts.currentDesktopWindows,
		activeDesktopId: parts.activeDesktopId,
		onApplyWindowLayoutPreset: parts.onApplyWindowLayoutPreset,
		onCollectCurrentWorkspaceWindows: parts.onCollectCurrentWorkspaceWindows,
		onApplyCuratedWorkspaceLayout: parts.onApplyCuratedWorkspaceLayout,
		widgetsPanelPosition: normalizeDesktopWidgetsPanelPosition(
			parts.widgetsPanelPositionRaw
		),
		compactWidgetsGlobal: parts.compactWidgetsGlobal ?? false,
		isOnline: parts.isOnline,
		persistSubjectKey: parts.persistSubjectKey,
	};
}

export function buildDesktopDeferredCompanionInput(
	parts: DesktopDeferredCompanionInput
): DesktopDeferredCompanionInput {
	return {
		isMobile: parts.isMobile,
		items: parts.items,
		selected: parts.selected,
		activeDesktopWindow: parts.activeDesktopWindow,
		windowsRef: parts.windowsRef,
		desktops: parts.desktops,
		activeDesktopId: parts.activeDesktopId,
		activeDesktopWindowId: parts.activeDesktopWindowId,
		expansionLaunchActionsInput: parts.expansionLaunchActionsInput,
	};
}

export function buildDesktopDeferredVoiceCommandsInput(
	parts: DesktopDeferredVoiceCommandsInput
): DesktopDeferredVoiceCommandsInput {
	return {
		items: parts.items,
		windows: parts.windows,
		currentDesktopWindows: parts.currentDesktopWindows,
		activeWindowId: parts.activeWindowId,
		focusWindow: parts.focusWindow,
		handleOpenWindow: parts.handleOpenWindow,
		setShowNF: parts.setShowNF,
		minimizeAllWindows: parts.minimizeAllWindows,
		closeWindow: parts.closeWindow,
		closeActiveWindow: parts.closeActiveWindow,
		setShowCommandPalette: parts.setShowCommandPalette,
	};
}

export function buildDesktopDeferredShellExtrasInput(
	parts: DesktopDeferredShellExtrasInput
): DesktopDeferredShellExtrasInput {
	return {
		displayItems: parts.displayItems,
		allDesktopItems: parts.allDesktopItems,
		installedApps: parts.installedApps,
		authUserId: parts.authUserId,
		isMobile: parts.isMobile,
		config: parts.config,
		activeDesktopId: parts.activeDesktopId,
		desktopWidgetsStyle: parts.desktopWidgetsStyle,
		bumpNotificationCenterOpen: parts.bumpNotificationCenterOpen,
		openDesktopAppByComponent: parts.openDesktopAppByComponent,
		openContentShortcut: parts.openContentShortcut,
		openAppCollection: parts.openAppCollection,
		openRecentDesktopFile: parts.openRecentDesktopFile,
	};
}

export type DesktopWorkspaceDeferredRuntimeInputsBundle = {
	expansionLaunchActionsInput: Omit<
		DesktopWorkspaceExpansionLaunchActionsInput,
		'expansion'
	>;
	deferredExpansionInput: DesktopDeferredExpansionSettingsInput;
	deferredCompanionInput: DesktopDeferredCompanionInput;
	deferredVoiceCommandsInput: DesktopDeferredVoiceCommandsInput;
	deferredShellExtrasInput: DesktopDeferredShellExtrasInput;
};

export type DesktopWorkspaceDeferredRuntimeInputsBundleParts = {
	expansionLaunchActionsInput: DesktopWorkspaceExpansionLaunchActionsInput;
	expansion: DesktopDeferredExpansionSettingsInputParts;
	companion: Omit<DesktopDeferredCompanionInput, 'expansionLaunchActionsInput'>;
	voice: DesktopDeferredVoiceCommandsInput;
	shellExtras: DesktopDeferredShellExtrasInput;
};

/**
 * One-shot bundle for TailCluster: omit expansion from launch input + all deferred.
 */
export function buildDesktopWorkspaceDeferredRuntimeInputsBundle(
	parts: DesktopWorkspaceDeferredRuntimeInputsBundleParts
): DesktopWorkspaceDeferredRuntimeInputsBundle {
	const expansionLaunchActionsInput =
		omitDesktopWorkspaceExpansionLaunchExpansion(
			parts.expansionLaunchActionsInput
		);
	return {
		expansionLaunchActionsInput,
		deferredExpansionInput: buildDesktopDeferredExpansionSettingsInput(
			parts.expansion
		),
		deferredCompanionInput: buildDesktopDeferredCompanionInput({
			...parts.companion,
			expansionLaunchActionsInput,
		}),
		deferredVoiceCommandsInput: buildDesktopDeferredVoiceCommandsInput(
			parts.voice
		),
		deferredShellExtrasInput: buildDesktopDeferredShellExtrasInput(
			parts.shellExtras
		),
	};
}
