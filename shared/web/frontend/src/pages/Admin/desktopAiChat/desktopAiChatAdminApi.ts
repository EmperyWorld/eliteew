/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP helpers for Desktop AI Chat admin endpoints.
 *
 * Related:
 * - api/routers/desktop_admin_ai_chat.py
 */

import { apiClient, APIError } from '../../../services/api/client';
import type {
	DesktopAiChatPromptTemplateRow,
	DesktopAiChatProbeResponse,
} from './desktopAiChatAdminTypes';

export const DESKTOP_AI_CHAT_ADMIN_BASE = '/api/v1/desktop/admin/ai-chat';

export function isDesktopAiChatAdminForbidden(error: unknown): boolean {
	return error instanceof APIError && error.statusCode === 403;
}

export async function fetchDesktopAiChatAdminConfig(): Promise<
	Record<string, unknown>
> {
	const res = await apiClient.get<{ defaults: Record<string, unknown> }>(
		`${DESKTOP_AI_CHAT_ADMIN_BASE}/config`
	);
	return res.data.defaults ?? {};
}

export async function patchDesktopAiChatAdminConfig(
	defaults: Record<string, unknown>
): Promise<Record<string, unknown>> {
	const res = await apiClient.patch<{ defaults: Record<string, unknown> }>(
		`${DESKTOP_AI_CHAT_ADMIN_BASE}/config`,
		{ defaults }
	);
	return res.data.defaults ?? {};
}

export async function fetchDesktopAiChatPromptTemplates(): Promise<
	DesktopAiChatPromptTemplateRow[]
> {
	const res = await apiClient.get<{ items: DesktopAiChatPromptTemplateRow[] }>(
		`${DESKTOP_AI_CHAT_ADMIN_BASE}/prompt-templates`
	);
	return res.data.items ?? [];
}

export async function createDesktopAiChatPromptTemplate(body: {
	template_key: string;
	display_name: string;
	system_prompt: string;
	is_active?: boolean;
	sort_order?: number;
}): Promise<DesktopAiChatPromptTemplateRow> {
	const res = await apiClient.post<DesktopAiChatPromptTemplateRow>(
		`${DESKTOP_AI_CHAT_ADMIN_BASE}/prompt-templates`,
		body
	);
	return res.data;
}

export async function patchDesktopAiChatPromptTemplate(
	templateId: string,
	body: Partial<{
		display_name: string;
		system_prompt: string;
		is_active: boolean;
		sort_order: number;
	}>
): Promise<DesktopAiChatPromptTemplateRow> {
	const res = await apiClient.patch<DesktopAiChatPromptTemplateRow>(
		`${DESKTOP_AI_CHAT_ADMIN_BASE}/prompt-templates/${templateId}`,
		body
	);
	return res.data;
}

export async function deleteDesktopAiChatPromptTemplate(
	templateId: string
): Promise<void> {
	await apiClient.delete(
		`${DESKTOP_AI_CHAT_ADMIN_BASE}/prompt-templates/${templateId}`
	);
}

export async function runDesktopAiChatAdminProbe(): Promise<DesktopAiChatProbeResponse> {
	const res = await apiClient.post<DesktopAiChatProbeResponse>(
		`${DESKTOP_AI_CHAT_ADMIN_BASE}/probe`
	);
	return res.data;
}
