/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Session cold-open ritual timeline for Empery Nexus Chronicle (skippable).
 *
 * Invariants:
 * - Once completed or skipped in sessionStorage, atlas starts immediately.
 * - prefers-reduced-motion jumps to atlas without scheduling the ritual.
 *
 * Related:
 * - ui/ChronicleColdOpen.tsx
 * - data/chronicleChapters.ts
 */

import { useEffect, useRef } from 'react';
import type { ChronicleChapterId } from '../data/chronicleChapters';
import type { RealityLayerId } from '../data/chronicleManifest';

export const COLD_OPEN_SESSION_KEY = 'eliteew.emperyNexus.coldOpenDone.v1';

export type ChroniclePhase = 'coldOpen' | 'atlas';

const BEATS: Array<{
	chapter: ChronicleChapterId;
	layer: RealityLayerId;
	lineKey: string;
	at: number;
}> = [
	{ chapter: 'husk', layer: 'mask', lineKey: 'coldOpen.lineHusk', at: 0 },
	{ chapter: 'word', layer: 'muscle', lineKey: 'coldOpen.lineWord', at: 6 },
	{
		chapter: 'constellation',
		layer: 'muscle',
		lineKey: 'coldOpen.lineConstellation',
		at: 12,
	},
	{
		chapter: 'sovereignty',
		layer: 'soul',
		lineKey: 'coldOpen.lineSovereignty',
		at: 18,
	},
];

export function hasCompletedColdOpen(): boolean {
	if (typeof sessionStorage === 'undefined') return false;
	try {
		return sessionStorage.getItem(COLD_OPEN_SESSION_KEY) === '1';
	} catch {
		return false;
	}
}

export function markColdOpenDone(): void {
	try {
		sessionStorage.setItem(COLD_OPEN_SESSION_KEY, '1');
	} catch {
		/* ignore quota / private mode */
	}
}

export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined' || !window.matchMedia) return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function initialChroniclePhase(): ChroniclePhase {
	if (prefersReducedMotion() || hasCompletedColdOpen()) return 'atlas';
	return 'coldOpen';
}

type UseCinematicColdOpenArgs = {
	active: boolean;
	onBeat: (beat: {
		chapter: ChronicleChapterId;
		layer: RealityLayerId;
		lineKey: string;
	}) => void;
	onComplete: () => void;
	onRebirth: () => void;
};

export function useCinematicColdOpen({
	active,
	onBeat,
	onComplete,
	onRebirth,
}: UseCinematicColdOpenArgs): void {
	const callbacks = useRef({ onBeat, onComplete, onRebirth });
	callbacks.current = { onBeat, onComplete, onRebirth };

	useEffect(() => {
		if (!active) return;

		if (prefersReducedMotion()) {
			markColdOpenDone();
			callbacks.current.onComplete();
			return;
		}

		const timers = BEATS.map((beat) =>
			window.setTimeout(() => {
				callbacks.current.onBeat({
					chapter: beat.chapter,
					layer: beat.layer,
					lineKey: beat.lineKey,
				});
			}, beat.at * 1000)
		);
		timers.push(
			window.setTimeout(() => callbacks.current.onRebirth(), 22_000),
			window.setTimeout(() => {
				markColdOpenDone();
				callbacks.current.onComplete();
			}, 24_000)
		);

		return () => {
			for (const timer of timers) {
				window.clearTimeout(timer);
			}
		};
	}, [active]);
}

export { BEATS as COLD_OPEN_BEATS };
