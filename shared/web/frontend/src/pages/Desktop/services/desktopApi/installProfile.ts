/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fetch active product edition install profile (`GET /desktop/install-profile`).
 *
 * Invariants:
 * - Path stays under `DESKTOP_USER_API_PREFIX`; auth via shared api client.
 *
 * Related:
 * - `api/routers/desktop_install_profile.py`
 * - `documentation/platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md` §6
 */

import { api } from '../../../../services/api/client';
import { API_PATH, DESKTOP_API_OPTIONS } from './constants';
import type { DesktopInstallProfileResponse } from './types';

/**
 * Active edition + enabled Desktop `app_component` set for Start/catalog filtering.
 */
export async function getDesktopInstallProfile(): Promise<DesktopInstallProfileResponse> {
	return api.get<DesktopInstallProfileResponse>(
		`${API_PATH}/install-profile`,
		DESKTOP_API_OPTIONS
	);
}
