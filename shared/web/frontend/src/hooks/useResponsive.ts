/**
 * 🎯 useResponsive Hook - React UI God Edition
 *
 * Production-ready responsive breakpoint hook
 *
 * Features:
 * - Tailwind CSS breakpoints aligned
 * - Multiple device detection
 * - Current breakpoint tracking
 * - TypeScript type-safe
 * - Performance optimized
 *
 * @version 1.0.0
 * @author React UI God
 *
 * @example
 * ```tsx
 * const { isMobile, isTablet, isDesktop, isWidescreen, currentBreakpoint } = useResponsive();
 *
 * if (isMobile) {
 *   return <MobileLayout />;
 * }
 * ```
 */

import { useEffect, useMemo, useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

/**
 * Breakpoint values matching Tailwind CSS defaults
 */
export const BREAKPOINTS = {
	xs: 475, // Extra small devices
	sm: 640, // Small devices (phones)
	md: 768, // Medium devices (tablets)
	lg: 1024, // Large devices (laptops)
	xl: 1280, // Extra large devices (desktops)
	'2xl': 1536, // 2X large devices (large desktops)
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export interface ResponsiveState {
	/** Extra small devices (< 475px) */
	isXs: boolean;
	/** Small devices (≥ 640px) */
	isSm: boolean;
	/** Medium devices (≥ 768px) */
	isMd: boolean;
	/** Large devices (≥ 1024px) */
	isLg: boolean;
	/** Extra large devices (≥ 1280px) */
	isXl: boolean;
	/** 2X large devices (≥ 1536px) */
	is2xl: boolean;

	/** Mobile devices (< 768px) */
	isMobile: boolean;
	/** Tablet devices (768px - 1023px) */
	isTablet: boolean;
	/** Desktop devices (≥ 1024px) */
	isDesktop: boolean;
	/** Widescreen devices (≥ 1536px) */
	isWidescreen: boolean;

	/** Current breakpoint name */
	currentBreakpoint: Breakpoint | 'xs';

	/** Utility to check if current breakpoint is at or above given breakpoint */
	isAtLeast: (breakpoint: Breakpoint) => boolean;
	/** Utility to check if current breakpoint is below given breakpoint */
	isBelow: (breakpoint: Breakpoint) => boolean;
}

/**
 * Hook to get responsive breakpoint information
 *
 * @returns ResponsiveState object with device type flags and utilities
 */
export function useResponsive(): ResponsiveState {
	// Individual breakpoint checks
	const isXs = !useMediaQuery(`(min-width: ${BREAKPOINTS.xs}px)`);
	const isSm = useMediaQuery(`(min-width: ${BREAKPOINTS.sm}px)`);
	const isMd = useMediaQuery(`(min-width: ${BREAKPOINTS.md}px)`);
	const isLg = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
	const isXl = useMediaQuery(`(min-width: ${BREAKPOINTS.xl}px)`);
	const is2xl = useMediaQuery(`(min-width: ${BREAKPOINTS['2xl']}px)`);

	// Device type categories
	const isMobile = !isMd;
	const isTablet = isMd && !isLg;
	const isDesktop = isLg;
	const isWidescreen = is2xl;

	// Determine current breakpoint
	const currentBreakpoint: Breakpoint | 'xs' = useMemo(() => {
		if (is2xl) {
			return '2xl';
		}
		if (isXl) {
			return 'xl';
		}
		if (isLg) {
			return 'lg';
		}
		if (isMd) {
			return 'md';
		}
		if (isSm) {
			return 'sm';
		}
		return 'xs';
	}, [is2xl, isXl, isLg, isMd, isSm]);

	// Utility functions
	const isAtLeast = useMemo(
		() => (breakpoint: Breakpoint) => {
			const breakpointOrder: (Breakpoint | 'xs')[] = [
				'xs',
				'sm',
				'md',
				'lg',
				'xl',
				'2xl',
			];
			const currentIndex = breakpointOrder.indexOf(currentBreakpoint);
			const targetIndex = breakpointOrder.indexOf(breakpoint);
			return currentIndex >= targetIndex;
		},
		[currentBreakpoint]
	);

	const isBelow = useMemo(
		() => (breakpoint: Breakpoint) => {
			const breakpointOrder: (Breakpoint | 'xs')[] = [
				'xs',
				'sm',
				'md',
				'lg',
				'xl',
				'2xl',
			];
			const currentIndex = breakpointOrder.indexOf(currentBreakpoint);
			const targetIndex = breakpointOrder.indexOf(breakpoint);
			return currentIndex < targetIndex;
		},
		[currentBreakpoint]
	);

	return {
		// Individual breakpoints
		isXs,
		isSm,
		isMd,
		isLg,
		isXl,
		is2xl,

		// Device categories
		isMobile,
		isTablet,
		isDesktop,
		isWidescreen,

		// Current state
		currentBreakpoint,

		// Utilities
		isAtLeast,
		isBelow,
	};
}

/**
 * Hook to check if viewport is at or above a specific breakpoint
 *
 * @example
 * ```tsx
 * const isLargeScreen = useBreakpoint('lg'); // true if ≥ 1024px
 * ```
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
	return useMediaQuery(`(min-width: ${BREAKPOINTS[breakpoint]}px)`);
}

/**
 * Hook to get current viewport width
 *
 * @example
 * ```tsx
 * const width = useViewportWidth();
 * ```
 */
export function useViewportWidth(): number {
	const [width, setWidth] = useState(() => {
		if (typeof window === 'undefined') {
			return 0;
		}
		return window.innerWidth;
	});

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const handleResize = () => setWidth(window.innerWidth);

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	return width;
}

/**
 * Hook to get current viewport height
 *
 * @example
 * ```tsx
 * const height = useViewportHeight();
 * ```
 */
export function useViewportHeight(): number {
	const [height, setHeight] = useState(() => {
		if (typeof window === 'undefined') {
			return 0;
		}
		return window.innerHeight;
	});

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const handleResize = () => setHeight(window.innerHeight);

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	return height;
}

export default useResponsive;
