/**
 * Tracks element width/height via ResizeObserver (rAF-coalesced updates).
 */
import * as React from 'react';

/**
 * @param reobserveKey — optional extra dependency (e.g. `isOpen`) when the ref
 * mounts only after a flag flips; ref identity alone does not re-run the effect.
 */
export function useResizeObserverRect<T extends HTMLElement>(
	elementRef: React.RefObject<T | null>,
	_reobserveKey?: unknown
): { width: number; height: number } {
	const [rect, setRect] = React.useState({ width: 0, height: 0 });
	const rafRef = React.useRef<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: optional key remounts observer when ref appears later (e.g. open flag)
	React.useLayoutEffect(() => {
		const el = elementRef.current;
		if (!el || typeof ResizeObserver === 'undefined') {
			return;
		}

		const flush = (): void => {
			rafRef.current = null;
			const { width, height } = el.getBoundingClientRect();
			setRect((prev) =>
				prev.width === width && prev.height === height
					? prev
					: { width, height }
			);
		};

		const schedule = (): void => {
			if (rafRef.current != null) {
				return;
			}
			rafRef.current = requestAnimationFrame(flush);
		};

		schedule();
		const ro = new ResizeObserver(() => schedule());
		ro.observe(el);
		return () => {
			ro.disconnect();
			if (rafRef.current != null) {
				cancelAnimationFrame(rafRef.current);
			}
		};
	}, [elementRef, _reobserveKey]);

	return rect;
}
