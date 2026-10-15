// 🔥💎 HONEST MONITORING SERVICE - REAL DATA ONLY 💎🔥
// Честный сервис мониторинга без демо данных и заглушек - только правда!

import { BaseService, type ServiceResponse } from '../core/BaseService';
import { ServiceErrorFactory } from '../core/ServiceError';

// ============= MONITORING INTERFACES =============

/** Payload from GET /api/health (DatabaseManager summary). */
export interface ApiHealthSummary {
	status: string;
	message?: string;
	api_version?: string;
	timestamp: string;
	services: Record<string, string>;
	ecosystem_services?: number;
}

function mapHealthLineToServiceStatus(
	name: string,
	line: string,
	lastCheck: string
): ServiceStatus {
	const u = (line || '').toLowerCase();
	let health: ServiceStatus['health'] = 'unknown';
	let status: ServiceStatus['status'] = 'error';
	if (u === 'healthy' || u === 'up' || u === 'ok') {
		health = 'healthy';
		status = 'running';
	} else if (
		u === 'degraded' ||
		u === 'warning' ||
		u === 'partial' ||
		u === 'unknown'
	) {
		health = u === 'unknown' ? 'unknown' : 'warning';
		status = 'running';
	} else {
		health = 'unhealthy';
		status = 'stopped';
	}
	return {
		name,
		stack: 0,
		status,
		health,
		active: status === 'running',
		last_check: lastCheck,
	};
}

export interface SystemMetrics {
	system: {
		cpu: {
			usage_percent: number;
			cores: number;
			load_avg: number[];
			temperature?: number;
		};
		memory: {
			usage_percent: number;
			total_gb: number;
			used_gb: number;
			available_gb: number;
			swap_used_gb?: number;
			swap_total_gb?: number;
		};
		disk: {
			usage_percent: number;
			total_gb: number;
			used_gb: number;
			free_gb: number;
			io_read_bps?: number;
			io_write_bps?: number;
			io_operations_per_sec?: number;
		};
		network: {
			rx_bps: number;
			tx_bps: number;
			total_bps: number;
			connections_active: number;
			packets_per_sec?: number;
		};
		processes: {
			running: number;
			sleeping: number;
			blocked: number;
			zombie: number;
			total: number;
		};
		gpu?: {
			available: boolean;
			usage_percent: number;
			memory_usage_percent: number;
			memory_used_mb: number;
			memory_total_mb: number;
			temperature_c: number;
			power_watts: number;
			processes: Array<{
				pid: number;
				name: string;
				memory_mb: number;
				gpu_usage_percent: number;
			}>;
			// Component compatibility - both formats supported
			memory: {
				used: number;
				total: number;
			};
			// Alternative property names for component usage
			used_mb?: number;
			total_mb?: number;
		};
		uptime: {
			seconds: number;
			formatted: string;
			boot_time: string;
		};
	};
	docker: {
		containers_running: number;
		containers_total: number;
		containers_paused: number;
		containers_stopped: number;
		cpu_usage_percent: number;
		memory_usage_gb: number;
		images_total: number;
		volumes_total: number;
		networks_total: number;
		// Component compatibility - ensure these exist in system.docker
		running?: number;
		total?: number;
	};
	ai_services?: {
		llama: ServiceStatus;
		comfyui: ServiceStatus;
		localai: ServiceStatus;
		openwebui: ServiceStatus;
	};
	exporters_status: {
		node_exporter: 'up' | 'down' | 'unknown';
		dcgm_exporter: 'up' | 'down' | 'unknown';
		cadvisor: 'up' | 'down' | 'unknown';
		prometheus: 'up' | 'down' | 'unknown';
	};
	prometheus_health: {
		healthy: boolean;
		status: 'up' | 'down' | 'degraded';
		targets_up: number;
		targets_total: number;
		scrape_duration_ms: number;
	};
	data_source: 'prometheus' | 'direct' | 'fallback';
	timestamp: string;
	collection_time_ms: number;
}

export interface ServiceStatus {
	name: string;
	stack: number;
	status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping';
	health: 'healthy' | 'warning' | 'unhealthy' | 'unknown';
	cpu_percent?: number;
	memory_mb?: number;
	memory_percent?: number;
	active: boolean;
	response_time_ms?: number;
	endpoint?: string;
	port?: number;
	container_id?: string;
	image?: string;
	created_at?: string;
	uptime?: string;
	restart_count?: number;
	alerts_count?: number;
	last_check: string;
	metrics?: {
		requests_per_minute?: number;
		error_rate_percent?: number;
		avg_response_time_ms?: number;
		active_connections?: number;
	};
}

export interface DockerContainerStats {
	id: string;
	name: string;
	image: string;
	status: string;
	state:
		| 'running'
		| 'stopped'
		| 'paused'
		| 'restarting'
		| 'removing'
		| 'created'
		| 'exited';
	cpu_percent: number;
	memory_usage_mb: number;
	memory_limit_mb: number;
	memory_percent: number;
	network_rx_mb: number;
	network_tx_mb: number;
	disk_read_mb: number;
	disk_write_mb: number;
	created_at: string;
	started_at?: string;
	ports: Array<{
		private_port: number;
		public_port?: number;
		type: string;
	}>;
	labels: Record<string, string>;
	health?: 'healthy' | 'unhealthy' | 'starting' | 'none';
	restart_count: number;
	uptime?: string;
}

export interface AlertInfo {
	id: string;
	severity: 'info' | 'warning' | 'error' | 'critical';
	title: string;
	message: string;
	source: string;
	service?: string;
	stack?: number;
	timestamp: string;
	resolved: boolean;
	resolved_at?: string;
	metadata?: Record<string, unknown>;
	actions?: Array<{
		label: string;
		action: string;
		url?: string;
	}>;
}

export interface DashboardData {
	overview: {
		status: 'healthy' | 'warning' | 'error';
		total_services: number;
		healthy_services: number;
		warning_services: number;
		error_services: number;
		system_load: number;
		uptime: string;
	};
	quick_metrics: {
		cpu_usage: number;
		memory_usage: number;
		disk_usage: number;
		network_activity: number;
		active_alerts: number;
	};
	recent_alerts: AlertInfo[];
	top_processes: Array<{
		pid: number;
		name: string;
		cpu_percent: number;
		memory_mb: number;
	}>;
	service_summary: {
		by_stack: Record<
			string,
			{
				total: number;
				healthy: number;
				warning: number;
				error: number;
			}
		>;
		by_status: Record<string, number>;
	};
}

export interface ChartDataPoint {
	timestamp: string;
	value: number;
	label?: string;
}

export interface ChartData {
	metric: string;
	period: string;
	data_points: ChartDataPoint[];
	min_value: number;
	max_value: number;
	avg_value: number;
	unit: string;
	collected_at: string;
}

type ChartMetricKey = 'cpu' | 'memory' | 'disk' | 'network' | 'gpu';
type ChartPeriodKey = '1h' | '6h' | '24h' | '7d' | '30d';

export interface AIModelInfo {
	name: string;
	provider: 'llama' | 'comfyui' | 'localai' | 'openwebui';
	status: 'loaded' | 'unloaded' | 'loading' | 'error';
	size_gb: number;
	memory_usage_mb?: number;
	gpu_usage_percent?: number;
	last_used?: string;
	total_requests?: number;
	avg_response_time_ms?: number;
	model_type: string;
	description?: string;
}

// ============= MONITORING SERVICE =============

export class MonitoringService extends BaseService {
	constructor() {
		super('MONITORING');
	}

	protected getServiceName(): string {
		return 'MonitoringService';
	}

	public override async healthCheck(): Promise<
		ServiceResponse<{ status: string; timestamp: string }>
	> {
		return this.request('healthCheck', {
			method: 'GET',
			url: '/health',
			baseURL: '/api',
		});
	}

	// ============= CONFIGURATION METHODS =============

	// Get system configuration
	public async getSystemConfig(): Promise<
		ServiceResponse<Record<string, unknown>>
	> {
		return this.request<Record<string, unknown>>(
			'getSystemConfig',
			{
				method: 'GET',
				url: '/config',
			},
			{
				cacheable: true,
				cacheKey: 'system_config',
			}
		);
	}

	// Update system configuration
	public async updateSystemConfig(
		config: Record<string, unknown>
	): Promise<ServiceResponse<Record<string, unknown>>> {
		return this.request<Record<string, unknown>>('updateSystemConfig', {
			method: 'POST',
			url: '/config',
			data: config,
		});
	}

	// Get database status
	public async getDatabaseStatus(): Promise<
		ServiceResponse<{ connected: boolean; details?: unknown }>
	> {
		return this.request<{ connected: boolean; details?: unknown }>(
			'getDatabaseStatus',
			{
				method: 'GET',
				url: '/database/status',
			},
			{
				cacheable: true,
				cacheKey: 'database_status',
				retryable: true,
			}
		);
	}

	// ============= SYSTEM MONITORING =============

	// Get API health summary (legacy name: was full system metrics)
	public async getSystemMetrics(): Promise<ServiceResponse<ApiHealthSummary>> {
		return this.request<ApiHealthSummary>(
			'getSystemMetrics',
			{
				method: 'GET',
				url: '/health',
				baseURL: '/api',
			},
			{
				cacheable: true,
				cacheKey: 'system_metrics',
				retryable: true,
			}
		);
	}

	// Map DatabaseManager-backed /api/health.services into ServiceStatus rows
	public async getServicesStatus(): Promise<
		ServiceResponse<{ services: ServiceStatus[] }>
	> {
		const raw = await this.request<ApiHealthSummary>(
			'getServicesStatus',
			{
				method: 'GET',
				url: '/health',
				baseURL: '/api',
			},
			{
				cacheable: true,
				cacheKey: 'services_status',
				retryable: true,
			}
		);

		if (!raw.success || !raw.data) {
			return {
				success: raw.success,
				error: raw.error,
				message: raw.message,
				metadata: raw.metadata,
			};
		}

		const ts = raw.data.timestamp;
		const services = Object.entries(raw.data.services ?? {}).map(
			([name, line]) => mapHealthLineToServiceStatus(name, line, ts)
		);

		return {
			...raw,
			data: { services },
		};
	}

	// Get specific service status by name
	public async getServiceStatus(
		serviceName: string
	): Promise<ServiceResponse<ServiceStatus>> {
		return this.request<ServiceStatus>(
			'getServiceStatus',
			{
				method: 'GET',
				url: `/service/${serviceName}`,
			},
			{
				cacheable: true,
				cacheKey: `service_status_${serviceName}`,
				retryable: true,
			}
		);
	}

	// Get dashboard overview data
	public async getDashboardData(): Promise<ServiceResponse<DashboardData>> {
		return this.request<DashboardData>(
			'getDashboardData',
			{
				method: 'GET',
				url: '/dashboard',
			},
			{
				cacheable: true,
				cacheKey: 'dashboard_data',
				retryable: true,
			}
		);
	}

	// ============= DOCKER MONITORING =============

	// Get Docker container statistics
	public async getDockerStats(): Promise<
		ServiceResponse<{
			containers: DockerContainerStats[];
			summary: {
				total_containers: number;
				running_containers: number;
				stopped_containers: number;
				paused_containers: number;
				total_cpu_usage: number;
				total_memory_usage_mb: number;
				total_network_rx_mb: number;
				total_network_tx_mb: number;
			};
		}>
	> {
		return this.request(
			'getDockerStats',
			{
				method: 'GET',
				url: '/docker/stats',
			},
			{
				cacheable: true,
				cacheKey: 'docker_stats',
				retryable: true,
			}
		);
	}

	// Get specific container stats
	public async getContainerStats(
		containerId: string
	): Promise<ServiceResponse<DockerContainerStats>> {
		return this.request<DockerContainerStats>(
			'getContainerStats',
			{
				method: 'GET',
				url: `/docker/container/${containerId}/stats`,
			},
			{
				cacheable: true,
				cacheKey: `container_stats_${containerId}`,
				retryable: true,
			}
		);
	}

	// Restart container
	public async restartContainer(
		containerId: string
	): Promise<ServiceResponse<{ success: boolean }>> {
		return this.request<{ success: boolean }>(
			'restartContainer',
			{
				method: 'POST',
				url: `/docker/container/${containerId}/restart`,
			},
			{
				retryable: true,
				maxRetries: 1,
			}
		);
	}

	// Stop container
	public async stopContainer(
		containerId: string
	): Promise<ServiceResponse<{ success: boolean }>> {
		return this.request<{ success: boolean }>(
			'stopContainer',
			{
				method: 'POST',
				url: `/docker/container/${containerId}/stop`,
			},
			{
				retryable: true,
				maxRetries: 1,
			}
		);
	}

	// Start container
	public async startContainer(
		containerId: string
	): Promise<ServiceResponse<{ success: boolean }>> {
		return this.request<{ success: boolean }>(
			'startContainer',
			{
				method: 'POST',
				url: `/docker/container/${containerId}/start`,
			},
			{
				retryable: true,
				maxRetries: 1,
			}
		);
	}

	// ============= ALERTS & NOTIFICATIONS =============

	// Get alerts
	public async getAlerts(filter?: {
		severity?: string;
		resolved?: boolean;
		service?: string;
		limit?: number;
	}): Promise<
		ServiceResponse<{
			alerts: AlertInfo[];
			total: number;
			unresolved_count: number;
			critical_count: number;
		}>
	> {
		return this.request(
			'getAlerts',
			{
				method: 'GET',
				url: '/alerts',
				params: filter,
			},
			{
				cacheable: true,
				cacheKey: `alerts_${JSON.stringify(filter || {})}`,
				retryable: true,
			}
		);
	}

	// Acknowledge alert
	public async acknowledgeAlert(
		alertId: string
	): Promise<ServiceResponse<{ success: boolean }>> {
		return this.request<{ success: boolean }>('acknowledgeAlert', {
			method: 'POST',
			url: `/alerts/${alertId}/acknowledge`,
		});
	}

	// Resolve alert
	public async resolveAlert(
		alertId: string,
		resolution?: string
	): Promise<ServiceResponse<{ success: boolean }>> {
		return this.request<{ success: boolean }>('resolveAlert', {
			method: 'POST',
			url: `/alerts/${alertId}/resolve`,
			data: { resolution },
		});
	}

	// ============= METRICS & CHARTS =============

	// Get chart data for specific metric
	public async getChartData(
		metric: ChartMetricKey,
		period: ChartPeriodKey = '24h'
	): Promise<ServiceResponse<ChartData>> {
		return this.request<ChartData>(
			'getChartData',
			{
				method: 'GET',
				url: `/charts/${metric}`,
				params: { period },
			},
			{
				cacheable: true,
				cacheKey: `chart_data_${metric}_${period}`,
				retryable: true,
			}
		);
	}

	// Get multiple chart data sets
	public async getMultipleChartData(
		metrics: ChartMetricKey[],
		period: ChartPeriodKey = '24h'
	): Promise<ServiceResponse<Record<string, ChartData>>> {
		const promises = metrics.map((metric) =>
			this.getChartData(metric, period).then((result) => ({
				metric,
				result,
			}))
		);

		try {
			const results = await Promise.all(promises);
			const chartData: Record<string, ChartData> = {};

			results.forEach(({ metric, result }) => {
				if (result.success && result.data) {
					chartData[metric] = result.data;
				}
			});

			return {
				success: true,
				data: chartData,
				metadata: {
					requestId: this.generateRequestId(),
					timestamp: new Date().toISOString(),
					source: this.getServiceName(),
				},
			};
		} catch (error) {
			const serviceError = ServiceErrorFactory.networkError(
				this.getServiceName(),
				'getMultipleChartData',
				error as Error
			);

			return {
				success: false,
				error: serviceError,
				message: serviceError.getUserMessage(),
			};
		}
	}

	// ============= AI MODELS MONITORING =============

	// Get AI models status
	public async getAIModels(): Promise<
		ServiceResponse<{
			models: AIModelInfo[];
			summary: {
				total_models: number;
				loaded_models: number;
				total_memory_usage_mb: number;
				total_gpu_usage_percent: number;
			};
		}>
	> {
		return this.request(
			'getAIModels',
			{
				method: 'GET',
				url: '/ai-models',
			},
			{
				cacheable: true,
				cacheKey: 'ai_models_status',
				retryable: true,
			}
		);
	}

	// Load AI model
	public async loadAIModel(
		modelName: string,
		provider?: string
	): Promise<ServiceResponse<{ success: boolean }>> {
		return this.request<{ success: boolean }>(
			'loadAIModel',
			{
				method: 'POST',
				url: '/ai-models/load',
				data: { model_name: modelName, provider },
			},
			{
				retryable: true,
			}
		);
	}

	// Unload AI model
	public async unloadAIModel(
		modelName: string,
		provider?: string
	): Promise<ServiceResponse<{ success: boolean }>> {
		return this.request<{ success: boolean }>(
			'unloadAIModel',
			{
				method: 'POST',
				url: '/ai-models/unload',
				data: { model_name: modelName, provider },
			},
			{
				retryable: true,
			}
		);
	}

	// ============= PROMETHEUS INTEGRATION =============

	// Get Prometheus metrics
	public async getPrometheusMetrics(
		query: string
	): Promise<ServiceResponse<unknown>> {
		return this.request<unknown>(
			'getPrometheusMetrics',
			{
				method: 'GET',
				url: '/prometheus/query',
				params: { query },
			},
			{
				cacheable: true,
				cacheKey: `prometheus_${query}`,
				retryable: true,
			}
		);
	}

	// Get Prometheus health
	public async getPrometheusHealth(): Promise<
		ServiceResponse<{
			healthy: boolean;
			status: string;
			version?: string;
			uptime?: string;
		}>
	> {
		return this.request(
			'getPrometheusHealth',
			{
				method: 'GET',
				url: '/prometheus/health',
			},
			{
				cacheable: true,
				cacheKey: 'prometheus_health',
				retryable: true,
			}
		);
	}

	// ============= LOGS =============

	// Get service logs
	public async getServiceLogs(
		serviceName: string,
		options?: {
			lines?: number;
			since?: string;
			until?: string;
			follow?: boolean;
		}
	): Promise<
		ServiceResponse<{
			logs: Array<{
				timestamp: string;
				level: string;
				message: string;
				source?: string;
			}>;
			total_lines: number;
		}>
	> {
		return this.request(
			'getServiceLogs',
			{
				method: 'GET',
				url: `/logs/${serviceName}`,
				params: options,
			},
			{
				retryable: true,
			}
		);
	}

	// ============= HEALTH CHECKS =============

	// Comprehensive health check
	public async performHealthCheck(): Promise<
		ServiceResponse<{
			status: 'healthy' | 'degraded' | 'unhealthy';
			checks: Array<{
				name: string;
				status: 'pass' | 'fail' | 'warn';
				duration_ms: number;
				message?: string;
			}>;
			timestamp: string;
			overall_score: number;
		}>
	> {
		return this.request(
			'performHealthCheck',
			{
				method: 'GET',
				url: '/health/comprehensive',
			},
			{
				retryable: true,
			}
		);
	}

	// Test connectivity to external services
	public async testConnectivity(): Promise<
		ServiceResponse<{
			tests: Array<{
				service: string;
				endpoint: string;
				status: 'connected' | 'failed' | 'timeout';
				response_time_ms?: number;
				error?: string;
			}>;
			overall_status: 'all_connected' | 'partial_failures' | 'major_failures';
		}>
	> {
		return this.request(
			'testConnectivity',
			{
				method: 'POST',
				url: '/health/connectivity',
			},
			{
				retryable: true,
				maxRetries: 1,
			}
		);
	}

	// ============= UTILITY METHODS =============

	// generateRequestId inherited from BaseService

	// Get monitoring configuration
	public async getMonitoringConfig(): Promise<
		ServiceResponse<{
			update_intervals: Record<string, number>;
			retention_periods: Record<string, string>;
			alert_thresholds: Record<string, number>;
			enabled_exporters: string[];
		}>
	> {
		return this.request(
			'getMonitoringConfig',
			{
				method: 'GET',
				url: '/config',
			},
			{
				cacheable: true,
				cacheKey: 'monitoring_config',
				retryable: true,
			}
		);
	}

	// Update monitoring configuration
	public async updateMonitoringConfig(
		config: Record<string, unknown>
	): Promise<ServiceResponse<{ success: boolean }>> {
		return this.request<{ success: boolean }>('updateMonitoringConfig', {
			method: 'PUT',
			url: '/config',
			data: config,
		});
	}
}

// Create singleton instance
const monitoringService = new MonitoringService();

export default monitoringService;
