/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed HTTP client for **EWA** desktop orchestration (`/api/v1/ewa/desktop-orchestration/*`), separate
 * from Marketing Cabinet run APIs (POST turn + optional SSE session events via `fetch`).
 *
 * Invariants:
 * - SSE helpers use `fetch` + `getAuthHeader()` (same Bearer as `apiClient`).
 * - HTTP turn request/response envelopes use OpenAPI pilots (`ewaDesktopOrchestrationOpenApi` + `ewaOpenApi`).
 * - SSE event payloads stay opaque (documented) — not in regenerable OpenAPI.
 *
 * Related:
 * - shared/api/ewa_platform/gateways/routers/desktop.py
 * - shared/api/ewa_platform/io/envelope.py
 * - src/hooks/api/useAmka.ts
 * - src/services/ewa/ewaDesktopOrchestrationOpenApi.ts
 * - src/services/ewa/ewaOpenApi.ts
 */
import { API_OPTIONS } from '@/pages/MarketingCabinet/marketingCabinetApi/config';
import { apiClient } from '@/services/api/client';
import { getAuthHeader } from '@/services/authSession';

import type { EwaDesktopOrchestrationTurnResponse } from './ewaOpenApi';
import type {
	EwaDesktopOrchestrationCompanionHints,
	EwaDesktopOrchestrationPayloadMetadata,
	EwaDesktopOrchestrationTurnRequestEnvelope,
} from './ewaDesktopOrchestrationOpenApi';

/** OpenAPI pilot aliases (SSE-enriched overlay for request metadata). */
export type {
	EwaDesktopOrchestrationCompanionHints,
	EwaDesktopOrchestrationPayloadMetadata,
	EwaDesktopOrchestrationTurnRequestEnvelope,
};

export type EwaDesktopOrchTurnRequestEnvelope =
	EwaDesktopOrchestrationTurnRequestEnvelope;
export type EwaDesktopOrchTurnResponseEnvelope =
	EwaDesktopOrchestrationTurnResponse;

/** Matches ``EWA_IO_API_VERSION`` on the API side. */
export const EWA_PLATFORM_IO_API_VERSION = '1' as const;

export const DESKTOP_ORCHESTRATION_V1_PAYLOAD_KIND =
	'ewa_desktop_orchestration_v1' as const;

export const DESKTOP_ORCHESTRATION_RESULT_V1_PAYLOAD_KIND =
	'ewa_desktop_orchestration_result_v1' as const;

const DESKTOP_ORCH_TURN_PATH = '/ewa/desktop-orchestration/turn' as const;

export function buildDesktopOrchestrationSignalEnvelope(params: {
	correlationId: string;
	sessionId: string;
	observation: Record<string, unknown>;
	/** Optional; keys beyond `companion` are ignored by today's API parsers. */
	metadata?: Record<string, unknown>;
}): EwaDesktopOrchTurnRequestEnvelope {
	const payload: Record<string, unknown> = {
		kind: DESKTOP_ORCHESTRATION_V1_PAYLOAD_KIND,
		session_id: params.sessionId,
		observation: params.observation,
	};
	if (params.metadata && Object.keys(params.metadata).length > 0) {
		payload.metadata = params.metadata;
	}
	return {
		api_version: EWA_PLATFORM_IO_API_VERSION,
		message_type: 'signal',
		correlation_id: params.correlationId,
		auth_context_ref: null,
		payload,
	};
}

export async function postEwaDesktopOrchestrationTurn(
	body: EwaDesktopOrchTurnRequestEnvelope
): Promise<EwaDesktopOrchTurnResponseEnvelope> {
	const res = await apiClient.post<EwaDesktopOrchestrationTurnResponse>(
		DESKTOP_ORCH_TURN_PATH,
		body,
		API_OPTIONS
	);
	return res.data;
}

const DESKTOP_ORCH_EVENTS_PATH_BASE =
	'/ewa/desktop-orchestration/sessions' as const;

/** Absolute URL path under `/api/v1` for SSE session events. */
export function desktopOrchestrationSessionEventsPath(
	sessionId: string,
	follow: boolean
): string {
	const q = follow ? '?follow=true' : '';
	return `${DESKTOP_ORCH_EVENTS_PATH_BASE}/${encodeURIComponent(sessionId)}/events${q}`;
}

async function* iterateSseDataLines(res: Response): AsyncGenerator<string> {
	const reader = res.body?.getReader();
	if (!reader) {
		return;
	}
	const decoder = new TextDecoder();
	let buf = '';
	let readResult = await reader.read();
	while (!readResult.done) {
		const value = readResult.value;
		buf += decoder.decode(value, { stream: true });
		const chunks = buf.split('\n\n');
		buf = chunks.pop() ?? '';
		for (const block of chunks) {
			for (const line of block.split('\n')) {
				const t = line.trim();
				if (t.startsWith('data:')) {
					yield t.slice(5).trimStart();
				}
			}
		}
		readResult = await reader.read();
	}
}

/**
 * Consume `GET .../desktop-orchestration/sessions/{id}/events` as SSE (`text/event-stream`).
 * Uses Bearer from `getAuthHeader()`; abort via `signal`.
 * SSE `data:` lines are opaque JSON — not typed by OpenAPI pilots.
 */
export async function consumeDesktopOrchestrationSessionSse(params: {
	sessionId: string;
	follow: boolean;
	signal?: AbortSignal;
	onDataLine?: (line: string) => void;
}): Promise<void> {
	const root = API_OPTIONS.baseURL.replace(/\/$/, '');
	const url = `${root}${desktopOrchestrationSessionEventsPath(params.sessionId, params.follow)}`;
	const headers: Record<string, string> = {
		Accept: 'text/event-stream',
		...getAuthHeader(),
	};
	const res = await fetch(url, { headers, signal: params.signal });
	if (!res.ok) {
		throw new Error(`SSE HTTP ${res.status}`);
	}
	for await (const line of iterateSseDataLines(res)) {
		params.onDataLine?.(line);
	}
}

/** Extract last executed intent kind from turn response events (client-side telemetry helper). */
export function extractLastIntentKindFromTurnEnvelope(
	env: EwaDesktopOrchTurnResponseEnvelope
): string | null {
	const payload = env.payload;
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return null;
	}
	const raw = (payload as { events?: unknown }).events;
	if (!Array.isArray(raw)) {
		return null;
	}
	for (let i = raw.length - 1; i >= 0; i--) {
		const e = raw[i];
		if (!e || typeof e !== 'object' || Array.isArray(e)) {
			continue;
		}
		const rec = e as { kind?: unknown; intent?: { intent_kind?: unknown } };
		if (rec.kind === 'intent_result') {
			const ik = rec.intent?.intent_kind;
			return typeof ik === 'string' && ik.trim() ? ik : null;
		}
	}
	return null;
}
