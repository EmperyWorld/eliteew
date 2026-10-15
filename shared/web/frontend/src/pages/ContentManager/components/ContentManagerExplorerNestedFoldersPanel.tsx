/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Main-panel nested desktop folders for Content Manager explorer (parity with
 * desktop folder window nested section).
 *
 * Invariants:
 * - Direct children only; open navigates explorerFolderTarget.
 * - Grid/list cards never nest interactive controls inside a button.
 * - Folder accent uses border-l-4 + getFolderAccentBorderClass (same as file cards).
 * - Grid tiles are compact horizontal chips (not tall poster cards).
 * - Context menu / ⋯ delegate to parent folder handlers.
 *
 * Related:
 * - contentManagerExplorerNestedFolders.ts · ContentManagerFolderContextMenu.tsx
 * - contentManagerNestedFoldersChrome.ts
 * - documentation/product/CONTENT-MANAGER.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	EllipsisHorizontalIcon,
	FolderIcon,
} from '@heroicons/react/24/outline';
import type { DesktopItemResponse } from '../../Desktop/services/desktopApi';
import {
	DesktopAppButton,
	DesktopAppSectionLabel,
	DesktopAppStatusBadge,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_INTERACTIVE } from '../../Desktop/constants';
import { resolveUserFolderIconNode } from '../../Desktop/constants/folderIcons';
import { readFolderIconIdFromMeta } from '../../Desktop/utils/desktopFolderIconMeta';
import { resolveDesktopFolderDisplayName } from '../../Desktop/utils/desktopSystemFolderLabels';
import { cn } from '../../../utils/cn';
import { getFolderAccentBorderClass } from '../utils/contentManagerFolderAccent';
import {
	CM_NESTED_FOLDERS_GRID_CLASS,
	CM_NESTED_FOLDER_ICON_WRAP_CLASS,
	CM_NESTED_FOLDER_MORE_BTN_CLASS,
	CM_NESTED_FOLDER_OPEN_BTN_CLASS,
	CM_NESTED_FOLDER_TILE_CLASS,
	CM_NESTED_FOLDER_TITLE_CLASS,
} from './contentManagerNestedFoldersChrome';

export type ContentManagerExplorerNestedFoldersPanelProps = {
	folders: readonly DesktopItemResponse[];
	viewMode: 'grid' | 'list';
	shellContentPanelClass: string;
	onOpenFolder: (itemId: string) => void;
	onFolderContextMenu: (
		e: React.MouseEvent,
		folder: DesktopItemResponse
	) => void;
};

function NestedFolderGlyph({
	folder,
	className,
}: {
	folder: DesktopItemResponse;
	className: string;
}): React.ReactElement {
	const custom = resolveUserFolderIconNode(
		readFolderIconIdFromMeta(folder.meta)
	);
	if (custom) {
		return (
			<span
				className={cn(
					'inline-flex shrink-0 items-center justify-center text-[rgb(var(--desktop-accent-rgb)/0.9)] [&_svg]:h-full [&_svg]:w-full',
					className
				)}
				aria-hidden
			>
				{custom}
			</span>
		);
	}
	return (
		<FolderIcon
			className={cn(
				'shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.9)]',
				className
			)}
			aria-hidden
		/>
	);
}

export function ContentManagerExplorerNestedFoldersPanel({
	folders,
	viewMode,
	shellContentPanelClass,
	onOpenFolder,
	onFolderContextMenu,
}: ContentManagerExplorerNestedFoldersPanelProps): React.ReactElement | null {
	const { t } = useTranslation('contentManager');
	const { t: tDesktopUi } = useTranslation('desktopUi');
	if (folders.length === 0) return null;

	return (
		<section
			className="space-y-2"
			aria-label={t('explorer.nestedFoldersSection')}
		>
			<div className="flex items-center gap-2">
				<span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.65)]" />
				<DesktopAppSectionLabel>
					{t('explorer.nestedFoldersSection')}
				</DesktopAppSectionLabel>
				<DesktopAppStatusBadge className="tabular-nums">
					({folders.length})
				</DesktopAppStatusBadge>
			</div>
			{viewMode === 'grid' ? (
				<div
					className={CM_NESTED_FOLDERS_GRID_CLASS}
					data-cm-nested-folders-grid="true"
				>
					{folders.map((folder) => {
						const displayName = resolveDesktopFolderDisplayName(
							folder,
							tDesktopUi
						);
						const openHint = t('explorer.folderRowHint', { name: displayName });
						return (
							// biome-ignore lint/a11y/useSemanticElements: folder tile with separate ⋯ control (parity ContentManagerFileCard)
							<div
								key={folder.item_id}
								role="group"
								data-cm-nested-folder-id={folder.item_id}
								aria-label={displayName}
								className={cn(
									CM_NESTED_FOLDER_TILE_CLASS,
									getFolderAccentBorderClass(folder.item_id)
								)}
							>
								<button
									type="button"
									title={openHint}
									aria-label={openHint}
									onClick={() => onOpenFolder(folder.item_id)}
									onContextMenu={(e) => {
										e.preventDefault();
										e.stopPropagation();
										onFolderContextMenu(e, folder);
									}}
									className={cn(
										CM_NESTED_FOLDER_OPEN_BTN_CLASS,
										DESKTOP_INTERACTIVE.focusRing
									)}
								>
									<span className={CM_NESTED_FOLDER_ICON_WRAP_CLASS}>
										<NestedFolderGlyph
											folder={folder}
											className="h-3.5 w-3.5"
										/>
									</span>
									<span className={CM_NESTED_FOLDER_TITLE_CLASS}>
										{displayName}
									</span>
								</button>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="icon"
									className={CM_NESTED_FOLDER_MORE_BTN_CLASS}
									title={t('pro.menu.more')}
									aria-label={t('pro.menu.more')}
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										onFolderContextMenu(e, folder);
									}}
								>
									<EllipsisHorizontalIcon className="h-3.5 w-3.5" />
								</DesktopAppButton>
							</div>
						);
					})}
				</div>
			) : (
				<div
					className={cn(
						shellContentPanelClass,
						'divide-y divide-(--desktop-border-subtle) overflow-hidden p-0'
					)}
					data-cm-nested-folders-list="true"
				>
					{folders.map((folder) => {
						const displayName = resolveDesktopFolderDisplayName(
							folder,
							tDesktopUi
						);
						const openHint = t('explorer.folderRowHint', { name: displayName });
						return (
							<div
								key={folder.item_id}
								data-cm-nested-folder-id={folder.item_id}
								className={cn(
									'group flex items-center gap-3 border-l-4 px-3 py-2.5 hover:bg-(--desktop-surface-raised)/50',
									getFolderAccentBorderClass(folder.item_id)
								)}
							>
								<button
									type="button"
									title={openHint}
									aria-label={openHint}
									className={cn(
										'flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none',
										DESKTOP_INTERACTIVE.focusRing
									)}
									onClick={() => onOpenFolder(folder.item_id)}
									onContextMenu={(e) => {
										e.preventDefault();
										e.stopPropagation();
										onFolderContextMenu(e, folder);
									}}
								>
									<span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--desktop-accent-rgb)/0.08)]">
										<NestedFolderGlyph folder={folder} className="h-4 w-4" />
									</span>
									<span className="truncate text-sm text-(--desktop-text-primary)">
										{displayName}
									</span>
								</button>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="icon"
									className="h-7 w-7 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
									title={t('pro.menu.more')}
									aria-label={t('pro.menu.more')}
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										onFolderContextMenu(e, folder);
									}}
								>
									<EllipsisHorizontalIcon className="h-3.5 w-3.5" />
								</DesktopAppButton>
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
