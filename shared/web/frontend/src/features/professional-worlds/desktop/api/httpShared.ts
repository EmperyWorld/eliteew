/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared HTTP helpers, cache-busting GETs, and SSE stream plumbing for Professional Worlds desktop API.
 *
 * Invariants:
 * - All REST calls go through the canonical EliteEW API helpers.
 * - Streaming helpers use authenticated fetch and parse SSE without extra dependencies.
 *
 * Related:
 * - api/routers/professional_worlds.py
 * - ../professionalWorldsOpenApi.ts
 * - ../professionalWorldsApiZod.ts
 * - ../types.ts
 */

import { api, apiFetchWithAuth } from '@/services/api/client';
import type { ProfessionalArtifact, StreamCallbacks } from '../types';
import {
	parseStreamProfessionalArtifactOut,
	ProfessionalWorldsApiParseError,
} from '../professionalWorldsApiZod';

export const PROFESSIONAL_WORLDS_API_BASE = '/api/v1/professional-worlds';

export function buildObjectIntakeIdempotencyKey(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return `object-intake-${globalThis.crypto.randomUUID()}`;
	}
	const suffix = Math.random().toString(36).slice(2, 11);
	return `object-intake-${Date.now()}-${suffix}`;
}

export function withNoCacheTs(url: string): string {
	const joiner = url.includes('?') ? '&' : '?';
	return `${url}${joiner}_ts=${Date.now()}`;
}

export async function getNoCache<T>(url: string): Promise<T> {
	return api.get<T>(withNoCacheTs(url));
}

function emitStreamResult(
	data: Record<string, unknown>,
	callbacks: StreamCallbacks
): boolean {
	let artifact: ProfessionalArtifact | undefined;
	try {
		artifact = parseStreamProfessionalArtifactOut(data.artifact);
	} catch (err: unknown) {
		if (err instanceof ProfessionalWorldsApiParseError) {
			callbacks.onError?.(err.message);
			return false;
		}
		throw err;
	}
	callbacks.onRawResult?.(data);
	callbacks.onResult?.(String(data.text ?? ''), artifact);
	return true;
}

export function parseSseMessages(buffer: string): {
	blocks: string[];
	rest: string;
} {
	const parts = buffer.split('\n\n');
	return { blocks: parts.slice(0, -1), rest: parts.at(-1) ?? '' };
}

export function parseSseBlock(block: string): {
	event: string;
	data: unknown;
} | null {
	let event = 'message';
	const dataLines: string[] = [];
	for (const rawLine of block.split('\n')) {
		const line = rawLine.trimEnd();
		if (line.startsWith(':')) continue;
		if (line.startsWith('event:')) {
			event = line.slice('event:'.length).trim();
			continue;
		}
		if (line.startsWith('data:')) {
			dataLines.push(line.slice('data:'.length).trimStart());
		}
	}
	if (dataLines.length === 0) return null;
	try {
		return { event, data: JSON.parse(dataLines.join('\n')) };
	} catch {
		return { event, data: dataLines.join('\n') };
	}
}

export async function consumeProfessionalWorldsStream(
	response: Response,
	callbacks: StreamCallbacks
): Promise<void> {
	if (!response.ok || !response.body) {
		callbacks.onError?.(`HTTP ${response.status}`);
		return;
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const parsed = parseSseMessages(buffer);
		buffer = parsed.rest;
		for (const block of parsed.blocks) {
			const message = parseSseBlock(block);
			if (!message) continue;
			const data = message.data as Record<string, unknown>;
			if (message.event === 'started') {
				callbacks.onStarted?.(String(data.request_id ?? ''));
			} else if (message.event === 'result') {
				if (!emitStreamResult(data, callbacks)) {
					return;
				}
			} else if (message.event === 'error') {
				callbacks.onError?.(
					String(data.error ?? data.message ?? 'Stream failed')
				);
			} else if (message.event === 'progress' || message.event === 'queued') {
				callbacks.onProgress?.(
					String(data.progress_message ?? data.status ?? message.event)
				);
			}
		}
	}
	buffer += decoder.decode();
	const lastBlock = parseSseBlock(buffer);
	if (lastBlock) {
		const data = lastBlock.data as Record<string, unknown>;
		if (lastBlock.event === 'started') {
			callbacks.onStarted?.(String(data.request_id ?? ''));
		} else if (lastBlock.event === 'result') {
			if (!emitStreamResult(data, callbacks)) {
				return;
			}
		} else if (lastBlock.event === 'error') {
			callbacks.onError?.(
				String(data.error ?? data.message ?? 'Stream failed')
			);
		}
	}
}

export async function streamProfessionalWorldsRequest(
	url: string,
	payload: unknown,
	callbacks: StreamCallbacks
): Promise<void> {
	try {
		const response = await apiFetchWithAuth(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		return consumeProfessionalWorldsStream(response, callbacks);
	} catch (error) {
		callbacks.onError?.(
			error instanceof Error ? error.message : 'Stream request failed'
		);
	}
}

export async function streamProfessionalWorldsFormRequest(
	url: string,
	formData: FormData,
	callbacks: StreamCallbacks
): Promise<void> {
	try {
		const response = await apiFetchWithAuth(url, {
			method: 'POST',
			body: formData,
		});
		return consumeProfessionalWorldsStream(response, callbacks);
	} catch (error) {
		callbacks.onError?.(
			error instanceof Error ? error.message : 'Stream request failed'
		);
	}
}
