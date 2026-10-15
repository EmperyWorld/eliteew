/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared browser-side maintenance window store for API interceptors, Socket.IO events, and React UI.
 *
 * Invariants:
 * - Planned maintenance is distinct from auth errors and stale bundle reloads.
 * - One global store prevents repeated toasts/retry storms across API and Socket.IO layers.
 * - ``fetchMaintenanceStatus`` is single-flight: early prefetch, recovery probes, and
 *   MaintenanceProvider share one HTTP GET; stale-within-window callers reuse last success.
 *
 * Related:
 * - `contexts/MaintenanceContext.tsx`
 * - `services/api/client.ts`
 * - `services/communication/EmperyworldSocketService.ts`
 */

export type MaintenancePhase =
	| 'scheduled'
	| 'warning'
	| 'draining'
	| 'active'
	| 'recovering'
	| 'completed'
	| 'cancelled';

export type MaintenanceKind =
	| 'stack0_restart'
	| 'frontend_deploy'
	| 'api_restart'
	| 'workers_restart'
	| 'full_maintenance'
	| 'emergency';

export type MaintenanceWindow = {
	id: string;
	kind: MaintenanceKind;
	phase: MaintenancePhase;
	active: boolean;
	starts_at?: string | null;
	expected_ends_at?: string | null;
	notice_before_seconds: number;
	retry_after_seconds: number;
	title: string;
	message: string;
	affected_services: string[];
	user_impact: string;
	suppress_error_toasts: boolean;
	block_new_long_jobs: boolean;
	allow_operator_bypass: boolean;
	updated_at?: string | null;
	source?: string | null;
	metadata?: Record<string, unknown>;
};

export type MaintenanceStatus = {
	active: boolean;
	window: MaintenanceWindow | null;
};

type MaintenanceListener = (status: MaintenanceStatus) => void;

const ACTIVE_PHASES = new Set<MaintenancePhase>([
	'scheduled',
	'warning',
	'draining',
	'active',
	'recovering',
]);

const GATE_PHASES = new Set<MaintenancePhase>(['draining', 'active']);

const DEFAULT_STATUS: MaintenanceStatus = {
	active: false,
	window: null,
};

let currentStatus: MaintenanceStatus = DEFAULT_STATUS;
const listeners = new Set<MaintenanceListener>();

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object'
		? (value as Record<string, unknown>)
		: null;
}

function asString(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string');
}

export function normalizeMaintenanceStatus(
	payload: unknown
): MaintenanceStatus {
	const root = asRecord(payload);
	if (!root) return DEFAULT_STATUS;
	const rawWindow = asRecord(root.window) ?? root;
	if (!rawWindow) return DEFAULT_STATUS;

	const phase = asString(rawWindow.phase, 'completed') as MaintenancePhase;
	const active = asBoolean(root.active, asBoolean(rawWindow.active, false));
	const isTerminalPhase = phase === 'completed' || phase === 'cancelled';
	if (!active && !ACTIVE_PHASES.has(phase) && !isTerminalPhase) {
		return DEFAULT_STATUS;
	}

	const window: MaintenanceWindow = {
		id: asString(rawWindow.id, `maintenance-${Date.now()}`),
		kind: asString(rawWindow.kind, 'stack0_restart') as MaintenanceKind,
		phase,
		active: active && ACTIVE_PHASES.has(phase),
		starts_at: asString(rawWindow.starts_at, '') || null,
		expected_ends_at: asString(rawWindow.expected_ends_at, '') || null,
		notice_before_seconds: asNumber(rawWindow.notice_before_seconds, 300),
		retry_after_seconds: asNumber(rawWindow.retry_after_seconds, 60),
		title: asString(rawWindow.title, 'EliteEW обновляет среду'),
		message: asString(
			rawWindow.message,
			'Связь с сервером временно прервана. Окна и данные сохранены.'
		),
		affected_services: asStringArray(rawWindow.affected_services),
		user_impact: asString(
			rawWindow.user_impact,
			'Вкладку можно оставить открытой.'
		),
		suppress_error_toasts: asBoolean(rawWindow.suppress_error_toasts, true),
		block_new_long_jobs: asBoolean(rawWindow.block_new_long_jobs, true),
		allow_operator_bypass: asBoolean(rawWindow.allow_operator_bypass, false),
		updated_at: asString(rawWindow.updated_at, '') || null,
		source: asString(rawWindow.source, '') || null,
		metadata: asRecord(rawWindow.metadata) ?? {},
	};

	return {
		active: window.active,
		window: window.active || isTerminalPhase ? window : null,
	};
}

export function isMaintenanceGatePhase(status: MaintenanceStatus): boolean {
	return Boolean(status.window?.active && GATE_PHASES.has(status.window.phase));
}

export function getCurrentMaintenanceStatus(): MaintenanceStatus {
	return currentStatus;
}

export function subscribeMaintenanceStatus(
	listener: MaintenanceListener
): () => void {
	listeners.add(listener);
	listener(currentStatus);
	return () => {
		listeners.delete(listener);
	};
}

export function publishMaintenanceStatus(payload: unknown): MaintenanceStatus {
	const next = normalizeMaintenanceStatus(payload);
	currentStatus = next;
	for (const listener of listeners) {
		listener(next);
	}
	return next;
}

export function clearMaintenanceStatus(): MaintenanceStatus {
	currentStatus = DEFAULT_STATUS;
	for (const listener of listeners) {
		listener(currentStatus);
	}
	return currentStatus;
}

let maintenanceFetchInflight: Promise<MaintenanceStatus> | null = null;
let lastSuccessfulFetchAtMs = 0;
let lastSuccessfulStatus: MaintenanceStatus = DEFAULT_STATUS;

/** Age of the last successful maintenance API response (0 = never). */
export function getMaintenanceLastFetchedAtMs(): number {
	return lastSuccessfulFetchAtMs;
}

/**
 * GET `/api/v1/system/maintenance` with in-flight coalescing.
 * Early bootstrap, recovery probes, and MaintenanceProvider must share one HTTP GET.
 */
export async function fetchMaintenanceStatus(): Promise<MaintenanceStatus> {
	if (maintenanceFetchInflight) {
		return maintenanceFetchInflight;
	}
	maintenanceFetchInflight = (async () => {
		const response = await fetch(`/api/v1/system/maintenance?t=${Date.now()}`, {
			cache: 'no-store',
		});
		if (response.status >= 500) {
			throw new Error(`maintenance API unavailable: ${response.status}`);
		}
		if (!response.ok) {
			lastSuccessfulFetchAtMs = Date.now();
			lastSuccessfulStatus = DEFAULT_STATUS;
			return DEFAULT_STATUS;
		}
		const next = normalizeMaintenanceStatus(await response.json());
		lastSuccessfulFetchAtMs = Date.now();
		lastSuccessfulStatus = next;
		return next;
	})().finally(() => {
		maintenanceFetchInflight = null;
	});
	return maintenanceFetchInflight;
}

/**
 * Prefer a recent successful response (or in-flight coalesce) over a new GET.
 * Used when bootstrap prefetch and Recovery/Provider race within the same second.
 */
export async function fetchMaintenanceStatusIfStale(
	maxAgeMs: number
): Promise<MaintenanceStatus> {
	if (maintenanceFetchInflight) {
		return maintenanceFetchInflight;
	}
	if (
		lastSuccessfulFetchAtMs > 0 &&
		Date.now() - lastSuccessfulFetchAtMs < maxAgeMs
	) {
		return lastSuccessfulStatus;
	}
	return fetchMaintenanceStatus();
}

export async function fetchStaticMaintenanceStatus(): Promise<MaintenanceStatus> {
	const response = await fetch(`/maintenance-state.json?t=${Date.now()}`, {
		cache: 'no-store',
	});
	if (!response.ok) return DEFAULT_STATUS;
	return normalizeMaintenanceStatus(await response.json());
}

export function maintenanceStatusFromHttpError(
	errorData: unknown
): MaintenanceStatus {
	const root = asRecord(errorData);
	if (!root) return DEFAULT_STATUS;
	if (root.code !== 'maintenance' && root.error !== 'maintenance') {
		return DEFAULT_STATUS;
	}
	return normalizeMaintenanceStatus({
		active: true,
		window: root.window ?? {
			id: asString(root.window_id, `maintenance-${Date.now()}`),
			phase: asString(root.phase, 'active'),
			retry_after_seconds: asNumber(root.retry_after, 60),
			title: asString(root.title, 'EliteEW обновляет среду'),
			message: asString(
				root.detail,
				'Безраздельный мир скоро восстановит связь.'
			),
			active: true,
		},
	});
}

export function createUnplannedMaintenanceStatus(
	source: string,
	retryAfterSeconds = 60
): MaintenanceStatus {
	return normalizeMaintenanceStatus({
		active: true,
		window: {
			id: `unplanned-${source}`,
			kind: 'emergency',
			phase: 'active',
			active: true,
			retry_after_seconds: retryAfterSeconds,
			title: 'EliteEW восстанавливает связь',
			message: 'Связь с сервером временно прервана. Окна и данные сохранены.',
			affected_services: ['Безраздельный мир', 'Связь'],
			user_impact: 'Вкладку можно оставить открытой.',
			suppress_error_toasts: true,
			block_new_long_jobs: true,
			allow_operator_bypass: false,
			source,
		},
	});
}
