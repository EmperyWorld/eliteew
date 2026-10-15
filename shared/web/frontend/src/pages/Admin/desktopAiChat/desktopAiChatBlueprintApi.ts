/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP helpers for ensemble plan template admin under Desktop AI Chat hub.
 *
 * Related:
 * - api/routers/desktop_admin_ai_chat.py
 */

import { apiClient } from '../../../services/api/client';
import { isDesktopAiChatAdminForbidden } from './desktopAiChatAdminApi';
import type {
	EnsemblePlanBuiltinItem,
	EnsemblePlanDraftRow,
} from './desktopAiChatBlueprintTypes';

export { isDesktopAiChatAdminForbidden };

const BLUEPRINT_BASE = '/api/v1/desktop/admin/ai-chat/ensemble-plan-templates';

export async function fetchEnsemblePlanDrafts(): Promise<
	EnsemblePlanDraftRow[]
> {
	const res = await apiClient.get<{ items: EnsemblePlanDraftRow[] }>(
		BLUEPRINT_BASE
	);
	return res.data.items ?? [];
}

export async function fetchEnsemblePlanBuiltins(): Promise<
	EnsemblePlanBuiltinItem[]
> {
	const res = await apiClient.get<{ items: EnsemblePlanBuiltinItem[] }>(
		`${BLUEPRINT_BASE}/builtins`
	);
	return res.data.items ?? [];
}

export async function fetchEnsemblePlanDraft(
	id: string
): Promise<EnsemblePlanDraftRow> {
	const res = await apiClient.get<EnsemblePlanDraftRow>(
		`${BLUEPRINT_BASE}/${id}`
	);
	return res.data;
}

export async function fetchEnsemblePlanBuiltinBody(
	builtinId: string
): Promise<{ template: Record<string, unknown>; keywords: string[] }> {
	const res = await apiClient.get<{
		template: Record<string, unknown>;
		keywords: string[];
	}>(`${BLUEPRINT_BASE}/builtins/${encodeURIComponent(builtinId)}`);
	return res.data;
}

export async function createEnsemblePlanDraft(body: {
	template_id: string;
	title: string;
	description: string;
	keywords: string[];
	sort_order: number;
	is_active: boolean;
	body: Record<string, unknown>;
}): Promise<EnsemblePlanDraftRow> {
	const res = await apiClient.post<EnsemblePlanDraftRow>(BLUEPRINT_BASE, body);
	return res.data;
}

export async function patchEnsemblePlanDraft(
	id: string,
	body: Partial<{
		title: string;
		description: string;
		keywords: string[];
		sort_order: number;
		is_active: boolean;
		body: Record<string, unknown>;
	}>
): Promise<EnsemblePlanDraftRow> {
	const res = await apiClient.patch<EnsemblePlanDraftRow>(
		`${BLUEPRINT_BASE}/${id}`,
		body
	);
	return res.data;
}

export async function deleteEnsemblePlanDraft(id: string): Promise<void> {
	await apiClient.delete(`${BLUEPRINT_BASE}/${id}`);
}

export async function validateEnsemblePlanBody(body: {
	template_id?: string;
	body: Record<string, unknown>;
}): Promise<void> {
	await apiClient.post(`${BLUEPRINT_BASE}/validate`, body);
}

export async function duplicateEnsemblePlanBuiltin(body: {
	source_id: string;
	new_template_id: string;
	title?: string;
}): Promise<void> {
	await apiClient.post(`${BLUEPRINT_BASE}/duplicate-builtin`, body);
}
