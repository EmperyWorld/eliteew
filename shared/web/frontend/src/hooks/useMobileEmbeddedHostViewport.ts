/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Physical viewport width tier for MobileAndroid embedded WebView (wide CSS viewport ≠ phone width).
 *
 * Invariants:
 * - Uses `visualViewport.width` when available; falls back to `window.innerWidth`.
 * - Tiers drive `[data-me-width-tier]` on embedded feature roots, not Tailwind `md:`/`lg:`.
 *
 * Related:
 * - mobileEmbeddedTheme.css, mobileEmbeddedLayoutTokens.ts, EwaDesktopApp.tsx
 */

import { useEffect, useState } from 'react';

export type MobileEmbeddedWidthTier = 'narrow' | 'standard' | 'wide';

export function resolveMobileEmbeddedWidthTier(
	widthPx: number
): MobileEmbeddedWidthTier {
	if (widthPx < 400) return 'narrow';
	if (widthPx < 720) return 'standard';
	return 'wide';
}

function readViewportWidthPx(): number {
	if (typeof window === 'undefined') return 720;
	return window.visualViewport?.width ?? window.innerWidth;
}

export function useMobileEmbeddedHostViewport(
	enabled: boolean
): MobileEmbeddedWidthTier {
	const [tier, setTier] = useState<MobileEmbeddedWidthTier>(() =>
		enabled ? resolveMobileEmbeddedWidthTier(readViewportWidthPx()) : 'wide'
	);

	useEffect(() => {
		if (!enabled || typeof window === 'undefined') return;

		const update = () => {
			setTier(resolveMobileEmbeddedWidthTier(readViewportWidthPx()));
		};

		update();
		window.addEventListener('resize', update);
		window.visualViewport?.addEventListener('resize', update);
		return () => {
			window.removeEventListener('resize', update);
			window.visualViewport?.removeEventListener('resize', update);
		};
	}, [enabled]);

	return tier;
}
