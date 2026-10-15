/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P4 / Wave 0 reachability — mark chrome `inert` when its box is outside the
 * viewport so off-screen controls cannot take Tab focus.
 *
 * Invariants:
 * - Applies `inert` only while the element fails a viewport intersection check.
 * - No-op when `enabled` is false (clears inert).
 *
 * Related:
 * - shell/shellSemanticContracts.ts (`reachability: in_viewport_or_inert`)
 * - components/Taskbar.tsx (welcome nudge slot)
 */

import { type RefObject, useLayoutEffect } from 'react';

function isElementInViewport(el: HTMLElement): boolean {
	const r = el.getBoundingClientRect();
	const vw =
		typeof window !== 'undefined'
			? window.innerWidth
			: Number.POSITIVE_INFINITY;
	const vh =
		typeof window !== 'undefined'
			? window.innerHeight
			: Number.POSITIVE_INFINITY;
	return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
}

/**
 * Keep `ref` focusable only while any part of it intersects the viewport.
 * Off-viewport → `inert` (removes from a11y tree / tab order).
 */
export function useDesktopInViewportReachability(
	ref: RefObject<HTMLElement | null>,
	enabled: boolean
): void {
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) {
			return;
		}
		if (!enabled) {
			el.removeAttribute('inert');
			return;
		}

		const sync = () => {
			const target = ref.current;
			if (!target) return;
			if (isElementInViewport(target)) {
				target.removeAttribute('inert');
			} else {
				target.setAttribute('inert', '');
			}
		};

		sync();
		const ro =
			typeof ResizeObserver !== 'undefined'
				? new ResizeObserver(() => sync())
				: null;
		if (ro) ro.observe(el);
		window.addEventListener('resize', sync);
		window.addEventListener('scroll', sync, true);
		return () => {
			ro?.disconnect();
			window.removeEventListener('resize', sync);
			window.removeEventListener('scroll', sync, true);
			ref.current?.removeAttribute('inert');
		};
	}, [ref, enabled]);
}

/** Pure helper for Vitest — same intersection rule as the hook. */
export function desktopChromeIntersectsViewport(
	rect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>,
	viewport: { width: number; height: number }
): boolean {
	return (
		rect.bottom > 0 &&
		rect.top < viewport.height &&
		rect.right > 0 &&
		rect.left < viewport.width
	);
}
