/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Playbook list/run/resume streams and media batch run SSE for Professional Worlds desktop API.
 *
 * Invariants:
 * - Streaming helpers use authenticated fetch and parse SSE without extra dependencies.
 * - Generation/playbook SSE optional nested artifact payloads are validated before UI callbacks.
 *
 * Related:
 * - api/routers/professional_worlds.py
 * - ../professionalWorldsApiZod.ts
 * - ../types.ts
 */

import type { ProfessionalPlaybookRunOut } from '../professionalWorldsOpenApi';
import { api, apiFetchWithAuth } from '@/services/api/client';
import type {
	ProfessionalPlaybookLaunch,
	ProfessionalPlaybookRun,
} from '../types';
import {
	parseProfessionalPlaybookLaunchBody,
	parseProfessionalPlaybookRunOut,
	parseProfessionalPlaybookRunOutList,
	parseStreamProfessionalArtifactOut,
	ProfessionalWorldsApiParseError,
} from '../professionalWorldsApiZod';
import {
	parseSseBlock,
	parseSseMessages,
	PROFESSIONAL_WORLDS_API_BASE,
} from './httpShared';

export type PlaybookStreamHandler = (
	event: string,
	data: Record<string, unknown>
) => void;

export type ProfessionalWorldsStreamOptions = {
	signal?: AbortSignal;
};

async function consumePlaybookSseStream(
	response: Response,
	onEvent: PlaybookStreamHandler,
	onError?: (message: string) => void
): Promise<void> {
	if (!response.ok || !response.body) {
		onError?.(`HTTP ${response.status}`);
		return;
	}
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		buffer += decoder.decode(value, { stream: true });
		const parsed = parseSseMessages(buffer);
		buffer = parsed.rest;
		for (const block of parsed.blocks) {
			const message = parseSseBlock(block);
			if (!message) {
				continue;
			}
			const data = message.data as Record<string, unknown>;
			if (data.artifact != null) {
				try {
					parseStreamProfessionalArtifactOut(data.artifact);
				} catch (err: unknown) {
					if (err instanceof ProfessionalWorldsApiParseError) {
						onError?.(err.message);
						continue;
					}
					throw err;
				}
			}
			onEvent(message.event, data);
		}
	}
}

export async function streamRealtorMediaBatchRun(
	propertyId: string,
	batchId: string,
	onEvent: PlaybookStreamHandler,
	onError?: (message: string) => void,
	options: ProfessionalWorldsStreamOptions = {}
): Promise<void> {
	const response = await apiFetchWithAuth(
		`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${encodeURIComponent(propertyId)}/media/enhance/batches/${encodeURIComponent(batchId)}/run/stream`,
		{ method: 'POST', signal: options.signal }
	);
	await consumePlaybookSseStream(response, onEvent, onError);
}

export async function listProfessionalPlaybookRuns(): Promise<
	ProfessionalPlaybookRun[]
> {
	return parseProfessionalPlaybookRunOutList(
		await api.get<ProfessionalPlaybookRunOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/playbook-runs`
		)
	);
}

export async function getProfessionalPlaybookRun(
	runId: string
): Promise<ProfessionalPlaybookRun> {
	return parseProfessionalPlaybookRunOut(
		await api.get<ProfessionalPlaybookRunOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/playbook-runs/${runId}`
		)
	);
}

export async function streamProfessionalPlaybook(
	verticalSlug: string,
	playbookKey: string,
	body: ProfessionalPlaybookLaunch,
	onEvent: PlaybookStreamHandler,
	onError?: (message: string) => void,
	options: ProfessionalWorldsStreamOptions = {}
): Promise<void> {
	const parsedBody = parseProfessionalPlaybookLaunchBody(body);
	const response = await apiFetchWithAuth(
		`${PROFESSIONAL_WORLDS_API_BASE}/playbooks/${encodeURIComponent(verticalSlug)}/${encodeURIComponent(playbookKey)}/stream`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(parsedBody),
			signal: options.signal,
		}
	);
	await consumePlaybookSseStream(response, onEvent, onError);
}

export async function resumeProfessionalPlaybookStream(
	runId: string,
	body: ProfessionalPlaybookLaunch,
	onEvent: PlaybookStreamHandler,
	onError?: (message: string) => void,
	options: ProfessionalWorldsStreamOptions = {}
): Promise<void> {
	const parsedBody = parseProfessionalPlaybookLaunchBody(body);
	const response = await apiFetchWithAuth(
		`${PROFESSIONAL_WORLDS_API_BASE}/playbook-runs/${encodeURIComponent(runId)}/resume/stream`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(parsedBody),
			signal: options.signal,
		}
	);
	await consumePlaybookSseStream(response, onEvent, onError);
}
