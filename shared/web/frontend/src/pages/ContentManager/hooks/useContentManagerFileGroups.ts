/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derives grouped Content Manager file rows for the Files tab.
 *
 * Invariants:
 * - All-files folder groups sort newest first and reveal in fixed increments.
 * - Size and processing_status filters are applied server-side on GET /content
 *   (and folder-view); this hook only groups already-filtered rows.
 *
 * Related:
 * - ContentManagerPro.tsx
 * - contentManagerTypes.ts
 * - documentation/product/CONTENT-MANAGER.md
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import type { DesktopItemResponse } from '../../Desktop/services/desktopApi';
import { resolveDesktopFolderDisplayName } from '../../Desktop/utils/desktopSystemFolderLabels';
import {
	ALL_FILES_FOLDER_VISIBLE_STEP,
	type ContentManagerFilePanelGroup,
	type FilesBrowseMode,
	type GroupBy,
} from '../contentManagerTypes';
import { sortItemsByNewestUpdatedFirst } from '../utils/contentManagerAllFilesSort';

export type UseContentManagerFileGroupsOptions = {
	t: TFunction<'contentManager'>;
	language: string;
	items: ContentItem[];
	desktopFolderItems: DesktopItemResponse[];
	filesBrowseMode: FilesBrowseMode;
	groupBy: GroupBy;
	loading: boolean;
};

export function useContentManagerFileGroups({
	t,
	language,
	items,
	desktopFolderItems,
	filesBrowseMode,
	groupBy,
	loading,
}: UseContentManagerFileGroupsOptions) {
	const { t: tDesktopUi } = useTranslation('desktopUi');
	const [allFilesFolderReveal, setAllFilesFolderReveal] = useState<
		Record<string, number>
	>({});
	useEffect(() => {
		if (filesBrowseMode !== 'all_files') setAllFilesFolderReveal({});
	}, [filesBrowseMode]);
	const previousLoadingRef = useRef(loading);
	useEffect(() => {
		if (
			previousLoadingRef.current &&
			!loading &&
			filesBrowseMode === 'all_files'
		) {
			setAllFilesFolderReveal({});
		}
		previousLoadingRef.current = loading;
	}, [filesBrowseMode, loading]);
	const onAllFilesShowMoreInFolder = useCallback((groupId: string) => {
		setAllFilesFolderReveal((current) => ({
			...current,
			[groupId]:
				(current[groupId] ?? ALL_FILES_FOLDER_VISIBLE_STEP) +
				ALL_FILES_FOLDER_VISIBLE_STEP,
		}));
	}, []);

	const processedGroups = useMemo(() => {
		if (groupBy === 'none') {
			return [{ groupId: 'all', title: '', items: [...items] }];
		}
		if (groupBy === 'folder') {
			const folderById = new Map(
				desktopFolderItems.map((folder) => [folder.item_id, folder])
			);
			const groupMap = new Map<string, ContentItem[]>();
			for (const item of items) {
				const key = item.folder_item_id?.trim() || '__unfiled__';
				const groupItems = groupMap.get(key) ?? [];
				groupItems.push(item);
				groupMap.set(key, groupItems);
			}
			const titleFor = (key: string) => {
				if (key === '__unfiled__') return t('explorer.unfiled');
				const folder = folderById.get(key);
				if (folder) {
					return resolveDesktopFolderDisplayName(folder, tDesktopUi);
				}
				const short =
					key.length > 14 ? `${key.slice(0, 8)}…${key.slice(-4)}` : key;
				return t('files.folderGroup.unknown', { id: short });
			};
			const entries = [...groupMap.entries()].sort(([left], [right]) => {
				if (left === '__unfiled__') return right === '__unfiled__' ? 0 : -1;
				if (right === '__unfiled__') return 1;
				return titleFor(left).localeCompare(titleFor(right), undefined, {
					sensitivity: 'base',
				});
			});
			if (filesBrowseMode === 'all_files') {
				for (const [, groupItems] of entries) {
					sortItemsByNewestUpdatedFirst(groupItems);
				}
			}
			return entries.map(([key, groupItems]) => ({
				groupId: key,
				title: titleFor(key),
				items: groupItems,
			}));
		}
		const groups = new Map<string, ContentItem[]>();
		for (const item of items) {
			let title: string;
			if (groupBy === 'type') {
				title = t(`contentTypes.${item.content_type}`, {
					defaultValue: t('files.typeOtherGroup'),
				});
			} else {
				const date = new Date(item.created_at);
				const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
				title =
					diffDays === 0
						? t('files.dateGroup.today')
						: diffDays === 1
							? t('files.dateGroup.yesterday')
							: diffDays < 7
								? t('files.dateGroup.thisWeek')
								: diffDays < 30
									? t('files.dateGroup.thisMonth')
									: date.toLocaleDateString(
											language.startsWith('en') ? 'en-US' : 'ru-RU',
											{ month: 'long', year: 'numeric' }
										);
			}
			const groupItems = groups.get(title) ?? [];
			groupItems.push(item);
			groups.set(title, groupItems);
		}
		return [...groups.entries()].map(([title, groupItems], index) => ({
			groupId: `${groupBy}:${index}:${title}`,
			title,
			items: groupItems,
		}));
	}, [
		desktopFolderItems,
		filesBrowseMode,
		groupBy,
		items,
		language,
		t,
		tDesktopUi,
	]);

	const filePanelGroups = useMemo((): ContentManagerFilePanelGroup[] => {
		if (filesBrowseMode !== 'all_files' || groupBy !== 'folder') {
			return processedGroups.map((group) => ({
				...group,
				totalInFolder: group.items.length,
			}));
		}
		return processedGroups.map((group) => {
			const cap =
				allFilesFolderReveal[group.groupId] ?? ALL_FILES_FOLDER_VISIBLE_STEP;
			return {
				...group,
				items: group.items.slice(0, cap),
				totalInFolder: group.items.length,
			};
		});
	}, [allFilesFolderReveal, filesBrowseMode, groupBy, processedGroups]);

	const filteredItems = useMemo(
		() => filePanelGroups.flatMap((group) => group.items),
		[filePanelGroups]
	);

	return { filePanelGroups, filteredItems, onAllFilesShowMoreInFolder };
}
