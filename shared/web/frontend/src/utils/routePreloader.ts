/**
 * Route Preloading Utility
 *
 * Implements intelligent route preloading strategies:
 * 1. Hover-triggered prefetch (loads route on hover)
 * 2. Idle prefetch (loads during browser idle time)
 * 3. Visible prefetch (loads when link is in viewport)
 *
 * Performance Benefits:
 * - Faster perceived navigation (routes pre-loaded before click)
 * - Better UX (instant page transitions)
 * - Optimized bandwidth usage (only preload likely routes)
 *
 * @version 1.0.0
 * @date 2025-10-13
 */

import type { PageType } from '../hooks/useAppState';
import { log } from '@utils/logger';

// Route component imports (lazy loaded)
const ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
	// Legacy dashboard hash routes (Elite Dashboard removed — preload UGS hub)
	'elite-dashboard-v3': () => import('../components/UGSDashboard'),
	dashboard: () => import('../components/UGSDashboard'),

	// Communication routes
	// Presentations: EWRP only
	'presentations-archive': () => import('../components/EWRP/EWRPGenerator'),
	presentations: () => import('../components/EWRP/EWRPGenerator'),
	ewrp: () => import('../components/EWRP/EWRPGenerator'),

	// Document routes
	'document-editor': () =>
		import('../components/UltimateDocEditor/UltimateDocEditor'),

	// System routes
	'unified-content': () => import('../pages/ContentManager/ContentManagerPro'),

	// Other routes
	'user-profile': () => import('../features/friends/components/SocialHubApp'),
};

// Cache to track preloaded routes
const preloadedRoutes = new Set<string>();

/**
 * Preload a specific route component
 *
 * @param route - The route to preload
 * @returns Promise that resolves when route is loaded
 */
export async function preloadRoute(route: PageType): Promise<void> {
	// Skip if already preloaded
	if (preloadedRoutes.has(route)) {
		return;
	}

	const loader = ROUTE_LOADERS[route];
	if (!loader) {
		log.warn('RoutePreloader', `No loader found for route: ${route}`);
		return;
	}

	try {
		log.info('RoutePreloader', `Preloading route: ${route}`);
		await loader();
		preloadedRoutes.add(route);
		log.info('RoutePreloader', `Successfully preloaded: ${route}`);
	} catch (error) {
		log.error(
			'RoutePreloader',
			`Failed to preload route ${route}`,
			error instanceof Error ? error : undefined,
			error
		);
	}
}

/**
 * Preload multiple routes
 *
 * @param routes - Array of routes to preload
 */
export async function preloadRoutes(routes: PageType[]): Promise<void> {
	await Promise.all(routes.map(preloadRoute));
}

/**
 * Preload critical routes during idle time
 *
 * This preloads common routes that users are likely to visit,
 * but only during browser idle time to avoid impacting performance.
 */
export function preloadCriticalRoutes(): void {
	const criticalRoutes: PageType[] = ['ugs'];

	// Use requestIdleCallback for better performance
	if ('requestIdleCallback' in window) {
		window.requestIdleCallback(
			() => {
				preloadRoutes(criticalRoutes);
			},
			{ timeout: 5000 }
		);
	} else {
		// Fallback for browsers without requestIdleCallback
		setTimeout(() => {
			preloadRoutes(criticalRoutes);
		}, 2000);
	}
}

/**
 * React hook for hover-triggered preloading
 *
 * Usage:
 * ```tsx
 * const handleHover = useRoutePreload('desktop');
 * <button onMouseEnter={handleHover}>Marketing Cabinet</button>
 * ```
 */
export function useRoutePreload(route: PageType): () => void {
	return () => {
		preloadRoute(route);
	};
}

/**
 * Preload a route when an element enters the viewport
 *
 * @param element - The element to observe
 * @param route - The route to preload when element is visible
 */
export function preloadOnVisible(element: HTMLElement, route: PageType): void {
	if (!('IntersectionObserver' in window)) {
		return;
	}

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					preloadRoute(route);
					observer.disconnect();
				}
			});
		},
		{ rootMargin: '50px' }
	);

	observer.observe(element);
}

/**
 * Get route preloading stats
 */
export function getPreloadStats() {
	return {
		totalRoutes: Object.keys(ROUTE_LOADERS).length,
		preloadedRoutes: preloadedRoutes.size,
		preloadedList: Array.from(preloadedRoutes),
		coverage: (preloadedRoutes.size / Object.keys(ROUTE_LOADERS).length) * 100,
	};
}

export default {
	preloadRoute,
	preloadRoutes,
	preloadCriticalRoutes,
	useRoutePreload,
	preloadOnVisible,
	getPreloadStats,
};
