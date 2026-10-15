/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * App collections, content shortcuts, assistant actions, and visual preset actions.
 *
 * Related:
 * - useDesktopExpansionSettings.ts
 */

import { useCallback } from 'react';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import {
	DESKTOP_APP_COLLECTION_TEMPLATES,
	type DesktopAppCollectionTemplateId,
} from '../../constants/desktopAppCollectionTemplates';
import type { DesktopItem } from '../../types/desktop.types';
import type {
	DesktopUserVisualStylePreset,
	DesktopWorkspaceProfile,
} from '../../types/desktopExpansion.types';
import type { ExpansionShellStatePatch } from '../../types/desktopShellStatePatch.types';
import {
	shortcutTargetFromSavedFilterFields,
	type SavedFilterContentShortcutFields,
} from '../../utils/contentManagerFilterShortcut';
import { createId } from './normalizers';
import type { DesktopExpansionShellCore } from './useDesktopExpansionShellCore';

type DiscoveryActionsDeps = Pick<
	DesktopExpansionShellCore,
	| 'appCollections'
	| 'setAppCollections'
	| 'contentShortcuts'
	| 'setContentShortcuts'
	| 'assistantContextActions'
	| 'setAssistantContextActions'
	| 'visualStylePresets'
	| 'setVisualStylePresets'
	| 'patchExpansion'
> & {
	items: DesktopItem[];
	installedApps: DesktopItem[];
	workspaceProfiles: DesktopWorkspaceProfile[];
	t: TFunction<'desktopUi'>;
};

export function useDesktopExpansionDiscoveryActions(
	deps: DiscoveryActionsDeps
) {
	const {
		appCollections,
		setAppCollections,
		contentShortcuts,
		setContentShortcuts,
		assistantContextActions,
		setAssistantContextActions,
		visualStylePresets,
		setVisualStylePresets,
		patchExpansion,
		items,
		installedApps,
		workspaceProfiles,
		t,
	} = deps;

	const addAppCollection = useCallback(async () => {
		const next = [
			...appCollections,
			{
				id: createId('apps'),
				name: t('settingsPanel.expansionAppCollectionNewName', {
					count: appCollections.length + 1,
				}),
				description: t('settingsPanel.expansionAppCollectionNewDesc'),
				appIds: installedApps.slice(0, 6).map((app) => app.id),
			},
		].slice(-24);
		setAppCollections(next);
		await patchExpansion({ app_collections: next });
	}, [appCollections, installedApps, patchExpansion, setAppCollections, t]);

	const addAppCollectionFromTemplate = useCallback(
		async (templateId: DesktopAppCollectionTemplateId) => {
			const def = DESKTOP_APP_COLLECTION_TEMPLATES.find(
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
				toast.info(t('settingsPanel.expansionAppCollectionTemplateEmpty'));
				return;
			}
			const next = [
				...appCollections,
				{
					id: createId('apps'),
					name: t(
						`settingsPanel.expansionAppCollectionTemplate.${templateId}.name`
					),
					description: t(
						`settingsPanel.expansionAppCollectionTemplate.${templateId}.desc`
					),
					appIds,
				},
			].slice(-24);
			setAppCollections(next);
			await patchExpansion({ app_collections: next });
		},
		[appCollections, installedApps, patchExpansion, setAppCollections, t]
	);

	const removeAppCollection = useCallback(
		async (collectionId: string) => {
			const next = appCollections.filter(
				(collection) => collection.id !== collectionId
			);
			setAppCollections(next);
			await patchExpansion({ app_collections: next });
		},
		[appCollections, patchExpansion, setAppCollections]
	);

	const addContentShortcut = useCallback(async () => {
		const folder = items.find(
			(item) => item.type === 'folder' && !item.parentId
		);
		const next = [
			...contentShortcuts,
			{
				id: createId('content'),
				label:
					folder?.name ??
					t('settingsPanel.expansionContentShortcutFallbackLabel'),
				type: 'desktop-folder' as const,
				target: { itemId: folder?.id ?? 'content' },
				workspaceProfileId: workspaceProfiles[0]?.id,
			},
		].slice(-48);
		setContentShortcuts(next);
		await patchExpansion({ content_shortcuts: next });
	}, [
		contentShortcuts,
		items,
		patchExpansion,
		setContentShortcuts,
		t,
		workspaceProfiles,
	]);

	const removeContentShortcut = useCallback(
		async (shortcutId: string) => {
			const next = contentShortcuts.filter(
				(shortcut) => shortcut.id !== shortcutId
			);
			setContentShortcuts(next);
			await patchExpansion({ content_shortcuts: next });
		},
		[contentShortcuts, patchExpansion, setContentShortcuts]
	);

	const addSavedFilterContentShortcut = useCallback(
		async (fields: SavedFilterContentShortcutFields) => {
			const label =
				fields.label?.trim() ||
				t('settingsPanel.expansionSavedFilterShortcutFallbackLabel');
			const target = shortcutTargetFromSavedFilterFields({
				...fields,
				label,
			});
			const next = [
				...contentShortcuts,
				{
					id: createId('content'),
					label,
					type: 'saved-filter' as const,
					target,
					workspaceProfileId: workspaceProfiles[0]?.id,
				},
			].slice(-48);
			setContentShortcuts(next);
			await patchExpansion({ content_shortcuts: next });
		},
		[
			contentShortcuts,
			patchExpansion,
			setContentShortcuts,
			t,
			workspaceProfiles,
		]
	);

	const toggleAssistantAction = useCallback(
		async (actionId: string) => {
			const next = assistantContextActions.map((action) =>
				action.id === actionId
					? { ...action, enabled: !action.enabled }
					: action
			);
			setAssistantContextActions(next);
			await patchExpansion({ assistant_context_actions: next });
		},
		[assistantContextActions, patchExpansion, setAssistantContextActions]
	);

	const addVisualStylePreset = useCallback(
		async (
			fields: Omit<DesktopUserVisualStylePreset, 'id' | 'createdAt'> & {
				id?: string;
			}
		) => {
			const id = fields.id?.trim() || createId('vstyle');
			const entry: DesktopUserVisualStylePreset = {
				...fields,
				id,
				createdAt: new Date().toISOString(),
			};
			const next = [...visualStylePresets, entry].slice(-24);
			setVisualStylePresets(next);
			await patchExpansion({
				visual_style_presets: next,
			} as ExpansionShellStatePatch);
		},
		[patchExpansion, setVisualStylePresets, visualStylePresets]
	);

	const removeVisualStylePreset = useCallback(
		async (presetId: string) => {
			const next = visualStylePresets.filter((p) => p.id !== presetId);
			setVisualStylePresets(next);
			await patchExpansion({
				visual_style_presets: next,
			} as ExpansionShellStatePatch);
		},
		[patchExpansion, setVisualStylePresets, visualStylePresets]
	);

	return {
		addAppCollection,
		addAppCollectionFromTemplate,
		removeAppCollection,
		addContentShortcut,
		addSavedFilterContentShortcut,
		removeContentShortcut,
		toggleAssistantAction,
		addVisualStylePreset,
		removeVisualStylePreset,
	};
}
