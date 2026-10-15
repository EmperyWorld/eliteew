import { useEffect, useRef, useCallback } from 'react';
import { log } from '../utils/logger';

// ============= TYPE DEFINITIONS =============

interface PerformanceData {
	renderStart: number;
	componentMounts: number;
	memoryUsage: number;
}

interface PerformanceMetrics {
	memoryUsage: number;
	renderCount: number;
	lastRenderTime: number;
}

type PerformanceWithMemory = Performance & {
	memory?: { usedJSHeapSize: number };
};

// ============= CUSTOM HOOK =============

export function usePerformance(
	onMetricsUpdate?: (metrics: PerformanceMetrics) => void
) {
	const performanceData = useRef<PerformanceData>({
		renderStart: Date.now(),
		componentMounts: 0,
		memoryUsage: 0,
	});

	const renderCountRef = useRef(0);

	// Update memory usage
	const updateMemoryUsage = useCallback(() => {
		if ('memory' in performance) {
			const memory = (performance as PerformanceWithMemory).memory;
			if (memory) {
				performanceData.current.memoryUsage = memory.usedJSHeapSize / 1048576; // Convert to MB
			}

			if (onMetricsUpdate) {
				onMetricsUpdate({
					memoryUsage: performanceData.current.memoryUsage,
					renderCount: renderCountRef.current,
					lastRenderTime: Date.now(),
				});
			}
		}
	}, [onMetricsUpdate]);

	// Track component mount
	const trackMount = useCallback(() => {
		performanceData.current.componentMounts += 1;
		renderCountRef.current += 1;
	}, []);

	// Get current metrics
	const getMetrics = useCallback((): PerformanceMetrics => {
		return {
			memoryUsage: performanceData.current.memoryUsage,
			renderCount: renderCountRef.current,
			lastRenderTime: Date.now(),
		};
	}, []);

	// Monitor memory usage periodically
	// ✅ OPTIMIZATION: Опциональный мониторинг - только если есть callback
	// Это предотвращает создание интервалов, когда мониторинг не нужен
	useEffect(() => {
		if (!onMetricsUpdate) {
			// Если нет callback - не создаем интервал (экономия ресурсов)
			return;
		}

		// Initial check
		updateMemoryUsage();

		// ✅ OPTIMIZATION: Увеличиваем интервал до 30 секунд для снижения нагрузки
		const interval = setInterval(updateMemoryUsage, 30000);

		return () => {
			clearInterval(interval);
		};
	}, [updateMemoryUsage, onMetricsUpdate]);

	// Track renders
	useEffect(() => {
		trackMount();
	}, [trackMount]);

	return {
		performanceData: performanceData.current,
		getMetrics,
		updateMemoryUsage,
	};
}

// ============= PERFORMANCE UTILITIES =============

/**
 * Measure the execution time of a function
 */
export function measureExecutionTime<T>(name: string, fn: () => T): T {
	const start = performance.now();
	const result = fn();
	const end = performance.now();

	if (import.meta.env.DEV) {
		log.info('usePerformance', `⏱️ ${name} took ${(end - start).toFixed(2)}ms`);
	}

	return result;
}

/**
 * Measure the execution time of an async function
 */
export async function measureAsyncExecutionTime<T>(
	name: string,
	fn: () => Promise<T>
): Promise<T> {
	const start = performance.now();
	const result = await fn();
	const end = performance.now();

	if (import.meta.env.DEV) {
		log.info('usePerformance', `⏱️ ${name} took ${(end - start).toFixed(2)}ms`);
	}

	return result;
}

/**
 * Get current memory usage (if available)
 */
export function getMemoryUsage(): number {
	if ('memory' in performance) {
		const memory = (performance as PerformanceWithMemory).memory;
		if (memory) {
			return memory.usedJSHeapSize / 1048576; // Convert to MB
		}
	}
	return 0;
}

/**
 * Log performance mark
 */
export function markPerformance(name: string): void {
	if (performance.mark) {
		performance.mark(name);
	}
}

/**
 * Measure performance between two marks
 */
export function measurePerformance(
	name: string,
	startMark: string,
	endMark: string
): void {
	if (performance.measure) {
		try {
			performance.measure(name, startMark, endMark);
			const measure = performance.getEntriesByName(name)[0];
			if (
				import.meta.env.DEV &&
				measure &&
				'duration' in measure &&
				typeof measure.duration === 'number'
			) {
				log.info(
					'usePerformance',
					`⏱️ ${name}: ${measure.duration.toFixed(2)}ms`
				);
			}
		} catch (error) {
			log.error(
				'usePerformance',
				'Performance measurement failed',
				error instanceof Error ? error : undefined,
				error
			);
		}
	}
}

export type { PerformanceData, PerformanceMetrics };
