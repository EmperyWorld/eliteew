/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop items CRUD (`/api/v1/desktop/items`).
 *
 * Invariants:
 * - Item ids are client-provided on upsert; bulk replace sends full snapshot.
 *
 * Related:
 * - `hooks/useDesktopStorage.ts`
 * - `utils/desktopStorageItemsSync.ts`
 */

import { api } from '../../../../services/api/client';
import { API_PATH, DESKTOP_API_OPTIONS } from './constants';
import type { DesktopItemCreate, DesktopItemResponse } from './types';

/**
 * Get all user's desktop items
 */
export async function getDesktopItems(): Promise<DesktopItemResponse[]> {
	const response = await api.get<{ items: DesktopItemResponse[] }>(
		`${API_PATH}/items`,
		DESKTOP_API_OPTIONS
	);
	return response.items;
}

/**
 * Create or update a desktop item
 */
export async function upsertDesktopItem(
	itemId: string,
	data: DesktopItemCreate
): Promise<DesktopItemResponse> {
	return api.put<DesktopItemResponse>(
		`${API_PATH}/items/${itemId}`,
		data,
		DESKTOP_API_OPTIONS
	);
}

/**
 * Update a desktop item (partial)
 */
export async function updateDesktopItem(
	itemId: string,
	data: Partial<DesktopItemCreate>
): Promise<DesktopItemResponse> {
	return api.patch<DesktopItemResponse>(
		`${API_PATH}/items/${itemId}`,
		data,
		DESKTOP_API_OPTIONS
	);
}

/**
 * Delete a desktop item
 */
export async function deleteDesktopItem(itemId: string): Promise<void> {
	await api.delete(`${API_PATH}/items/${itemId}`, DESKTOP_API_OPTIONS);
}

/**
 * Replace all desktop items (bulk update)
 */
export async function replaceDesktopItems(
	items: DesktopItemCreate[]
): Promise<DesktopItemResponse[]> {
	const response = await api.put<{ items: DesktopItemResponse[] }>(
		`${API_PATH}/items`,
		{ items },
		DESKTOP_API_OPTIONS
	);
	return response.items;
}
