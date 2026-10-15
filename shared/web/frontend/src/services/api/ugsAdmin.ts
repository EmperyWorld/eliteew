/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS legacy Admin HTTP client for providers, types, workflows, settings, and user limits.
 *
 * Invariants:
 * - Base URL stays `/api/v1/ugs/admin`; legacy `/api/ugs/admin` is server-side compatibility only.
 * - Response DTOs are generated-backed aliases where backend exposes concrete OpenAPI schemas.
 *
 * Related:
 * - services/api/ugs/schemas.ts
 * - api/routers/ugs_admin.py
 */

import { createAPIClient } from './client';
import type {
	UgsAdminComfyWorkflowSchema,
	UgsAdminProviderSchema,
	UgsAdminSettingsListSchema,
	UgsAdminTypeSchema,
	UgsAdminUserLimitsUpdateSchema,
	UgsAdminUserSchema,
} from './ugs/schemas';

/** Matches FastAPI mount `prefix="/api/v1/ugs/admin"` (`shared/api/domains/bi_ugs.py`). */
const client = createAPIClient({ baseURL: '/api/v1/ugs/admin' });

export type GenerationProviderDTO = UgsAdminProviderSchema;

export interface RuntimeProviderBootstrapResultDTO {
	created: string[];
	skipped: string[];
	total_created: number;
	total_skipped: number;
}

export type GenerationTypeDTO = UgsAdminTypeSchema;

export type ComfyUIWorkflowDTO = UgsAdminComfyWorkflowSchema;

export interface ComfyUIWorkflowImportResult {
	directory: string;
	total_files: number;
	imported: number;
	updated: number;
	skipped: number;
	errors: Array<{
		file: string;
		error: string;
	}>;
	slugs: string[];
}

export interface UGSSettingDTO {
	id: string;
	scope: 'global' | 'company' | 'project' | 'user';
	key: string;
	value: Record<string, unknown>;
	description?: string | null;
	company_id?: string | null;
	project_id?: string | null;
	user_id?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
}

export type UGSSettingsListDTO = UgsAdminSettingsListSchema;

export type AdminUserDTO = UgsAdminUserSchema;

export type UserLimitsUpdatePayload = UgsAdminUserLimitsUpdateSchema;

// Providers -----------------------------------------------------------------

export const getProviders = async (): Promise<GenerationProviderDTO[]> => {
	const { data } = await client.get<GenerationProviderDTO[]>('/providers');
	return data;
};

export const createProvider = async (
	payload: Partial<GenerationProviderDTO>
): Promise<GenerationProviderDTO> => {
	const { data } = await client.post<GenerationProviderDTO>(
		'/providers',
		payload
	);
	return data;
};

export const updateProvider = async (
	providerName: string,
	payload: Partial<GenerationProviderDTO>
): Promise<GenerationProviderDTO> => {
	const { data } = await client.put<GenerationProviderDTO>(
		`/providers/${providerName}`,
		payload
	);
	return data;
};

export const deleteProvider = async (providerName: string): Promise<void> => {
	await client.delete(`/providers/${providerName}`);
};

export const bootstrapRuntimeProviders =
	async (): Promise<RuntimeProviderBootstrapResultDTO> => {
		const { data } = await client.post<RuntimeProviderBootstrapResultDTO>(
			'/providers/bootstrap-runtime'
		);
		return data;
	};

/** Fetch list of model names from an Llama instance (for provider default_model selector). */
export const getLlamaModels = async (baseUrl: string): Promise<string[]> => {
	const { data } = await client.get<{ models: string[] }>('/llama-models', {
		params: { base_url: baseUrl.replace(/\/$/, '') },
	});
	return data?.models ?? [];
};

// Generation Types -----------------------------------------------------------

export const getGenerationTypes = async (
	includeInactive = true
): Promise<GenerationTypeDTO[]> => {
	const { data } = await client.get<GenerationTypeDTO[]>('/types', {
		params: { include_inactive: includeInactive },
	});
	return data;
};

export const createGenerationType = async (
	payload: Partial<GenerationTypeDTO>
): Promise<GenerationTypeDTO> => {
	const { data } = await client.post<GenerationTypeDTO>('/types', payload);
	return data;
};

export const updateGenerationType = async (
	typeKey: string,
	payload: Partial<GenerationTypeDTO>
): Promise<GenerationTypeDTO> => {
	const { data } = await client.put<GenerationTypeDTO>(
		`/types/${typeKey}`,
		payload
	);
	return data;
};

export const deleteGenerationType = async (typeKey: string): Promise<void> => {
	await client.delete(`/types/${typeKey}`);
};

// Workflows ------------------------------------------------------------------

export const getWorkflows = async (
	includeInactive = false
): Promise<ComfyUIWorkflowDTO[]> => {
	const { data } = await client.get<ComfyUIWorkflowDTO[]>('/workflows', {
		params: { include_inactive: includeInactive },
	});
	return data;
};

export const createWorkflow = async (
	payload: Partial<ComfyUIWorkflowDTO>
): Promise<ComfyUIWorkflowDTO> => {
	const { data } = await client.post<ComfyUIWorkflowDTO>('/workflows', payload);
	return data;
};

export const importWorkflowsFromDisk = async (
	overwriteExisting = true
): Promise<ComfyUIWorkflowImportResult> => {
	const { data } = await client.post<ComfyUIWorkflowImportResult>(
		'/workflows/import-from-disk',
		null,
		{
			params: { overwrite_existing: overwriteExisting },
		}
	);
	return data;
};

export const updateWorkflow = async (
	slug: string,
	payload: Partial<ComfyUIWorkflowDTO>
): Promise<ComfyUIWorkflowDTO> => {
	const { data } = await client.put<ComfyUIWorkflowDTO>(
		`/workflows/${slug}`,
		payload
	);
	return data;
};

export const deleteWorkflow = async (slug: string): Promise<void> => {
	await client.delete(`/workflows/${slug}`);
};

// Settings -------------------------------------------------------------------

interface SettingsQueryParams {
	scope?: string;
	company_id?: string;
	project_id?: string;
	user_id?: string;
}

export const getSettings = async (
	params: SettingsQueryParams = {}
): Promise<UGSSettingsListDTO> => {
	const { data } = await client.get<UGSSettingsListDTO>('/settings', {
		params,
	});
	return data;
};

export const createSetting = async (
	payload: Partial<UGSSettingDTO>
): Promise<UGSSettingDTO> => {
	const { data } = await client.post<UGSSettingDTO>('/settings', payload);
	return data;
};

export const updateSetting = async (
	id: string,
	payload: Partial<UGSSettingDTO>
): Promise<UGSSettingDTO> => {
	const { data } = await client.put<UGSSettingDTO>(`/settings/${id}`, payload);
	return data;
};

export const deleteSetting = async (id: string): Promise<void> => {
	await client.delete(`/settings/${id}`);
};

// Users ----------------------------------------------------------------------

export const getAdminUsers = async (): Promise<AdminUserDTO[]> => {
	const { data } = await client.get<AdminUserDTO[]>('/users');
	return data;
};

export const getAdminUser = async (userId: string): Promise<AdminUserDTO> => {
	const { data } = await client.get<AdminUserDTO>(`/users/${userId}`);
	return data;
};

export const topUpUserCredits = async (
	userId: string,
	amount: number,
	reason?: string
): Promise<AdminUserDTO> => {
	const { data } = await client.post<AdminUserDTO>(`/users/${userId}/credits`, {
		amount,
		reason,
	});
	return data;
};

export const updateUserLimits = async (
	userId: string,
	payload: UserLimitsUpdatePayload
): Promise<AdminUserDTO> => {
	const { data } = await client.put<AdminUserDTO>(
		`/users/${userId}/limits`,
		payload
	);
	return data;
};

export const patchUserTrusted = async (
	userId: string,
	isTrusted: boolean
): Promise<AdminUserDTO> => {
	const { data } = await client.patch<AdminUserDTO>(
		`/users/${userId}/trusted`,
		{ is_trusted: isTrusted }
	);
	return data;
};

export const patchUserAdminBadge = async (
	userId: string,
	payload: { label: string | null; hint: string | null }
): Promise<AdminUserDTO> => {
	const { data } = await client.patch<AdminUserDTO>(
		`/users/${userId}/admin-badge`,
		{ label: payload.label, hint: payload.hint }
	);
	return data;
};
