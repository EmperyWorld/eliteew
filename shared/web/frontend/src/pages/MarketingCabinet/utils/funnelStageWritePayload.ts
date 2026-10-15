/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure Marketing Cabinet funnel stage write payload (visitors/conversions only).
 *
 * Invariants:
 * - Must not include client-computed `conversion_rate` — server derives it.
 *
 * Related:
 * - FunnelView.tsx, api/routers/marketing_cabinet/funnels.py
 */

export type FunnelStageWritePayload = {
	stage_name: string;
	stage_order: number;
	visitors: number;
	conversions: number;
};

export type FunnelStageRowLike = {
	name: string;
	visitors: string;
	conversions: string;
};

export function funnelStageRowsToWritePayload(
	rows: FunnelStageRowLike[]
): FunnelStageWritePayload[] {
	return rows
		.filter((r) => r.name.trim())
		.map((r, index) => {
			const visitors = Number(r.visitors || 0);
			const conversions = Number(r.conversions || 0);
			return {
				stage_name: r.name.trim(),
				stage_order: index,
				visitors,
				conversions,
			};
		});
}
