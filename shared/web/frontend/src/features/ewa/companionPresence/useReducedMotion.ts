/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tiny **prefers-reduced-motion** subscription so the companion presence canvas can disable breathing /
 * waveform animations for users who request a calmer interface.
 *
 * Invariants:
 * - SSR-safe: returns `false` when `window` is unavailable.
 * - Always tracks the `prefers-reduced-motion: reduce` media query — no caller-supplied query strings.
 *
 * Related:
 * - src/features/ewa/companionPresence/CompanionSigil.tsx
 */
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
	const [reduced, setReduced] = useState<boolean>(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return false;
		return window.matchMedia(QUERY).matches;
	});

	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const mq = window.matchMedia(QUERY);
		const handler = (ev: MediaQueryListEvent) => setReduced(ev.matches);
		mq.addEventListener('change', handler);
		return () => {
			mq.removeEventListener('change', handler);
		};
	}, []);

	return reduced;
}
