/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop app store catalog, wallet, and installed-apps endpoints.
 *
 * Invariants:
 * - Store GET responses normalize default-app user-facing copy before UI render.
 * - Install/uninstall invalidates conditional `installed` cache key.
 *
 * Related:
 * - `components/AppStore.tsx`
 * - `utils/desktopDefaultAppUserFacingCopy.ts`
 */

import { api } from '../../../../services/api/client';
import { normalizeDefaultDesktopStoreAppUserFacingCopy } from '../../utils/desktopDefaultAppUserFacingCopy';
import {
	desktopConditionalJsonGet,
	invalidateDesktopConditionalCache,
} from '../desktopConditionalGet';
import {
	API_PATH,
	DESKTOP_API_OPTIONS,
	DESKTOP_STORE_API_OPTIONS,
} from './constants';
import type {
	EwWalletResponse,
	InstalledResponse,
	StoreAppDetailResponse,
	StoreResponse,
} from './types';

/**
 * Elite Worlds wallet for desktop store (balance + family flag from token)
 */
export async function getEwWallet(): Promise<EwWalletResponse> {
	return api.get<EwWalletResponse>(
		`${API_PATH}/ew-wallet`,
		DESKTOP_STORE_API_OPTIONS
	);
}

/**
 * Get app store catalog with installed flags for current user
 */
export async function getStore(): Promise<StoreResponse> {
	const response = await api.get<StoreResponse>(
		`${API_PATH}/store`,
		DESKTOP_STORE_API_OPTIONS
	);
	return {
		...response,
		apps: response.apps.map(normalizeDefaultDesktopStoreAppUserFacingCopy),
	};
}

/**
 * Get single app detail from store (with access check)
 */
export async function getStoreApp(
	appId: string
): Promise<StoreAppDetailResponse> {
	const response = await api.get<StoreAppDetailResponse>(
		`${API_PATH}/store/${appId}`,
		DESKTOP_STORE_API_OPTIONS
	);
	return normalizeDefaultDesktopStoreAppUserFacingCopy(response);
}

/**
 * Get list of installed app_ids for current user
 */
export async function getInstalled(): Promise<InstalledResponse> {
	return desktopConditionalJsonGet<InstalledResponse>(
		'installed',
		`${API_PATH}/installed`,
		DESKTOP_STORE_API_OPTIONS
	);
}

/**
 * Install an app for current user
 */
export async function installApp(appId: string): Promise<void> {
	await api.post(
		`${API_PATH}/installed`,
		{ app_id: appId },
		DESKTOP_API_OPTIONS
	);
	invalidateDesktopConditionalCache('installed');
}

/**
 * Uninstall an app for current user
 */
export async function uninstallApp(appId: string): Promise<void> {
	await api.delete(`${API_PATH}/installed/${appId}`, DESKTOP_API_OPTIONS);
	invalidateDesktopConditionalCache('installed');
}
