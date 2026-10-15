import type { MarketingCabinetDeepLinkState } from './hooks/useMarketingCabinetNavigation';

/** Section keys AMKA may audit (aligned with backend `AMKA_SCOPE_ALL_VISIBLE`). */
export const AMKA_START_SECTION_KEYS = [
	'overview',
	'companies',
	'projects',
	'team',
	'jtbd',
	'value',
	'analysis',
	'evidence',
	'project_rag',
	'segments',
	'campaigns',
	'funnel',
	'tasks',
	'alerts',
	'dashboard',
	'imc',
	'client_interaction',
] as const;

export type AmkaStartSectionKey = (typeof AMKA_START_SECTION_KEYS)[number];

function entityTypeToView(
	entityType: string
): Pick<
	MarketingCabinetDeepLinkState,
	'activeView' | 'focusedEntityId' | 'selectedContentId'
> {
	const t = entityType.toLowerCase().trim();
	switch (t) {
		case 'job_story':
			return {
				activeView: 'jtbd',
				focusedEntityId: null,
				selectedContentId: null,
			};
		case 'value_proposition':
			return {
				activeView: 'value',
				focusedEntityId: null,
				selectedContentId: null,
			};
		case 'swot_analysis':
		case 'competitor':
			return {
				activeView: 'analysis',
				focusedEntityId: null,
				selectedContentId: null,
			};
		case 'segment':
			return {
				activeView: 'segments',
				focusedEntityId: null,
				selectedContentId: null,
			};
		case 'campaign':
			return {
				activeView: 'campaigns',
				focusedEntityId: null,
				selectedContentId: null,
			};
		case 'funnel':
			return {
				activeView: 'funnel',
				focusedEntityId: null,
				selectedContentId: null,
			};
		case 'task':
			return {
				activeView: 'tasks',
				focusedEntityId: null,
				selectedContentId: null,
			};
		case 'alert':
			return {
				activeView: 'alerts',
				focusedEntityId: null,
				selectedContentId: null,
			};
		case 'content_source':
			return {
				activeView: 'evidence',
				focusedEntityId: null,
				selectedContentId: null,
			};
		case 'imc_research_run':
			return {
				activeView: 'imc',
				focusedEntityId: null,
				selectedContentId: null,
			};
		case 'customer_facing_summary':
			return {
				activeView: 'client_interaction',
				focusedEntityId: null,
				selectedContentId: null,
			};
		default:
			return {
				activeView: 'overview',
				focusedEntityId: null,
				selectedContentId: null,
			};
	}
}

/**
 * Builds desktop deep-link state for MarketingCabinet from an AMKA entity or child job.
 * Research/list rows in Evidence use `focusedEntityId`; unified content uses `selectedContentId`.
 */
export function buildMarketingCabinetDeepLinkForAmkaEntity(params: {
	companyId: string;
	projectId: string;
	entityType: string;
	entityId: string;
}): MarketingCabinetDeepLinkState | null {
	const id = params.entityId?.trim();
	if (!params.companyId?.trim() || !params.projectId?.trim() || !id) {
		return null;
	}
	const mapped = entityTypeToView(params.entityType);
	const t = params.entityType.toLowerCase().trim();
	let focusedEntityId: string | null = mapped.focusedEntityId;
	let selectedContentId: string | null = mapped.selectedContentId;
	if (t === 'imc_research_run') {
		focusedEntityId = id;
	} else if (t === 'content_source') {
		selectedContentId = id;
	} else if (
		t === 'job_story' ||
		t === 'value_proposition' ||
		t === 'swot_analysis' ||
		t === 'competitor' ||
		t === 'segment' ||
		t === 'campaign' ||
		t === 'funnel' ||
		t === 'task' ||
		t === 'alert'
	) {
		focusedEntityId = id;
	}
	return {
		activeView: mapped.activeView,
		selectedCompanyId: params.companyId.trim(),
		selectedProjectId: params.projectId.trim(),
		focusedEntityId,
		selectedContentId,
	};
}

export function buildMarketingCabinetDeepLinkForAmkaChildJob(
	job: { kind?: string; external_id?: string },
	companyId: string,
	projectId: string
): MarketingCabinetDeepLinkState | null {
	const kind = String(job.kind || '')
		.trim()
		.toLowerCase();
	const ext = String(job.external_id || '').trim();
	if (!ext || !companyId.trim() || !projectId.trim()) return null;
	if (kind === 'imc_research_run') {
		return {
			activeView: 'imc',
			selectedCompanyId: companyId.trim(),
			selectedProjectId: projectId.trim(),
			focusedEntityId: ext,
			selectedContentId: null,
		};
	}
	return null;
}
