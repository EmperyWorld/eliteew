/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Admin v2 API client: snapshot, validation, and safe bulk operations.
 *
 * Invariants:
 * - Base URL must match FastAPI mount `prefix="/api/v1/ugs/admin"`.
 * - Bulk apply must never bypass backend validation; warnings require explicit allow_warnings.
 *
 * Related:
 * - shared/api/routers/ugs_admin.py (v2 endpoints)
 * - src/hooks/api/useUgsAdminV2.ts
 */

import { createAPIClient } from './client';
import type {
	ComfyUIWorkflowDTO,
	GenerationProviderDTO,
	GenerationTypeDTO,
	UGSSettingDTO,
	UGSSettingsListDTO,
} from './ugsAdmin';
import type {
	UgsAdminV2BulkApplyRequestSchema,
	UgsAdminV2BulkApplyResultSchema,
	UgsAdminV2SnapshotSchema,
	UgsAdminV2ValidationIssueSchema,
} from './ugs/schemas';

const client = createAPIClient({ baseURL: '/api/v1/ugs/admin' });

export type UgsAdminV2IssueSeverity = 'error' | 'warning' | 'info';
export type UgsAdminV2EntityType =
	| 'provider'
	| 'type'
	| 'workflow'
	| 'settings'
	| 'model_route'
	| 'config_source';

export type UgsAdminV2ValidationIssueDTO = UgsAdminV2ValidationIssueSchema;

export interface UgsAdminV2ModelRoutesDTO {
	global_default_model?: string | null;
	provider_defaults: Record<string, string | null>;
	category_defaults: Record<string, string | null>;
	domain_defaults: Record<string, string | null>;
	type_overrides: Record<string, string | null>;
	request_model_override_allowlist: string[];
}

export interface UgsAdminV2ModelInventoryItemDTO {
	provider_name: string;
	model_id: string;
	label?: string | null;
	enabled: boolean;
	source: string;
	capabilities: string[];
}

export interface UgsAdminV2ResolvedModelDTO {
	type_key: string;
	provider: string;
	category?: string | null;
	domain?: string | null;
	resolved_model?: string | null;
	source: string;
	warnings: string[];
}

export interface UgsAdminV2ConfigSourceAuditItemDTO {
	key: string;
	severity: UgsAdminV2IssueSeverity;
	source_type: 'env' | 'hardcode' | 'file' | 'db';
	message: string;
	recommendation?: string | null;
}

export interface UgsAdminV2AutofixRecommendationDTO {
	id: string;
	title: string;
	description: string;
	severity: UgsAdminV2IssueSeverity;
	operations: UgsAdminV2BulkOperation[];
	affected_count: number;
}

export interface UgsAdminV2SnapshotDTO
	extends Omit<
		UgsAdminV2SnapshotSchema,
		| 'providers'
		| 'types'
		| 'workflows'
		| 'settings'
		| 'autofix_recommendations'
		| 'issues'
	> {
	providers: GenerationProviderDTO[];
	types: GenerationTypeDTO[];
	workflows: ComfyUIWorkflowDTO[];
	settings: UGSSettingsListDTO;
	model_routes: UgsAdminV2ModelRoutesDTO;
	model_inventory: UgsAdminV2ModelInventoryItemDTO[];
	resolved_models_by_type: UgsAdminV2ResolvedModelDTO[];
	config_source_audit: UgsAdminV2ConfigSourceAuditItemDTO[];
	autofix_recommendations: UgsAdminV2AutofixRecommendationDTO[];
	issues: UgsAdminV2ValidationIssueDTO[];
}

export interface UgsAdminV2ProviderCreateDTO {
	provider_name: string;
	provider_type: string;
	base_url?: string | null;
	api_key_required?: boolean;
	health_endpoint?: string | null;
	timeout_seconds?: number;
	max_concurrent?: number;
	enabled?: boolean;
	cost_per_request?: number;
	fallback_priority?: number;
	fallback_for?: string[];
	config_json?: Record<string, unknown>;
	display_label?: string | null;
}

export type UgsAdminV2BulkOperation =
	| {
			kind: 'provider.create';
			provider: UgsAdminV2ProviderCreateDTO;
	  }
	| {
			kind: 'provider.patch';
			provider_names: string[];
			patch: Partial<GenerationProviderDTO>;
	  }
	| {
			kind: 'provider.set_enabled';
			provider_names: string[];
			enabled: boolean;
	  }
	| {
			kind: 'type.create';
			generation_type: {
				type_key: string;
				category: string;
				display_name: string;
				description?: string | null;
				provider: string;
				model_name?: string | null;
				parameters?: Record<string, unknown>;
				complexity?: string;
				estimated_time?: number;
				max_retries?: number;
				priority?: number;
				cost_credits?: number;
				is_active?: boolean;
				metadata?: Record<string, unknown>;
			};
	  }
	| {
			kind: 'type.patch';
			type_keys: string[];
			patch: Partial<GenerationTypeDTO>;
	  }
	| {
			kind: 'type.set_active';
			type_keys: string[];
			is_active: boolean;
	  }
	| {
			kind: 'type.clear_model_names';
			type_keys: string[];
	  }
	| {
			kind: 'workflow.create';
			workflow: {
				name: string;
				slug: string;
				category?: string | null;
				description?: string | null;
				json_body: Record<string, unknown>;
				model_dependencies?: string[];
				metadata?: Record<string, unknown>;
				estimated_time?: number | null;
				version?: number;
				is_active?: boolean;
			};
	  }
	| {
			kind: 'workflow.patch';
			slugs: string[];
			patch: Partial<ComfyUIWorkflowDTO>;
	  }
	| {
			kind: 'workflow.set_active';
			slugs: string[];
			is_active: boolean;
	  }
	| {
			kind: 'model_routes.patch';
			routes: UgsAdminV2ModelRoutesDTO;
	  }
	| {
			kind: 'model_routes.replace';
			routes: UgsAdminV2ModelRoutesDTO;
	  }
	| {
			kind: 'provider.default_model.set';
			provider_names: string[];
			default_model: string;
	  }
	| {
			kind: 'provider.models.refresh';
			provider_names: string[];
	  }
	| {
			kind: 'workflow.import_from_disk';
			overwrite_existing: boolean;
	  }
	| {
			kind: 'settings.create';
			setting: {
				scope: UGSSettingDTO['scope'];
				key: string;
				value: Record<string, unknown>;
				description?: string | null;
				company_id?: string | null;
				project_id?: string | null;
				user_id?: string | null;
			};
	  }
	| {
			kind: 'settings.patch';
			setting_ids: string[];
			patch: {
				value?: Record<string, unknown> | null;
				description?: string | null;
				company_id?: string | null;
				project_id?: string | null;
				user_id?: string | null;
			};
	  }
	| {
			kind: 'settings.delete';
			setting_ids: string[];
	  };

export const getUgsAdminV2Snapshot =
	async (): Promise<UgsAdminV2SnapshotDTO> => {
		const { data } = await client.get<UgsAdminV2SnapshotDTO>('/v2/snapshot');
		return data;
	};

export const validateUgsAdminV2Operations = async (
	operations: UgsAdminV2BulkOperation[]
): Promise<UgsAdminV2ValidationIssueDTO[]> => {
	const { data } = await client.post<UgsAdminV2ValidationIssueDTO[]>(
		'/v2/validate',
		{ operations }
	);
	return data ?? [];
};

export type UgsAdminV2BulkApplyResultDTO = UgsAdminV2BulkApplyResultSchema;

export type UgsAdminV2BulkApplyPayload = Omit<
	UgsAdminV2BulkApplyRequestSchema,
	'operations'
> & {
	operations: UgsAdminV2BulkOperation[];
};

export const bulkApplyUgsAdminV2Operations = async (
	payload: UgsAdminV2BulkApplyPayload
): Promise<UgsAdminV2BulkApplyResultDTO> => {
	const { data } = await client.post<UgsAdminV2BulkApplyResultDTO>(
		'/v2/bulk',
		payload
	);
	return data;
};
