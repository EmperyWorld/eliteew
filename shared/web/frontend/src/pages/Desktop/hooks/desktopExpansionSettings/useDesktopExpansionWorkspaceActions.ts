/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Workspace profile CRUD actions for desktop expansion settings.
 *
 * Related:
 * - useDesktopExpansionSettings.ts
 */

import { useCallback } from 'react';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import {
	DESKTOP_WORKSPACE_PROFILE_TEMPLATES,
	type DesktopWorkspaceProfileTemplateId,
} from '../../constants/desktopWorkspaceProfileTemplates';
import type {
	DesktopItem,
	PersistedWindowState,
	WindowState,
} from '../../types/desktop.types';
import type {
	DesktopWidgetsLayout,
	DesktopWorkspaceProfile,
} from '../../types/desktopExpansion.types';
import {
	deriveWorkspaceProfileIdsFromPersistedWindows,
	deriveWorkspaceProfileIdsFromWindows,
} from '../../utils/desktopWorkspaceProfileCapture';
import { createId } from './normalizers';
import type { DesktopExpansionShellCore } from './useDesktopExpansionShellCore';

type WorkspaceActionsDeps = Pick<
	DesktopExpansionShellCore,
	'workspaceProfiles' | 'setWorkspaceProfiles' | 'patchExpansion'
> & {
	items: DesktopItem[];
	installedApps: DesktopItem[];
	currentDesktopWindows: WindowState[];
	sessionSnapshotWindows: PersistedWindowState[];
	activeDesktopId: string;
	widgetsLayout: DesktopWidgetsLayout;
	t: TFunction<'desktopUi'>;
};

export function useDesktopExpansionWorkspaceActions(
	deps: WorkspaceActionsDeps
) {
	const {
		workspaceProfiles,
		setWorkspaceProfiles,
		patchExpansion,
		items,
		installedApps,
		currentDesktopWindows,
		sessionSnapshotWindows,
		activeDesktopId,
		widgetsLayout,
		t,
	} = deps;

	const addWorkspaceProfile = useCallback(async () => {
		const rootApps = installedApps.slice(0, 4).map((app) => app.id);
		const folders = items
			.filter((item) => item.type === 'folder' && !item.parentId)
			.slice(0, 4)
			.map((item) => item.id);
		const next = [
			...workspaceProfiles,
			{
				id: createId('workspace'),
				name: t('settingsPanel.expansionWorkspaceNewName', {
					count: workspaceProfiles.length + 1,
				}),
				description: t('settingsPanel.expansionWorkspaceNewDesc'),
				desktopId: activeDesktopId,
				appIds: rootApps,
				folderItemIds: folders,
				widgetIds: widgetsLayout.slots
					.filter((slot) => slot.enabled)
					.map((slot) => slot.id),
			},
		].slice(-24);
		setWorkspaceProfiles(next);
		await patchExpansion({ workspace_profiles: { profiles: next } });
	}, [
		activeDesktopId,
		installedApps,
		items,
		patchExpansion,
		setWorkspaceProfiles,
		t,
		widgetsLayout.slots,
		workspaceProfiles,
	]);

	const addWorkspaceProfileFromOpenWindows = useCallback(async () => {
		const { appIds, folderItemIds } = deriveWorkspaceProfileIdsFromWindows(
			currentDesktopWindows,
			items,
			installedApps
		);
		if (appIds.length === 0 && folderItemIds.length === 0) {
			toast.info(t('settingsPanel.expansionWorkspaceCaptureEmpty'));
			return;
		}
		const next = [
			...workspaceProfiles,
			{
				id: createId('workspace'),
				name: t('settingsPanel.expansionWorkspaceFromSessionName', {
					count: workspaceProfiles.length + 1,
				}),
				description: t('settingsPanel.expansionWorkspaceFromSessionDesc'),
				desktopId: activeDesktopId,
				appIds: appIds.slice(0, 12),
				folderItemIds: folderItemIds.slice(0, 12),
				widgetIds: widgetsLayout.slots
					.filter((slot) => slot.enabled)
					.map((slot) => slot.id),
			},
		].slice(-24);
		setWorkspaceProfiles(next);
		await patchExpansion({ workspace_profiles: { profiles: next } });
	}, [
		activeDesktopId,
		currentDesktopWindows,
		installedApps,
		items,
		patchExpansion,
		setWorkspaceProfiles,
		t,
		widgetsLayout.slots,
		workspaceProfiles,
	]);

	const addWorkspaceProfileFromSessionSnapshot = useCallback(async () => {
		const { appIds, folderItemIds } =
			deriveWorkspaceProfileIdsFromPersistedWindows(
				sessionSnapshotWindows,
				items,
				installedApps,
				activeDesktopId
			);
		if (appIds.length === 0 && folderItemIds.length === 0) {
			toast.info(t('settingsPanel.expansionWorkspaceSnapshotEmpty'));
			return;
		}
		const next = [
			...workspaceProfiles,
			{
				id: createId('workspace'),
				name: t('settingsPanel.expansionWorkspaceFromSavedSnapshotName', {
					count: workspaceProfiles.length + 1,
				}),
				description: t('settingsPanel.expansionWorkspaceFromSavedSnapshotDesc'),
				desktopId: activeDesktopId,
				appIds: appIds.slice(0, 12),
				folderItemIds: folderItemIds.slice(0, 12),
				widgetIds: widgetsLayout.slots
					.filter((slot) => slot.enabled)
					.map((slot) => slot.id),
			},
		].slice(-24);
		setWorkspaceProfiles(next);
		await patchExpansion({ workspace_profiles: { profiles: next } });
	}, [
		activeDesktopId,
		installedApps,
		items,
		patchExpansion,
		sessionSnapshotWindows,
		setWorkspaceProfiles,
		t,
		widgetsLayout.slots,
		workspaceProfiles,
	]);

	const addWorkspaceProfileFromTemplate = useCallback(
		async (templateId: DesktopWorkspaceProfileTemplateId) => {
			const def = DESKTOP_WORKSPACE_PROFILE_TEMPLATES.find(
				(item) => item.id === templateId
			);
			if (!def) return;
			const appIds: string[] = [];
			const seen = new Set<string>();
			for (const ac of def.appComponents) {
				const hit = installedApps.find((a) => a.appComponent === ac);
				if (hit && !seen.has(hit.id)) {
					appIds.push(hit.id);
					seen.add(hit.id);
				}
			}
			if (appIds.length === 0) {
				toast.info(t('settingsPanel.expansionWorkspaceTemplateEmpty'));
				return;
			}
			const folders = items
				.filter((item) => item.type === 'folder' && !item.parentId)
				.slice(0, 4)
				.map((item) => item.id);
			const next = [
				...workspaceProfiles,
				{
					id: createId('workspace'),
					name: t(
						`settingsPanel.expansionWorkspaceTemplate.${templateId}.profileName`
					),
					description: t(
						`settingsPanel.expansionWorkspaceTemplate.${templateId}.profileDesc`
					),
					desktopId: activeDesktopId,
					appIds,
					folderItemIds: folders,
					widgetIds: widgetsLayout.slots
						.filter((slot) => slot.enabled)
						.map((slot) => slot.id),
				},
			].slice(-24);
			setWorkspaceProfiles(next);
			await patchExpansion({ workspace_profiles: { profiles: next } });
		},
		[
			activeDesktopId,
			installedApps,
			items,
			patchExpansion,
			setWorkspaceProfiles,
			t,
			widgetsLayout.slots,
			workspaceProfiles,
		]
	);

	const removeWorkspaceProfile = useCallback(
		async (profileId: string) => {
			const next = workspaceProfiles.filter(
				(profile) => profile.id !== profileId
			);
			setWorkspaceProfiles(next);
			await patchExpansion({ workspace_profiles: { profiles: next } });
		},
		[patchExpansion, setWorkspaceProfiles, workspaceProfiles]
	);

	const patchWorkspaceProfile = useCallback(
		async (
			profileId: string,
			patch: Partial<
				Pick<
					DesktopWorkspaceProfile,
					'name' | 'description' | 'desktopId' | 'wallpaper'
				>
			>
		) => {
			const next = workspaceProfiles.map((p) => {
				if (p.id !== profileId) return p;
				const name =
					typeof patch.name === 'string' ? patch.name.trim() || p.name : p.name;
				if (!name) return p;
				return {
					...p,
					name,
					description:
						patch.description !== undefined
							? patch.description.trim() || undefined
							: p.description,
					desktopId:
						patch.desktopId !== undefined
							? patch.desktopId === ''
								? undefined
								: patch.desktopId
							: p.desktopId,
					wallpaper:
						patch.wallpaper !== undefined
							? patch.wallpaper.trim() || undefined
							: p.wallpaper,
				};
			});
			setWorkspaceProfiles(next);
			await patchExpansion({ workspace_profiles: { profiles: next } });
		},
		[patchExpansion, setWorkspaceProfiles, workspaceProfiles]
	);

	return {
		addWorkspaceProfile,
		addWorkspaceProfileFromOpenWindows,
		addWorkspaceProfileFromSessionSnapshot,
		addWorkspaceProfileFromTemplate,
		removeWorkspaceProfile,
		patchWorkspaceProfile,
	};
}
