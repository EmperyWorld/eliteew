/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Opt-in Performance panel marks/measures for desktop Socket.IO → React Query
 * invalidation → refetch (Cluster B/C investigation). Zero work when disabled.
 *
 * Invariants:
 * - No marks/measures/subscriptions unless `window.isPerfMode` (or persisted flag) is on.
 * - Telemetry must not alter socket payloads, invalidation keys, or reconnect policy.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md
 * - services/communication/EmperyworldSocketService.ts
 * - pages/Desktop/context/GAFChatProvider.tsx
 */

import type { QueryClient, QueryKey } from '@tanstack/react-query';

export const DESKTOP_REALTIME_PERF_MODE_STORAGE_KEY =
	'eliteew_desktop_realtime_perf_mode';

export const DESKTOP_REALTIME_PERF_MODE_CHANGE_EVENT =
	'eliteew-desktop-realtime-perf-mode-change';

const GAF_QUERY_ROOT = 'gaf-chat';

declare global {
	interface Window {
		/** Opt-in DevTools Performance marks for desktop realtime investigation. */
		isPerfMode?: boolean;
		/** Enable/disable perf marks; mirrors Settings → Performance toggle. */
		__eliteewSetPerfMode?: (enabled: boolean) => void;
		/**
		 * Chaos monkey: synthetic GAF socket storm for Cluster B (O(E×C)).
		 * Requires isPerfMode. Returns a stop function.
		 */
		__eliteewDesktopSocketStorm?: (
			options?: DesktopSocketStormOptions
		) => () => void;
	}
}

export type DesktopSocketStormOptions = {
	/** Target event rate (default 80). */
	eventsPerSecond?: number;
	/** How long to run (default 3000 ms). */
	durationMs?: number;
	/** Socket event name (default `gaf_chat.message_new`). */
	eventType?: string;
	/** Rotate chat_id across these ids (default 8 synthetic ids). */
	chatIds?: string[];
};

type PerfEmitFn = (eventType: string, data: unknown) => void;

let queryClientRef: QueryClient | null = null;
let queryCacheUnsub: (() => void) | null = null;
let invalidationStartMs: number | null = null;
const refetchStarts = new Map<string, number>();
let consoleApiInstalled = false;
let stormEmitFn: PerfEmitFn | null = null;

function canUsePerformanceApi(): boolean {
	return (
		typeof performance !== 'undefined' &&
		typeof performance.mark === 'function' &&
		typeof performance.measure === 'function' &&
		typeof performance.now === 'function'
	);
}

function readPersistedPerfMode(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		const raw = window.localStorage.getItem(
			DESKTOP_REALTIME_PERF_MODE_STORAGE_KEY
		);
		if (raw == null) return false;
		const normalized = raw.trim().toLowerCase();
		return (
			normalized === '1' ||
			normalized === 'true' ||
			normalized === 'on' ||
			normalized === 'yes'
		);
	} catch {
		return false;
	}
}

/** True only when operator enabled investigation mode (window or localStorage). */
export function isDesktopRealtimePerfMode(): boolean {
	if (typeof window === 'undefined') return false;
	if (window.isPerfMode === true) return true;
	if (window.isPerfMode === false) return false;
	return readPersistedPerfMode();
}

function syncQueryCacheSubscription(): void {
	if (queryCacheUnsub) {
		queryCacheUnsub();
		queryCacheUnsub = null;
	}
	refetchStarts.clear();
	if (!isDesktopRealtimePerfMode() || !queryClientRef) return;

	const cache = queryClientRef.getQueryCache();
	queryCacheUnsub = cache.subscribe((event) => {
		if (!isDesktopRealtimePerfMode() || !event) return;
		if (event.type !== 'updated') return;
		const key = event.query.queryKey;
		if (!isGafChatRootKey(key)) return;
		const hash = event.query.queryHash;
		const actionType = event.action.type;
		if (actionType === 'fetch') {
			markNetworkRefetchStart(hash);
			return;
		}
		if (actionType === 'success' || actionType === 'error') {
			markNetworkRefetchEnd(hash);
		}
	});
}

function persistPerfMode(enabled: boolean): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(
			DESKTOP_REALTIME_PERF_MODE_STORAGE_KEY,
			enabled ? '1' : '0'
		);
	} catch {
		/* ignore */
	}
}

export function setDesktopRealtimePerfMode(enabled: boolean): void {
	if (typeof window === 'undefined') return;
	window.isPerfMode = enabled;
	persistPerfMode(enabled);
	syncQueryCacheSubscription();
	try {
		window.dispatchEvent(
			new CustomEvent(DESKTOP_REALTIME_PERF_MODE_CHANGE_EVENT, {
				detail: { enabled },
			})
		);
	} catch {
		/* ignore */
	}
}

function isGafChatRootKey(key: QueryKey): boolean {
	return Array.isArray(key) && key[0] === GAF_QUERY_ROOT;
}

function safeMark(name: string): void {
	if (!canUsePerformanceApi()) return;
	try {
		performance.mark(name);
	} catch {
		/* ignore duplicate/quota */
	}
}

function safeMeasure(
	name: string,
	startMs: number,
	endMs: number = performance.now()
): void {
	if (!canUsePerformanceApi()) return;
	try {
		performance.measure(name, { start: startMs, end: endMs });
	} catch {
		/* ignore */
	}
}

/** Mark 1 — first line of Socket.IO event listener (or synthetic storm emit). */
export function markSocketArrival(eventType: string): void {
	if (!isDesktopRealtimePerfMode()) return;
	const safeType = eventType.trim() || 'unknown';
	safeMark(`perf:socket:arrival:${safeType}`);
}

/** Mark 2 — debounce flush about to call invalidateQueries. */
export function markInvalidationStart(): void {
	if (!isDesktopRealtimePerfMode()) return;
	safeMark('perf:invalidation:start');
	invalidationStartMs = performance.now();
}

/** Mark 3 — after invalidateQueries Promise settles. */
export function markInvalidationEnd(): void {
	if (!isDesktopRealtimePerfMode()) return;
	safeMark('perf:invalidation:end');
	if (invalidationStartMs != null) {
		safeMeasure('perf:invalidation', invalidationStartMs);
		invalidationStartMs = null;
	}
}

/** Mark 4a — React Query fetch action for a gaf-chat query. */
export function markNetworkRefetchStart(queryHash: string): void {
	if (!isDesktopRealtimePerfMode()) return;
	safeMark('perf:network:refetch_start');
	refetchStarts.set(queryHash, performance.now());
}

/** Mark 4b — React Query fetch settled for a gaf-chat query. */
export function markNetworkRefetchEnd(queryHash: string): void {
	if (!isDesktopRealtimePerfMode()) return;
	safeMark('perf:network:refetch_end');
	const startMs = refetchStarts.get(queryHash);
	refetchStarts.delete(queryHash);
	if (startMs != null) {
		safeMeasure('perf:network:refetch', startMs);
	}
}

/**
 * Bind the desktop QueryClient so Mark 4 can observe gaf-chat fetches.
 * Safe to call repeatedly; no-op work when perf mode is off.
 */
export function bindDesktopRealtimePerfQueryClient(
	queryClient: QueryClient
): () => void {
	queryClientRef = queryClient;
	syncQueryCacheSubscription();
	return () => {
		if (queryClientRef === queryClient) {
			queryClientRef = null;
		}
		if (queryCacheUnsub) {
			queryCacheUnsub();
			queryCacheUnsub = null;
		}
		refetchStarts.clear();
	};
}

/** Register storm emit sink (EmperyworldSocketService.perfEmitSyntheticEvent). */
export function registerDesktopRealtimePerfStormEmitter(
	emit: PerfEmitFn | null
): void {
	stormEmitFn = emit;
}

function buildStormPayload(
	eventType: string,
	chatId: string,
	seq: number
): unknown {
	if (eventType === 'gaf_chat.message_new') {
		return {
			chat_id: chatId,
			message_id: `perf-storm-${seq}`,
			sender_id: 'perf-storm-sender',
			body: `[perf-storm] ${seq}`,
			created_at: new Date().toISOString(),
		};
	}
	if (eventType === 'gaf_chat.message_read') {
		return {
			chat_id: chatId,
			reader_user_id: 'perf-storm-reader',
			up_to_message_id: `perf-storm-${seq}`,
		};
	}
	if (eventType === 'presence_superseded') {
		return {
			reason: 'single_browser_realtime',
			keep_sid: 'perf-storm-keep',
			seq,
		};
	}
	return { chat_id: chatId, seq, source: 'perf-storm' };
}

/**
 * Dispatch synthetic socket events through the same listener fan-out as production
 * (does not send bytes to the server).
 */
export function runDesktopSocketStorm(
	options: DesktopSocketStormOptions = {}
): () => void {
	if (!isDesktopRealtimePerfMode()) {
		console.warn(
			'[eliteew-perf] Enable perf mode first: window.__eliteewSetPerfMode(true) or Settings → Performance'
		);
		return () => {};
	}
	const emit = stormEmitFn;
	if (!emit) {
		console.warn(
			'[eliteew-perf] Storm emitter not registered (open Desktop so Socket.IO service mounts)'
		);
		return () => {};
	}

	const eventsPerSecond = Math.max(1, options.eventsPerSecond ?? 80);
	const durationMs = Math.max(100, options.durationMs ?? 3000);
	const eventType = options.eventType ?? 'gaf_chat.message_new';
	const chatIds =
		options.chatIds && options.chatIds.length > 0
			? options.chatIds
			: Array.from({ length: 8 }, (_, i) => `perf-storm-chat-${i + 1}`);

	const intervalMs = Math.max(1, Math.round(1000 / eventsPerSecond));
	let seq = 0;
	let stopped = false;

	console.info(
		`[eliteew-perf] Socket storm start: ${eventsPerSecond}/s for ${durationMs}ms event=${eventType}`
	);

	const timer = window.setInterval(() => {
		if (stopped) return;
		seq += 1;
		const chatId = chatIds[seq % chatIds.length] ?? chatIds[0];
		emit(eventType, buildStormPayload(eventType, chatId, seq));
	}, intervalMs);

	const stopTimer = window.setTimeout(() => {
		stop();
	}, durationMs);

	const stop = () => {
		if (stopped) return;
		stopped = true;
		window.clearInterval(timer);
		window.clearTimeout(stopTimer);
		console.info(`[eliteew-perf] Socket storm stop after ${seq} events`);
	};

	return stop;
}

/** Install window.isPerfMode helpers once (idempotent). */
export function ensureDesktopRealtimePerfConsoleInstalled(): void {
	if (typeof window === 'undefined' || consoleApiInstalled) return;
	consoleApiInstalled = true;

	if (window.isPerfMode == null && readPersistedPerfMode()) {
		window.isPerfMode = true;
	}

	window.__eliteewSetPerfMode = (enabled: boolean) => {
		setDesktopRealtimePerfMode(Boolean(enabled));
		console.info(`[eliteew-perf] isPerfMode=${isDesktopRealtimePerfMode()}`);
	};
	window.__eliteewDesktopSocketStorm = runDesktopSocketStorm;

	syncQueryCacheSubscription();
}
