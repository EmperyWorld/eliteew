/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FE orchestrator for Journey W5a/W5b local factory-reset.
 *
 * Invariants:
 * - Calls Core `license_local_factory_reset` (critical + extended W5b wipe).
 * - Clears bind + licenseCapabilities (+ ops debug) localStorage after Core ok.
 * - Marks after_local_reset then app_restart (restart may not return).
 * - No retail UI here — W5c wires the CTA.
 * - No server revoke HTTP.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.3
 */

import { clearPersistedBindIds } from '../bindSession';
import { clearPersistedLicenseCapabilities } from '../licenseCapabilities';
import { disableOpsDebugUi } from '../retailSealed';
import {
	appRestart,
	licenseLocalFactoryReset,
	licenseLocalFactoryResetPrepare,
	type LicenseLocalFactoryResetView,
} from '../../tauri-bridge/commands';
import { markAfterLocalResetForRestart } from './onboardingPersistence';
import { resetAllowsSuccessUi } from './licenseLocalReset';

export type RunLicenseLocalFactoryResetResult = LicenseLocalFactoryResetView & {
	fe_local_storage_cleared: boolean;
	restart_requested: boolean;
};

/**
 * Wipe path. On Core failure does not clear FE keys or restart.
 * On success: FE keys → after_local_reset → app_restart (process replace).
 * Core already runs product_webview_wipe + FoFline/denylist/extras (W5b).
 */
export async function runLicenseLocalFactoryReset(): Promise<RunLicenseLocalFactoryResetResult> {
	const confirmationToken = await licenseLocalFactoryResetPrepare();
	const core = await licenseLocalFactoryReset(confirmationToken);
	if (!resetAllowsSuccessUi(core)) {
		return {
			...core,
			fe_local_storage_cleared: false,
			restart_requested: false,
		};
	}

	clearPersistedBindIds();
	clearPersistedLicenseCapabilities();
	disableOpsDebugUi();
	markAfterLocalResetForRestart();

	try {
		await appRestart();
	} catch {
		/* invoke may reject if host already exiting — still requested */
	}

	return {
		...core,
		cleared: [...core.cleared, 'fe_local_storage', 'app_restart'],
		fe_local_storage_cleared: true,
		restart_requested: true,
	};
}
