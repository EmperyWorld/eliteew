/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map Content Manager UI filter tokens to Unified Content list/folder-view query params.
 *
 * Invariants:
 * - Only canonical API `content_type` enum values are sent as `content_type`.
 * - UI refinements (`pdf`, `text`, …) use `mime_type` when the API supports it.
 *
 * Related:
 * - hooks/useContentList.ts
 * - hooks/useContentManagerAllFilesQuery.ts
 * - hooks/useContentManagerContentListOrchestration.ts
 */

const API_CONTENT_TYPES = new Set([
	'document',
	'image',
	'video',
	'audio',
	'ai_result',
	'presentation',
	'spreadsheet',
	'other',
]);

export type ContentManagerApiFilter = {
	content_type?: string;
	mime_type?: string;
};

export function resolveContentManagerApiFilter(
	filterType: string
): ContentManagerApiFilter {
	const raw = (filterType || '').trim().toLowerCase();
	if (!raw || raw === 'all') {
		return {};
	}

	if (API_CONTENT_TYPES.has(raw)) {
		return { content_type: raw };
	}

	switch (raw) {
		case 'pdf':
			return { content_type: 'document', mime_type: 'application/pdf' };
		case 'text':
			return { content_type: 'document', mime_type: 'text/' };
		case 'code':
			return { content_type: 'document' };
		case 'archive':
			return { content_type: 'other' };
		default:
			return {};
	}
}
