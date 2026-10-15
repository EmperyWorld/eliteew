import {
	getDesktopItems,
	upsertDesktopItem,
} from '../Desktop/services/desktopApi';

/** Prefix for desktop folders bound to a tenant/marketing project (see desktop/API guard). */
export const PROJECT_DESKTOP_FOLDER_PREFIX = 'eliteew-proj-';

/** Stable desktop `item_id` for a marketing/tenant project content folder (idempotent upsert). */
export function projectContentFolderItemId(projectId: string): string {
	return `${PROJECT_DESKTOP_FOLDER_PREFIX}${projectId.trim()}`;
}

export function isProjectDesktopFolderItemId(itemId: string): boolean {
	return itemId.startsWith(PROJECT_DESKTOP_FOLDER_PREFIX);
}

/** UUID string after `eliteew-proj-`, or `null` if not a valid project desktop folder id. */
export function parseProjectIdFromDesktopFolderItemId(
	itemId: string
): string | null {
	if (!isProjectDesktopFolderItemId(itemId)) return null;
	const rest = itemId.slice(PROJECT_DESKTOP_FOLDER_PREFIX.length).trim();
	return rest.length > 0 ? rest : null;
}

/** First user-visible glyph of folder title (project name), for desktop icon overlay. */
export function projectDesktopFolderInitialGlyph(name: string): string {
	const t = name.trim();
	if (!t) return '·';
	const first = [...t][0];
	if (!first) return '·';
	return first.toLocaleUpperCase(undefined);
}

export async function ensureProjectDesktopFolder(params: {
	projectId: string;
	projectName: string;
}): Promise<{ item_id: string }> {
	const item_id = projectContentFolderItemId(params.projectId);
	const items = await getDesktopItems();
	if (items.some((i) => i.item_id === item_id)) {
		return { item_id };
	}
	const label = params.projectName.trim() || 'Project';
	await upsertDesktopItem(item_id, {
		item_id,
		item_type: 'FOLDER',
		name: label,
		position: { x: 120, y: 280 },
		parent_item_id: null,
		is_pinned: false,
	});
	return { item_id };
}
