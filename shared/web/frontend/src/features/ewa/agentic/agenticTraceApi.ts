/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP client for agentic session trace and task-tree observability APIs.
 *
 * Invariants:
 * - Browser callers always receive stable array fields for trace/tree collections.
 * - Requests use ``API_OPTIONS`` (``baseURL: '/api/v1'``) so paths resolve to
 *   ``/api/v1/ewa/agentic/...`` — bare ``/ewa/...`` is 404 on frontend nginx.
 *
 * Related:
 * - api/ewa_platform/gateways/routers/agentic_sessions.py
 * - pages/MarketingCabinet/marketingCabinetApi/config.ts (API_OPTIONS)
 */

import { API_OPTIONS } from '@/pages/MarketingCabinet/marketingCabinetApi/config';
import { apiClient } from '@/services/api/client';

export type AgenticCheckpointRow = {
	seq: number;
	kind: string;
	node_id: string | null;
	payload_json: Record<string, unknown>;
};

export type AgenticTraceResponse = {
	session_id: string;
	checkpoints: AgenticCheckpointRow[];
};

export type AgenticTreeNodeRow = {
	id: string;
	node_kind: string;
	status: string;
	title: string;
	tool_name: string | null;
	sort_order: number;
	materialized_path: string;
};

export type AgenticTreeResponse = {
	session_id: string;
	nodes: AgenticTreeNodeRow[];
};

/** Relative to ``API_OPTIONS.baseURL`` (`/api/v1`). */
export const AGENTIC_SESSION_TRACE_PATH = (sessionId: string) =>
	`/ewa/agentic/sessions/${encodeURIComponent(sessionId)}/trace` as const;

export const AGENTIC_SESSION_TREE_PATH = (sessionId: string) =>
	`/ewa/agentic/sessions/${encodeURIComponent(sessionId)}/tree` as const;

export function normalizeAgenticTraceResponse(
	raw: Partial<AgenticTraceResponse> | null | undefined,
	sessionId: string
): AgenticTraceResponse {
	return {
		session_id: String(raw?.session_id || sessionId),
		checkpoints: Array.isArray(raw?.checkpoints) ? raw.checkpoints : [],
	};
}

export function normalizeAgenticTreeResponse(
	raw: Partial<AgenticTreeResponse> | null | undefined,
	sessionId: string
): AgenticTreeResponse {
	return {
		session_id: String(raw?.session_id || sessionId),
		nodes: Array.isArray(raw?.nodes) ? raw.nodes : [],
	};
}

export async function fetchAgenticSessionTrace(
	sessionId: string,
	limit = 50
): Promise<AgenticTraceResponse> {
	const { data } = await apiClient.get<Partial<AgenticTraceResponse> | null>(
		AGENTIC_SESSION_TRACE_PATH(sessionId),
		{ ...API_OPTIONS, params: { limit } }
	);
	return normalizeAgenticTraceResponse(data, sessionId);
}

export async function fetchAgenticSessionTree(
	sessionId: string
): Promise<AgenticTreeResponse> {
	const { data } = await apiClient.get<Partial<AgenticTreeResponse> | null>(
		AGENTIC_SESSION_TREE_PATH(sessionId),
		API_OPTIONS
	);
	return normalizeAgenticTreeResponse(data, sessionId);
}
