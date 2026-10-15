/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared typed helpers for Desktop Vitest suites — shell frame, i18n stubs, shell-state mocks.
 *
 * Invariants:
 * - No `as any` / `@ts-expect-error`; use namespace-specific TFunction casts only.
 *
 * Related:
 * - src/pages/Desktop/__fixtures__/desktopSettingsTestDoubles.ts
 */

import type { TFunction } from 'i18next';
import type { DesktopWindowStyle } from '@/types/profile';
import type { useDesktopStateActions } from '../context/DesktopStateContext';
import type {
	DesktopShellState,
	DesktopShellStatePatch,
} from '../services/desktopApi';
import type { PersistedWindowState } from '../types/desktop.types';
import { vi } from 'vitest';

/** Canonical window-style preset for shell chrome tests. */
export const DESKTOP_TEST_SHELL_FRAME =
	'glass' as const satisfies DesktopWindowStyle;

export function createDesktopUiTFunction(): TFunction<'desktopUi'> {
	return ((key: string, params?: Record<string, unknown>) =>
		params
			? `${key}:${JSON.stringify(params)}`
			: key) as TFunction<'desktopUi'>;
}

export function createDesktopUiNotificationHubTFunction(): TFunction<
	'desktopUi',
	'notificationHub'
> {
	return ((key: string, opts?: { count?: number }) =>
		opts?.count !== undefined ? `${key}:${opts.count}` : key) as TFunction<
		'desktopUi',
		'notificationHub'
	>;
}

export function createGafChatTFunction(): TFunction<'gafChat'> {
	return ((key: string) => `i18n:${key}`) as TFunction<'gafChat'>;
}

/** Empty shell-state object for API mocks (integration tests). */
export function emptyDesktopShellState(): DesktopShellState {
	return {} as DesktopShellState;
}

export function asDesktopShellState(
	patch: Partial<DesktopShellState> | DesktopShellStatePatch
): DesktopShellState {
	return patch as DesktopShellState;
}

export function createMinimalDesktopStateActions(): ReturnType<
	typeof useDesktopStateActions
> {
	return {
		setSelected: vi.fn(),
		setCtx: vi.fn(),
		setWallpaper: vi.fn(),
		setShowWP: vi.fn(),
		setShowNF: vi.fn(),
		setShowWelcome: vi.fn(),
		setTheme: vi.fn(),
		setAccent: vi.fn(),
		setAccentCustomHex: vi.fn(),
		setRecentFiles: vi.fn(),
		setClipboard: vi.fn(),
		setRenamingId: vi.fn(),
		setShowCommandPalette: vi.fn(),
		setShowClipboard: vi.fn(),
		setIsDraggingIcon: vi.fn(),
		setShowEnhancedContextMenu: vi.fn(),
		setContextMenuPosition: vi.fn(),
		setContextMenuType: vi.fn(),
	};
}

export function persistedWindowStateFixture(
	overrides: Partial<PersistedWindowState> = {}
): PersistedWindowState {
	return {
		type: 'app',
		title: 'Test',
		path: ['Test'],
		position: { x: 0, y: 0 },
		size: { width: 800, height: 600 },
		isMinimized: false,
		isMaximized: false,
		zIndex: 1,
		appComponent: 'TestApp',
		...overrides,
	};
}
