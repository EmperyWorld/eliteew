/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin write client for planned maintenance windows (`/api/admin/system/maintenance/*`).
 *
 * Invariants:
 * - Public GET stays in services/maintenance/maintenanceState.ts.
 * - Admin mutations require admin JWT (same as other adminApi routes).
 *
 * Related:
 * - documentation/platform/USER-SAFE-RESTARTS-AND-MAINTENANCE.md
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { apiClient } from '@/services/api';

const BASE = '/api/admin/system/maintenance';

export type MaintenancePhase =
	| 'scheduled'
	| 'warning'
	| 'draining'
	| 'active'
	| 'recovering'
	| 'completed'
	| 'cancelled';

export type MaintenanceKind =
	| 'stack0_restart'
	| 'frontend_deploy'
	| 'api_restart'
	| 'workers_restart'
	| 'full_maintenance'
	| 'emergency';

export interface MaintenanceWindow {
	id: string;
	kind: MaintenanceKind;
	phase: MaintenancePhase;
	active: boolean;
	starts_at?: string | null;
	expected_ends_at?: string | null;
	notice_before_seconds?: number;
	retry_after_seconds?: number;
	title: string;
	message: string;
	user_impact?: string;
}

export interface MaintenanceStatus {
	active: boolean;
	window: MaintenanceWindow | null;
}

export interface MaintenanceWindowUpsertBody {
	id?: string;
	kind?: MaintenanceKind;
	phase?: MaintenancePhase;
	starts_at?: string | null;
	expected_ends_at?: string | null;
	notice_before_seconds?: number;
	retry_after_seconds?: number;
	title?: string;
	message?: string;
	user_impact?: string;
}

export async function getAdminMaintenanceStatus(): Promise<MaintenanceStatus> {
	const out = await apiClient.get<MaintenanceStatus>(
		'/api/v1/system/maintenance'
	);
	return out.data;
}

export async function scheduleAdminMaintenance(
	body: MaintenanceWindowUpsertBody
): Promise<MaintenanceStatus> {
	const out = await apiClient.post<MaintenanceStatus>(`${BASE}/schedule`, body);
	return out.data;
}

export async function setAdminMaintenancePhase(
	phase: MaintenancePhase
): Promise<MaintenanceStatus> {
	const out = await apiClient.post<MaintenanceStatus>(
		`${BASE}/phase/${encodeURIComponent(phase)}`
	);
	return out.data;
}

export async function clearAdminMaintenance(): Promise<MaintenanceStatus> {
	const out = await apiClient.delete<MaintenanceStatus>(BASE);
	return out.data;
}

export interface MaintenanceDeployDefaults {
	notice_before_seconds: number;
	expected_downtime_seconds: number;
	title: string;
	message_template: string;
	user_impact_template: string;
	updated_at?: string | null;
	updated_by?: string | null;
}

export interface MaintenanceDeployDefaultsPreview {
	defaults: MaintenanceDeployDefaults;
	preview: {
		starts_at: string;
		expected_ends_at: string;
		starts_at_local: string;
		ends_at_local: string;
		title: string;
		message: string;
		user_impact: string;
	};
}

export interface MaintenanceDeployDefaultsUpdateBody {
	notice_before_seconds?: number;
	expected_downtime_seconds?: number;
	title?: string;
	message_template?: string;
	user_impact_template?: string;
}

export async function getAdminMaintenanceDeployDefaults(): Promise<MaintenanceDeployDefaultsPreview> {
	const out = await apiClient.get<MaintenanceDeployDefaultsPreview>(
		`${BASE}/defaults`
	);
	return out.data;
}

export async function putAdminMaintenanceDeployDefaults(
	body: MaintenanceDeployDefaultsUpdateBody
): Promise<MaintenanceDeployDefaults> {
	const out = await apiClient.put<MaintenanceDeployDefaults>(
		`${BASE}/defaults`,
		body
	);
	return out.data;
}
