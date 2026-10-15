/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Responsive breakpoints for Professional Worlds shell (sidebar density).
 *
 * Invariants:
 * - Wraps `useDesktopSurfaceLayout` with PW-specific width thresholds.
 *
 * Related:
 * - ProfessionalWorldsRuntimeShell.tsx
 */

import { useDesktopSurfaceLayout } from '@/pages/Desktop/hooks/useDesktopSurfaceLayout';

export function useProfessionalWorldsSurfaceLayout() {
	return useDesktopSurfaceLayout({
		compactWidth: 960,
		compactHeight: 640,
		denseWidth: 1100,
		denseHeight: 720,
	});
}
