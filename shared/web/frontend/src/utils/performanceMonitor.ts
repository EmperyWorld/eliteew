/**
 * Extended Performance Monitoring Dashboard
 *
 * Provides comprehensive performance tracking beyond Web Vitals:
 * - Bundle loading metrics
 * - Route transition timing
 * - Memory usage tracking
 * - Long tasks detection
 * - Resource loading waterfall
 *
 * @version 1.0.0
 * @date 2025-10-13
 */

import { log } from '@utils/logger';

export interface PerformanceMetrics {
	// Page Load Metrics
	domContentLoaded: number;
	loadComplete: number;
	firstPaint: number;
	firstContentfulPaint: number;
	timeToInteractive: number;

	// Resource Metrics
	totalResources: number;
	jsSize: number;
	cssSize: number;
	imageSize: number;
	fontSize: number;

	// Navigation Timing
	dnsLookup: number;
	tcpConnection: number;
	serverResponse: number;
	downloadTime: number;

	// Memory (if available)
	jsHeapSize?: number;
	jsHeapLimit?: number;
	totalJSHeapSize?: number;
	usedJSHeapSize?: number;

	// Long Tasks
	longTasksCount: number;
	totalBlockingTime: number;

	// Custom Metrics
	routeTransitionTime?: number;
	bundleLoadTime: Record<string, number>;
}

export interface RouteTransition {
	from: string;
	to: string;
	duration: number;
	timestamp: number;
}

class PerformanceMonitor {
	private metrics: Partial<PerformanceMetrics> = {};
	private routeTransitions: RouteTransition[] = [];
	private longTaskObserver: PerformanceObserver | null = null;
	private resourceObserver: PerformanceObserver | null = null;

	constructor() {
		this.initializeObservers();
	}

	/**
	 * Initialize Performance Observers
	 */
	private initializeObservers(): void {
		// Long Tasks Observer (detect tasks > 50ms)
		if ('PerformanceObserver' in window) {
			try {
				this.longTaskObserver = new PerformanceObserver((list) => {
					const entries = list.getEntries();
					entries.forEach((entry) => {
						if (entry.duration > 50) {
							this.metrics.longTasksCount =
								(this.metrics.longTasksCount || 0) + 1;
							this.metrics.totalBlockingTime =
								(this.metrics.totalBlockingTime || 0) + entry.duration;

							log.warn(
								'PerformanceMonitor',
								`Long Task Detected: ${entry.duration.toFixed(2)}ms`,
								entry
							);
						}
					});
				});

				this.longTaskObserver.observe({ entryTypes: ['longtask'] });
			} catch {
				// Long task observer not supported
			}

			// Resource Observer (track resource loading)
			try {
				this.resourceObserver = new PerformanceObserver((list) => {
					this.processResourceEntries(
						list.getEntries() as PerformanceResourceTiming[]
					);
				});

				this.resourceObserver.observe({ entryTypes: ['resource'] });
			} catch {
				// Resource observer not supported
			}
		}
	}

	/**
	 * Process resource timing entries
	 */
	private processResourceEntries(entries: PerformanceResourceTiming[]): void {
		entries.forEach((entry) => {
			const size = entry.transferSize || 0;

			if (entry.name.includes('.js')) {
				this.metrics.jsSize = (this.metrics.jsSize || 0) + size;
			} else if (entry.name.includes('.css')) {
				this.metrics.cssSize = (this.metrics.cssSize || 0) + size;
			} else if (entry.name.match(/\.(png|jpg|jpeg|gif|webp|avif|svg)$/i)) {
				this.metrics.imageSize = (this.metrics.imageSize || 0) + size;
			} else if (entry.name.match(/\.(woff|woff2|ttf|eot)$/i)) {
				this.metrics.fontSize = (this.metrics.fontSize || 0) + size;
			}
		});

		this.metrics.totalResources =
			(this.metrics.totalResources || 0) + entries.length;
	}

	/**
	 * Collect page load metrics
	 */
	public collectPageLoadMetrics(): Partial<PerformanceMetrics> {
		if (!('performance' in window)) {
			return {};
		}

		const navigation = performance.getEntriesByType(
			'navigation'
		)[0] as PerformanceNavigationTiming;
		const paint = performance.getEntriesByType('paint');

		if (navigation) {
			this.metrics.domContentLoaded =
				navigation.domContentLoadedEventEnd - navigation.fetchStart;
			this.metrics.loadComplete =
				navigation.loadEventEnd - navigation.fetchStart;
			this.metrics.dnsLookup =
				navigation.domainLookupEnd - navigation.domainLookupStart;
			this.metrics.tcpConnection =
				navigation.connectEnd - navigation.connectStart;
			this.metrics.serverResponse =
				navigation.responseEnd - navigation.requestStart;
			this.metrics.downloadTime =
				navigation.responseEnd - navigation.responseStart;
		}

		paint.forEach((entry) => {
			if (entry.name === 'first-paint') {
				this.metrics.firstPaint = entry.startTime;
			} else if (entry.name === 'first-contentful-paint') {
				this.metrics.firstContentfulPaint = entry.startTime;
			}
		});

		return this.metrics;
	}

	/**
	 * Collect memory metrics (Chrome only)
	 */
	public collectMemoryMetrics(): Partial<PerformanceMetrics> {
		if ('memory' in performance) {
			const memory = (
				performance as Performance & {
					memory?: {
						jsHeapSizeLimit?: number;
						totalJSHeapSize?: number;
						usedJSHeapSize?: number;
					};
				}
			).memory;
			if (memory) {
				this.metrics.jsHeapSize = memory.jsHeapSizeLimit;
				this.metrics.jsHeapLimit = memory.jsHeapSizeLimit;
				this.metrics.totalJSHeapSize = memory.totalJSHeapSize;
				this.metrics.usedJSHeapSize = memory.usedJSHeapSize;
			}
		}

		return this.metrics;
	}

	/**
	 * Track route transition timing
	 */
	public trackRouteTransition(
		from: string,
		to: string,
		duration: number
	): void {
		this.routeTransitions.push({
			from,
			to,
			duration,
			timestamp: Date.now(),
		});

		// Keep only last 50 transitions
		if (this.routeTransitions.length > 50) {
			this.routeTransitions = this.routeTransitions.slice(-50);
		}

		log.info(
			'PerformanceMonitor',
			`Route transition: ${from} → ${to} (${duration.toFixed(2)}ms)`
		);
	}

	/**
	 * Get average route transition time
	 */
	public getAverageRouteTransition(): number {
		if (this.routeTransitions.length === 0) {
			return 0;
		}

		const total = this.routeTransitions.reduce((sum, t) => sum + t.duration, 0);
		return total / this.routeTransitions.length;
	}

	/**
	 * Track bundle load time
	 */
	public trackBundleLoad(bundleName: string, duration: number): void {
		if (!this.metrics.bundleLoadTime) {
			this.metrics.bundleLoadTime = {};
		}

		this.metrics.bundleLoadTime[bundleName] = duration;
		log.info(
			'PerformanceMonitor',
			`Bundle loaded: ${bundleName} (${duration.toFixed(2)}ms)`
		);
	}

	/**
	 * Get all performance metrics
	 */
	public getAllMetrics(): PerformanceMetrics {
		this.collectPageLoadMetrics();
		this.collectMemoryMetrics();

		return this.metrics as PerformanceMetrics;
	}

	/**
	 * Get performance summary report
	 */
	public getPerformanceSummary(): string {
		const metrics = this.getAllMetrics();
		const avgTransition = this.getAverageRouteTransition();

		return `
📊 Performance Summary
======================

Page Load:
  - DOM Content Loaded: ${(metrics.domContentLoaded || 0).toFixed(2)}ms
  - Load Complete: ${(metrics.loadComplete || 0).toFixed(2)}ms
  - FCP: ${(metrics.firstContentfulPaint || 0).toFixed(2)}ms

Resources:
  - Total: ${metrics.totalResources || 0} files
  - JS Size: ${((metrics.jsSize || 0) / 1024).toFixed(2)} KB
  - CSS Size: ${((metrics.cssSize || 0) / 1024).toFixed(2)} KB
  - Images: ${((metrics.imageSize || 0) / 1024).toFixed(2)} KB

Performance:
  - Long Tasks: ${metrics.longTasksCount || 0}
  - Total Blocking Time: ${(metrics.totalBlockingTime || 0).toFixed(2)}ms
  - Avg Route Transition: ${avgTransition.toFixed(2)}ms

Memory (Chrome):
  - Used JS Heap: ${((metrics.usedJSHeapSize || 0) / 1024 / 1024).toFixed(2)} MB
  - Total JS Heap: ${((metrics.totalJSHeapSize || 0) / 1024 / 1024).toFixed(2)} MB
  - Heap Limit: ${((metrics.jsHeapLimit || 0) / 1024 / 1024).toFixed(2)} MB
    `.trim();
	}

	/**
	 * Log performance summary to console
	 */
	public logSummary(): void {
		console.groupCollapsed('📊 Performance Summary');
		log.info('PerformanceMonitor', this.getPerformanceSummary());
		console.groupEnd();
	}

	/**
	 * Export metrics as JSON
	 */
	public exportMetrics(): object {
		return {
			metrics: this.getAllMetrics(),
			routeTransitions: this.routeTransitions,
			averageRouteTransition: this.getAverageRouteTransition(),
			timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Cleanup observers
	 */
	public cleanup(): void {
		if (this.longTaskObserver) {
			this.longTaskObserver.disconnect();
		}
		if (this.resourceObserver) {
			this.resourceObserver.disconnect();
		}
	}
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null;

/**
 * Get or create performance monitor instance
 */
export function getPerformanceMonitor(): PerformanceMonitor {
	if (!performanceMonitor) {
		performanceMonitor = new PerformanceMonitor();
	}
	return performanceMonitor;
}

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring(): PerformanceMonitor {
	const monitor = getPerformanceMonitor();

	// Log summary after page load
	if (typeof window !== 'undefined') {
		window.addEventListener('load', () => {
			setTimeout(() => {
				monitor.logSummary();
			}, 1000);
		});
	}

	log.info('PerformanceMonitor', 'Performance monitoring initialized');
	return monitor;
}

export default {
	getPerformanceMonitor,
	initPerformanceMonitoring,
};
