/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Browser SSE streaming client for UGS generation endpoints.
 *
 * Invariants:
 * - Authenticated streaming is restricted by `apiFetchWithAuth` to same-origin `/api/*`.
 * - SSE parsing supports CRLF, comments/keep-alives, multiple data lines, and final-buffer flush.
 *
 * Related:
 * - src/services/api/ugs/ugsHubTaskCacheFacade.ts
 * - src/services/api/client.ts
 */
import { apiFetchWithAuth } from '../client';
import { emitUgsFrontendTelemetry } from './telemetry';

export type UGSStreamEventName =
	| 'started'
	| 'queued'
	| 'progress'
	| 'keep_alive'
	| 'result'
	| 'error'
	| 'cancelled';

export interface UGSStreamEventPayload {
	request_id?: string;
	status?: string;
	stage?: string | null;
	progress?: number | null;
	progress_message?: string | null;
	execution_backend?: string | null;
	provider_name?: string | null;
	provider_attempt?: number | null;
	retry_count?: number | null;
	queued_at?: string | null;
	estimated_completion?: string | null;
	last_heartbeat_at?: string | null;
	result?: Record<string, unknown> | null;
	result_preview?: Record<string, unknown> | null;
	metadata?: Record<string, unknown> | null;
	error?: string | null;
	error_type?: string | null;
	data?: Record<string, unknown>;
	payload?: Record<string, unknown>;
	timestamp?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeUgsStreamEventPayload(
	value: unknown
): UGSStreamEventPayload | null {
	if (!isRecord(value)) {
		return null;
	}
	const payload: UGSStreamEventPayload = {};
	if (typeof value.request_id === 'string')
		payload.request_id = value.request_id;
	if (typeof value.status === 'string') payload.status = value.status;
	if (typeof value.stage === 'string' || value.stage === null)
		payload.stage = value.stage;
	if (typeof value.progress === 'number' || value.progress === null)
		payload.progress = value.progress;
	if (
		typeof value.progress_message === 'string' ||
		value.progress_message === null
	) {
		payload.progress_message = value.progress_message;
	}
	if (
		typeof value.execution_backend === 'string' ||
		value.execution_backend === null
	) {
		payload.execution_backend = value.execution_backend;
	}
	if (typeof value.provider_name === 'string' || value.provider_name === null) {
		payload.provider_name = value.provider_name;
	}
	if (
		typeof value.provider_attempt === 'number' ||
		value.provider_attempt === null
	) {
		payload.provider_attempt = value.provider_attempt;
	}
	if (typeof value.retry_count === 'number' || value.retry_count === null) {
		payload.retry_count = value.retry_count;
	}
	if (typeof value.queued_at === 'string' || value.queued_at === null)
		payload.queued_at = value.queued_at;
	if (
		typeof value.estimated_completion === 'string' ||
		value.estimated_completion === null
	) {
		payload.estimated_completion = value.estimated_completion;
	}
	if (
		typeof value.last_heartbeat_at === 'string' ||
		value.last_heartbeat_at === null
	) {
		payload.last_heartbeat_at = value.last_heartbeat_at;
	}
	if (isRecord(value.result) || value.result === null)
		payload.result = value.result;
	if (isRecord(value.result_preview) || value.result_preview === null) {
		payload.result_preview = value.result_preview;
	}
	if (isRecord(value.metadata) || value.metadata === null)
		payload.metadata = value.metadata;
	if (typeof value.error === 'string' || value.error === null)
		payload.error = value.error;
	if (typeof value.error_type === 'string' || value.error_type === null) {
		payload.error_type = value.error_type;
	}
	if (isRecord(value.data)) payload.data = value.data;
	if (isRecord(value.payload)) payload.payload = value.payload;
	if (typeof value.timestamp === 'string') payload.timestamp = value.timestamp;
	return payload;
}

export interface UGSStreamEvent {
	event: UGSStreamEventName;
	data: UGSStreamEventPayload;
}

export interface UGSStreamCallbacks {
	onEvent?: (event: UGSStreamEvent) => void;
	onStarted?: (requestId: string, payload: UGSStreamEventPayload) => void;
	onProgress?: (payload: UGSStreamEventPayload) => void;
}

export type ParsedUgsSseBlock = {
	event: UGSStreamEventName;
	data: string;
};

export function parseUgsSseBlock(block: string): ParsedUgsSseBlock | null {
	let eventName: UGSStreamEventName = 'progress';
	const dataLines: string[] = [];

	for (const rawLine of block.replace(/\r\n/g, '\n').split('\n')) {
		const line = rawLine.trimEnd();
		if (!line || line.startsWith(':')) continue;
		const separator = line.indexOf(':');
		const field = separator === -1 ? line : line.slice(0, separator);
		const value =
			separator === -1 ? '' : line.slice(separator + 1).replace(/^\s/, '');
		if (field === 'event' && value) {
			eventName = value as UGSStreamEventName;
		} else if (field === 'data') {
			dataLines.push(value);
		}
	}

	if (dataLines.length === 0) return null;
	return { event: eventName, data: dataLines.join('\n') };
}

function parseUgsStreamPayload(data: string): UGSStreamEventPayload | null {
	try {
		return normalizeUgsStreamEventPayload(JSON.parse(data));
	} catch {
		return null;
	}
}

export async function streamUgsGeneration(
	url: string,
	body: Record<string, unknown> | FormData,
	callbacks?: UGSStreamCallbacks,
	extraHeaders?: Record<string, string>
): Promise<Record<string, unknown>> {
	const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
	const res = await apiFetchWithAuth(url, {
		method: 'POST',
		headers: isForm
			? { ...(extraHeaders ?? {}) }
			: { 'Content-Type': 'application/json', ...(extraHeaders ?? {}) },
		body: isForm ? body : JSON.stringify(body),
	});

	if (!res.ok || !res.body) {
		throw new Error(res.statusText || `UGS stream failed: ${res.status}`);
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}

		buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
		const parts = buffer.split(/\n\n+/);
		buffer = parts.pop() ?? '';

		for (const chunk of parts) {
			const result = handleUgsSseChunk(chunk, callbacks);
			if (result.kind === 'return') return result.value;
			if (result.kind === 'throw') throw result.error;
		}
	}
	if (buffer.trim()) {
		const result = handleUgsSseChunk(buffer, callbacks);
		if (result.kind === 'return') return result.value;
		if (result.kind === 'throw') throw result.error;
	}

	throw new Error('UGS stream ended without result');
}

function handleUgsSseChunk(
	chunk: string,
	callbacks?: UGSStreamCallbacks
):
	| { kind: 'continue' }
	| { kind: 'return'; value: Record<string, unknown> }
	| { kind: 'throw'; error: Error } {
	const parsed = parseUgsSseBlock(chunk);
	if (!parsed) return { kind: 'continue' };
	const payload = parseUgsStreamPayload(parsed.data);
	if (!payload) return { kind: 'continue' };

	callbacks?.onEvent?.({ event: parsed.event, data: payload });

	if (parsed.event === 'started' && typeof payload.request_id === 'string') {
		emitUgsFrontendTelemetry({
			event: 'stream_started',
			requestId: payload.request_id,
			status: payload.status ?? null,
			meta: {
				stage: payload.stage ?? null,
			},
		});
		callbacks?.onStarted?.(payload.request_id, payload);
	}

	if (
		parsed.event === 'queued' ||
		parsed.event === 'progress' ||
		parsed.event === 'keep_alive'
	) {
		callbacks?.onProgress?.(payload);
	}

	if (parsed.event === 'result') {
		emitUgsFrontendTelemetry({
			event: 'stream_result',
			requestId: payload.request_id,
			status: payload.status ?? 'completed',
		});
		return {
			kind: 'return',
			value: (payload.data ?? payload.result ?? payload) as Record<
				string,
				unknown
			>,
		};
	}

	if (parsed.event === 'cancelled') {
		emitUgsFrontendTelemetry({
			event: 'stream_cancelled',
			requestId: payload.request_id,
			status: payload.status ?? 'cancelled',
			meta: {
				message: payload.progress_message ?? null,
			},
		});
		return {
			kind: 'throw',
			error: new Error(
				String(payload.progress_message ?? 'UGS generation cancelled')
			),
		};
	}

	if (parsed.event === 'error') {
		emitUgsFrontendTelemetry({
			event: 'stream_error',
			requestId: payload.request_id,
			status: payload.status ?? 'failed',
			meta: {
				error: payload.error ?? null,
				error_type: payload.error_type ?? null,
			},
		});
		return {
			kind: 'throw',
			error: new Error(String(payload.error ?? 'UGS stream error')),
		};
	}

	return { kind: 'continue' };
}
