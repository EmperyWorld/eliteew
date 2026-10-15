/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop Assistant FAQ/chat types, KB admin, settings, and SSE stream client.
 *
 * Invariants:
 * - REST DTOs alias `productDesktopAssistantOpenApi.ts` (OpenAPI SSOT).
 * - `sendAssistantMessageStream` SSE `StreamEvent` overlay stays hand (pilot lacks SSE schemas).
 * - `sendAssistantMessageStream` uses `apiFetchWithAuth` (leader/follower gate on POST).
 * - Stable stream error tokens in `ASSISTANT_STREAM_ERROR_CODE` for UI mapping.
 *
 * Related:
 * - `shared/api/routers/product_desktop.py`
 * - `components/assistant/mapAssistantStreamError.ts`
 */

import { api, apiFetchWithAuth } from '../../../../services/api/client';
import authSession from '../../../../services/authSession';
import type {
	AssistantChatMessage,
	AssistantFaqCreateBody,
	AssistantFaqEntry,
	AssistantFaqUpdateBody,
	AssistantKbBulkUploadResult,
	AssistantKbCreateBody,
	AssistantKbDocument,
	AssistantKbDocumentDetail,
	AssistantKbPatchBody,
	AssistantKbPurgeResult,
	AssistantKbReindexAllResult,
	AssistantKbSummary,
	AssistantKbSyncHandbookResult,
	AssistantKbUploadLimits,
	AssistantPreviewResult,
	AssistantSettings,
	AssistantSettingsPatchBody,
} from '../productDesktopAssistantOpenApi';
import { PRODUCT_DESKTOP_API_BASE } from './constants';

export type {
	AssistantChatMessage,
	AssistantFaqEntry,
	AssistantKbBulkUploadResult,
	AssistantKbDocument,
	AssistantKbDocumentDetail,
	AssistantKbPurgeResult,
	AssistantKbReindexAllResult,
	AssistantKbSummary,
	AssistantKbSyncHandbookResult,
	AssistantKbUploadLimits,
	AssistantPreviewResult,
	AssistantSettings,
} from '../productDesktopAssistantOpenApi';

const BASE = PRODUCT_DESKTOP_API_BASE;

export type AssistantStreamErrorMeta = {
	retryAfterSeconds?: number;
	status?: number;
};

/** Stable error tokens from `sendAssistantMessageStream` — map in `mapAssistantStreamError`. */
export const ASSISTANT_STREAM_ERROR_CODE = {
	rateLimited: 'rate_limited',
	networkError: 'network_error',
	noResponseBody: 'no_response_body',
	streamError: 'stream_error',
} as const;

export async function fetchAssistantFaq(): Promise<AssistantFaqEntry[]> {
	const data = await api.get<AssistantFaqEntry[]>(`${BASE}/assistant/faq`);
	return data ?? [];
}

export async function listAssistantMessages(
	limit = 80
): Promise<AssistantChatMessage[]> {
	const data = await api.get<AssistantChatMessage[]>(
		`${BASE}/assistant/messages`,
		{ params: { limit } }
	);
	return data ?? [];
}

export async function clearAssistantMessages(): Promise<void> {
	await api.delete(`${BASE}/assistant/messages`);
}

export async function sendAssistantMessage(
	message: string
): Promise<AssistantChatMessage> {
	return api.post<AssistantChatMessage>(`${BASE}/assistant/chat`, {
		message,
	});
}

export async function adminListAssistantFaq(): Promise<AssistantFaqEntry[]> {
	const data = await api.get<AssistantFaqEntry[]>(
		`${BASE}/admin/assistant/faq`
	);
	return data ?? [];
}

export async function adminCreateAssistantFaq(
	body: AssistantFaqCreateBody
): Promise<AssistantFaqEntry> {
	return api.post<AssistantFaqEntry>(`${BASE}/admin/assistant/faq`, body);
}

export async function adminUpdateAssistantFaq(
	id: string,
	body: AssistantFaqUpdateBody
): Promise<AssistantFaqEntry> {
	return api.patch<AssistantFaqEntry>(
		`${BASE}/admin/assistant/faq/${id}`,
		body
	);
}

export async function adminDeleteAssistantFaq(id: string): Promise<void> {
	await api.delete(`${BASE}/admin/assistant/faq/${id}`);
}

export async function getAssistantSettings(): Promise<AssistantSettings> {
	return api.get<AssistantSettings>(`${BASE}/admin/assistant/settings`);
}

export async function patchAssistantSettings(
	body: AssistantSettingsPatchBody
): Promise<AssistantSettings> {
	return api.patch<AssistantSettings>(`${BASE}/admin/assistant/settings`, body);
}

export async function adminGetKbSummary(): Promise<AssistantKbSummary> {
	return api.get<AssistantKbSummary>(`${BASE}/admin/assistant/kb/summary`);
}

export async function adminListKbDocuments(): Promise<AssistantKbDocument[]> {
	const data = await api.get<AssistantKbDocument[]>(
		`${BASE}/admin/assistant/kb`
	);
	return data ?? [];
}

export async function adminGetKbDocument(
	id: string
): Promise<AssistantKbDocumentDetail> {
	return api.get<AssistantKbDocumentDetail>(`${BASE}/admin/assistant/kb/${id}`);
}

export async function adminCreateKbDocument(
	body: AssistantKbCreateBody
): Promise<AssistantKbDocument> {
	return api.post<AssistantKbDocument>(`${BASE}/admin/assistant/kb`, body);
}

export async function adminUploadKbDocument(
	file: File,
	title?: string
): Promise<AssistantKbDocument> {
	const form = new FormData();
	form.append('file', file);
	if (title?.trim()) {
		form.append('title', title.trim());
	}
	return api.post<AssistantKbDocument>(
		`${BASE}/admin/assistant/kb/upload`,
		form
	);
}

/** Несколько файлов за один запрос (заголовок документа — из имени файла). */
export async function adminUploadKbDocumentsBulk(
	files: File[]
): Promise<AssistantKbBulkUploadResult> {
	if (files.length === 0) {
		return { ok: [], failed: [] };
	}
	const form = new FormData();
	for (const f of files) {
		form.append('files', f);
	}
	return api.post<AssistantKbBulkUploadResult>(
		`${BASE}/admin/assistant/kb/uploads`,
		form
	);
}

export async function adminPatchKbDocument(
	id: string,
	body: AssistantKbPatchBody
): Promise<AssistantKbDocument> {
	return api.patch<AssistantKbDocument>(
		`${BASE}/admin/assistant/kb/${id}`,
		body
	);
}

export async function adminReindexKbDocument(
	id: string
): Promise<AssistantKbDocument> {
	return api.post<AssistantKbDocument>(
		`${BASE}/admin/assistant/kb/${id}/reindex`
	);
}

export async function adminDeleteKbDocument(id: string): Promise<void> {
	await api.delete(`${BASE}/admin/assistant/kb/${id}`);
}

export async function getAssistantKbUploadLimits(): Promise<AssistantKbUploadLimits> {
	return api.get<AssistantKbUploadLimits>(
		`${BASE}/admin/assistant/kb/upload-limits`
	);
}

export async function adminPurgeKbDocuments(): Promise<AssistantKbPurgeResult> {
	return api.post<AssistantKbPurgeResult>(`${BASE}/admin/assistant/kb/purge`, {
		confirm: 'purge',
	});
}

export async function adminPreviewAssistantPrompt(body: {
	message: string;
	include_my_history?: boolean;
}): Promise<AssistantPreviewResult> {
	return api.post<AssistantPreviewResult>(
		`${BASE}/admin/assistant/preview`,
		body
	);
}

export async function adminReindexAllKbDocuments(): Promise<AssistantKbReindexAllResult> {
	return api.post<AssistantKbReindexAllResult>(
		`${BASE}/admin/assistant/kb/reindex-all`,
		undefined
	);
}

export async function adminSyncHandbookKb(options?: {
	dryRun?: boolean;
	limit?: number;
}): Promise<AssistantKbSyncHandbookResult> {
	const params = new URLSearchParams();
	if (options?.dryRun) params.set('dry_run', 'true');
	if (options?.limit != null) params.set('limit', String(options.limit));
	const qs = params.toString();
	return api.post<AssistantKbSyncHandbookResult>(
		`${BASE}/admin/assistant/kb/sync-handbook${qs ? `?${qs}` : ''}`,
		undefined
	);
}

/** Hand SSE overlay — not in OpenAPI pilot (stream events). */
type StreamEvent =
	| { type: 'token'; text: string }
	| { type: 'meta'; rag_source_labels: string[] }
	| { type: 'done'; message: AssistantChatMessage }
	| { type: 'error'; message: string };

function parseSseDataBlock(block: string): StreamEvent | null {
	const lines = block
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	for (const line of lines) {
		if (!line.startsWith('data:')) continue;
		const raw = line.slice(5).trimStart();
		if (!raw) continue;
		try {
			return JSON.parse(raw) as StreamEvent;
		} catch {
			return null;
		}
	}
	return null;
}

/**
 * SSE-чат помощника (Llama stream + сохранение в БД на сервере).
 */
export async function sendAssistantMessageStream(
	message: string,
	handlers: {
		onToken: (text: string) => void;
		onMeta?: (meta: { rag_source_labels: string[] }) => void;
		onDone: (message: AssistantChatMessage) => void | Promise<void>;
		onError: (message: string, meta?: AssistantStreamErrorMeta) => void;
		onAborted?: () => void;
	},
	options?: { signal?: AbortSignal }
): Promise<void> {
	try {
		await authSession.updateToken(70);
	} catch {
		// ignore
	}
	const signal = options?.signal;
	try {
		const res = await apiFetchWithAuth(`${BASE}/assistant/chat/stream`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ message }),
			signal,
		});
		if (!res.ok) {
			if (res.status === 429) {
				const retryRaw = res.headers.get('Retry-After');
				const retryAfterSeconds = Math.max(
					1,
					Number.parseInt(retryRaw ?? '60', 10) || 60
				);
				handlers.onError('rate_limited', { retryAfterSeconds });
				return;
			}
			handlers.onError(ASSISTANT_STREAM_ERROR_CODE.networkError, {
				status: res.status,
			});
			return;
		}
		const reader = res.body?.getReader();
		if (!reader) {
			handlers.onError(ASSISTANT_STREAM_ERROR_CODE.noResponseBody);
			return;
		}
		const decoder = new TextDecoder();
		let buffer = '';
		let doneHandled = false;
		while (true) {
			if (signal?.aborted) {
				await reader.cancel().catch(() => undefined);
				handlers.onAborted?.();
				return;
			}
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const parts = buffer.split('\n\n');
			buffer = parts.pop() ?? '';
			for (const block of parts) {
				if (block.startsWith(':')) continue;
				const ev = parseSseDataBlock(block);
				if (!ev) continue;
				if (ev.type === 'token' && ev.text) handlers.onToken(ev.text);
				if (ev.type === 'meta' && ev.rag_source_labels) {
					handlers.onMeta?.({ rag_source_labels: ev.rag_source_labels });
				}
				if (ev.type === 'error')
					handlers.onError(
						ev.message || ASSISTANT_STREAM_ERROR_CODE.streamError
					);
				if (ev.type === 'done' && ev.message && !doneHandled) {
					doneHandled = true;
					await Promise.resolve(handlers.onDone(ev.message));
				}
			}
		}
		if (buffer.trim() && !buffer.startsWith(':')) {
			const ev = parseSseDataBlock(buffer);
			if (ev?.type === 'done' && ev.message && !doneHandled) {
				doneHandled = true;
				await Promise.resolve(handlers.onDone(ev.message));
			}
		}
	} catch (err) {
		if (
			signal?.aborted ||
			(err instanceof DOMException && err.name === 'AbortError')
		) {
			handlers.onAborted?.();
			return;
		}
		handlers.onError(err instanceof Error ? err.message : String(err));
	}
}
