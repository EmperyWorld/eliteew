/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Executive snapshot helpers for Marketing Cabinet overview (top gap, weakest readiness pillar).
 *
 * Related:
 * - views/OverviewView.tsx
 */
import type { MarketingInsight } from '../marketingCabinetApi';
import type { MarketingReadinessBreakdown } from '../marketingCabinetApi';

const SEVERITY_RANK: Record<string, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	positive: 3,
};

/** Highest-priority gap for executive snapshot (critical before high before medium). */
export function pickTopGapForSnapshot(
	gaps: MarketingInsight[]
): MarketingInsight | null {
	if (!gaps.length) return null;
	return [...gaps].sort((a, b) => {
		const ra = SEVERITY_RANK[String(a.severity)] ?? 99;
		const rb = SEVERITY_RANK[String(b.severity)] ?? 99;
		return ra - rb;
	})[0];
}

const READINESS_KEYS: (keyof MarketingReadinessBreakdown)[] = [
	'strategy_base',
	'operations',
	'coverage',
	'freshness',
	'strategy_integrity',
];

/** Component with minimum 0–100 score — shown as “weakest link” in snapshot copy. */
export function getWeakestReadinessComponentKey(
	breakdown: MarketingReadinessBreakdown
): keyof MarketingReadinessBreakdown {
	let minKey = READINESS_KEYS[0];
	let minVal = Number(breakdown[minKey] ?? 100);
	for (const k of READINESS_KEYS) {
		const v = Number(breakdown[k] ?? 100);
		if (v < minVal) {
			minVal = v;
			minKey = k;
		}
	}
	return minKey;
}
