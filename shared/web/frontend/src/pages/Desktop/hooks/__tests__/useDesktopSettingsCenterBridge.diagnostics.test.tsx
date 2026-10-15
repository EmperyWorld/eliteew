/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for Settings Center diagnostics export payload.
 *
 * Invariants:
 * - Diagnostics summary includes session-local coalesced shell writer telemetry
 *   without adding a backend contract.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopSettingsCenterBridge.ts
 * ---
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DesktopExpansionSettings } from '../../types/desktopExpansion.types';
import { useDesktopSettingsCenterBridge } from '../useDesktopSettingsCenterBridge';

const downloadJsonDocument = vi.fn();

vi.mock('../../utils/desktopDiagnosticsExport', () => ({
	downloadJsonDocument: (...args: unknown[]) => downloadJsonDocument(...args),
	summarizeShellStateForDiagnostics: () => ({ shell: 'summary' }),
}));

vi.mock('../../services/desktopApi', () => ({
	fetchDesktopShellStateDeduplicated: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../../utils/desktopShellStateWriteCoordinator', () => ({
	getCoalescedDesktopShellStateTelemetry: () => ({
		pendingKeys: ['timezone', 'quiet_mode'],
		inflight: true,
		lastFlushLatencyMs: 42,
		failedFlushCount: 1,
		conflictFlushCount: 2,
		lastConflictAtMs: 1234,
		keepaliveFlushCount: 3,
	}),
}));

vi.mock('../useDesktopTaskbarShellPrefs', () => ({
	useDesktopTaskbarShellPrefs: () => ({
		showSeconds: false,
		persistClockShowSeconds: vi.fn(),
		quietMode: false,
		persistQuietMode: vi.fn(),
		timezone: 'Asia/Vladivostok',
		persistTimezone: vi.fn(),
	}),
}));

const t = ((key: string) => key) as never;

function expansionSettings(): DesktopExpansionSettings {
	return {
		workspaceProfiles: [],
		windowLayoutPresets: [],
		widgetsLayout: { slots: [], perWorkspace: false },
		appCollections: [],
		contentShortcuts: [],
		assistantContextActions: [],
		visualStylePresets: [],
		refresh: vi.fn(async () => undefined),
	} as unknown as DesktopExpansionSettings;
}

describe('useDesktopSettingsCenterBridge diagnostics export', () => {
	it('includes coalesced shell writer telemetry in summary JSON', async () => {
		const { result } = renderHook(() =>
			useDesktopSettingsCenterBridge({
				desktops: [],
				activeDesktopId: 'desktop-1',
				wallpaper: '',
				createDesktop: vi.fn(),
				deleteDesktop: vi.fn(),
				switchToDesktop: vi.fn(),
				updateDesktopName: vi.fn(),
				updateDesktopWallpaper: vi.fn(),
				tabConflictDetected: false,
				clearTabConflict: vi.fn(),
				isSyncing: false,
				storageError: null,
				isOnline: true,
				persistPatchStats: { config: 0, shell: 1, total: 1 },
				persistPatchFlushFailed: null,
				flushPersistPatches: vi.fn(),
				refreshStorage: vi.fn(async () => undefined),
				expansionSettings: expansionSettings(),
				installedApps: [],
				items: [],
				handlePinAppFromStartMenu: vi.fn(),
				deleteItem: vi.fn(),
				openAppStoreAsWindow: vi.fn(),
				getWindowsOnDesktop: () => [],
				currentDesktopWindows: [],
				bringWindowsIntoWorkArea: vi.fn(),
				t,
				clientLanguage: 'ru',
			})
		);

		await act(async () => {
			await result.current.sync.onExportDiagnosticsSummary?.();
		});

		expect(downloadJsonDocument).toHaveBeenCalledTimes(1);
		expect(downloadJsonDocument.mock.calls[0]?.[1]).toMatchObject({
			coalescedWriter: {
				pendingKeys: ['timezone', 'quiet_mode'],
				inflight: true,
				lastFlushLatencyMs: 42,
				failedFlushCount: 1,
				conflictFlushCount: 2,
				lastConflictAtMs: 1234,
				keepaliveFlushCount: 3,
			},
			persistQueue: { config: 0, shell: 1, total: 1 },
		});
	});
});
