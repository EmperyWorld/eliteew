import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDesktopWorkspaceOverlayState } from '../useDesktopWorkspaceOverlayState';

describe('useDesktopWorkspaceOverlayState', () => {
	it('openAppStore and closeAppStoreModal keep detail id in sync', () => {
		const { result } = renderHook(() => useDesktopWorkspaceOverlayState());
		expect(result.current.showAppStore).toBe(false);
		expect(result.current.appStoreDetailId).toBe(null);

		act(() => {
			result.current.openAppStore('test-app');
		});
		expect(result.current.showAppStore).toBe(true);
		expect(result.current.appStoreDetailId).toBe('test-app');

		act(() => {
			result.current.closeAppStoreModal();
		});
		expect(result.current.showAppStore).toBe(false);
		expect(result.current.appStoreDetailId).toBe(null);
	});

	it('toggles task switcher independently', () => {
		const { result } = renderHook(() => useDesktopWorkspaceOverlayState());
		act(() => {
			result.current.setShowTaskSwitcher(true);
		});
		expect(result.current.showTaskSwitcher).toBe(true);
		expect(result.current.showQuickSearch).toBe(false);
	});

	it('keeps primary overlays mutually exclusive', () => {
		const { result } = renderHook(() => useDesktopWorkspaceOverlayState());

		act(() => {
			result.current.setShowQuickSearch(true);
		});
		expect(result.current.showQuickSearch).toBe(true);

		act(() => {
			result.current.setShowTaskSwitcher(true);
		});
		expect(result.current.showTaskSwitcher).toBe(true);
		expect(result.current.showQuickSearch).toBe(false);

		act(() => {
			result.current.openAppStore('app-a');
		});
		expect(result.current.showAppStore).toBe(true);
		expect(result.current.appStoreDetailId).toBe('app-a');
		expect(result.current.showTaskSwitcher).toBe(false);
	});

	it('allows help and session overlays to stack with a primary overlay', () => {
		const { result } = renderHook(() => useDesktopWorkspaceOverlayState());

		act(() => {
			result.current.setShowQuickSearch(true);
			result.current.setShowShortcutsHelp(true);
			result.current.setShowSessionInfoPanel(true);
		});

		expect(result.current.showQuickSearch).toBe(true);
		expect(result.current.showShortcutsHelp).toBe(true);
		expect(result.current.showSessionInfoPanel).toBe(true);
	});
});
