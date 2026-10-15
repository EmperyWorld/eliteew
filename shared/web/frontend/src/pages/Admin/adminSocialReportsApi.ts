/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP client for Social Hub admin report moderation (`/api/v1/friends/admin/reports`).
 *
 * Invariants:
 * - Admin-only; caller must already pass Unified Admin RBAC gate.
 * - Payloads are summary-only (no private notes).
 *
 * Related:
 * - api/routers/friends_admin_reports.py
 * - SocialReportsAdminSection.tsx
 */

import { api } from '@/services/api/client';

const BASE = '/api/v1' as const;
const CFG = { baseURL: BASE } as const;

export type SocialReportAdminStatus =
	| 'open'
	| 'in_review'
	| 'resolved'
	| 'dismissed';

export type SocialReportAdminItem = {
	id: string;
	reporter_user_id: string;
	reported_user_id: string;
	reason: string;
	details: string | null;
	status: SocialReportAdminStatus | string;
	created_at: string | null;
	reviewed_at: string | null;
	reviewer_user_id: string | null;
	reporter_username: string | null;
	reporter_display_name: string;
	reported_username: string | null;
	reported_display_name: string;
	reviewer_username: string | null;
};

export type SocialReportAdminListPage = {
	items: SocialReportAdminItem[];
	total: number;
};

export async function adminListSocialReports(params?: {
	status?: string;
	q?: string;
	limit?: number;
	offset?: number;
}): Promise<SocialReportAdminListPage> {
	const data = await api.get<SocialReportAdminListPage>(
		'/friends/admin/reports',
		{
			...CFG,
			params: {
				status: params?.status || undefined,
				q: params?.q || undefined,
				limit: params?.limit ?? 50,
				offset: params?.offset ?? 0,
			},
		}
	);
	return {
		items: Array.isArray(data?.items) ? data.items : [],
		total: typeof data?.total === 'number' ? data.total : 0,
	};
}

export async function adminGetSocialReport(
	reportId: string
): Promise<SocialReportAdminItem> {
	return api.get<SocialReportAdminItem>(
		`/friends/admin/reports/${encodeURIComponent(reportId)}`,
		CFG
	);
}

export async function adminPatchSocialReport(
	reportId: string,
	body: { status: string }
): Promise<SocialReportAdminItem> {
	return api.patch<SocialReportAdminItem>(
		`/friends/admin/reports/${encodeURIComponent(reportId)}`,
		body,
		CFG
	);
}
