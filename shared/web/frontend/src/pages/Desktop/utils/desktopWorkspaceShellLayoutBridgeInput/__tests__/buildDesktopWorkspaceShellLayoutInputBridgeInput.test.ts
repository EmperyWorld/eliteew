/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 24 lock: bridge input compose exposes three groups + remapping invariants.
 *
 * Related:
 * - utils/desktopWorkspaceShellLayoutBridgeInput/buildDesktopWorkspaceShellLayoutInputBridgeInput.ts
 */

import { describe, expect, it, vi } from 'vitest';
import { buildDesktopWorkspaceShellLayoutInputBridgeInput } from '../buildDesktopWorkspaceShellLayoutInputBridgeInput';
import { DESKTOP_FLOATING_WIDGET_POSITION_SEED } from '../../../constants';

describe('buildDesktopWorkspaceShellLayoutInputBridgeInput (Wave 24)', () => {
	it('exposes canvas / chrome / derived groups with sync and menu remaps', () => {
		const sources = {
			t: vi.fn(),
			isSyncing: false,
			persistQueueFlushing: true,
			canvasSyncPersistenceError: null,
			widgetOutboxPendingCount: 2,
			persistPatchStats: { total: 3, config: 1, shell: 2 },
			contextMenuType: 'window',
			config: null,
			desktopVisualPreferences: { desktop_widgets_style: 'minimal' },
			desktopWidgetsPanelProps: null,
			onBackgroundContentDragOver: vi.fn(),
			onBackgroundContentDrop: vi.fn(),
			onExternalContentDropToFolder: vi.fn(),
			expansionSettings: {
				workspaceProfiles: [],
				addWorkspaceProfileFromTemplate: vi.fn(),
				addAppCollectionFromTemplate: vi.fn(),
			},
			openWorkspaceProfile: vi.fn(),
			openShellSettings: vi.fn(),
			canOpenUnifiedAdmin: false,
			handleOpenWindow: vi.fn(),
			unifiedAdminDesktopItem: null,
			desktops: [],
			activeDesktopId: 'd1',
			createDesktop: vi.fn(),
			deleteDesktop: vi.fn(),
			switchToDesktop: vi.fn(),
			updateDesktopName: vi.fn(),
			vdDropHoverId: null,
			setWindowContextMenu: vi.fn(),
			setShowShortcutsHelp: vi.fn(),
			setShowSessionInfoModal: vi.fn(),
		} as never;

		const input = buildDesktopWorkspaceShellLayoutInputBridgeInput(sources);

		expect(Object.keys(input).sort()).toEqual(
			['canvasAndInteractions', 'chromeAndModalsRest', 'derived'].sort()
		);
		expect(input.canvasAndInteractions.syncPersistence.isSyncing).toBe(true);
		expect(
			input.canvasAndInteractions.syncPersistence.persistQueuedPatches
		).toBe(5);
		expect(input.canvasAndInteractions.iconInteractions.contextMenuType).toBe(
			'desktop'
		);
		expect(input.canvasAndInteractions.widgetsAndDrop.widgetPosition).toEqual(
			DESKTOP_FLOATING_WIDGET_POSITION_SEED
		);
		expect(input.derived.virtualDesktopsState.activeDesktopId).toBe('d1');
	});
});
