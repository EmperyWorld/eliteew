/**
 * @fileoverview Services Registry - Centralized Service Access
 *
 * @role Service Layer Organization
 *   - Primary responsibility: Central registry for all application services
 *   - Used by: All components requiring service access
 *   - Services: API, Auth, Monitoring, Empery World socket
 *
 * @architecture
 *   - Layer: Service Layer / Registry Pattern
 *   - Pattern: Singleton registry with type-safe access
 *   - Integration: All backend services, WebSocket connections
 *
 * @status
 *   - TypeScript errors fixed: 4 (removed dead imports from non-existent modules)
 *   - Last audit: 2025-10-23 - Agent 1 (API Hooks & Services)
 */

// ============= TYPE EXPORTS ONLY =============
// Экспортируем ТОЛЬКО типы для TypeScript - никаких классов!

export type { BaseService, ServiceResponse } from './core/BaseService';
export type { ServiceConfig, StackType } from './core/ServiceConfig';
export type {
	ServiceError,
	ServiceErrorSeverity,
	ServiceErrorType,
} from './core/ServiceError';
export type { LogLevel, ServiceLogger } from './core/ServiceLogger';

// API Service types
export type {
	EcosystemConfig,
	EcosystemHealth,
	GenerateImageRequest,
	GenerateTextRequest,
	GenerationTask,
	ServiceHealthStatus,
} from './api/ApiService';

// Auth / profile DTO types (session runtime: keycloak.ts / AuthContext)
export type {
	AuthEvent,
	AuthStatus,
	AuthTokens,
	LoginCredentials,
	LoginResponse,
	RegisterData,
	User,
} from './auth/userTypes';

// Monitoring Service types
export type {
	AIModelInfo,
	AlertInfo,
	ApiHealthSummary,
	ChartData,
	ChartDataPoint,
	DashboardData,
	DockerContainerStats,
	ServiceStatus,
	SystemMetrics,
} from './monitoring/MonitoringService';

// Socket Service types
export type {
	AIGenerationProgress,
	EmperyworldMessage,
	CreativeCollaboration,
	DocumentOperation,
	NotificationEvent,
} from './communication/EmperyworldSocketService';

// ============= PERFECT SERVICES REGISTRY =============
// ЕДИНСТВЕННЫЙ способ доступа к services - никакой халтуры!

// Import service instances
import { log } from '../utils/logger';
import apiService from './api/ApiService';
import emperyworldService from './api/EmperyworldService';
import emperyworldSocket from './communication/EmperyworldSocketService';
import monitoringService from './monitoring/MonitoringService';

/** Keys checked by {@link Services.healthCheckAll} (api, monitoring). */
export const SERVICES_HEALTH_CHECK_KEYS = ['api', 'monitoring'] as const;

// PERFECT Services Registry - ЕДИНСТВЕННАЯ точка доступа
type ServicesType = {
	api: typeof apiService;
	emperyworld: typeof emperyworldService;
	monitoring: typeof monitoringService;
	socket: typeof emperyworldSocket;
	getService<T>(serviceName: keyof ServicesType): T;
	healthCheckAll(): Promise<Record<string, boolean>>;
	getPerformanceMetrics(): Record<string, unknown>;
	clearAllCaches(): void;
	connectToEcosystem(): Promise<{
		connected: boolean;
		services: Record<string, boolean>;
		socket_connected: boolean;
	}>;
};

export const Services: ServicesType = {
	// Core API services
	api: apiService,
	emperyworld: emperyworldService,
	monitoring: monitoringService,

	// Communication
	socket: emperyworldSocket,

	// ============= ECOSYSTEM MANAGEMENT =============

	// Get service by name with type safety
	getService<T>(serviceName: keyof ServicesType): T {
		const service = Services[serviceName];
		if (!service) {
			throw new Error(`❌ СЕРВИС '${String(serviceName)}' НЕ НАЙДЕН! ❌`);
		}
		return service as T;
	},

	// Health check all services
	async healthCheckAll(): Promise<Record<string, boolean>> {
		const services = SERVICES_HEALTH_CHECK_KEYS;
		const results: Record<string, boolean> = {};

		await Promise.all(
			services.map(async (serviceName) => {
				try {
					const service = Services[serviceName] as {
						healthCheck?: () => Promise<{ success: boolean }>;
					};
					if (service.healthCheck) {
						const result = await service.healthCheck();
						results[serviceName] = result.success;
					} else {
						results[serviceName] = true; // Assume healthy if no health check
					}
				} catch (error) {
					log.error(
						'Services',
						`Health check failed for ${serviceName}`,
						error instanceof Error ? error : undefined,
						error
					);
					results[serviceName] = false;
				}
			})
		);

		return results;
	},

	// Get performance metrics from all services
	getPerformanceMetrics(): Record<string, unknown> {
		const metrics: Record<string, unknown> = {};

		Object.entries(Services).forEach(([name, service]) => {
			if (typeof service === 'object' && service !== null) {
				try {
					// Cache stats
					if (
						'getCacheStats' in service &&
						typeof service.getCacheStats === 'function'
					) {
						metrics[`${name}_cache`] = service.getCacheStats();
					}

					// Performance metrics
					if (
						'getPerformanceMetrics' in service &&
						typeof service.getPerformanceMetrics === 'function'
					) {
						metrics[`${name}_performance`] = service.getPerformanceMetrics();
					}
				} catch (_error) {
					// Silent fail for metrics collection
				}
			}
		});

		return metrics;
	},

	// Clear all service caches
	clearAllCaches(): void {
		Object.values(Services).forEach((service) => {
			if (
				typeof service === 'object' &&
				service !== null &&
				'clearCache' in service
			) {
				try {
					(service as { clearCache?: () => void }).clearCache?.();
				} catch (_error) {
					// Silent fail for cache clearing
				}
			}
		});
	},

	// Connect to entire ecosystem
	async connectToEcosystem(): Promise<{
		connected: boolean;
		services: Record<string, boolean>;
		socket_connected: boolean;
	}> {
		const results = {
			connected: false,
			services: {} as Record<string, boolean>,
			socket_connected: false,
		};

		// Check all service connections
		const healthResults = await this.healthCheckAll();
		results.services = healthResults;

		// Check socket connection
		try {
			if (!this.socket.isConnected()) {
				// Socket connection is optional
			} else {
				results.socket_connected = true;
			}
		} catch (_error) {
			results.socket_connected = false;
		}

		// Determine overall connection status (70% services healthy)
		const servicesHealthy = Object.values(healthResults).filter(Boolean).length;
		const totalServices = Object.keys(healthResults).length;
		results.connected = servicesHealthy >= Math.ceil(totalServices * 0.7);

		return results;
	},
};

// ============= UTILITY FUNCTIONS =============

/**
 * Legacy no-op: AuthService init removed; SPA OIDC boots via authBootstrap.
 * Kept for any external import sites; returns empty success.
 */
export async function initializeServices(): Promise<{
	success: boolean;
	initializedServices: string[];
	failedServices: string[];
	errors: Record<string, string>;
}> {
	return {
		success: true,
		initializedServices: [],
		failedServices: [],
		errors: {},
	};
}

// Component logger helper
export function getComponentLogger(componentName: string) {
	// Import the function directly
	const { getServiceLogger } = require('./core/ServiceLogger');
	return getServiceLogger(`Component:${componentName}`);
}

// Service configuration helper
export function createServiceConfig() {
	return {
		// Get all service endpoints
		getEndpoints: () => ({
			api: '/api',
			auth: '/api/auth',
			monitoring: '/api/monitoring',
			socket: '/socket.io',
		}),

		// Get service health endpoints
		getHealthEndpoints: () => ({
			api: '/api/health',
			auth: '/api/auth/status',
			monitoring: '/api/health',
		}),

		// Check if service is available
		async isServiceAvailable(
			serviceName: keyof typeof Services
		): Promise<boolean> {
			try {
				const service = Services[serviceName] as {
					healthCheck?: () => Promise<{ success: boolean }>;
				};
				if (service.healthCheck) {
					const result = await service.healthCheck();
					return result.success;
				}
				return true;
			} catch {
				return false;
			}
		},
	};
}

// ============= DEFAULT EXPORT =============
// Services registry - ЕДИНСТВЕННЫЙ export объекта!
export default Services;

/*

ЭТО PERFECT ARCHITECTURE:
✅ ТОЛЬКО Services registry - единый способ доступа
✅ ТОЛЬКО типы экспортированы для TypeScript
✅ Никаких дублирующих экспортов классов
✅ Tree-shaking готовность
✅ Consistent developer experience
✅ Production-ready качество

ИСПОЛЬЗУЙ ТОЛЬКО ТАК:
import { Services } from '../services';
import { log } from "../utils/logger";
const data = await Services.monitoring.getSystemMetrics(); // GET /api/health

*/
