/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Periodic desktop-client runtime presence report for Admin Users enrich.
 *
 * Invariants:
 * - No-op without license+device bind ids.
 * - Interval ~3 min; also fire on mount and when WG ok/unit flips.
 *
 * Related:
 * - lib/enroll/reportRuntimePresence.ts
 */

import { useEffect, useRef } from 'react';
import {
	detectBuildChannel,
	reportRuntimePresence,
} from '../lib/enroll/reportRuntimePresence';
import { APP_VERSION } from '../lib/launcher/appVersion';
import type { WgPortalStatus } from '../lib/tauri-bridge/commands';

const INTERVAL_MS = 3 * 60 * 1000;

export function useRuntimePresenceReport(opts: {
	enrollBase: string;
	licenseId: string | null;
	deviceId: string | null;
	wg: WgPortalStatus | null;
	peerSlug?: string | null;
	/** Honest: true only when build baked updater pubkey (caller may know from updater gate). */
	updaterPubkeyBaked?: boolean;
}): void {
	const {
		enrollBase,
		licenseId,
		deviceId,
		wg,
		peerSlug,
		updaterPubkeyBaked = false,
	} = opts;
	const lastWgUp = useRef<boolean | null>(null);

	useEffect(() => {
		const lic = (licenseId || '').trim();
		const dev = (deviceId || '').trim();
		if (!lic || !dev || !enrollBase) return;

		let cancelled = false;

		const fire = async () => {
			if (cancelled) return;
			const wgUp =
				wg == null ? null : Boolean(wg.unit_active || wg.code === 'up');
			await reportRuntimePresence({
				enrollBase,
				payload: {
					licenseId: lic,
					deviceId: dev,
					appVersion: APP_VERSION,
					wgUp,
					peerSlug: peerSlug ?? null,
					buildChannel: detectBuildChannel(),
					updaterPubkeyBaked,
				},
			});
		};

		void fire();
		const timer = window.setInterval(() => {
			void fire();
		}, INTERVAL_MS);

		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
		// wg flips handled in second effect
		// eslint-disable-next-line react-hooks/exhaustive-deps -- interval rebind on ids only
	}, [enrollBase, licenseId, deviceId, peerSlug, updaterPubkeyBaked]);

	useEffect(() => {
		const lic = (licenseId || '').trim();
		const dev = (deviceId || '').trim();
		if (!lic || !dev || !enrollBase || wg == null) return;
		const wgUp = Boolean(wg.unit_active || wg.code === 'up');
		if (lastWgUp.current === wgUp) return;
		lastWgUp.current = wgUp;
		void reportRuntimePresence({
			enrollBase,
			payload: {
				licenseId: lic,
				deviceId: dev,
				appVersion: APP_VERSION,
				wgUp,
				peerSlug: peerSlug ?? null,
				buildChannel: detectBuildChannel(),
				updaterPubkeyBaked,
			},
		});
	}, [enrollBase, licenseId, deviceId, wg, peerSlug, updaterPubkeyBaked]);
}
