/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Explorer folder tree and collapsed monogram rail for Content Manager files tab.
 *
 * Invariants:
 * - Drop targets highlight during drag-over; folder target state owned by parent.
 *
 * Related:
 * - `ContentManagerFilesTab.tsx`
 * - `contentManagerFilesGridLayout.ts`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ChevronDownIcon,
	FolderIcon,
	FolderOpenIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';
import { DesktopExplorerFolderMonogramButton } from '../../Desktop/components/desktopExplorerRailUi';
import type {
	ContentManagerFolderTreeNode,
	ExplorerFolderTarget,
	FilesBrowseMode,
} from '../contentManagerTypes';
import { resolveDesktopFolderDisplayName } from '../../Desktop/utils/desktopSystemFolderLabels';
import { CM_EXPLORER_DEPTH_PS } from '../utils/contentManagerFilesGridLayout';

export type ContentManagerFilesExplorerTreeProps = {
	folderTreeRoots: ContentManagerFolderTreeNode[];
	explorerFolderTarget: ExplorerFolderTarget;
	setExplorerFolderTarget: React.Dispatch<
		React.SetStateAction<ExplorerFolderTarget>
	>;
	explorerExpandedFolderIds: ReadonlySet<string>;
	setExplorerExpandedFolderIds: React.Dispatch<
		React.SetStateAction<Set<string>>
	>;
	explorerDropHighlight: 'unfiled' | string | null;
	setExplorerDropHighlight: React.Dispatch<
		React.SetStateAction<'unfiled' | string | null>
	>;
	onExplorerDropToFolder: (
		e: React.DragEvent,
		targetFolderItemId: string | null
	) => void | Promise<void>;
	onRequestFolderMenu: (
		event: React.MouseEvent,
		folder: ContentManagerFolderTreeNode
	) => void;
};

function ExplorerFolderBranch({
	nodes,
	depth,
	props,
}: {
	nodes: ContentManagerFolderTreeNode[];
	depth: number;
	props: ContentManagerFilesExplorerTreeProps;
}): React.ReactElement {
	const { t } = useTranslation('contentManager');
	const { t: tDesktopUi } = useTranslation('desktopUi');
	const {
		explorerFolderTarget,
		setExplorerFolderTarget,
		explorerExpandedFolderIds,
		setExplorerExpandedFolderIds,
		explorerDropHighlight,
		setExplorerDropHighlight,
		onExplorerDropToFolder,
		onRequestFolderMenu,
	} = props;

	return (
		<>
			{nodes.map((node) => {
				const displayName = resolveDesktopFolderDisplayName(node, tDesktopUi);
				const hasKids = node.children.length > 0;
				const expanded = explorerExpandedFolderIds.has(node.item_id);
				const isSel = explorerFolderTarget === node.item_id;
				const isHl = explorerDropHighlight === node.item_id;
				return (
					<div key={node.item_id} className="min-w-0">
						<div
							className={cn(
								'flex min-w-0 items-stretch gap-0.5 rounded-lg',
								CM_EXPLORER_DEPTH_PS[
									Math.min(depth, CM_EXPLORER_DEPTH_PS.length - 1)
								]
							)}
						>
							{hasKids ? (
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="icon"
									className="h-8 w-7 shrink-0"
									aria-expanded={expanded}
									title={
										expanded ? t('explorer.collapse') : t('explorer.expand')
									}
									onClick={() => {
										setExplorerExpandedFolderIds((prev) => {
											const next = new Set(prev);
											if (next.has(node.item_id)) next.delete(node.item_id);
											else next.add(node.item_id);
											return next;
										});
									}}
								>
									<ChevronDownIcon
										className={cn(
											'h-4 w-4 text-(--desktop-text-muted) transition-transform',
											!expanded && '-rotate-90'
										)}
									/>
								</DesktopAppButton>
							) : (
								<span className="inline-flex w-7 shrink-0" aria-hidden />
							)}
							<button
								type="button"
								title={t('explorer.folderRowHint', { name: displayName })}
								onClick={() => setExplorerFolderTarget(node.item_id)}
								onContextMenu={(event) => {
									event.preventDefault();
									event.stopPropagation();
									onRequestFolderMenu(event, node);
								}}
								onDragOver={(e) => {
									e.preventDefault();
									e.stopPropagation();
									e.dataTransfer.dropEffect = 'move';
									setExplorerDropHighlight(node.item_id);
								}}
								onDragLeave={(e) => {
									e.stopPropagation();
									setExplorerDropHighlight((h) =>
										h === node.item_id ? null : h
									);
								}}
								onDrop={(e) => {
									void onExplorerDropToFolder(e, node.item_id);
								}}
								className={cn(
									'flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors',
									isSel
										? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] text-(--desktop-text-primary)'
										: 'border-transparent text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft)',
									isHl && 'ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
								)}
							>
								<FolderIcon
									className="h-3.5 w-3.5 shrink-0 text-(--desktop-text-muted)"
									aria-hidden
								/>
								<span className="truncate font-medium">{displayName}</span>
							</button>
						</div>
						{hasKids && expanded ? (
							<div className="mt-0.5 space-y-0.5">
								<ExplorerFolderBranch
									nodes={node.children}
									depth={depth + 1}
									props={props}
								/>
							</div>
						) : null}
					</div>
				);
			})}
		</>
	);
}

export function ContentManagerFilesExplorerTree(
	props: ContentManagerFilesExplorerTreeProps
): React.ReactElement {
	const { t } = useTranslation('contentManager');
	const {
		folderTreeRoots,
		explorerFolderTarget,
		setExplorerFolderTarget,
		explorerDropHighlight,
		setExplorerDropHighlight,
		onExplorerDropToFolder,
	} = props;

	return (
		<>
			<div className="mb-2 space-y-1">
				<button
					type="button"
					title={t('explorer.unfiledRowHint')}
					onClick={() => setExplorerFolderTarget('unfiled')}
					onDragOver={(e) => {
						e.preventDefault();
						e.stopPropagation();
						e.dataTransfer.dropEffect = 'move';
						setExplorerDropHighlight('unfiled');
					}}
					onDragLeave={(e) => {
						e.stopPropagation();
						setExplorerDropHighlight((h) => (h === 'unfiled' ? null : h));
					}}
					onDrop={(e) => {
						void onExplorerDropToFolder(e, null);
					}}
					className={cn(
						'flex w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition-colors',
						explorerFolderTarget === 'unfiled'
							? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] text-(--desktop-text-primary)'
							: 'border-transparent text-(--desktop-text-secondary) hover:bg-(--desktop-surface-panel)',
						explorerDropHighlight === 'unfiled' &&
							'ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
					)}
				>
					<FolderOpenIcon
						className="h-3.5 w-3.5 shrink-0 text-(--desktop-text-muted)"
						aria-hidden
					/>
					<span className="truncate">{t('explorer.unfiled')}</span>
				</button>
			</div>
			<div className="space-y-0.5">
				<ExplorerFolderBranch nodes={folderTreeRoots} depth={0} props={props} />
			</div>
		</>
	);
}

export type ContentManagerFilesExplorerCollapsedRailProps = {
	filesBrowseMode: FilesBrowseMode;
	folderTreeRoots: ContentManagerFolderTreeNode[];
	explorerFolderTarget: ExplorerFolderTarget;
	setExplorerFolderTarget: React.Dispatch<
		React.SetStateAction<ExplorerFolderTarget>
	>;
	explorerDropHighlight: 'unfiled' | string | null;
	setExplorerDropHighlight: React.Dispatch<
		React.SetStateAction<'unfiled' | string | null>
	>;
	onExplorerDropToFolder: (
		e: React.DragEvent,
		targetFolderItemId: string | null
	) => void | Promise<void>;
};

export function ContentManagerFilesExplorerCollapsedRail({
	filesBrowseMode,
	folderTreeRoots,
	explorerFolderTarget,
	setExplorerFolderTarget,
	setExplorerDropHighlight,
	onExplorerDropToFolder,
}: ContentManagerFilesExplorerCollapsedRailProps): React.ReactElement | null {
	const { t } = useTranslation('contentManager');
	const { t: tDesktopUi } = useTranslation('desktopUi');

	if (filesBrowseMode !== 'explorer') return null;

	const unfiledLabel = t('explorer.unfiled');

	return (
		<>
			<DesktopExplorerFolderMonogramButton
				name={unfiledLabel}
				title={t('explorer.unfiledRowHint')}
				ariaLabel={unfiledLabel}
				active={explorerFolderTarget === 'unfiled'}
				onClick={() => setExplorerFolderTarget('unfiled')}
				onDragOver={(e) => {
					e.preventDefault();
					e.stopPropagation();
					e.dataTransfer.dropEffect = 'move';
					setExplorerDropHighlight('unfiled');
				}}
				onDragLeave={(e) => {
					e.stopPropagation();
					setExplorerDropHighlight((h) => (h === 'unfiled' ? null : h));
				}}
				onDrop={(e) => {
					void onExplorerDropToFolder(e, null);
				}}
			/>
			{folderTreeRoots.map((node) => {
				const displayName = resolveDesktopFolderDisplayName(node, tDesktopUi);
				return (
					<DesktopExplorerFolderMonogramButton
						key={node.item_id}
						name={displayName}
						title={t('explorer.folderRowHint', { name: displayName })}
						ariaLabel={displayName}
						active={explorerFolderTarget === node.item_id}
						onClick={() => setExplorerFolderTarget(node.item_id)}
						onDragOver={(e) => {
							e.preventDefault();
							e.stopPropagation();
							e.dataTransfer.dropEffect = 'move';
							setExplorerDropHighlight(node.item_id);
						}}
						onDragLeave={(e) => {
							e.stopPropagation();
							setExplorerDropHighlight((h) => (h === node.item_id ? null : h));
						}}
						onDrop={(e) => {
							void onExplorerDropToFolder(e, node.item_id);
						}}
					/>
				);
			})}
		</>
	);
}
