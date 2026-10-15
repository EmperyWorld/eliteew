/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build companion `shell_context.surface_listing` plain text for EWRP workspace.
 *
 * Related:
 * - `useEwrpGeneratorCompose.ts`, `EWRPGeneratorProps.onWindowPayloadChange`
 */

import type { EwrpJobListItem } from '@/services/ewrpApi';
import {
	contentTypeBadgeShort,
	ewrpStatusLabel,
	type ContentItem,
} from '../EwrpGeneratorChunks';

export type BuildEwrpCompanionListingParams = {
	mainTab: 'generate' | 'presentations';
	historyLoading: boolean;
	historyJobsLength: number;
	historyHasMore: boolean;
	filteredHistoryJobs: EwrpJobListItem[];
	deferredDocSearch: string;
	filteredDocItems: ContentItem[];
	docItemsLength: number;
};

export function buildEwrpCompanionListingPlainText(
	params: BuildEwrpCompanionListingParams
): string {
	const {
		mainTab,
		historyLoading,
		historyJobsLength,
		historyHasMore,
		filteredHistoryJobs,
		deferredDocSearch,
		filteredDocItems,
		docItemsLength,
	} = params;

	const lines: string[] = ['[EWRP · Presentations]'];
	lines.push(`Workspace tab: ${mainTab}`);
	if (historyLoading && historyJobsLength === 0) {
		lines.push('Jobs: loading…');
	} else if (filteredHistoryJobs.length === 0) {
		lines.push('Jobs (filtered): none');
	} else {
		const shown = filteredHistoryJobs.slice(0, 28);
		const scope =
			filteredHistoryJobs.length < historyJobsLength
				? `shown ${shown.length}, filtered (${historyJobsLength} loaded)`
				: `shown ${shown.length}`;
		lines.push(`Jobs (${scope}):`);
		for (const j of shown) {
			const stateLabel = ewrpStatusLabel(j.status);
			const label = `${j.title || j.topic || j.id} · ${stateLabel} · ${j.num_slides} slides`;
			lines.push(`- ${label.replace(/\s+/g, ' ').trim().slice(0, 260)}`);
		}
		if (historyHasMore) lines.push('… (more history available)');
	}
	if (docItemsLength > 0) {
		const docsShown = filteredDocItems.slice(0, 28);
		lines.push(
			`Source docs (shown ${docsShown.length} of ${docItemsLength}${deferredDocSearch.trim() ? '; filter active' : ''}):`
		);
		for (const d of docsShown) {
			const badge = contentTypeBadgeShort(d.content_type);
			lines.push(
				`- ${d.name.replace(/\s+/g, ' ').trim().slice(0, 220)} [${badge}]`
			);
		}
		if (docItemsLength > docsShown.length) {
			lines.push('… (picker truncated)');
		}
	}
	return lines.join('\n').slice(0, 3600);
}
