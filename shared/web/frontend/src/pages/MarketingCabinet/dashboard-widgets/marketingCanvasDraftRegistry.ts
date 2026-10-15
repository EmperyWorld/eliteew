/** Session-scoped flags: unsaved marketing canvas (notes/drawing) per project for project-switch guard. */

const STORAGE_PREFIX = 'mc-dashboard-canvas-draft';

function storageKey(projectId: string): string {
	return `${STORAGE_PREFIX}:${projectId}`;
}

export function setMarketingCanvasWidgetDraftState(
	projectId: string,
	widgetId: string,
	dirty: boolean
): void {
	try {
		const key = storageKey(projectId);
		const raw = sessionStorage.getItem(key);
		const o: Record<string, true> = raw
			? (JSON.parse(raw) as Record<string, true>)
			: {};
		if (dirty) {
			o[widgetId] = true;
		} else {
			delete o[widgetId];
		}
		if (Object.keys(o).length === 0) {
			sessionStorage.removeItem(key);
		} else {
			sessionStorage.setItem(key, JSON.stringify(o));
		}
	} catch {
		// ignore quota / private mode
	}
}

export function hasMarketingCanvasDraftForProject(
	projectId: string | null
): boolean {
	if (!projectId) {
		return false;
	}
	try {
		const raw = sessionStorage.getItem(storageKey(projectId));
		if (!raw) {
			return false;
		}
		const o = JSON.parse(raw) as Record<string, unknown>;
		return Object.keys(o).length > 0;
	} catch {
		return false;
	}
}
