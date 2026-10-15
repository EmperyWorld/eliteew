export const isBrowserEnvironment = typeof window !== 'undefined';

export const readJsonStorage = <T>(key: string, defaultValue: T): T => {
	if (!isBrowserEnvironment) {
		return defaultValue;
	}

	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) {
			return defaultValue;
		}
		return JSON.parse(raw) as T;
	} catch {
		return defaultValue;
	}
};

export const writeJsonStorage = <T>(key: string, value: T): void => {
	if (!isBrowserEnvironment) {
		return;
	}

	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// ignore quota / access errors
	}
};

export const removeStorageItem = (key: string): void => {
	if (!isBrowserEnvironment) {
		return;
	}

	try {
		window.localStorage.removeItem(key);
	} catch {
		// ignore
	}
};
