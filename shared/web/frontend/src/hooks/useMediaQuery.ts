/**
 * 🎯 useMediaQuery Hook - React UI God Edition
 *
 * Production-ready responsive hook for media query matching
 *
 * Features:
 * - Server-side rendering safe
 * - Automatic cleanup
 * - TypeScript type-safe
 * - Performance optimized
 * - Supports all CSS media queries
 *
 * @version 1.0.0
 * @author React UI God
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
 * const isLandscape = useMediaQuery('(orientation: landscape)');
 * ```
 */

import { useState, useEffect } from 'react';

/**
 * Hook to match CSS media queries
 *
 * @param query - CSS media query string (e.g., '(max-width: 768px)')
 * @param defaultValue - Default value for SSR (default: false)
 * @returns Boolean indicating if the media query matches
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
	// Initialize with defaultValue for SSR compatibility
	const [matches, setMatches] = useState<boolean>(() => {
		// Check if we're in browser environment
		if (typeof window === 'undefined') {
			return defaultValue;
		}
		return window.matchMedia(query).matches;
	});

	useEffect(() => {
		// Skip if not in browser
		if (typeof window === 'undefined') {
			return;
		}

		const mediaQueryList = window.matchMedia(query);

		// Update state with current match
		setMatches(mediaQueryList.matches);

		// Define event handler
		const handleChange = (event: MediaQueryListEvent) => {
			setMatches(event.matches);
		};

		// Add listener
		// Use addEventListener for modern browsers
		if (mediaQueryList.addEventListener) {
			mediaQueryList.addEventListener('change', handleChange);
		} else {
			// Fallback for older browsers
			mediaQueryList.addListener(handleChange);
		}

		// Cleanup
		return () => {
			if (mediaQueryList.removeEventListener) {
				mediaQueryList.removeEventListener('change', handleChange);
			} else {
				// Fallback for older browsers
				mediaQueryList.removeListener(handleChange);
			}
		};
	}, [query]);

	return matches;
}

/**
 * Hook to check if device prefers dark mode
 */
export function usePrefersDarkMode(): boolean {
	return useMediaQuery('(prefers-color-scheme: dark)');
}

/**
 * Hook to check if device prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
	return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Hook to check device orientation
 */
export function useOrientation(): 'portrait' | 'landscape' {
	const isLandscape = useMediaQuery('(orientation: landscape)');
	return isLandscape ? 'landscape' : 'portrait';
}

/**
 * Hook to check if device is touch-enabled
 */
export function useIsTouchDevice(): boolean {
	const [isTouch, setIsTouch] = useState(false);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		setIsTouch(
			'ontouchstart' in window ||
				navigator.maxTouchPoints > 0 ||
				// @ts-expect-error - Legacy IE support
				navigator.msMaxTouchPoints > 0
		);
	}, []);

	return isTouch;
}

export default useMediaQuery;
