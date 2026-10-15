/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure merge of API desktop items with DEFAULT_APPS / DEFAULT_FOLDERS metadata
 * (legacy id migrations, copy normalization). No React.
 *
 * Invariants:
 * - Does not invent icons missing from the API response.
 * - Stable app ids / appComponent values preserved except documented legacy migrations.
 *
 * Related:
 * - hooks/useDesktopStorage.ts
 * - utils/desktopAppRegistry.ts
 */

import { DEFAULT_APPS, DEFAULT_FOLDERS } from '../constants';
import { resolveUserFolderIconNode } from '../constants/folderIcons';
import type { DesktopItem } from '../types/desktop.types';
import {
	isLegacyHiddenDesktopApp,
	migrateLegacyDesktopChatAppItem,
	shouldMigrateLegacyDesktopChatApp,
} from './desktopAppRegistry';
import { normalizeDefaultDesktopAppUserFacingCopy } from './desktopDefaultAppUserFacingCopy';
import { inferDesktopFileTypeFromName } from './createDesktopMarkdownFile';
import { isDesktopSystemFolder } from './desktopItemTree';

/** One item per id (API or merge may return duplicates). */
export function dedupeDesktopItemsById(list: DesktopItem[]): DesktopItem[] {
	const seen = new Set<string>();
	return list.filter((item) => {
		if (seen.has(item.id)) return false;
		seen.add(item.id);
		return true;
	});
}

/**
 * Enrich API items with default app/folder metadata (icon, colors).
 * Does not add apps from DEFAULT_APPS that are absent from the API payload.
 */
export function mergeDesktopItemsWithDefaults(
	savedItems: DesktopItem[]
): DesktopItem[] {
	const defaultAppsMap = new Map(DEFAULT_APPS.map((app) => [app.id, app]));
	const gafDefault = defaultAppsMap.get('app-gaf-chat');
	const eliteChatMigrated = savedItems.map((item) => {
		if (!shouldMigrateLegacyDesktopChatApp(item) || !gafDefault) {
			return item;
		}
		return migrateLegacyDesktopChatAppItem(item, gafDefault);
	});
	const dedupedEliteChat = eliteChatMigrated.filter((item, index, arr) => {
		if (item.type === 'app' && item.id === 'app-gaf-chat') {
			return (
				arr.findIndex((x) => x.type === 'app' && x.id === 'app-gaf-chat') ===
				index
			);
		}
		return true;
	});

	const filteredSavedItems = dedupedEliteChat.filter(
		(item) => !(item.type === 'app' && isLegacyHiddenDesktopApp(item))
	);
	const legacyVoiceIds = new Set([
		'app-voice',
		'app-voicecmd',
		'app-transcription',
	]);
	const legacyVoiceComponents = new Set([
		'VoiceStudio',
		'VoiceCommand',
		'AudioTranscriptionPro',
	]);

	const migratedItems = filteredSavedItems
		.map((item) => {
			if (
				item.type !== 'app' ||
				(!legacyVoiceIds.has(item.id) &&
					!(item.appComponent && legacyVoiceComponents.has(item.appComponent)))
			) {
				return item;
			}
			const studioDefault = defaultAppsMap.get('app-studio-gu');
			if (!studioDefault) return item;
			return {
				...studioDefault,
				...item,
				id: 'app-studio-gu',
				appComponent: 'StudioGU',
				name: studioDefault.name,
				icon: studioDefault.icon,
				description: studioDefault.description ?? item.description,
			};
		})
		.filter((item, index, arr) => {
			if (item.type === 'app' && item.id === 'app-studio-gu') {
				return (
					arr.findIndex((x) => x.type === 'app' && x.id === 'app-studio-gu') ===
					index
				);
			}
			return true;
		});

	const legacySocialIds = new Set(['app-friends', 'app-user-profile']);
	const legacySocialComponents = new Set(['FriendsApp', 'UserProfile']);
	const socialMigrated = migratedItems.map((item) => {
		if (
			item.type !== 'app' ||
			(!legacySocialIds.has(item.id) &&
				!(item.appComponent && legacySocialComponents.has(item.appComponent)))
		) {
			return item;
		}
		const hubDefault = defaultAppsMap.get('app-social-hub');
		if (!hubDefault) return item;
		return {
			...hubDefault,
			...item,
			id: 'app-social-hub',
			appComponent: 'SocialHubApp',
			name: hubDefault.name,
			icon: hubDefault.icon,
			description: hubDefault.description ?? item.description,
		};
	});
	const dedupedSocial = socialMigrated.filter((item, index, arr) => {
		if (item.type === 'app' && item.id === 'app-social-hub') {
			return (
				arr.findIndex((x) => x.type === 'app' && x.id === 'app-social-hub') ===
				index
			);
		}
		return true;
	});

	const defaultFoldersMap = new Map(
		DEFAULT_FOLDERS.map((folder) => [folder.id, folder])
	);

	return dedupedSocial.map((item) => {
		const defaultApp = defaultAppsMap.get(item.id);
		if (item.type === 'app' && defaultApp) {
			return normalizeDefaultDesktopAppUserFacingCopy({
				...defaultApp,
				...item,
				icon: defaultApp.icon,
				appComponent: item.appComponent ?? defaultApp.appComponent,
				description: item.description ?? defaultApp.description,
				category: item.category ?? defaultApp.category,
				color: item.color ?? defaultApp.color,
				gradient: item.gradient ?? defaultApp.gradient,
				isPinned: item.isPinned ?? defaultApp.isPinned,
			});
		}
		const defaultFolder = defaultFoldersMap.get(item.id);
		if (item.type === 'folder' && defaultFolder) {
			return {
				...item,
				icon: defaultFolder.icon,
				color: item.color ?? defaultFolder.color,
				gradient: item.gradient ?? defaultFolder.gradient,
			};
		}
		if (item.type === 'file') {
			return {
				...item,
				fileType: item.fileType ?? inferDesktopFileTypeFromName(item.name),
			};
		}
		if (
			item.type === 'folder' &&
			!isDesktopSystemFolder(item) &&
			item.folderIconId
		) {
			const iconNode = resolveUserFolderIconNode(item.folderIconId);
			if (iconNode) {
				return { ...item, icon: iconNode };
			}
		}
		return item;
	});
}
