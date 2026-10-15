import { apiClient } from './api';

export type SimpleHealthStatus = 'ok' | 'error';

export interface ApiDatabaseStatus {
	api: SimpleHealthStatus;
	db: SimpleHealthStatus;
}

export const fetchApiDatabaseStatus = async (): Promise<ApiDatabaseStatus> => {
	const [apiResponse, dbResponse] = await Promise.all([
		apiClient.get('/api/health'),
		apiClient.get('/api/database/health'),
	]);

	const apiStatusCode = (apiResponse as { status?: number }).status ?? 200;
	const dbStatusCode = (dbResponse as { status?: number }).status ?? 200;

	return {
		api: apiStatusCode >= 200 && apiStatusCode < 300 ? 'ok' : 'error',
		db: dbStatusCode >= 200 && dbStatusCode < 300 ? 'ok' : 'error',
	};
};

export interface DatabaseStatus {
	status?: string;
	uptime_percent?: number;
	response_time_ms?: number;
}

export interface EcosystemData {
	api?: DatabaseStatus;
	databases?: {
		postgresql?: DatabaseStatus;
		redis?: DatabaseStatus;
		elasticsearch?: DatabaseStatus;
	};
	ai_services?: {
		llama?: DatabaseStatus;
		[key: string]: DatabaseStatus | undefined;
	};
	services?: {
		[key: string]: DatabaseStatus;
	};
}

type ApiHealthPayload = {
	status?: string;
	services?: Record<string, string>;
};

/** Maps consolidated GET /api/health (DatabaseManager summary) into widget-friendly shape. */
export const fetchEcosystemHealth = async (): Promise<EcosystemData> => {
	const response = await apiClient.get<ApiHealthPayload>('/api/health');
	const payload = response.data;
	const svc = payload.services ?? {};
	const mapSvc = (keys: string[]): DatabaseStatus | undefined => {
		for (const k of keys) {
			const s = svc[k];
			if (s != null && s !== '') {
				return {
					status: s === 'healthy' || s === 'ok' ? 'healthy' : 'degraded',
				};
			}
		}
		return undefined;
	};
	const overall = payload.status === 'healthy' ? 'healthy' : 'degraded';
	return {
		api: { status: overall },
		databases: {
			postgresql: mapSvc(['postgres', 'postgresql', 'PostgreSQL']),
			redis: mapSvc(['redis', 'Redis']),
			elasticsearch: mapSvc(['elasticsearch', 'Elasticsearch']),
		},
	};
};
