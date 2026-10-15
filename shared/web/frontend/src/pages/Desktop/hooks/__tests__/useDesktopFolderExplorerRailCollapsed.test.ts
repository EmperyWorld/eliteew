import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDesktopFolderExplorerRailCollapsed } from '../useDesktopFolderExplorerRailCollapsed';

const mockRefresh = vi.fn();
const mockUpdatePreferences = vi.fn();

vi.mock('@/contexts/UserPreferencesAppContext', () => ({
	useUserPreferencesApp: () => ({
		preferences: { ui: { sidebar_collapsed: true } },
		refresh: mockRefresh,
	}),
}));

vi.mock('@/services/profileService', () => ({
	default: {
		updatePreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
	},
}));

describe('useDesktopFolderExplorerRailCollapsed', () => {
	beforeEach(() => {
		mockRefresh.mockReset();
		mockUpdatePreferences.mockReset();
		mockUpdatePreferences.mockResolvedValue({
			ui: { sidebar_collapsed: false },
		});
	});

	it('defaults to collapsed from profile preference', () => {
		const { result } = renderHook(() =>
			useDesktopFolderExplorerRailCollapsed()
		);
		expect(result.current.collapsed).toBe(true);
	});

	it('persists expanded state to profile preferences', async () => {
		const { result } = renderHook(() =>
			useDesktopFolderExplorerRailCollapsed()
		);

		act(() => {
			result.current.toggle();
		});

		expect(result.current.collapsed).toBe(false);

		await waitFor(() => {
			expect(mockUpdatePreferences).toHaveBeenCalledWith({
				ui: expect.objectContaining({ sidebar_collapsed: false }),
			});
		});
	});
});
