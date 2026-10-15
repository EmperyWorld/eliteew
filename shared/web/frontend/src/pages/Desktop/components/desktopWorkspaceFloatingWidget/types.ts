/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Props contract for the desktop workspace floating widget (P34 atomization).
 *
 * Invariants:
 * - Widget position commits through `onWidgetPositionCommit`; no parallel placement state.
 *
 * Related:
 * - components/DesktopWorkspaceFloatingWidget.tsx
 * - utils/desktopFloatingWidgetPlacement.ts
 */

import type { DesktopWidgetsStyle } from '../../../../types/profile';
import type { ViewportRect } from '../../utils/desktopFloatingWidgetPlacement';

export interface DesktopWorkspaceFloatingWidgetProps {
	performance: {
		metrics: {
			fps: number;
			renderTime: number;
			memoryUsage: number;
			windowCount?: number;
		};
		isHighPerformanceMode: boolean;
		preferAggressiveBackgroundSuspend?: boolean;
		recommendations?: import('../../utils/desktopPerformanceRecommendations').DesktopPerformanceRecommendation[];
		setPreferAggressiveBackgroundSuspend?: (value: boolean) => void;
	};
	/** При открытых тяжёлых модалках (например Settings) временно приглушаем telemetry-блоки. */
	suspendTelemetry?: boolean;
	/** Во время drag окна снижаем частоту вторичных обновлений виджета. */
	deferRealtimeUpdates?: boolean;
	windowCount: number;
	notifications: {
		unreadCount: number;
		markAllAsRead: () => void;
	};
	/** Open user profile (avatar click in widget) */
	onOpenProfile?: () => void;
	/** Avatar URL from profile API (AuthContext does not have it) */
	avatarUrl?: string | null;
	/** Hide floating widget for current user */
	onHide?: () => void;
	/** Вкладка «Производительность» в центре настройки стола */
	onOpenPerformanceSettings?: () => void;
	/** Открыть центр уведомлений (панель таскбара) */
	onOpenNotificationCenter?: () => void;
	widgetsStyle: DesktopWidgetsStyle;
	/** Desktop config `widget_position` — free placement after first drag or non-seed API values. */
	widgetPosition: { x: number; y: number };
	/** Persist clamped viewport coordinates to desktop config. */
	onWidgetPositionCommit?: (next: { x: number; y: number }) => void;
	/** Viewport bounds of desktop icons; nudge free placement out of this zone. */
	iconReservedViewportBounds?: ViewportRect | null;
}
