/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed HTTP client for KIRS project-scoped Site Studio instances.
 * Reuses shared Site Studio runtime shapes while preserving project-specific API paths.
 *
 * Invariants:
 * - KIRS authorization lives on backend routes; this client only calls authenticated Desktop endpoints.
 * - Lifecycle diagnostics are consumed through the shared `SiteStudioHealth` shape.
 *
 * Related:
 * - `pages/Kirs/KirsPage.tsx`
 * - `api/routers/kirs.py`
 */
import { apiClient } from '@/services/api/client';
import type {
	SiteStudioActionResponse,
	SiteStudioDomainBinding,
	SiteStudioHealth,
} from '@/features/site-studio/desktop/api';
import type { SiteStudioInstance } from '@/features/site-studio/desktop/api';

export const KIRS_API_BASE = '/api/v1/desktop/kirs';
export const SITE_MANAGER_OPS_API_BASE = '/api/v1/desktop/site-manager/ops';

export interface KirsOperatorProjectRow {
	project_id: string;
	project_name: string;
	company_name: string;
}

export interface KirsClientSiteContext {
	project_id: string;
	has_instance: boolean;
	status: string | null;
	public_url: string | null;
	allow_public_site: boolean;
	allow_admin_embed: boolean;
	admin_embed_available: boolean;
	readiness_status:
		| 'preparing'
		| 'ready_for_review'
		| 'published'
		| 'paused'
		| string;
	approval_status:
		| 'not_requested'
		| 'requested'
		| 'approved'
		| 'changes_requested'
		| string;
	client_feedback: string;
}

export interface KirsCollaborationState {
	instance_id: string | null;
	marketing_project_id: string | null;
	readiness_status: 'preparing' | 'ready_for_review' | 'published' | 'paused';
	approval_status:
		| 'not_requested'
		| 'requested'
		| 'approved'
		| 'changes_requested';
	operator_notes: string;
	handoff_checklist: Record<string, unknown>;
}

export async function listKirsOperatorProjects(): Promise<
	KirsOperatorProjectRow[]
> {
	const { data } = await apiClient.get<KirsOperatorProjectRow[]>(
		`${KIRS_API_BASE}/operator-projects`
	);
	return data;
}

export async function getKirsProjectInstance(
	projectId: string
): Promise<SiteStudioInstance | null> {
	const { data } = await apiClient.get<SiteStudioInstance | null>(
		`${KIRS_API_BASE}/projects/${projectId}/instance`
	);
	return data;
}

export async function createKirsProjectInstance(
	projectId: string,
	body: {
		site_title: string;
		site_topic?: string;
		brief_json?: Record<string, unknown>;
		template_key?: string;
	}
): Promise<SiteStudioInstance> {
	const { data } = await apiClient.post<SiteStudioInstance>(
		`${KIRS_API_BASE}/projects/${projectId}/instance`,
		body
	);
	return data;
}

export async function updateKirsProjectInstance(
	projectId: string,
	body: {
		site_title?: string;
		site_topic?: string;
		brief_json?: Record<string, unknown>;
	}
): Promise<SiteStudioInstance> {
	const { data } = await apiClient.patch<SiteStudioInstance>(
		`${KIRS_API_BASE}/projects/${projectId}/instance`,
		body
	);
	return data;
}

export async function updateKirsClientAccess(
	projectId: string,
	body: { allow_public_site: boolean; allow_admin_embed: boolean }
): Promise<SiteStudioInstance> {
	const { data } = await apiClient.patch<SiteStudioInstance>(
		`${KIRS_API_BASE}/projects/${projectId}/instance/client-access`,
		body
	);
	return data;
}

export async function deleteKirsProjectInstance(
	projectId: string,
	preserveRuntimeData = false
): Promise<void> {
	await apiClient.delete(`${KIRS_API_BASE}/projects/${projectId}/instance`, {
		params: preserveRuntimeData ? { preserve_runtime_data: true } : undefined,
	});
}

export async function provisionKirsInstance(
	projectId: string
): Promise<SiteStudioActionResponse> {
	const { data } = await apiClient.post<SiteStudioActionResponse>(
		`${KIRS_API_BASE}/projects/${projectId}/instance/provision`
	);
	return data;
}

export async function startKirsInstance(
	projectId: string
): Promise<SiteStudioActionResponse> {
	const { data } = await apiClient.post<SiteStudioActionResponse>(
		`${KIRS_API_BASE}/projects/${projectId}/instance/start`
	);
	return data;
}

export async function stopKirsInstance(
	projectId: string
): Promise<SiteStudioActionResponse> {
	const { data } = await apiClient.post<SiteStudioActionResponse>(
		`${KIRS_API_BASE}/projects/${projectId}/instance/stop`
	);
	return data;
}

export async function redeployKirsInstance(
	projectId: string
): Promise<SiteStudioActionResponse> {
	const { data } = await apiClient.post<SiteStudioActionResponse>(
		`${KIRS_API_BASE}/projects/${projectId}/instance/redeploy`
	);
	return data;
}

export async function getKirsInstanceHealth(
	projectId: string
): Promise<SiteStudioHealth> {
	const { data } = await apiClient.get<SiteStudioHealth>(
		`${KIRS_API_BASE}/projects/${projectId}/instance/health`
	);
	return data;
}

export async function listKirsDomainBindings(
	projectId: string
): Promise<SiteStudioDomainBinding[]> {
	const { data } = await apiClient.get<SiteStudioDomainBinding[]>(
		`${KIRS_API_BASE}/projects/${projectId}/instance/domains`
	);
	return data;
}

export async function createKirsDomainBinding(
	projectId: string,
	hostname: string
): Promise<SiteStudioDomainBinding> {
	const { data } = await apiClient.post<SiteStudioDomainBinding>(
		`${KIRS_API_BASE}/projects/${projectId}/instance/domains`,
		{ hostname }
	);
	return data;
}

export async function verifyKirsDomainBinding(
	projectId: string,
	bindingId: string
): Promise<SiteStudioDomainBinding> {
	const { data } = await apiClient.post<SiteStudioDomainBinding>(
		`${KIRS_API_BASE}/projects/${projectId}/instance/domains/${bindingId}/verify`
	);
	return data;
}

export async function requestKirsDomainRoute(
	projectId: string,
	bindingId: string
): Promise<SiteStudioDomainBinding> {
	const { data } = await apiClient.post<SiteStudioDomainBinding>(
		`${KIRS_API_BASE}/projects/${projectId}/instance/domains/${bindingId}/request-route`
	);
	return data;
}

export async function activateKirsDomainBinding(
	projectId: string,
	bindingId: string
): Promise<SiteStudioDomainBinding> {
	const { data } = await apiClient.post<SiteStudioDomainBinding>(
		`${KIRS_API_BASE}/projects/${projectId}/instance/domains/${bindingId}/activate`
	);
	return data;
}

export async function disableKirsDomainBinding(
	projectId: string,
	bindingId: string
): Promise<SiteStudioDomainBinding> {
	const { data } = await apiClient.post<SiteStudioDomainBinding>(
		`${KIRS_API_BASE}/projects/${projectId}/instance/domains/${bindingId}/disable`
	);
	return data;
}

export async function getKirsClientSiteContext(
	projectId: string
): Promise<KirsClientSiteContext> {
	const { data } = await apiClient.get<KirsClientSiteContext>(
		`${KIRS_API_BASE}/client/projects/${projectId}/site`
	);
	return data;
}

export async function updateKirsClientSiteApproval(
	projectId: string,
	body: { action: 'approve' | 'request_changes'; message?: string | null }
): Promise<KirsClientSiteContext> {
	const { data } = await apiClient.post<KirsClientSiteContext>(
		`${KIRS_API_BASE}/client/projects/${projectId}/site/approval`,
		body
	);
	return data;
}

export async function getKirsCollaborationState(
	projectId: string
): Promise<KirsCollaborationState> {
	const { data } = await apiClient.get<KirsCollaborationState>(
		`${SITE_MANAGER_OPS_API_BASE}/kirs/projects/${projectId}/collaboration`
	);
	return data;
}

export async function updateKirsCollaborationState(
	projectId: string,
	body: Partial<
		Pick<
			KirsCollaborationState,
			| 'readiness_status'
			| 'approval_status'
			| 'operator_notes'
			| 'handoff_checklist'
		>
	>
): Promise<KirsCollaborationState> {
	const { data } = await apiClient.patch<KirsCollaborationState>(
		`${SITE_MANAGER_OPS_API_BASE}/kirs/projects/${projectId}/collaboration`,
		body
	);
	return data;
}
