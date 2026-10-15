/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop user configuration GET/PATCH (`/api/v1/desktop/config`).
 *
 * Invariants:
 * - GET uses conditional JSON cache; PATCH invalidates config cache key.
 *
 * Related:
 * - `services/desktopConditionalGet.ts`
 * - `hooks/useDesktopStorage.ts`
 */

import { api } from '../../../../services/api/client';
import {
	desktopConditionalJsonGet,
	invalidateDesktopConditionalCache,
} from '../desktopConditionalGet';
import { API_PATH, DESKTOP_API_OPTIONS } from './constants';
import type { DesktopConfigResponse, DesktopConfigUpdate } from './types';

/**
 * Get user's desktop configuration
 */
export async function getDesktopConfig(): Promise<DesktopConfigResponse> {
	return desktopConditionalJsonGet<DesktopConfigResponse>(
		'config',
		`${API_PATH}/config`,
		DESKTOP_API_OPTIONS
	);
}

/**
 * Update user's desktop configuration
 */
export async function updateDesktopConfig(
	data: DesktopConfigUpdate
): Promise<DesktopConfigResponse> {
	const next = await api.patch<DesktopConfigResponse>(
		`${API_PATH}/config`,
		data,
		DESKTOP_API_OPTIONS
	);
	invalidateDesktopConditionalCache('config');
	return next;
}
