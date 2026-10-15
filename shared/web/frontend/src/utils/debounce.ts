/**
 * Native debounce implementation
 * Replaces lodash debounce
 */

export interface DebouncedFunction<T extends (...args: never[]) => unknown> {
	(...args: Parameters<T>): void;
	cancel: () => void;
	flush: () => void;
}

export function debounce<T extends (...args: never[]) => unknown>(
	func: T,
	wait: number
): DebouncedFunction<T> {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let lastArgs: Parameters<T> | null = null;

	const debounced = (...args: Parameters<T>): void => {
		lastArgs = args;

		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		timeoutId = setTimeout(() => {
			if (lastArgs) {
				func(...lastArgs);
				lastArgs = null;
			}
			timeoutId = null;
		}, wait);
	};

	debounced.cancel = (): void => {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
			lastArgs = null;
		}
	};

	debounced.flush = (): void => {
		if (timeoutId && lastArgs) {
			clearTimeout(timeoutId);
			func(...lastArgs);
			timeoutId = null;
			lastArgs = null;
		}
	};

	return debounced;
}

export default debounce;
