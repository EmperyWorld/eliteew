import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StoreAppResponse } from '../../services/desktopApi';
import type { DesktopItem } from '../../types/desktop.types';
import { useDesktopWorkspaceAppLaunch } from '../useDesktopWorkspaceAppLaunch';

vi.mock('../../../../contexts/AuthContext', () => ({
	useAuth: () => ({
		user: { id: 'u1', role: 'emperyworld_member' },
		isAuthenticated: true,
	}),
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: { name?: string }) =>
			opts?.name ? `${key}:${opts.name}` : key,
	}),
}));

describe('useDesktopWorkspaceAppLaunch', () => {
	it('openDesktopAppByComponent returns undefined when app missing', () => {
		const openWindow = vi.fn();
		const { result } = renderHook(() =>
			useDesktopWorkspaceAppLaunch({
				items: [],
				installedApps: [],
				installedAppIds: new Set(),
				openWindow,
			})
		);
		expect(
			result.current.openDesktopAppByComponent('NonExistentApp')
		).toBeUndefined();
		expect(openWindow).not.toHaveBeenCalled();
	});

	it('handleOpenWindow calls openWindow for installed app item', () => {
		const item: DesktopItem = {
			id: 'a1',
			name: 'Test',
			type: 'app',
			color: 'text-white',
			gradient: 'from-gray-500 to-gray-600',
			position: { x: 0, y: 0 },
			appComponent: 'ContentManagerPro',
			icon: null,
			description: '',
			isPinned: false,
		};
		const openWindow = vi.fn();
		const { result } = renderHook(() =>
			useDesktopWorkspaceAppLaunch({
				items: [item],
				installedApps: [item],
				installedAppIds: new Set(['a1']),
				openWindow,
			})
		);
		act(() => {
			result.current.handleOpenWindow(item);
		});
		expect(openWindow).toHaveBeenCalledTimes(1);
		expect(openWindow.mock.calls[0]?.[1]).toMatchObject({
			instancePolicy: { allowMultiple: false, maxInstances: 1 },
		});
	});

	it('passes multi-window policy from store catalog to openWindow', () => {
		const item: DesktopItem = {
			id: 'doc-editor',
			name: 'Doc Editor',
			type: 'app',
			position: { x: 0, y: 0 },
			appComponent: 'DocEditor',
		};
		const openWindow = vi.fn();
		const { result } = renderHook(() =>
			useDesktopWorkspaceAppLaunch({
				items: [item],
				installedApps: [item],
				installedAppIds: new Set(['doc-editor']),
				storeApps: [
					{
						app_id: 'doc-editor',
						name: 'Doc Editor',
						description: null,
						app_component: 'DocEditor',
						category: 'productivity',
						gradient: null,
						color: null,
						sort_order: 1,
						installed: true,
						allow_multiple_windows: true,
						max_window_instances: 3,
					} as StoreAppResponse,
				],
				openWindow,
			})
		);
		act(() => {
			result.current.handleOpenWindow(item);
		});
		expect(openWindow).toHaveBeenCalledTimes(1);
		expect(openWindow.mock.calls[0]?.[1]).toMatchObject({
			instancePolicy: { allowMultiple: true, maxInstances: 3 },
		});
	});

	it('openDesktopAppByComponent resolves from installed catalog without desktop shortcut', () => {
		const item: DesktopItem = {
			id: 'app-catalog-only',
			name: 'Catalog Only',
			type: 'app',
			position: { x: 0, y: 0 },
			appComponent: 'CatalogOnlyApp',
		};
		const openWindow = vi.fn();
		const { result } = renderHook(() =>
			useDesktopWorkspaceAppLaunch({
				items: [],
				installedApps: [item],
				installedAppIds: new Set(['app-catalog-only']),
				openWindow,
			})
		);
		expect(result.current.openDesktopAppByComponent('CatalogOnlyApp')).toEqual(
			expect.objectContaining({ appComponent: 'CatalogOnlyApp' })
		);
		expect(openWindow).toHaveBeenCalledTimes(1);
	});
});
