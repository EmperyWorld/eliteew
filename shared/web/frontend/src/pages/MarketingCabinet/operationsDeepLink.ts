/** Query keys preserved alongside `mc_*` cabinet routing (see useMarketingCabinetNavigation). */
export const MC_OPS_TASK_STATUS = 'mc_ops_task_status';
export const MC_OPS_TASK_PRIORITY = 'mc_ops_task_priority';
export const MC_OPS_ALERT_STATUS = 'mc_ops_alert_status';
export const MC_OPS_ALERT_SEVERITY = 'mc_ops_alert_severity';
export const MC_OPS_CAMPAIGN_STATUS = 'mc_ops_campaign_status';
export const MC_OPS_CAMPAIGN_CHANNEL = 'mc_ops_campaign_channel';
export const MC_OPS_CAMPAIGN_PRIORITY = 'mc_ops_campaign_priority';
export const MC_OPS_SEGMENT_TYPE = 'mc_ops_segment_type';
export const MC_OPS_SEGMENT_STATUS = 'mc_ops_segment_status';
export const MC_OPS_SEGMENT_PRIORITY = 'mc_ops_segment_priority';
export const MC_OPS_RESEARCH_STATUS = 'mc_ops_research_status';
export const MC_OPS_RESEARCH_TYPE = 'mc_ops_research_type';
export const MC_OPS_RESEARCH_PRIORITY = 'mc_ops_research_priority';

/** JTBD list filters (dashboard tile «Открыть раздел» + раздел JTBD). */
export const MC_OPS_JTBD_CATEGORY = 'mc_ops_jtbd_category';
export const MC_OPS_JTBD_PRIORITY = 'mc_ops_jtbd_priority';
/** URL values: `true` | `false`; empty = all. */
export const MC_OPS_JTBD_VALIDATED = 'mc_ops_jtbd_validated';

/** Value propositions list filter (`status` совпадает с `widget_config.filters`). */
export const MC_OPS_VALUE_PROP_STATUS = 'mc_ops_value_prop_status';

/** Конкуренты в разделе «Анализ» (`competitor_type` в `widget_config.filters`). */
export const MC_OPS_COMPETITOR_TYPE = 'mc_ops_competitor_type';

export type MarketingCabinetOpsListFilters = {
	jtbd: {
		category: string;
		priority: string;
		/** `true`, `false`, or `` (any). */
		validated: string;
	};
	valueProp: { status: string };
	competitor: { competitor_type: string };
};

function normalizeSearchForOps(search: string): string {
	return search.startsWith('?') ? search.slice(1) : search;
}

/** Читает `mc_ops_*` для списков JTBD / value props (не путать с `mc_*` маршрутизацией). */
export function parseMarketingCabinetOpsListFilters(
	search: string
): MarketingCabinetOpsListFilters {
	const p = new URLSearchParams(normalizeSearchForOps(search));
	return {
		jtbd: {
			category: p.get(MC_OPS_JTBD_CATEGORY)?.trim() ?? '',
			priority: p.get(MC_OPS_JTBD_PRIORITY)?.trim() ?? '',
			validated: p.get(MC_OPS_JTBD_VALIDATED)?.trim() ?? '',
		},
		valueProp: {
			status: p.get(MC_OPS_VALUE_PROP_STATUS)?.trim() ?? '',
		},
		competitor: {
			competitor_type: p.get(MC_OPS_COMPETITOR_TYPE)?.trim() ?? '',
		},
	};
}
