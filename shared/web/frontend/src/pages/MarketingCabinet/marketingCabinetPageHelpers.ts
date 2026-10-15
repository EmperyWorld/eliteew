/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Marketing Cabinet page helpers — chat excerpt, list cache patches, sidebar storage keys.
 *
 * Invariants:
 * - Persisted company/project ids are best-effort localStorage; invalid ids fall back via foundation queries.
 *
 * Related:
 * - hooks/useMarketingCabinetNavigation.ts
 * - marketingCabinetPageTypes.ts
 */
import type { QueryClient } from '@tanstack/react-query';

import type { SwotFactorInput } from './marketingCabinetApi';
import { parseMultilineList } from './utils';
import type { TeamAccessSummaryParts } from './utils/teamMemberMcPermissions';
import type {
	ChatTimelineMessage,
	MarketingRailSignalTone,
} from './marketingCabinetPageTypes';

/** Сжатый текст предыдущих реплик для tool-agent (чат кабинета). */
export function buildMarketingChatExcerpt(
	messages: ChatTimelineMessage[],
	maxChars = 3500,
	roles?: { user: string; assistant: string }
): string {
	const roleUser = roles?.user ?? 'Владыка';
	const roleAssistant = roles?.assistant ?? 'Оракул';
	const lines: string[] = [];
	let total = 0;
	const slice = messages.slice(-14);
	for (const m of [...slice].reverse()) {
		const role = m.role === 'user' ? roleUser : roleAssistant;
		const content = m.content.trim();
		if (!content) continue;
		let line = `${role}: ${content}`;
		const remaining = maxChars - total;
		if (remaining <= 0) break;
		if (line.length > remaining) {
			if (lines.length > 0) continue;
			if (remaining <= 1) break;
			line = `${line.slice(0, remaining - 1).trimEnd()}…`;
		}
		lines.push(line);
		total += line.length + 1;
	}
	return lines.reverse().join('\n');
}

/** Сразу убираем сущность из кэша списка — иначе после soft-delete на сервере UI часто остаётся на старых данных (повторное удаление → 404). */
export function removeMarketingListEntity(
	queryClient: QueryClient,
	queryKey: readonly unknown[],
	entityId: string
): void {
	queryClient.setQueryData(queryKey, (old: unknown) => {
		if (!old || typeof old !== 'object') return old;
		const data = old as { items?: Array<{ id: string }>; total?: number };
		if (!Array.isArray(data.items)) return old;
		const nextItems = data.items.filter((x) => x.id !== entityId);
		if (nextItems.length === data.items.length) return old;
		const total =
			typeof data.total === 'number'
				? Math.max(0, data.total - 1)
				: nextItems.length;
		return { ...data, items: nextItems, total };
	});
}

export function getHttpStatus(error: unknown): number | undefined {
	if (error && typeof error === 'object') {
		const o = error as Record<string, unknown>;
		if (typeof o.statusCode === 'number') return o.statusCode;
		const resp = o.response as { status?: number } | undefined;
		if (resp && typeof resp.status === 'number') return resp.status;
	}
	return undefined;
}

export function buildSwotFactors(
	source: string,
	impact_level: string
): SwotFactorInput[] {
	return parseMultilineList(source).map((factor, index) => ({
		factor_text: factor,
		impact_level,
		priority_score: Math.max(30, 100 - index * 12),
	}));
}

export const MARKETING_SIDEBAR_PINNED_STORAGE_KEY =
	'marketing-cabinet-sidebar-pinned';
export const MARKETING_SIDEBAR_COMPACT_STORAGE_KEY =
	'marketing-cabinet-sidebar-compact';
export const MARKETING_CABINET_SELECTED_COMPANY_STORAGE_KEY =
	'marketing-cabinet-selected-company';
export const MARKETING_CABINET_SELECTED_PROJECT_STORAGE_KEY =
	'marketing-cabinet-selected-project';

export type MarketingCabinetPersistedSelection = {
	selectedCompanyId: string | null;
	selectedProjectId: string | null;
};

export function readMarketingCabinetPersistedSelection(): MarketingCabinetPersistedSelection {
	if (typeof window === 'undefined') {
		return { selectedCompanyId: null, selectedProjectId: null };
	}
	try {
		const companyId = window.localStorage.getItem(
			MARKETING_CABINET_SELECTED_COMPANY_STORAGE_KEY
		);
		const projectId = window.localStorage.getItem(
			MARKETING_CABINET_SELECTED_PROJECT_STORAGE_KEY
		);
		return {
			selectedCompanyId: companyId?.trim() || null,
			selectedProjectId: projectId?.trim() || null,
		};
	} catch {
		return { selectedCompanyId: null, selectedProjectId: null };
	}
}

/** Fills missing company/project from localStorage; explicit URL/deep-link ids win. */
export function mergeMarketingCabinetStateWithPersistedSelection<
	T extends MarketingCabinetPersistedSelection,
>(state: T): T {
	const persisted = readMarketingCabinetPersistedSelection();
	return {
		...state,
		selectedCompanyId: state.selectedCompanyId ?? persisted.selectedCompanyId,
		selectedProjectId: state.selectedProjectId ?? persisted.selectedProjectId,
	};
}

export function writeMarketingCabinetPersistedSelection(
	selectedCompanyId: string | null,
	selectedProjectId: string | null
): void {
	if (typeof window === 'undefined') return;
	try {
		if (selectedCompanyId?.trim()) {
			window.localStorage.setItem(
				MARKETING_CABINET_SELECTED_COMPANY_STORAGE_KEY,
				selectedCompanyId
			);
		} else {
			window.localStorage.removeItem(
				MARKETING_CABINET_SELECTED_COMPANY_STORAGE_KEY
			);
		}
		if (selectedProjectId?.trim()) {
			window.localStorage.setItem(
				MARKETING_CABINET_SELECTED_PROJECT_STORAGE_KEY,
				selectedProjectId
			);
		} else {
			window.localStorage.removeItem(
				MARKETING_CABINET_SELECTED_PROJECT_STORAGE_KEY
			);
		}
	} catch {
		// Keep toolbar functional when storage is unavailable.
	}
}

export const MARKETING_RAIL_SIGNAL_CLASSNAMES: Record<
	MarketingRailSignalTone,
	{ inline: string; overlay: string }
> = {
	danger: {
		inline: 'border-red-500/30 bg-red-950/40 text-red-200/95',
		overlay:
			'border-red-400/35 bg-red-600 text-[rgb(var(--desktop-fg-primary-rgb))]',
	},
	warning: {
		inline:
			'border-(--mc-border-accent-soft) bg-(--mc-accent-10) text-(--desktop-text-secondary)',
		overlay:
			'border-(--mc-border-accent-soft) bg-(--mc-accent) text-[rgb(var(--desktop-fg-primary-rgb))]',
	},
};

export const formatMarketingRailSignalCount = (count: number): string => {
	if (count > 99) return '99+';
	if (count > 9) return '9+';
	return String(count);
};

export function shellAccessSummarySuffix(
	t: (key: string, options?: Record<string, unknown>) => string,
	shell: TeamAccessSummaryParts['shell']
): string {
	const all = shell.overview && shell.companies && shell.projects;
	if (all) return '';
	const sections: string[] = [];
	if (shell.overview) sections.push(t('modules.overview.title'));
	if (shell.companies) sections.push(t('modules.companies.title'));
	if (shell.projects) sections.push(t('modules.projects.title'));
	if (sections.length === 0) {
		return t('cabinetPage.setup.teamAccessShellNoneNav');
	}
	return t('cabinetPage.setup.teamAccessShellLimited', {
		sections: sections.join(', '),
	});
}

export function teamAccessSummaryText(
	t: (key: string, options?: Record<string, unknown>) => string,
	parts: TeamAccessSummaryParts
): string {
	let base: string;
	if (parts.scope === 'full') {
		base = parts.uploadVault
			? t('cabinetPage.setup.teamAccessSummaryFullVault')
			: t('cabinetPage.setup.teamAccessSummaryFull');
	} else if (parts.scope === 'none') {
		base = parts.uploadVault
			? t('cabinetPage.setup.teamAccessSummaryNoneVault')
			: t('cabinetPage.setup.teamAccessSummaryNone');
	} else {
		base = parts.uploadVault
			? t('cabinetPage.setup.teamAccessSummaryPartialVault', {
					count: parts.moduleCount,
				})
			: t('cabinetPage.setup.teamAccessSummaryPartial', {
					count: parts.moduleCount,
				});
	}
	const shellSfx = shellAccessSummarySuffix(t, parts.shell);
	return shellSfx ? `${base} ${shellSfx}` : base;
}
