/**
 * Client-side guardrails for marketing canvas drawing snapshots (Excalidraw + legacy tldraw).
 * Size in bytes remains capped in `parseWidgetConfig` / API (`MAX_TLDRAW_SNAPSHOT_JSON_BYTES`).
 */
import { marketingCanvasPersistKey } from './widgets/marketingCanvasPersistKey';

export const MAX_TLDRAW_SHAPE_RECORDS = 400;

/** Product cap: multi-page legacy tldraw boards beyond this are rejected on persist (G.68). */
export const MAX_TLDRAW_PAGE_COUNT = 8;

function countExcaliPersistedShapes(snapshot: Record<string, unknown>): number {
	if (!Object.hasOwn(snapshot, marketingCanvasPersistKey)) {
		return -1;
	}
	const raw = snapshot[marketingCanvasPersistKey];
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return 0;
	}
	const els = (raw as { elements?: unknown }).elements;
	if (!Array.isArray(els)) {
		return 0;
	}
	return els.filter(
		(el) =>
			el && typeof el === 'object' && !(el as { isDeleted?: boolean }).isDeleted
	).length;
}

/** @deprecated Prefer countMarketingDrawingShapeRecords */
export function countTldrawShapeRecords(
	snapshot: Record<string, unknown>
): number {
	const nEw = countExcaliPersistedShapes(snapshot);
	if (nEw !== -1) {
		return nEw;
	}
	try {
		const doc = snapshot.document as
			| { records?: Record<string, { typeName?: string }> }
			| undefined;
		const records = doc?.records;
		if (!records || typeof records !== 'object') {
			return 0;
		}
		let n = 0;
		for (const rec of Object.values(records)) {
			if (rec && typeof rec === 'object' && rec.typeName === 'shape') {
				n += 1;
			}
		}
		return n;
	} catch {
		return 0;
	}
}

export function countMarketingDrawingShapeRecords(
	snapshot: Record<string, unknown>
): number {
	return countTldrawShapeRecords(snapshot);
}

/** Legacy tldraw pages; Excali payloads count as single surface. */
/** @deprecated Prefer countMarketingDrawingPages */
export function countTldrawPages(snapshot: Record<string, unknown>): number {
	if (
		snapshot[marketingCanvasPersistKey] !== undefined &&
		snapshot[marketingCanvasPersistKey] !== null
	) {
		return 1;
	}
	try {
		const doc = snapshot.document as
			| { records?: Record<string, { typeName?: string }> }
			| undefined;
		const records = doc?.records;
		if (!records || typeof records !== 'object') {
			return 0;
		}
		let n = 0;
		for (const rec of Object.values(records)) {
			if (rec && typeof rec === 'object' && rec.typeName === 'page') {
				n += 1;
			}
		}
		return n;
	} catch {
		return 0;
	}
}

export function countMarketingDrawingPages(
	snapshot: Record<string, unknown>
): number {
	return countTldrawPages(snapshot);
}
