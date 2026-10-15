/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Clock tick scheduling for the floating widget — minute cadence when collapsed or during window drag.
 *
 * Invariants:
 * - Resyncs on document visibility; defers to 1/min when `deferRealtimeUpdates` is true.
 *
 * Related:
 * - utils/subscribeDocumentVisibleSync.ts
 * - constants (DESKTOP_POLLING.CLOCK_MS)
 */

import { useEffect, useRef, useState } from 'react';
import { DESKTOP_POLLING } from '../../constants';
import { subscribeDocumentVisibleSync } from '../../utils/subscribeDocumentVisibleSync';

export function useFloatingWidgetClock(
	isExpanded: boolean,
	deferRealtimeUpdates: boolean
): Date {
	const [time, setTime] = useState(new Date());
	const clockMinuteIntervalRef = useRef<number | null>(null);

	useEffect(() => {
		setTime(new Date());
		if (clockMinuteIntervalRef.current) {
			window.clearInterval(clockMinuteIntervalRef.current);
			clockMinuteIntervalRef.current = null;
		}
		if (isExpanded && !deferRealtimeUpdates) {
			const id = window.setInterval(
				() => setTime(new Date()),
				DESKTOP_POLLING.CLOCK_MS
			);
			return () => window.clearInterval(id);
		}
		const now = new Date();
		const msToNextMinute =
			60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());
		const timeoutId = window.setTimeout(() => {
			setTime(new Date());
			clockMinuteIntervalRef.current = window.setInterval(
				() => setTime(new Date()),
				60_000
			);
		}, msToNextMinute);
		return () => {
			window.clearTimeout(timeoutId);
			if (clockMinuteIntervalRef.current) {
				window.clearInterval(clockMinuteIntervalRef.current);
				clockMinuteIntervalRef.current = null;
			}
		};
	}, [isExpanded, deferRealtimeUpdates]);

	useEffect(() => {
		return subscribeDocumentVisibleSync(() => setTime(new Date()));
	}, []);

	return time;
}
