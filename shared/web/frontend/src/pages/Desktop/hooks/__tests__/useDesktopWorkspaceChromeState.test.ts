import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
	useDesktopWorkspaceChromeState,
	useDesktopWorkspacePersistenceMessages,
} from '../useDesktopWorkspaceChromeState';
import { DESKTOP_STORAGE_SYNC_ERROR } from '../../utils/desktopStorageSyncError';

const mockT = ((key: string) => key) as Parameters<
	typeof useDesktopWorkspacePersistenceMessages
>[0]['t'];

describe('useDesktopWorkspacePersistenceMessages', () => {
	it('prefers load failure over sync error', () => {
		const { result } = renderHook(() =>
			useDesktopWorkspacePersistenceMessages({
				loadFailure: { kind: 'timeout', httpStatus: 408 },
				storageError: DESKTOP_STORAGE_SYNC_ERROR.SYNC_FAILED,
				t: mockT,
			})
		);
		expect(result.current.combinedDesktopPersistenceError).toBe(
			'workspace.loadError.timeout'
		);
	});

	it('falls back to translated sync error when no load failure', () => {
		const { result } = renderHook(() =>
			useDesktopWorkspacePersistenceMessages({
				loadFailure: null,
				storageError: DESKTOP_STORAGE_SYNC_ERROR.SYNC_FAILED,
				t: mockT,
			})
		);
		expect(result.current.combinedDesktopPersistenceError).toBe(
			'workspace.syncFailed'
		);
	});

	it('prefers persist flush error over sync error', () => {
		const { result } = renderHook(() =>
			useDesktopWorkspacePersistenceMessages({
				loadFailure: null,
				storageError: DESKTOP_STORAGE_SYNC_ERROR.SYNC_FAILED,
				persistPatchFlushFailed: 'net down',
				t: mockT,
			})
		);
		expect(result.current.combinedDesktopPersistenceError).toBe(
			'workspace.persistPatchFlushFailed'
		);
	});
});

describe('useDesktopWorkspaceChromeState', () => {
	it('exposes loading shell props aligned with persistence', () => {
		const refreshStorage = () => {};
		const { result } = renderHook(() =>
			useDesktopWorkspaceChromeState({
				loadFailure: null,
				storageError: null,
				t: mockT,
				effectiveTheme: 'dark',
				desktopThemeVars: { '--x': '1' },
				workspaceShellCss: '.test{}',
				isLoadingStalled: false,
				refreshStorage,
			})
		);
		expect(result.current.combinedDesktopPersistenceError).toBeNull();
		expect(result.current.loadingShellProps.loadingLabel).toBe(
			'workspace.loading'
		);
		expect(result.current.loadingShellProps.effectiveTheme).toBe('dark');
		expect(result.current.loadingShellProps.workspaceShellCss).toBe('.test{}');
		expect(result.current.loadingShellProps.onRetry).toBe(refreshStorage);
	});
});
