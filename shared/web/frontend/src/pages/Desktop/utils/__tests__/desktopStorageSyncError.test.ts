/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for desktop storage sync error codes and translation helper.
 *
 * Invariants:
 * - Codes map to `desktopUi` keys only — no raw Russian literals at boundaries.
 *
 * Related:
 * - `utils/desktopStorageSyncError.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	DESKTOP_STORAGE_CONFIG_SAVE_ERROR,
	DESKTOP_STORAGE_SYNC_ERROR,
	translateDesktopStorageConfigSaveError,
	translateDesktopStorageSyncError,
} from '../desktopStorageSyncError';

const mockT = ((key: string) => key) as Parameters<
	typeof translateDesktopStorageSyncError
>[1];

describe('desktopStorageSyncError', () => {
	it('translates sync_failed code', () => {
		expect(
			translateDesktopStorageSyncError(
				DESKTOP_STORAGE_SYNC_ERROR.SYNC_FAILED,
				mockT
			)
		).toBe('workspace.syncFailed');
	});

	it('translates server unavailable code', () => {
		expect(
			translateDesktopStorageSyncError(
				DESKTOP_STORAGE_SYNC_ERROR.SERVER_UNAVAILABLE_LOCAL,
				mockT
			)
		).toBe('workspace.syncServerUnavailable');
	});

	it('translates server sync failed code', () => {
		expect(
			translateDesktopStorageSyncError(
				DESKTOP_STORAGE_SYNC_ERROR.SERVER_SYNC_FAILED,
				mockT
			)
		).toBe('workspace.syncServerSyncFailed');
	});

	it('returns null for empty sync code', () => {
		expect(translateDesktopStorageSyncError(null, mockT)).toBeNull();
	});
});

describe('desktopStorageConfigSaveError', () => {
	it('translates queued server unavailable code', () => {
		expect(
			translateDesktopStorageConfigSaveError(
				DESKTOP_STORAGE_CONFIG_SAVE_ERROR.QUEUED_SERVER_UNAVAILABLE,
				mockT
			)
		).toBe('workspace.configSaveQueuedServerUnavailable');
	});

	it('translates failed local kept code', () => {
		expect(
			translateDesktopStorageConfigSaveError(
				DESKTOP_STORAGE_CONFIG_SAVE_ERROR.FAILED_LOCAL_KEPT,
				mockT
			)
		).toBe('workspace.configSaveFailedLocalKept');
	});

	it('returns null for empty config save code', () => {
		expect(translateDesktopStorageConfigSaveError(null, mockT)).toBeNull();
	});
});
