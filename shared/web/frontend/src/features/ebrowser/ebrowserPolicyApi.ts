/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fetch/put EBrowser navigation policy (OpenAPI-typed).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-EBROWSER.md
 * - /api/v1/ebrowser/policy
 * - features/ebrowser/ebrowserOpenApi.ts
 */

import { api } from '@/services/api/client';
import type { EBrowserPolicyApi, EBrowserPolicyPut } from './ebrowserOpenApi';

export async function fetchOwnEBrowserPolicy(): Promise<EBrowserPolicyApi> {
	return api.get<EBrowserPolicyApi>('/api/v1/ebrowser/policy');
}

export async function adminGetEBrowserPolicy(
	userId: string
): Promise<EBrowserPolicyApi> {
	return api.get<EBrowserPolicyApi>(
		`/api/v1/ebrowser/admin/users/${encodeURIComponent(userId)}/policy`
	);
}

export async function adminPutEBrowserPolicy(
	userId: string,
	body: EBrowserPolicyPut
): Promise<EBrowserPolicyApi> {
	return api.put<EBrowserPolicyApi>(
		`/api/v1/ebrowser/admin/users/${encodeURIComponent(userId)}/policy`,
		body
	);
}
