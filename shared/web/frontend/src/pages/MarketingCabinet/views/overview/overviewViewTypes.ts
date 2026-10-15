/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Props contract for Marketing Cabinet OverviewView (project dashboard overview).
 *
 * Invariants:
 * - Props shape stays stable for MarketingCabinetPageViewRouter consumers.
 *
 * Related:
 * - overview/OverviewView.tsx
 * - documentation/product/marketing/MARKETING-CABINET.md
 */

import type { MarketingView } from '@/pages/MarketingCabinet/constants';
import type {
	MarketingProject,
	MarketingProjectDashboard,
	MarketingSwot,
} from '@/pages/MarketingCabinet/marketingCabinetApi';

export interface OverviewViewProps {
	selectedProjectId: string | null;
	selectedProject: MarketingProject | null;
	dashboard: MarketingProjectDashboard | undefined;
	isLoading: boolean;
	isError: boolean;
	error: unknown;
	refetch: () => unknown;
	latestSwot: MarketingSwot | null;
	extractApiErrorMessage: (error: unknown, fallback: string) => string;
	onNavigate: (view: MarketingView, entityId?: string | null) => void;
	allowMarketingWrite: boolean;
}
