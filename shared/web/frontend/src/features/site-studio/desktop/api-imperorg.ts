/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed Site Studio auto-fill SSE client for launch requests and progress events.
 *
 * Invariants:
 * - SSE parsing supports comments, CRLF, multi-line data fields, malformed-event recovery, and final-buffer flush.
 * - Stream termination without `pipeline_complete` or `pipeline_error` is reported as an interrupted run.
 *
 * Related:
 * - features/site-studio/desktop/components/ImperorG/imperorGPipelineRunner.ts
 * - api/routers/imperorg.py
 */
import { apiFetchWithAuth } from '@/services/api/client';

const IMPERORG_API_BASE = '/api/v1/desktop/site-studio/imperorg';

export type ImperorGStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface ImperorGStep {
	stepId: string;
	label: string;
	status: ImperorGStepStatus;
	summary?: string;
}

export interface ImperorGPhase {
	id: string;
	label: string;
	icon: string;
	status: ImperorGStepStatus;
	steps: ImperorGStep[];
}

export interface ImperorGConfig {
	document_id?: string | null;
	user_prompt?: string | null;
	include_audio?: boolean;
	use_web_search?: boolean;
	search_queries?: string[] | null;
}

export type ImperorGEventName =
	| 'pipeline_start'
	| 'phase_start'
	| 'phase_step'
	| 'phase_complete'
	| 'keep_alive'
	| 'pipeline_complete'
	| 'pipeline_error';

export interface ImperorGEvent {
	event: ImperorGEventName;
	data: Record<string, unknown>;
}

export interface ImperorGCallbacks {
	onEvent?: (event: ImperorGEvent) => void;
	onPipelineStart?: (phases: ImperorGPhase[], pipelineId: string) => void;
	onPhaseStart?: (
		phaseId: string,
		phaseIndex: number,
		label: string,
		icon: string
	) => void;
	onPhaseStep?: (
		phaseId: string,
		stepId: string,
		label: string,
		status: ImperorGStepStatus,
		summary?: string
	) => void;
	onPhaseComplete?: (phaseId: string, phaseIndex: number) => void;
	onPipelineComplete?: (data: Record<string, unknown>) => void;
	onPipelineError?: (error: string) => void;
}

export type ParsedImperorGSseBlock = {
	event: ImperorGEventName;
	data: string;
};

export function parseImperorGSseBlock(
	block: string
): ParsedImperorGSseBlock | null {
	let eventName: ImperorGEventName = 'keep_alive';
	const dataLines: string[] = [];

	for (const rawLine of block.replace(/\r\n/g, '\n').split('\n')) {
		const line = rawLine.trimEnd();
		if (!line || line.startsWith(':')) continue;
		const separator = line.indexOf(':');
		const field = separator === -1 ? line : line.slice(0, separator);
		const value =
			separator === -1 ? '' : line.slice(separator + 1).replace(/^\s/, '');
		if (field === 'event' && value) {
			eventName = value as ImperorGEventName;
		} else if (field === 'data') {
			dataLines.push(value);
		}
	}

	if (!dataLines.length) return null;
	return { event: eventName, data: dataLines.join('\n') };
}

function dispatchImperorGEvent(
	eventName: ImperorGEventName,
	payload: Record<string, unknown>,
	callbacks?: ImperorGCallbacks
): boolean {
	const event: ImperorGEvent = { event: eventName, data: payload };
	callbacks?.onEvent?.(event);

	switch (eventName) {
		case 'pipeline_start': {
			const phases = (payload.phases as ImperorGPhase[]) || [];
			callbacks?.onPipelineStart?.(
				phases,
				(payload.pipeline_id as string) || ''
			);
			break;
		}
		case 'phase_start':
			callbacks?.onPhaseStart?.(
				payload.phase_id as string,
				payload.phase_index as number,
				payload.label as string,
				payload.icon as string
			);
			break;
		case 'phase_step':
			callbacks?.onPhaseStep?.(
				payload.phase_id as string,
				payload.step_id as string,
				payload.label as string,
				payload.status as ImperorGStepStatus,
				payload.summary as string | undefined
			);
			break;
		case 'phase_complete':
			callbacks?.onPhaseComplete?.(
				payload.phase_id as string,
				payload.phase_index as number
			);
			break;
		case 'pipeline_complete':
			callbacks?.onPipelineComplete?.(payload);
			return true;
		case 'pipeline_error':
			callbacks?.onPipelineError?.(
				(payload.error as string) || 'Unknown pipeline error'
			);
			return true;
	}
	return false;
}

function processImperorGSseBlocks(
	blocks: string[],
	callbacks?: ImperorGCallbacks
): boolean {
	let terminal = false;
	for (const chunk of blocks) {
		const parsed = parseImperorGSseBlock(chunk);
		if (!parsed) continue;

		let payload: Record<string, unknown>;
		try {
			payload = JSON.parse(parsed.data);
		} catch {
			continue;
		}

		terminal =
			dispatchImperorGEvent(parsed.event, payload, callbacks) || terminal;
	}
	return terminal;
}

async function extractErrorMessage(response: Response): Promise<string> {
	try {
		const payload = (await response.json()) as { detail?: unknown };
		if (typeof payload.detail === 'string') return payload.detail;
	} catch {
		// Keep status fallback below.
	}
	return response.statusText || `Auto-fill launch failed: ${response.status}`;
}

export async function launchImperorG(
	config: ImperorGConfig,
	callbacks?: ImperorGCallbacks,
	signal?: AbortSignal
): Promise<void> {
	const res = await apiFetchWithAuth(`${IMPERORG_API_BASE}/launch`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(config),
		signal,
	});

	if (!res.ok || !res.body) {
		throw new Error(await extractErrorMessage(res));
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let terminalSeen = false;

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			buffer += decoder.decode();
			break;
		}

		buffer += decoder.decode(value, { stream: true });
		const parts = buffer.replace(/\r\n/g, '\n').split('\n\n');
		buffer = parts.pop() ?? '';

		terminalSeen = processImperorGSseBlocks(parts, callbacks) || terminalSeen;
		if (terminalSeen) return;
	}

	const tail = buffer.trim();
	if (tail) {
		terminalSeen = processImperorGSseBlocks([tail], callbacks) || terminalSeen;
		if (terminalSeen) return;
	}

	const interruptedMessage =
		'Auto-fill stream ended before completion. The run may have been interrupted; check drafts or launch it again.';
	callbacks?.onPipelineError?.(interruptedMessage);
	throw new Error(interruptedMessage);
}
