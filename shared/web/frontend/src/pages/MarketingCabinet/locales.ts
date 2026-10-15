/**
 * Локализация маркетингового кабинета через i18n (namespace `marketing`, ключи `enums.*`).
 */
import i18n from 'i18next';

const NS = 'marketing';

function na(): string {
	return i18n.t('common.na', { ns: NS });
}

function tEnum(group: string, raw?: string | null): string {
	const key = (raw || '').toLowerCase();
	if (!key) return na();
	return i18n.t(`enums.${group}.${key}`, { ns: NS, defaultValue: raw || na() });
}

export function formatDateTime(value?: string | null): string {
	if (!value) return na();
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return na();
	const lang = i18n.language || 'ru';
	const locale = lang.startsWith('en') ? 'en-US' : 'ru-RU';
	return parsed.toLocaleString(locale, {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function localizeStatus(value?: string | null): string {
	return tEnum('status', value);
}

export function localizePriority(value?: string | null): string {
	return tEnum('priority', value);
}

export function localizeJobCategory(value?: string | null): string {
	return tEnum('jobCategory', value);
}

export function localizeProjectCategory(value?: string | null): string {
	return tEnum('projectCategory', value);
}

export function localizeResearchType(value?: string | null): string {
	if (!value) return na();
	const raw = value.toLowerCase().replace(/\s+/g, '_');
	const key =
		raw === 'business'
			? 'market'
			: raw === 'porter'
				? 'competitive'
				: raw === 'opportunity_analysis' || raw === 'risk_assessment'
					? 'trend_analysis'
					: raw;
	return i18n.t(`enums.researchType.${key}`, {
		ns: NS,
		defaultValue: value.replace(/_/g, ' '),
	});
}

export function localizeResearchTypeSafe(value?: string | null): string {
	return localizeResearchType(value);
}

export function localizeCompetitorType(value?: string | null): string {
	return tEnum('competitorType', value);
}

export function localizeSegmentType(value?: string | null): string {
	return tEnum('segmentType', value);
}

export function localizeCampaignChannel(value?: string | null): string {
	return tEnum('campaignChannel', value);
}

export function localizeAlertSeverity(value?: string | null): string {
	return tEnum('alertSeverity', value);
}

export function localizeMarketingAiTool(value?: string | null): string {
	const key = (value || '').toLowerCase();
	if (!key) return na();
	if (key.startsWith('document_autofill_preview_')) {
		return i18n.t('enums.marketingAiTool.document_autofill_preview', {
			ns: NS,
		});
	}
	if (key.startsWith('document_autofill_apply_')) {
		return i18n.t('enums.marketingAiTool.document_autofill_apply', { ns: NS });
	}
	if (key.startsWith('document_autofill_project_preview')) {
		return i18n.t('enums.marketingAiTool.document_autofill_project_preview', {
			ns: NS,
		});
	}
	if (key.startsWith('document_autofill_project_apply')) {
		return i18n.t('enums.marketingAiTool.document_autofill_project_apply', {
			ns: NS,
		});
	}
	if (key.startsWith('document_autofill_project')) {
		return i18n.t('enums.marketingAiTool.document_autofill_project_generic', {
			ns: NS,
		});
	}
	return i18n.t(`enums.marketingAiTool.${key}`, {
		ns: NS,
		defaultValue: value?.replace(/_/g, ' ') || na(),
	});
}

export function localizeSource(value?: string | null): string {
	return tEnum('source', value);
}

function tOverview(path: string, fallback?: string | null): string {
	return i18n.t(path, { ns: NS, defaultValue: fallback ?? na() });
}

export function localizeOverviewCoverageLabel(
	key?: string | null,
	fallback?: string | null
): string {
	const normalized = (key || '').trim();
	if (!normalized) return fallback ?? na();
	return tOverview(`overview.system.coverage.${normalized}`, fallback);
}

export function localizeOverviewStrategyIntegrityLabel(
	key?: string | null,
	fallback?: string | null
): string {
	const normalized = (key || '').trim();
	if (!normalized) return fallback ?? na();
	return tOverview(`overview.system.strategyIntegrity.${normalized}`, fallback);
}

export function localizeOverviewFreshnessLabel(
	key?: string | null,
	fallback?: string | null
): string {
	const normalized = (key || '').trim();
	if (!normalized) return fallback ?? na();
	return tOverview(`overview.system.freshness.${normalized}.label`, fallback);
}

export function localizeOverviewFreshnessDetail(
	key?: string | null,
	fallback?: string | null
): string {
	const normalized = (key || '').trim();
	if (!normalized) return fallback ?? na();
	return tOverview(`overview.system.freshness.${normalized}.detail`, fallback);
}

export function localizeOverviewInsight(
	code?: string | null,
	field: 'title' | 'description' = 'title',
	fallback?: string | null
): string {
	const normalized = (code || '').trim();
	if (!normalized) return fallback ?? na();
	return tOverview(`overview.system.insights.${normalized}.${field}`, fallback);
}

export function localizeOverviewGraphNodeText(
	nodeId?: string | null,
	field: 'title' | 'subtitle' = 'title',
	fallback?: string | null
): string {
	const normalized = (nodeId || '').trim();
	if (!normalized) return fallback ?? na();
	return tOverview(
		`overview.system.graph.nodes.${normalized}.${field}`,
		fallback
	);
}

export function localizeOverviewGraphMetricLabel(
	value?: string | null
): string {
	const normalized = (value || '').trim().toLowerCase();
	if (!normalized) return na();
	return tOverview(`overview.system.graph.metricLabel.${normalized}`, value);
}

export function localizeOverviewGraphEdge(
	source?: string | null,
	target?: string | null,
	fallback?: string | null
): string {
	const from = (source || '').trim();
	const to = (target || '').trim();
	if (!from || !to) return fallback ?? na();
	return tOverview(`overview.system.graph.edges.${from}_${to}`, fallback);
}

export function localizeOverviewGraphBullet(
	nodeId?: string | null,
	index?: number | null,
	fallback?: string | null
): string {
	const normalized = (nodeId || '').trim();
	if (!normalized || index == null) return fallback ?? na();
	const numbers = String(fallback || '').match(/\d+/g) ?? [];
	return i18n.t(`overview.system.graph.nodes.${normalized}.bullets.${index}`, {
		ns: NS,
		defaultValue: fallback ?? na(),
		value: numbers[0],
		covered: numbers[0],
		total: numbers[1],
		percentage: numbers[0],
	});
}

/** Оценки важности / удовлетворённости (0–10), опционально «без оценки». */
export function getJtbdScoreSelectOptions(): Array<{
	value: string;
	label: string;
}> {
	return [
		{ value: '', label: i18n.t('cabinetPage.jtbdScoreUnset', { ns: NS }) },
		...Array.from({ length: 11 }, (_, i) => ({
			value: String(i),
			label: String(i),
		})),
	];
}
