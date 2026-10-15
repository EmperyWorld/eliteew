import { useState } from 'react';
import { log } from '../utils/logger';

/**
 * Custom hook for managing localStorage with React state
 * @param key - The localStorage key
 * @param initialValue - The initial value if key doesn't exist
 * @returns [value, setValue] tuple
 */
export function useLocalStorage<T>(
	key: string,
	initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
	// Get initial value from localStorage or use provided initial value
	const [storedValue, setStoredValue] = useState<T>(() => {
		try {
			const item = window.localStorage.getItem(key);
			return item ? JSON.parse(item) : initialValue;
		} catch (error) {
			log.warn(
				'useLocalStorage',
				`Error reading localStorage key "${key}"`,
				error
			);
			return initialValue;
		}
	});

	// Update localStorage when state changes
	const setValue = (value: T | ((prev: T) => T)) => {
		try {
			const valueToStore =
				value instanceof Function ? value(storedValue) : value;
			setStoredValue(valueToStore);
			window.localStorage.setItem(key, JSON.stringify(valueToStore));
		} catch (error) {
			log.warn(
				'useLocalStorage',
				`Error setting localStorage key "${key}"`,
				error
			);
		}
	};

	return [storedValue, setValue];
}
