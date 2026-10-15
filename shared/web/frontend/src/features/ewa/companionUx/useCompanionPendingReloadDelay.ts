/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Track elapsed pending time and expose reload-delay banner visibility (plan 15 R03).
 *
 * Invariants:
 * - Resets when pending clears or streaming tokens arrive.
 * - Uses a single timeout at the threshold (no 500ms polling) — one setState when the banner may appear.
 *
 * Related:
 * - src/features/ewa/companionUx/companionPendingReloadDelay.ts
 */

import { useEffect, useState } from 'react';

import {
	COMPANION_PENDING_RELOAD_DELAY_MS,
	shouldShowCompanionPendingReloadDelay,
} from '@/features/ewa/companionUx/companionPendingReloadDelay';

export type UseCompanionPendingReloadDelayOptions = {
	pending: boolean;
	streamingText: string;
	/** @deprecated Ignored — kept for call-site compatibility; banner uses one threshold timeout. */
	pollIntervalMs?: number;
	thresholdMs?: number;
};

export function useCompanionPendingReloadDelay({
	pending,
	streamingText,
	thresholdMs = COMPANION_PENDING_RELOAD_DELAY_MS,
}: UseCompanionPendingReloadDelayOptions): boolean {
	const [elapsedMs, setElapsedMs] = useState(0);

	useEffect(() => {
		if (!pending || streamingText.trim().length > 0) {
			setElapsedMs(0);
			return;
		}
		setElapsedMs(0);
		const id = window.setTimeout(() => {
			setElapsedMs(thresholdMs);
		}, thresholdMs);
		return () => window.clearTimeout(id);
	}, [pending, streamingText, thresholdMs]);

	return shouldShowCompanionPendingReloadDelay(
		pending,
		streamingText,
		elapsedMs,
		thresholdMs
	);
}
