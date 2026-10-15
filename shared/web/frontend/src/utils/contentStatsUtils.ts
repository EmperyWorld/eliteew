/**
 * Utility functions for Content Statistics Dashboard
 */

/**
 * Format bytes to human-readable string
 */
export const formatBytes = (bytes: number): string => {
	if (bytes === 0) {
		return '0 B';
	}
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

/**
 * Get relative time string from timestamp
 */
export const getRelativeTime = (timestamp: string): string => {
	const now = new Date();
	const time = new Date(timestamp);
	const diffInMs = now.getTime() - time.getTime();
	const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
	const diffInHours = Math.floor(diffInMinutes / 60);
	const diffInDays = Math.floor(diffInHours / 24);

	if (diffInMinutes < 1) {
		return 'только что';
	}
	if (diffInMinutes < 60) {
		return `${diffInMinutes} минут назад`;
	}
	if (diffInHours < 24) {
		return `${diffInHours} часов назад`;
	}
	return `${diffInDays} дней назад`;
};

/**
 * Storage limit constants
 */
export const STORAGE_LIMIT_GB = 10;
export const STORAGE_LIMIT_BYTES = STORAGE_LIMIT_GB * 1024 * 1024 * 1024;
export const RECENT_ACTIVITY_LIMIT = 5;
