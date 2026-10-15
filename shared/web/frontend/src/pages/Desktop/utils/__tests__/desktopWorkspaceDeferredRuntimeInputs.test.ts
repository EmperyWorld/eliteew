/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 23 lock: deferred runtime builders + expansion launch omit dedupe.
 *
 * Related:
 * - utils/desktopWorkspaceDeferredRuntimeInputs.ts
 */

import { describe, expect, it, vi } from 'vitest';
import {
	buildDesktopDeferredExpansionSettingsInput,
	buildDesktopWorkspaceDeferredRuntimeInputsBundle,
	buildDesktopWorkspaceExpansionLaunchActionsInput,
	omitDesktopWorkspaceExpansionLaunchExpansion,
} from '../desktopWorkspaceDeferredRuntimeInputs';

describe('desktopWorkspaceDeferredRuntimeInputs (Wave 23)', () => {
	it('normalizes widgets position and compact default in expansion input', () => {
		const input = buildDesktopDeferredExpansionSettingsInput({
			items: [],
			installedApps: [],
			currentDesktopWindows: [],
			activeDesktopId: 'd1',
			onApplyWindowLayoutPreset: vi.fn(),
			onCollectCurrentWorkspaceWindows: vi.fn(),
			onApplyCuratedWorkspaceLayout: vi.fn(),
			widgetsPanelPositionRaw: 'top-right',
			compactWidgetsGlobal: undefined,
			isOnline: true,
			persistSubjectKey: 'sub',
		});

		expect(input.widgetsPanelPosition).toBe('top-right');
		expect(input.compactWidgetsGlobal).toBe(false);
		expect(input.persistSubjectKey).toBe('sub');
	});

	it('omits expansion from launch input and wires companion', () => {
		const full = buildDesktopWorkspaceExpansionLaunchActionsInput({
			items: [],
			installedApps: [],
			selected: new Set(),
			activeDesktopId: 'd1',
			activeDesktopWindow: null,
			windows: [],
			expansion: {
				workspaceProfiles: [],
				appCollections: [],
				contentShortcuts: [],
				assistantContextActions: [],
			},
			handleOpenWindow: vi.fn(),
			openDesktopAppByComponent: vi.fn(),
			switchToDesktop: vi.fn(),
			updateDesktopWallpaper: vi.fn(),
			recordRecentAppOnVirtualDesktop: vi.fn(),
			addRecentFile: vi.fn(),
			propertiesItem: null,
			setPropertiesItem: vi.fn(),
			t: vi.fn() as never,
		});

		const omitted = omitDesktopWorkspaceExpansionLaunchExpansion(full);
		expect(omitted).not.toHaveProperty('expansion');
		expect(omitted.activeDesktopId).toBe('d1');

		const bundle = buildDesktopWorkspaceDeferredRuntimeInputsBundle({
			expansionLaunchActionsInput: full,
			expansion: {
				items: [],
				installedApps: [],
				currentDesktopWindows: [],
				activeDesktopId: 'd1',
				onApplyWindowLayoutPreset: vi.fn(),
				onCollectCurrentWorkspaceWindows: vi.fn(),
				onApplyCuratedWorkspaceLayout: vi.fn(),
				widgetsPanelPositionRaw: 'bogus',
				compactWidgetsGlobal: true,
				isOnline: false,
				persistSubjectKey: null,
			},
			companion: {
				isMobile: false,
				items: [],
				selected: new Set(),
				activeDesktopWindow: null,
				windowsRef: { current: [] },
				desktops: [],
				activeDesktopId: 'd1',
				activeDesktopWindowId: null,
			},
			voice: {
				items: [],
				windows: [],
				currentDesktopWindows: [],
				activeWindowId: null,
				focusWindow: vi.fn(),
				handleOpenWindow: vi.fn(),
				setShowNF: vi.fn(),
				minimizeAllWindows: vi.fn(),
				closeWindow: vi.fn(),
				closeActiveWindow: vi.fn(),
				setShowCommandPalette: vi.fn(),
			},
			shellExtras: {
				displayItems: [],
				allDesktopItems: [],
				installedApps: [],
				authUserId: undefined,
				isMobile: false,
				config: null,
				activeDesktopId: 'd1',
				desktopWidgetsStyle: 'minimal' as never,
				bumpNotificationCenterOpen: vi.fn(),
				openDesktopAppByComponent: vi.fn(),
				openContentShortcut: vi.fn(),
				openAppCollection: vi.fn(),
				openRecentDesktopFile: vi.fn(),
			},
		});

		expect(Object.keys(bundle).sort()).toEqual(
			[
				'deferredCompanionInput',
				'deferredExpansionInput',
				'deferredShellExtrasInput',
				'deferredVoiceCommandsInput',
				'expansionLaunchActionsInput',
			].sort()
		);
		expect(bundle.expansionLaunchActionsInput).not.toHaveProperty('expansion');
		expect(bundle.deferredCompanionInput.expansionLaunchActionsInput).toBe(
			bundle.expansionLaunchActionsInput
		);
		expect(bundle.deferredExpansionInput.compactWidgetsGlobal).toBe(true);
	});
});
