/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build unified content PATCH payloads when Content Manager moves files between explorer folders.
 *
 * Invariants:
 * - Project desktop folders (`eliteew-proj-*`) bind company_id + project_id from tenancy list.
 * - Regular folders and «Без папки» clear company/project scope.
 *
 * Related:
 * - pages/Desktop/utils/desktopFileContentFolderScope.ts
 * - pages/ContentManager/ContentManagerPro.tsx
 */
import { buildContentFolderScopePatch } from '@/pages/Desktop/utils/desktopFileContentFolderScope';
import type { TenancyProject } from '../hooks/useTenancyOptions';
import { parseProjectIdFromDesktopFolderItemId } from '../projectDesktopFolder';

export function buildContentMoveScopePatch(
	targetFolderItemId: string | null,
	projects: readonly TenancyProject[]
): Record<string, unknown> {
	if (!targetFolderItemId) {
		return buildContentFolderScopePatch(null);
	}

	const projectId = parseProjectIdFromDesktopFolderItemId(targetFolderItemId);
	if (projectId) {
		const project = projects.find((entry) => entry.id === projectId);
		if (project) {
			return {
				folder_item_id: targetFolderItemId,
				project_id: project.id,
				company_id: project.company_id,
			};
		}
		return { folder_item_id: targetFolderItemId };
	}

	return buildContentFolderScopePatch(targetFolderItemId);
}
