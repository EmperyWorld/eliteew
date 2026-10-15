/**
 * useDebounce Hook
 * Debounces a value to prevent excessive updates
 *
 * @version 1.0.0
 * @date 2025-10-24
 */

import { useState, useEffect } from 'react';

/**
 * Debounces a value by delaying updates
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(handler);
		};
	}, [value, delay]);

	return debouncedValue;
}

/**
 * Debounces a callback function
 *
 * @param callback - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: never[]) => unknown>(
	callback: T,
	delay: number
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return function debounced(...args: Parameters<T>) {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		timeoutId = setTimeout(() => {
			callback(...args);
		}, delay);
	};
}

/**
 * Throttles a callback function
 * Ensures function is called at most once per specified interval
 *
 * @param callback - Function to throttle
 * @param limit - Minimum time between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: never[]) => unknown>(
	callback: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle = false;

	return function throttled(...args: Parameters<T>) {
		if (!inThrottle) {
			callback(...args);
			inThrottle = true;
			setTimeout(() => {
				inThrottle = false;
			}, limit);
		}
	};
}

export default useDebounce;
