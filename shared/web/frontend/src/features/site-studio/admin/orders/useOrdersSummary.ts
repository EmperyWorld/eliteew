/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Server-side order KPI summary for Site Studio admin Orders page.
 *
 * Invariants:
 * - Totals come from GET /admin/orders/summary (full catalog), not client reduce.
 *
 * Related:
 * - site-templates/olenti/server/src/routes/admin.ts
 * - documentation/product/SITE-STUDIO.md
 */

import { useQuery } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@constants/api';
import { apiClient } from '@services/api/client';

export type OrdersSummary = {
	total: number;
	pending: number;
	inProgress: number;
	delivered: number;
	cancelled: number;
	totalRevenue: number;
	countByStatus?: Record<string, number>;
};

export function useOrdersSummary() {
	return useQuery({
		queryKey: ['admin-orders-summary'],
		queryFn: async () => {
			const { data } = await apiClient.get<OrdersSummary>(
				API_ENDPOINTS.ADMIN_ORDERS_SUMMARY
			);
			return data;
		},
		staleTime: 1000 * 30,
	});
}
