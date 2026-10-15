/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Internal paint helper: applies dynamic colors on the DOM to avoid JSX `style` (webhint no-inline-styles).
 *
 * Invariants:
 * - App component visual identities remain stable for persisted desktop items.
 * - Every DesktopWindowStyle key keeps a distinct premium look; no backdrop-filter / chameleon motion.
 * - No infinite CSS animation on window, taskbar, or widget chrome.
 * - Chrome gradient tokens (`--desktop-chrome-*-bg`) use `[background-image:var(--…)]`,
 *   never Tailwind `bg-(--…)` (that emits `background-color`, which drops gradients).
 *
 * Related:
 * - `pages/Desktop/utils/desktopVisualSystem.tsx` (public barrel)
 * - `documentation/product/DESKTOP-WINDOW-SHELL-STYLE.md`
 */
import { useLayoutEffect, useRef } from 'react';

/** Backgrounds that depend on dynamic colors — paint on the DOM to avoid JSX `style` (webhint no-inline-styles). */
export function DesktopPaintedSpan({
	className,
	paint,
	depsKey,
}: {
	className: string;
	paint: (el: HTMLSpanElement) => void;
	/** Changes when visual inputs change; avoids unstable `deps` array identity. */
	depsKey: string;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const paintRef = useRef(paint);
	paintRef.current = paint;
	// biome-ignore lint/correctness/useExhaustiveDependencies: depsKey reruns paint when serialized visual deps change; paint is held in ref
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		paintRef.current(el);
	}, [depsKey]);
	return <span ref={ref} aria-hidden className={className} />;
}
