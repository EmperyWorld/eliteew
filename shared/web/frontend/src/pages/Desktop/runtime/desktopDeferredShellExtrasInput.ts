/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Input contract for deferred Desktop extras runtime (badges + widgets + feed).
 *
 * Invariants:
 * - Value-only; no hooks. Safe to assemble from the critical view-model.
 *
 * Related:
 * - DesktopDeferredShellExtrasRuntime.tsx
 */

import type { DesktopWidgetsStyle } from '@/types/profile';
import type { DesktopWidgetsPanelProps } from '../components/DesktopWidgetsPanel';
import type { DesktopItem, RecentFile } from '../types/desktop.types';

export type DesktopDeferredShellExtrasInput = {
	displayItems: DesktopItem[];
	allDesktopItems: DesktopItem[];
	installedApps: DesktopItem[];
	authUserId: string | undefined;
	isMobile: boolean;
	config: {
		show_widgets_panel?: boolean;
		widgets_panel_position?: DesktopWidgetsPanelProps['panelPosition'];
		compact_widgets?: boolean;
	} | null;
	activeDesktopId: string;
	desktopWidgetsStyle: DesktopWidgetsStyle;
	bumpNotificationCenterOpen: () => void;
	openDesktopAppByComponent: (
		component: string,
		opts?: { initialPayload?: Record<string, unknown> }
	) => void;
	openContentShortcut: (id: string) => void;
	openAppCollection: (id: string) => void;
	openRecentDesktopFile: (file: RecentFile) => void;
};
