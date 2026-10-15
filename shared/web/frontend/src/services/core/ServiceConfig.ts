import { log } from '../../utils/logger';
import { apiClient } from '../api/client';

export interface EndpointConfig {
	baseUrl: string;
	endpoints: Record<string, string>;
	stack?: StackType;
	timeout?: number;
	retryAttempts?: number;
	retryDelay?: number;
}

export interface ServiceConfig {
	serviceName: string;
	version: string;
	environment: 'development' | 'staging' | 'production';

	// Network configuration
	endpoints: EndpointConfig;

	// Authentication
	requiresAuth: boolean;

	// Performance settings
	timeout: number;
	retryAttempts: number;
	retryDelay: number;

	// Caching
	cacheEnabled: boolean;
	cacheTtl: number;

	// Logging
	logLevel: 'debug' | 'info' | 'warn' | 'error';
	enableRequestLogging: boolean;

	// Feature flags
	features: Record<string, boolean>;
}

export enum StackType {
	ELITEEW = 0,
	DATABASES = 1,
	AI_SERVICES = 2,
	DEVOPS = 3,
	DOCUMENTS = 4,
	COMMUNICATION = 5,
	DEPLOYMENT = 6,
}

export interface StackEndpoints {
	stack0: string; // EliteEW Core (29000-29099)
	stack1: string; // Databases (30000-30099)
	stack2: string; // AI Services (31000-31099)
	stack3: string; // DevOps (32000-32099)
	stack4: string; // Documents (33000-33099)
	stack5: string; // Communication (34000-34099)
	stack6: string; // Deployment (35000-35099)
}

// Unified ecosystem configuration
export interface UnifiedEcosystemConfig {
	stacks: StackEndpoints;
	apiVersion: string;
	environment: string;
	baseUrl: string;
	websocketUrl: string;

	// Authentication (refresh = MobileAndroid path; SPA uses Keycloak OIDC)
	authEndpoints: {
		refresh: string;
		logout: string;
	};

	// Core services
	coreEndpoints: {
		monitoring: string;
		emperyworld: string;
	};
}

// Default configurations for each service type
export const DEFAULT_SERVICE_CONFIG: Partial<ServiceConfig> = {
	version: '4.0',
	environment: 'development',
	timeout: 10000, // 10 seconds (optimized from 30s)
	retryAttempts: 3,
	retryDelay: 1000,
	cacheEnabled: true,
	cacheTtl: 300000, // 5 minutes
	logLevel: 'info',
	enableRequestLogging: true,
	requiresAuth: true,
};

// Service-specific configurations
export const SERVICE_CONFIGS = {
	API: {
		...DEFAULT_SERVICE_CONFIG,
		serviceName: 'ApiService',
		endpoints: {
			baseUrl: '/api',
			endpoints: {
				health: '/health',
				config: '/config',
				status: '/status',
			},
			stack: StackType.ELITEEW,
			timeout: 5000,
		},
		requiresAuth: true, // 💎 SSO - все запросы требуют авторизации
	},

	// AUTH service config retired with AuthService (soft-trash). Mobile refresh path:
	// services/auth/mobileAuthRefreshPath.ts → POST /api/auth/refresh.

	MONITORING: {
		...DEFAULT_SERVICE_CONFIG,
		serviceName: 'MonitoringService',
		endpoints: {
			baseUrl: '/api/monitoring',
			endpoints: {
				system: '/system',
				services: '/services',
				dashboard: '/dashboard',
				docker: '/docker/stats',
				alerts: '/alerts',
				health: '/health',
				charts: '/charts',
				aiModels: '/ai-models',
			},
			stack: StackType.ELITEEW,
			timeout: 10000,
		},
		cacheEnabled: true,
		cacheTtl: 30000, // 30 seconds for monitoring data
	},

	EMPERYWORLD: {
		...DEFAULT_SERVICE_CONFIG,
		serviceName: 'EmperyworldService',
		endpoints: {
			baseUrl: '/api/emperyworld',
			endpoints: {
				stats: '/stats',
				projects: '/projects',
				gallery: '/gallery',
				members: '/members',
				activity: '/activity',
				achievements: '/achievements',
				mood: '/mood',
				events: '/events',
			},
			stack: StackType.ELITEEW,
			timeout: 10000,
		},
	},

	WEBSOCKET: {
		...DEFAULT_SERVICE_CONFIG,
		serviceName: 'EmperyworldSocketService',
		endpoints: {
			baseUrl: '/',
			endpoints: {
				main: '/socket.io/',
				monitoring: '/api/monitoring/',
			},
			stack: StackType.ELITEEW,
			timeout: 20000,
		},
		requiresAuth: true,
		retryAttempts: 10, // More retries for Socket.IO
		retryDelay: 2000,
		features: {
			reconnect: true,
			heartbeat: true,
			compression: true,
		},
	},
} as const;

// Helper function to get service config
export function getServiceConfig(
	serviceName: keyof typeof SERVICE_CONFIGS
): ServiceConfig {
	log.debug(
		'ServiceConfig',
		`Getting config for service: ${String(serviceName)}`
	);

	const config = SERVICE_CONFIGS[serviceName];
	if (!config) {
		const availableServices = Object.keys(SERVICE_CONFIGS);
		log.error(
			'ServiceConfig',
			`Unknown service: ${String(serviceName)}`,
			new Error(`Available services: ${availableServices.join(', ')}`)
		);
		throw new Error(`Unknown service: ${serviceName}`);
	}

	log.debug('ServiceConfig', `Raw config for ${String(serviceName)}`, {
		hasEndpoints: !!config.endpoints,
		endpointsType: typeof config.endpoints,
		endpointsBaseUrl: config.endpoints?.baseUrl,
	});

	const mergedConfig = {
		...DEFAULT_SERVICE_CONFIG,
		...config,
		features: config.features || {},
	} as ServiceConfig;

	// Validation: ensure endpoints exist and is properly structured
	if (!mergedConfig.endpoints) {
		const error = new Error(
			`Service ${serviceName} missing endpoints configuration`
		);
		log.error('ServiceConfig', 'Endpoints validation failed', error);
		throw error;
	}

	if (!mergedConfig.endpoints.baseUrl) {
		const error = new Error(`Service ${serviceName} missing endpoints.baseUrl`);
		log.error('ServiceConfig', 'BaseUrl validation failed', error);
		throw error;
	}

	log.info('ServiceConfig', `Configuration loaded for ${serviceName}`, {
		serviceName: mergedConfig.serviceName,
		endpointsBaseUrl: mergedConfig.endpoints.baseUrl,
		environment: mergedConfig.environment,
		timeout: mergedConfig.timeout,
	});

	return mergedConfig;
}

// Helper function to build full URL
export function buildEndpointUrl(
	config: EndpointConfig,
	endpoint: string
): string {
	const endpointPath = config.endpoints[endpoint];
	if (!endpointPath) {
		throw new Error(`Unknown endpoint: ${endpoint} for service`);
	}

	return `${config.baseUrl}${endpointPath}`;
}

// Environment detection
export function detectEnvironment(): 'development' | 'staging' | 'production' {
	if (typeof window !== 'undefined') {
		const hostname = window.location.hostname;
		if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
			return 'development';
		}
		if (hostname.includes('staging')) {
			return 'staging';
		}
	}
	return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

// Get unified ecosystem configuration
export async function getUnifiedConfig(): Promise<UnifiedEcosystemConfig> {
	try {
		log.info('ServiceConfig', 'Loading unified ecosystem configuration');

		// First try to fetch from API
		try {
			const { data } = await apiClient.get<UnifiedEcosystemConfig>(
				'/api/config/unified'
			);
			if (data) {
				log.info('ServiceConfig', 'Unified configuration loaded from API');
				return data;
			}
		} catch (apiError) {
			log.warn(
				'ServiceConfig',
				'Failed to fetch config from API, using fallback',
				apiError
			);
		}

		// Fallback to environment-based configuration
		const environment = detectEnvironment();
		const isProduction = environment === 'production';

		// Dynamic stack endpoints based on environment
		const isTauri =
			typeof window !== 'undefined' &&
			(window.location.protocol === 'tauri:' ||
				(window as Window & { __TAURI__?: unknown }).__TAURI__ !== undefined);
		const externalBaseUrl = (() => {
			const url = import.meta.env.VITE_API_URL || 'https://app.eliteew.ru';
			return url.startsWith('http://')
				? url.replace('http://', 'https://')
				: url;
		})();

		const getStackEndpoint = (
			stackId: number,
			_defaultPort: number
		): string => {
			if (isProduction) {
				// In production, use environment variables or service discovery
				const envVar = `STACK${stackId}_URL`;
				const envUrl =
					typeof window !== 'undefined'
						? (
								window as Window & {
									__ELITE_CONFIG__?: Record<string, string>;
								}
							).__ELITE_CONFIG__?.[envVar]
						: process.env[envVar];
				if (envUrl) {
					return envUrl;
				}

				// Production fallback - use current host with calculated ports
				const protocol = window?.location?.protocol || 'https:';
				const hostname = window?.location?.hostname || 'app.eliteew.ru';
				return `${protocol}//${hostname}:${29000 + stackId * 1000}`;
			}

			// Development: use localhost with stack-specific ports
			return `http://localhost:${29000 + stackId * 1000}`;
		};

		const config: UnifiedEcosystemConfig = {
			stacks: {
				stack0: getStackEndpoint(0, 29000), // EliteEW Core
				stack1: getStackEndpoint(1, 30000), // Databases
				stack2: getStackEndpoint(2, 31000), // AI Services
				stack3: getStackEndpoint(3, 32000), // DevOps
				stack4: getStackEndpoint(4, 33000), // Documents
				stack5: getStackEndpoint(5, 34000), // Communication
				stack6: getStackEndpoint(6, 35000), // Deployment
			},
			apiVersion: '4.0',
			environment,
			baseUrl: isTauri ? `${externalBaseUrl}/api` : '/api',
			// Socket.IO path (not legacy raw `/ws` FastAPI echo — soft-retired 2026-07-28).
			websocketUrl: isTauri
				? import.meta.env.VITE_WS_URL || 'wss://app.eliteew.ru'
				: window?.location?.origin || '/',
			authEndpoints: {
				// refresh: MobileAndroid only (see mobileAuthRefreshPath.ts); not SPA OIDC.
				refresh: '/api/auth/refresh',
				logout: '/api/auth/logout',
			},
			coreEndpoints: {
				monitoring: '/api/monitoring',
				emperyworld: '/api/emperyworld',
			},
		};

		log.info('ServiceConfig', 'Fallback configuration created', {
			environment,
			stacksCount: Object.keys(config.stacks).length,
		});

		return config;
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		log.error(
			'ServiceConfig',
			'Failed to load unified configuration',
			error instanceof Error ? error : new Error(message)
		);
		throw new Error(`Failed to load unified configuration: ${message}`);
	}
}
