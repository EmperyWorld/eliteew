/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * React Query hook for Marketing Cabinet performance analytics (spend, revenue, ROI/ROMI, CPA/CPL).
 *
 * Invariants:
 * - Filter shape is part of the query key so dashboard cards, charts, and tables stay coherent.
 * - The hook is enabled only after a project is selected.
 *
 * Related:
 * - ../marketingPerformanceDashboard.ts
 * - ../marketingCabinetQueryOptions.ts
 * - shared/api/services/marketing_cabinet/project_performance_service.py
 */
import { useQuery } from '@tanstack/react-query';

import { marketingCabinetPerformanceDashboardQueryOptions } from '../marketingCabinetQueryOptions';
import type { MarketingPerformanceDashboardRequest } from '../marketingPerformanceDashboard';

export function useMarketingPerformanceDashboard({
	selectedProjectId,
	filters,
}: {
	selectedProjectId: string | null;
	filters: MarketingPerformanceDashboardRequest;
}) {
	return useQuery({
		...marketingCabinetPerformanceDashboardQueryOptions(
			selectedProjectId,
			filters
		),
		enabled: Boolean(selectedProjectId),
	});
}
