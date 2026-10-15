/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Optional read-only `/api/version` polling hook for diagnostics or custom UI.
 * Deploy auto-reload is owned by `staleBundleReload.startDeployVersionWatcher` (see `mainFullApp.ts`).
 *
 * Invariants:
 * - Never performs destructive reload — user confirm uses manual hard reload only.
 * - Do not mount in `App.tsx` for deploy detection; prod watcher is bootstrap-level.
 *
 * Related:
 * - `services/versionCheck.ts`, `utils/staleBundleReload.ts`
 */

import { useEffect, useCallback } from 'react';
import versionCheckService from '../services/versionCheck';
import { performManualHardPageReload } from '../utils/staleBundleReload';
import { log } from '../utils/logger';

interface UseVersionCheckOptions {
	/** Poll interval in ms (default 5 min). */
	interval?: number;

	/**
	 * @deprecated Deploy reload is owned by `staleBundleReload`. Ignored — kept for API compat.
	 */
	autoReload?: boolean;

	/** Ask user before manual hard reload (bypasses auto-reload circuit). */
	showNotification?: boolean;

	/** Fired when `/api/version` metadata changes (read-only). */
	onUpdateDetected?: (version: string) => void;

	/** When false, hook is a no-op (default false — deploy watcher lives in mainFullApp). */
	enabled?: boolean;
}

/**
 * @deprecated Prefer `startDeployVersionWatcher` for deploy detection.
 * Use only when read-only `/api/version` polling is explicitly needed.
 */
export const useVersionCheck = (options: UseVersionCheckOptions = {}) => {
	const {
		interval,
		showNotification = false,
		onUpdateDetected,
		enabled = false,
	} = options;

	useEffect(() => {
		if (interval) {
			versionCheckService.setCheckInterval(interval);
		}
	}, [interval]);

	const handleUpdate = useCallback(
		(version: string) => {
			onUpdateDetected?.(version);

			if (showNotification) {
				versionCheckService.showUpdateNotification(
					version,
					async () => {
						await versionCheckService.clearCache();
						performManualHardPageReload('manual_user');
					},
					() => {
						log.info('VersionCheck', 'User cancelled update');
					}
				);
			}
		},
		[showNotification, onUpdateDetected]
	);

	useEffect(() => {
		if (!enabled) {
			return;
		}
		versionCheckService.startAutoCheck(handleUpdate);
		return () => {
			versionCheckService.stopAutoCheck();
		};
	}, [enabled, handleUpdate]);
};

export default useVersionCheck;
