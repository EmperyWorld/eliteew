/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave K7: react to online/offline so Kernel offline SPA subset catalog/UX updates live.
 *
 * Related:
 * - shell/kernelOfflineOpenGate.ts
 * - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
 */

import { useEffect, useState } from 'react';
import {
	isBrowserOnline,
	isDesktopNativeClientRuntime,
	isKernelOfflineSpaSubsetModeActive,
} from './kernelOfflineOpenGate';

export function useKernelOfflineSpaSubsetMode(): {
	desktopNative: boolean;
	online: boolean;
	subsetModeActive: boolean;
} {
	const [online, setOnline] = useState(() => isBrowserOnline());
	const [desktopNative] = useState(() => isDesktopNativeClientRuntime());

	useEffect(() => {
		const onOnline = () => setOnline(true);
		const onOffline = () => setOnline(false);
		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);
		return () => {
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
		};
	}, []);

	return {
		desktopNative,
		online,
		subsetModeActive: isKernelOfflineSpaSubsetModeActive({
			desktopNative,
			online,
		}),
	};
}
