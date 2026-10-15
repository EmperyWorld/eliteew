/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * REST helpers for Desktop AI Chat (CRUD, memory, collab, attachments, voice, projects).
 * SSE transport lives in ./stream.ts.
 *
 * Invariants:
 * - Paths under BASE `/api/v1/desktop/ai-chat` stay byte-stable for Vitest contracts.
 *
 * Related:
 * - ./stream.ts
 * - ../desktopAiChatOpenApi.ts
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */
import { APIError, apiClient } from '../../../../services/api/client';
import { API_CONFIG } from '../../../../services/api/config';
import { normalizeFileForMultipartUpload } from '../../../../utils/uploadMultipartFilename';

import type {
	DesktopAiAttachment,
	DesktopAiAttachmentListOut,
	DesktopAiChatItem,
	DesktopAiChatListOut,
	DesktopAiChatMe,
	DesktopAiChatMember,
	DesktopAiChatMemberListOut,
	DesktopAiChatStreamLockPeek,
	DesktopAiEffectiveSettingsOut,
	DesktopAiMemoryCell,
	DesktopAiMemoryCellListOut,
	DesktopAiMessagesDeleteOut,
	DesktopAiSoloSlotTariffsOut,
	EnsembleBlueprintCommandItem,
	EnsembleBlueprintCommandsOut,
	SoloSlotTariffsResponse,
} from '../desktopAiChatOpenApi';
import { BASE, tDesktopAiApiError } from './shared';
import type {
	DesktopAiMessage,
	DesktopAiProjectRow,
	ListDesktopAiMessagesResult,
	SoloSlotDurationHours,
	VoiceGatewaySynthesizeOptions,
} from './types';

export async function fetchDesktopAiEffectiveSettings(): Promise<DesktopAiEffectiveSettingsOut> {
	const { data } = await apiClient.get<DesktopAiEffectiveSettingsOut>(
		`${BASE}/effective-settings`
	);
	return data;
}

/** Примеры запросов под встроенные шаблоны blueprint (групповой чат). */
export async function fetchEnsembleBlueprintCommands(): Promise<
	EnsembleBlueprintCommandItem[]
> {
	const { data } = await apiClient.get<EnsembleBlueprintCommandsOut>(
		`${BASE}/ensemble-blueprint-commands`
	);
	return data.items ?? [];
}

export async function getDesktopAiChatMe(): Promise<DesktopAiChatMe> {
	const { data } = await apiClient.get<DesktopAiChatMe>(`${BASE}/me`);
	return data;
}

export async function listDesktopAiChats(): Promise<DesktopAiChatItem[]> {
	const { data } = await apiClient.get<DesktopAiChatListOut>(`${BASE}/chats`);
	return data.items ?? [];
}

export async function createDesktopAiChat(body: {
	title?: string;
	project_id?: string | null;
	company_id?: string | null;
	use_project_rag?: boolean;
	llama_model?: string | null;
	system_prompt_override?: string | null;
	memory_cell_id?: string | null;
	settings?: Record<string, unknown>;
}): Promise<DesktopAiChatItem> {
	const { data } = await apiClient.post<DesktopAiChatItem>(
		`${BASE}/chats`,
		body
	);
	return data;
}

export async function patchDesktopAiChat(
	chatId: string,
	body: Partial<{
		title: string;
		project_id: string | null;
		company_id: string | null;
		use_project_rag: boolean;
		llama_model: string | null;
		system_prompt_override: string | null;
		memory_cell_id: string | null;
		clear_memory_cell: boolean;
		settings: Record<string, unknown>;
	}>
): Promise<DesktopAiChatItem> {
	const { data } = await apiClient.patch<DesktopAiChatItem>(
		`${BASE}/chats/${chatId}`,
		body
	);
	return data;
}

export async function deleteDesktopAiChat(chatId: string): Promise<void> {
	await apiClient.delete(`${BASE}/chats/${chatId}`);
}

export async function listDesktopAiMemoryCells(): Promise<
	DesktopAiMemoryCell[]
> {
	const { data } = await apiClient.get<DesktopAiMemoryCellListOut>(
		`${BASE}/memory-cells`
	);
	return data.items ?? [];
}

export async function extractDesktopAiMemoryCell(
	chatId: string,
	body: { mode: 'create' | 'update'; title?: string }
): Promise<DesktopAiMemoryCell> {
	const { data } = await apiClient.post<DesktopAiMemoryCell>(
		`${BASE}/chats/${chatId}/memory-cells/extract`,
		body
	);
	return data;
}

export async function patchDesktopAiMemoryCell(
	cellId: string,
	body: { title?: string; description?: string | null }
): Promise<DesktopAiMemoryCell> {
	const { data } = await apiClient.patch<DesktopAiMemoryCell>(
		`${BASE}/memory-cells/${cellId}`,
		body
	);
	return data;
}

export async function deleteDesktopAiMemoryCell(cellId: string): Promise<void> {
	await apiClient.delete(`${BASE}/memory-cells/${cellId}`);
}

export async function listDesktopAiChatMembers(
	chatId: string
): Promise<DesktopAiChatMember[]> {
	const { data } = await apiClient.get<DesktopAiChatMemberListOut>(
		`${BASE}/chats/${chatId}/members`
	);
	return data.items ?? [];
}

export async function inviteDesktopAiChatMember(
	chatId: string,
	friendUserId: string
): Promise<DesktopAiChatMember> {
	const { data } = await apiClient.post<DesktopAiChatMember>(
		`${BASE}/chats/${chatId}/members/invite`,
		{ friend_user_id: friendUserId }
	);
	return data;
}

export async function removeDesktopAiChatMember(
	chatId: string,
	userId: string
): Promise<DesktopAiChatMember> {
	const { data } = await apiClient.post<DesktopAiChatMember>(
		`${BASE}/chats/${chatId}/members/${userId}/remove`
	);
	return data;
}

export async function leaveDesktopAiChat(chatId: string): Promise<void> {
	await apiClient.post(`${BASE}/chats/${chatId}/leave`);
}

export async function listDesktopAiChatPendingInvites(): Promise<
	DesktopAiChatMember[]
> {
	const { data } = await apiClient.get<DesktopAiChatMemberListOut>(
		`${BASE}/invites/pending`
	);
	return data.items ?? [];
}

export async function acceptDesktopAiChatInvite(
	memberId: string
): Promise<DesktopAiChatMember> {
	const { data } = await apiClient.post<DesktopAiChatMember>(
		`${BASE}/invites/${memberId}/accept`
	);
	return data;
}

export async function declineDesktopAiChatInvite(
	memberId: string
): Promise<DesktopAiChatMember> {
	const { data } = await apiClient.post<DesktopAiChatMember>(
		`${BASE}/invites/${memberId}/decline`
	);
	return data;
}

export async function peekDesktopAiChatStreamLock(
	chatId: string
): Promise<DesktopAiChatStreamLockPeek> {
	const { data } = await apiClient.get<DesktopAiChatStreamLockPeek>(
		`${BASE}/chats/${chatId}/stream-lock`
	);
	return {
		locked: data?.locked === true,
		holder_user_id: data?.holder_user_id ?? null,
		ttl_sec:
			typeof data?.ttl_sec === 'number'
				? data.ttl_sec
				: (data?.ttl_sec ?? null),
	};
}

/** Server tariffs for solo slot UI (matches POST .../solo-slot billing). */
export async function fetchSoloSlotTariffs(): Promise<SoloSlotTariffsResponse> {
	const { data } = await apiClient.get<DesktopAiSoloSlotTariffsOut>(
		`${BASE}/solo-slot-tariffs`
	);
	return data;
}

/** Purchase or extend solo time slot; deducts energy on the server in the same transaction. */
export async function purchaseDesktopAiSoloSlot(
	chatId: string,
	body: { duration_hours: SoloSlotDurationHours; hero_id?: string | null }
): Promise<DesktopAiChatItem> {
	const { data } = await apiClient.post<DesktopAiChatItem>(
		`${BASE}/chats/${chatId}/solo-slot`,
		body
	);
	return data;
}

/** Clear solo slot and hero/prompt without refund (solo chats only). */
export async function releaseDesktopAiSoloSlot(
	chatId: string
): Promise<DesktopAiChatItem> {
	const { data } = await apiClient.post<DesktopAiChatItem>(
		`${BASE}/chats/${chatId}/solo-slot/release`,
		{}
	);
	return data;
}

/** Clears Redis stream lock after a stuck turn_in_progress (client crash). Owner only. */
export async function releaseDesktopAiChatStreamLock(
	chatId: string
): Promise<void> {
	try {
		await apiClient.delete(`${BASE}/chats/${chatId}/stream-lock`);
	} catch (e) {
		if (!(e instanceof APIError) || e.statusCode !== 404) {
			throw e;
		}
		if (/chat not found/i.test(e.message)) {
			throw e;
		}
		await apiClient.post(`${BASE}/chats/${chatId}/stream-lock/release`);
	}
}

export async function listDesktopAiMessages(
	chatId: string,
	options?: { limit?: number; offset?: number; tail?: number }
): Promise<ListDesktopAiMessagesResult> {
	const params: Record<string, number> = {};
	if (options?.tail != null) {
		params.tail = options.tail;
	} else if (options?.limit != null || options?.offset != null) {
		params.limit = options.limit ?? 10_000;
		params.offset = options.offset ?? 0;
	}
	const { data } = await apiClient.get<{
		items: DesktopAiMessage[];
		total: number;
		truncated?: boolean;
	}>(`${BASE}/chats/${chatId}/messages`, {
		params: Object.keys(params).length ? params : undefined,
	});
	const items = data.items ?? [];
	return {
		items,
		total: typeof data.total === 'number' ? data.total : items.length,
		truncated: data.truncated,
	};
}

/** Удалить сообщение user и все сообщения после него в этом чате (ответы ИИ и дальше). */
export async function deleteDesktopAiMessagesFromUserMessage(
	chatId: string,
	messageId: string
): Promise<{ deleted_count: number }> {
	const { data } = await apiClient.delete<DesktopAiMessagesDeleteOut>(
		`${BASE}/chats/${chatId}/messages/${messageId}`
	);
	return data;
}

export async function listDesktopAiAttachments(
	chatId: string
): Promise<DesktopAiAttachment[]> {
	const { data } = await apiClient.get<DesktopAiAttachmentListOut>(
		`${BASE}/chats/${chatId}/attachments`
	);
	return data.items ?? [];
}

/** Optional pre-flight: project vault / RAG access (same checks as stream). */
export async function verifyDesktopAiChatContext(
	chatId: string
): Promise<{ ok: boolean; detail?: string }> {
	const { data } = await apiClient.post<{ ok: boolean; detail?: string }>(
		`${BASE}/chats/${chatId}/verify-context`,
		{}
	);
	return data ?? { ok: false, detail: 'verify-context: empty response' };
}

export async function attachDesktopAiContent(
	chatId: string,
	body: { content_id: string; source_label?: string | null }
): Promise<{
	id: string;
	content_id: string | null;
	rag_index_ok: boolean;
}> {
	const { data } = await apiClient.post(
		`${BASE}/chats/${chatId}/attachments`,
		body
	);
	return data as {
		id: string;
		content_id: string | null;
		rag_index_ok: boolean;
	};
}

export async function uploadContentForChat(file: File): Promise<string> {
	const uploadFile = normalizeFileForMultipartUpload(file);
	const fd = new FormData();
	fd.append('file', uploadFile, uploadFile.name);
	const { data } = await apiClient.post<{ id: string }>('/api/v1/content', fd, {
		params: {
			content_type: 'document',
			name: uploadFile.name,
		},
	});
	if (!data?.id) throw new Error(tDesktopAiApiError('uploadNoId'));
	return data.id;
}

/** Сообщения-артефакты шаблонного документа (план, анализ по blueprint), не обычный болталка. */
export function isDesktopEnsembleBlueprintArtifactMessage(
	m: DesktopAiMessage
): boolean {
	if (m.role !== 'assistant') {
		return false;
	}
	const meta = m.metadata;
	if (!meta) {
		return false;
	}
	if (meta.desktop_ensemble_blueprint === true) {
		return true;
	}
	if (
		typeof meta.plan_template_id === 'string' &&
		meta.plan_template_id.trim()
	) {
		return true;
	}
	return false;
}

/**
 * Сохранить markdown ответа в Unified Content: папка проекта в контент-менеджере
 * (`apply_project_desktop_folder` + `project_desktop_folder_item_id` на бэкенде).
 */
export async function saveDesktopAiBlueprintToProject(params: {
	projectId: string;
	companyId: string | null;
	displayName: string;
	description: string;
	message: DesktopAiMessage;
}): Promise<{ id: string }> {
	const { apiClient: client } = await import('../../../../services/api/client');
	const body = (params.message.content ?? '').trim();
	if (!body) {
		throw new Error('empty_message');
	}
	const safeSlug = params.displayName
		.replace(/[^\w\-\s\u0400-\u04FF]+/g, '_')
		.replace(/_+/g, '_')
		.trim()
		.slice(0, 96);
	const filename = `${safeSlug || 'desktop-ai-plan'}_${params.message.id.slice(0, 8)}.md`;
	const blob = new Blob([body], {
		type: 'text/markdown;charset=utf-8',
	});
	const file = new File([blob], filename, { type: 'text/markdown' });
	const fd = new FormData();
	fd.append('file', file);
	const q: Record<string, string | boolean> = {
		name: params.displayName.slice(0, 200),
		description: params.description.slice(0, 4000),
		tags: 'desktop-ai-chat,ensemble,blueprint,markdown',
		content_type: 'document',
		visibility: 'private',
		apply_project_desktop_folder: true,
		source_service: 'desktop_ai_chat',
		project_id: params.projectId,
	};
	if (params.companyId && String(params.companyId).trim()) {
		q.company_id = String(params.companyId).trim();
	}
	const { data } = await client.post<{ id: string }>('/api/v1/content', fd, {
		params: q,
		headers: { 'Content-Type': 'multipart/form-data' },
	});
	if (!data?.id) {
		throw new Error('content_upload_no_id');
	}
	return { id: data.id };
}

export async function voiceGatewayTranscribe(file: File): Promise<string> {
	const { apiClient: client } = await import('../../../../services/api/client');
	const fd = new FormData();
	fd.append('file', file);
	const { data } = await client.post<{ text: string }>(
		'/api/v1/voice-gateway/transcribe',
		fd
	);
	return data.text ?? '';
}

export async function voiceGatewaySynthesize(
	text: string,
	options?: VoiceGatewaySynthesizeOptions
): Promise<string> {
	const { apiClient: client } = await import('../../../../services/api/client');
	const voice = (options?.voice ?? 'xenia').trim() || 'xenia';
	const speed = options?.speed ?? 1;
	const maxChars = Math.max(1, Math.min(options?.maxChars ?? 1200, 5000));
	const { data } = await client.post<{ audio_url?: string }>(
		'/api/v1/voice-gateway/synthesize',
		{ text: text.slice(0, maxChars), voice, speed },
		{ timeout: API_CONFIG.longTimeout }
	);
	const u = data.audio_url;
	if (!u) throw new Error(tDesktopAiApiError('ttsNoAudioUrl'));
	return u;
}

/** Видимые пользователю проекты (маркетинг) для привязки чата. */
export async function listAccessibleProjects(
	limit = 100
): Promise<DesktopAiProjectRow[]> {
	const { data } = await apiClient.get<
		Array<{ id: string; name: string; company_id: string }>
	>('/api/v1/projects', { params: { limit } });
	const rows = data ?? [];
	return rows.map((p) => ({
		id: String(p.id),
		name: p.name,
		company_id: String(p.company_id),
	}));
}
