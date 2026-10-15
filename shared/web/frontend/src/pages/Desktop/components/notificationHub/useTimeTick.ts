/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bump a monotonic tick for relative time labels (e.g. notification "5 min ago").
 *
 * Invariants:
 * - Refreshes immediately when the document becomes visible again (throttled background tabs).
 *
 * Related:
 * - components/NotificationHubBody.tsx
 * - utils/taskbarClockTiming.ts
 * - utils/subscribeDocumentVisibleSync.ts
 */

import { useEffect, useState } from 'react';
import { getTaskbarClockInitialDelayMs } from '../../utils/taskbarClockTiming';
import { subscribeDocumentVisibleSync } from '../../utils/subscribeDocumentVisibleSync';

/** Bumps every `intervalMs` so relative time labels (e.g. "5 min ago") stay fresh. */
export function useTimeTick(intervalMs = 60_000): number {
	const [tick, setTick] = useState(0);

	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		let intervalId: ReturnType<typeof setInterval> | null = null;

		const bump = () => setTick((n) => n + 1);

		const clearTimers = () => {
			if (timeoutId != null) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			if (intervalId != null) {
				clearInterval(intervalId);
				intervalId = null;
			}
		};

		const scheduleCadence = () => {
			clearTimers();
			if (intervalMs >= 60_000) {
				const delay = getTaskbarClockInitialDelayMs({ showSeconds: false });
				timeoutId = setTimeout(() => {
					bump();
					intervalId = setInterval(bump, intervalMs);
				}, delay);
				return;
			}
			intervalId = setInterval(bump, intervalMs);
		};

		scheduleCadence();
		return clearTimers;
	}, [intervalMs]);

	useEffect(() => {
		return subscribeDocumentVisibleSync(() => {
			setTick((n) => n + 1);
		});
	}, []);

	return tick;
}
