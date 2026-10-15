/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure coercion helpers for EWA companion file-list output surface payloads.
 *
 * Invariants:
 * - Rows only become client navigation targets; this helper never executes desktop actions.
 *
 * Related:
 * - CompanionFileListMode.tsx
 * - api/ewa_platform/companion/orchestration/tool_registry.py (`catalog_list`)
 */

export type CompanionFileListSurfaceItem = {
	unifiedContentId: string;
	title: string;
	contentType: string;
	mimeType: string;
	updatedAt: string;
	snippet: string;
};

export type CompanionFileListSurfacePayload = {
	title: string;
	query: string;
	browseAll: boolean;
	rowCount: number;
	items: CompanionFileListSurfaceItem[];
};

function isRecord(raw: unknown): raw is Record<string, unknown> {
	return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

function asString(raw: unknown): string {
	return typeof raw === 'string'
		? raw.trim()
		: raw == null
			? ''
			: String(raw).trim();
}

function asBool(raw: unknown): boolean {
	return raw === true || asString(raw).toLowerCase() === 'true';
}

function asInt(raw: unknown): number {
	const n = typeof raw === 'number' ? raw : Number.parseInt(asString(raw), 10);
	return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

export function coerceCompanionFileListSurfacePayload(
	payload: Record<string, unknown> | undefined
): CompanionFileListSurfacePayload {
	const rawItems = Array.isArray(payload?.items) ? payload.items : [];
	const items = rawItems.flatMap((raw): CompanionFileListSurfaceItem[] => {
		if (!isRecord(raw)) return [];
		const unifiedContentId =
			asString(raw.unifiedContentId) || asString(raw.unified_content_id);
		if (!unifiedContentId) return [];
		return [
			{
				unifiedContentId,
				title: asString(raw.title || raw.name) || unifiedContentId,
				contentType: asString(raw.contentType || raw.content_type),
				mimeType: asString(raw.mimeType || raw.mime_type),
				updatedAt: asString(raw.updatedAt || raw.updated_at),
				snippet: asString(raw.snippet),
			},
		];
	});
	return {
		title: asString(payload?.title) || 'EwaFile',
		query: asString(payload?.query),
		browseAll: asBool(payload?.browseAll ?? payload?.browse_all),
		rowCount: asInt(payload?.rowCount ?? payload?.row_count) || items.length,
		items,
	};
}
