/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derives overview dashboard snapshot fields (counts, gaps, readiness, feeds) for OverviewView compose.
 *
 * Invariants:
 * - Pure derivation from dashboard + latestSwot; no side effects. Gaps collapse threshold GAPS_COLLAPSED_AT = 4.
 *
 * Related:
 * - overview/OverviewView.tsx, utils/overviewExecutiveSnapshot.ts
 */

import type {
	MarketingProjectDashboard,
	MarketingSwot,
} from '@/pages/MarketingCabinet/marketingCabinetApi';
import {
	getWeakestReadinessComponentKey,
	pickTopGapForSnapshot,
} from '@/pages/MarketingCabinet/utils/overviewExecutiveSnapshot';

export const GAPS_COLLAPSED_AT = 4;

export function deriveOverviewViewModel(
	dashboard: MarketingProjectDashboard,
	latestSwot: MarketingSwot | null,
	gapsExpanded: boolean
) {
	const d = dashboard;
	const counts = d.counts ?? {
		jtbd: 0,
		value_propositions: 0,
		swot: 0,
		competitors: 0,
		researches: 0,
		content: 0,
		segments: 0,
		campaigns: 0,
		funnels: 0,
		tasks: 0,
		alerts: 0,
		ai_runs: 0,
	};
	const readinessScore = d.readiness_score ?? 0;
	const highlights = d.highlights ?? [];
	const gaps = d.gaps ?? [];
	const visibleGaps =
		gapsExpanded || gaps.length <= GAPS_COLLAPSED_AT
			? gaps
			: gaps.slice(0, GAPS_COLLAPSED_AT);
	const readinessBreakdown = d.readiness_breakdown ?? null;
	const readinessMeta = d.readiness_meta ?? null;
	const coverage = d.coverage ?? [];
	const strategyIntegrityScore = d.strategy_integrity_score ?? 0;
	const strategyIntegrity = d.strategy_integrity ?? [];
	const strategyIntegrityIssues = d.strategy_integrity_issues ?? [];
	const gapCodeSet = new Set(gaps.map((g) => g.code).filter(Boolean));
	const strategyIntegrityIssuesVisible = strategyIntegrityIssues.filter(
		(i) => Boolean(i.code) && !gapCodeSet.has(String(i.code))
	);
	const issueRemediation = d.issue_remediation ?? [];
	const issueRemediationByCode = new Map(
		issueRemediation.map((item) => [item.issue_code, item])
	);
	const remediationIssueCodes = Array.from(
		new Set(
			[...gaps, ...strategyIntegrityIssues]
				.map((item) => item.code)
				.filter(Boolean)
		)
	);
	const strategyIntegrityIssueCodes = Array.from(
		new Set(
			strategyIntegrityIssuesVisible.map((item) => item.code).filter(Boolean)
		)
	);
	const freshness = d.freshness ?? [];
	const activityFeed = d.activity_feed ?? [];
	const recentAiRuns = d.ai_runs ?? [];
	const recentSegments = d.segments ?? [];
	const recentCampaigns = d.campaigns ?? [];
	const recentTasks = d.tasks ?? [];
	const recentAlerts = d.alerts ?? [];
	const openAlertsCount =
		d.counts?.open_alerts ??
		recentAlerts.filter((item) => item.status === 'open').length;
	const criticalAlertsCount =
		d.counts?.critical_alerts ??
		recentAlerts.filter((item) => item.severity === 'critical').length;
	const recentContent = d.recent_content ?? [];
	const recentResearches = d.recent_researches ?? [];
	const swotSnapshot = d.latest_swot ?? d.swot ?? latestSwot;
	const swotFactors = swotSnapshot?.factors ?? {
		strength: [],
		weakness: [],
		opportunity: [],
		threat: [],
	};
	const companyRollup = d.company_rollup_excerpt;
	const jtbdCoverage = coverage.find(
		(item) => item.key === 'jtbd_to_value_props'
	);
	const staleFlags = freshness.filter(
		(item) => item.state === 'stale' || item.state === 'missing'
	);
	const wMeta = readinessMeta?.weights;
	const topGapSnapshot = pickTopGapForSnapshot(gaps);
	const weakestReadinessKey = readinessBreakdown
		? getWeakestReadinessComponentKey(readinessBreakdown)
		: null;

	return {
		d,
		counts,
		readinessScore,
		highlights,
		gaps,
		visibleGaps,
		readinessBreakdown,
		readinessMeta,
		coverage,
		strategyIntegrityScore,
		strategyIntegrity,
		strategyIntegrityIssues,
		strategyIntegrityIssuesVisible,
		issueRemediationByCode,
		remediationIssueCodes,
		strategyIntegrityIssueCodes,
		freshness,
		activityFeed,
		recentAiRuns,
		recentSegments,
		recentCampaigns,
		recentTasks,
		recentAlerts,
		openAlertsCount,
		criticalAlertsCount,
		recentContent,
		recentResearches,
		swotSnapshot,
		swotFactors,
		companyRollup,
		jtbdCoverage,
		staleFlags,
		wMeta,
		topGapSnapshot,
		weakestReadinessKey,
	};
}

export type OverviewViewModel = ReturnType<typeof deriveOverviewViewModel>;
