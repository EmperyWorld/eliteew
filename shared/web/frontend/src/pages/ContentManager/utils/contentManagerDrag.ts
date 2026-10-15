import type * as React from 'react';

export const CM_CONTENT_DRAG_MIME = 'application/x-eliteew-content-ids';

export type ContentDragEntry = {
	id: string;
	name: string;
	/** Unified content `content_type` (e.g. document, image). */
	content_type?: string | null;
};

/** v2 object shape; legacy drag used a bare JSON array of ids. */
export type ContentDragPayload = {
	ids: string[];
	items?: ContentDragEntry[];
};

function normalizeParsedPayload(parsed: unknown): ContentDragPayload | null {
	if (Array.isArray(parsed)) {
		const ids = parsed.filter(
			(x): x is string => typeof x === 'string' && x.length > 0
		);
		return ids.length > 0 ? { ids } : null;
	}
	if (parsed && typeof parsed === 'object' && 'ids' in parsed) {
		const idsRaw = (parsed as { ids?: unknown }).ids;
		if (!Array.isArray(idsRaw)) return null;
		const ids = idsRaw.filter(
			(x): x is string => typeof x === 'string' && x.length > 0
		);
		if (ids.length === 0) return null;

		const itemsRaw = (parsed as { items?: unknown }).items;
		let items: ContentDragEntry[] | undefined;
		if (Array.isArray(itemsRaw)) {
			const mapped = itemsRaw
				.map((row): ContentDragEntry | null => {
					if (!row || typeof row !== 'object') return null;
					const id =
						typeof (row as { id?: unknown }).id === 'string'
							? (row as { id: string }).id.trim()
							: '';
					if (!id) return null;
					const nameRaw = (row as { name?: unknown }).name;
					const name =
						typeof nameRaw === 'string' && nameRaw.trim() !== ''
							? nameRaw.trim()
							: id;
					const ct = (row as { content_type?: unknown }).content_type;
					return {
						id,
						name,
						content_type: typeof ct === 'string' ? ct : null,
					};
				})
				.filter((x): x is ContentDragEntry => x != null);
			if (mapped.length > 0) items = mapped;
		}
		return { ids, items };
	}
	return null;
}

/** JSON string for `dataTransfer.setData` (compact array when there is no metadata). */
export function stringifyContentDragPayload(
	payload: ContentDragPayload
): string {
	if (payload.items && payload.items.length > 0) {
		return JSON.stringify({ ids: payload.ids, items: payload.items });
	}
	return JSON.stringify(payload.ids);
}

export function parseContentDragPayload(
	raw: string
): ContentDragPayload | null {
	try {
		const parsed = JSON.parse(raw) as unknown;
		return normalizeParsedPayload(parsed);
	} catch {
		return null;
	}
}

export function parseContentDragPayloadFromDataTransfer(
	dt: DataTransfer | null
): ContentDragPayload | null {
	if (!dt) return null;
	const r = dt.getData(CM_CONTENT_DRAG_MIME);
	if (!r) return null;
	return parseContentDragPayload(r);
}

export function parseContentDragIds(e: React.DragEvent): string[] {
	return parseContentDragPayloadFromDataTransfer(e.dataTransfer)?.ids ?? [];
}

export function dataTransferHasContentDrag(dt: DataTransfer | null): boolean {
	if (!dt?.types) return false;
	// DOMStringList or string[] depending on browser
	return Array.from(dt.types as unknown as string[]).includes(
		CM_CONTENT_DRAG_MIME
	);
}

/**
 * Replaces the default drag ghost with a compact label so huge card snapshots
 * do not cover folder drop zones during DnD.
 */
export function setContentManagerDragGhost(
	e: React.DragEvent,
	options: { title: string; count: number }
): void {
	const { title, count } = options;
	const maxLen = 44;
	const truncated =
		title.length > maxLen ? `${title.slice(0, maxLen - 1)}…` : title;
	const label = count > 1 ? `${truncated} · ${count}` : truncated;

	const ghost = document.createElement('div');
	ghost.setAttribute('role', 'presentation');
	ghost.setAttribute('aria-hidden', 'true');
	ghost.textContent = label;
	Object.assign(ghost.style, {
		position: 'fixed',
		top: '-10000px',
		left: '0',
		zIndex: '2147483647',
		maxWidth: 'min(320px, 90vw)',
		padding: '8px 12px',
		borderRadius: '12px',
		fontSize: '12px',
		fontWeight: '600',
		fontFamily: 'system-ui, sans-serif',
		pointerEvents: 'none',
		boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
		border: '1px solid rgba(255,255,255,0.14)',
		background: 'rgba(15, 23, 42, 0.94)',
		color: '#e2e8f0',
		backdropFilter: 'blur(10px)',
		whiteSpace: 'nowrap',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
	});

	document.body.appendChild(ghost);
	try {
		e.dataTransfer.setDragImage(ghost, 16, 20);
	} catch {
		// Safari / older engines
	}
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			ghost.remove();
		});
	});
}
