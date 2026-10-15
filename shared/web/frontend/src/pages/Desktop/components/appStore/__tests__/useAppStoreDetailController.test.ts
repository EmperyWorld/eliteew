/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral coverage for App Store detail controller — seed from catalog,
 * Escape→onBack, install toggle toast path.
 *
 * Related:
 * - ../useAppStoreDetailController.ts
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import { storeAppFixture } from './storeAppFixture';

const getStoreApp = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const copyDeepLink = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
	useAuth: () => ({ user: null }),
}));

vi.mock('@/notifications', () => ({
	notify: {
		success: (...args: unknown[]) => toastSuccess(...args),
		error: (...args: unknown[]) => toastError(...args),
	},
}));

vi.mock('../../../services/desktopApi', () => ({
	getStoreApp: (...args: unknown[]) => getStoreApp(...args),
}));

vi.mock('../../../utils/appStoreDeepLink', () => ({
	copyAppStoreAppDeepLink: (...args: unknown[]) => copyDeepLink(...args),
}));

vi.mock('../../../utils/appStoreWindowPolicy', () => ({
	getAppStoreWindowInstanceCap: () => ({
		maxInstances: 1,
		allowsMultipleInstances: false,
	}),
}));

vi.mock('../../../utils/desktopWindowMinSizeRegistry', () => ({
	getDesktopWindowMinSizeForAppComponent: () => null,
}));

import { useAppStoreDetailController } from '../useAppStoreDetailController';

describe('useAppStoreDetailController', () => {
	beforeEach(() => {
		getStoreApp.mockReset();
		toastSuccess.mockReset();
		toastError.mockReset();
		copyDeepLink.mockReset();
	});

	it('seeds detail from appFromStore without fetching', async () => {
		const app = storeAppFixture({
			app_id: 'demo-app',
			name: 'Demo',
			installed: false,
		});
		const { result } = renderHook(() =>
			useAppStoreDetailController({
				appId: 'demo-app',
				appFromStore: app,
				onBack: vi.fn(),
				onInstall: vi.fn(),
				onUninstall: vi.fn(),
			})
		);

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});
		expect(result.current.detail?.app_id).toBe('demo-app');
		expect(getStoreApp).not.toHaveBeenCalled();
	});

	it('calls onBack on Escape', () => {
		const onBack = vi.fn();
		const app = storeAppFixture({ app_id: 'demo-app', name: 'Demo' });
		renderHook(() =>
			useAppStoreDetailController({
				appId: 'demo-app',
				appFromStore: app,
				onBack,
				onInstall: vi.fn(),
				onUninstall: vi.fn(),
			})
		);

		act(() => {
			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		});
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('toggles installed via handleInstall and toasts', async () => {
		const onInstall = vi.fn().mockResolvedValue(undefined);
		const app = storeAppFixture({
			app_id: 'demo-app',
			name: 'Demo',
			installed: false,
		});
		const { result } = renderHook(() =>
			useAppStoreDetailController({
				appId: 'demo-app',
				appFromStore: app,
				onBack: vi.fn(),
				onInstall,
				onUninstall: vi.fn(),
			})
		);

		await act(async () => {
			await result.current.handleInstall();
		});

		expect(onInstall).toHaveBeenCalledWith('demo-app');
		expect(result.current.detail?.installed).toBe(true);
		expect(toastSuccess).toHaveBeenCalled();
	});

	it('handleCopyDeepLink toasts success when clipboard ok', async () => {
		copyDeepLink.mockResolvedValue(true);
		const app = storeAppFixture({ app_id: 'demo-app', name: 'Demo' });
		const { result } = renderHook(() =>
			useAppStoreDetailController({
				appId: 'demo-app',
				appFromStore: app,
				onBack: vi.fn(),
				onInstall: vi.fn(),
				onUninstall: vi.fn(),
			})
		);

		await act(async () => {
			await result.current.handleCopyDeepLink();
		});
		expect(copyDeepLink).toHaveBeenCalledWith('demo-app');
		expect(toastSuccess).toHaveBeenCalled();
	});
});
