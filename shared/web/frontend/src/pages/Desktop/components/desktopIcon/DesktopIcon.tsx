/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Draggable desktop icon orchestrator (native mouse drag + optional HTML5 CM export).
 *
 * Invariants:
 * - Reposition drag uses mouse events + rAF translate3d preview; no Framer scale/opacity during drag.
 * - File icons are not draggable unless Alt arms CM export drag.
 * - Wrapper exposes data-desktop-icon-id for multi-select sibling preview (DOM-only).
 * - No hover tooltips (TooltipV2 / native title / absolute overlay) — label under icon is enough.
 *
 * Related:
 * - hooks/useDesktopWorkspaceIconInteractions.ts
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md (P29)
 * - documentation/product/desktop/DESKTOP-IMPLEMENTED-VS-STUB.md
 */

import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveDesktopFolderDisplayName } from '../../utils/desktopSystemFolderLabels';
import { formatDesktopLabel } from '../../utils/desktopUi';
import { DesktopIconSurface } from './DesktopIconSurface';
import { ICON_VISUAL_STYLES } from './iconVisualStyles';
import type { DesktopIconProps } from './types';
import { useDesktopIconDrag } from './useDesktopIconDrag';
import { useDesktopIconExternalDrag } from './useDesktopIconExternalDrag';

export const DesktopIcon = memo(function DesktopIcon({
	item,
	isSelected,
	onSelect,
	onDoubleClick,
	onContextMenu,
	onDragStart,
	onDragEnd,
	onDrag,
	onDropToFolder,
	onExternalContentDropToFolder,
	allItems = [],
	isRenaming = false,
	onRename,
	onCancelRename,
	isCut = false,
	tabIndex = -1,
	iconRef,
	onKeyDown,
	iconSize = 'medium',
	visualStyle = 'glass',
	onDropTargetChange,
	activeDropTargetFolderId = null,
	badgeCount,
	folderChildCount,
	folderPreviewEntries,
	selectedIds,
}: DesktopIconProps) {
	const { t } = useTranslation('desktopUi');

	const visual = ICON_VISUAL_STYLES[visualStyle] ?? ICON_VISUAL_STYLES.glass;
	const displayName = useMemo(
		() => resolveDesktopFolderDisplayName(item, t),
		[item, t]
	);
	const labelText = formatDesktopLabel(displayName);

	const isFolderDropTarget =
		item.type === 'folder' && activeDropTargetFolderId === item.id;

	const {
		wrapperRef,
		sizes,
		isDragging,
		isDropTarget,
		handleMouseDown,
		consumeDidDrag,
	} = useDesktopIconDrag({
		item,
		allItems,
		iconSize,
		isRenaming,
		onDragStart,
		onDragEnd,
		onDrag,
		onDropToFolder,
		onDropTargetChange,
	});

	const {
		contentManagerDragArmed,
		externalContentOver,
		handleHtml5DragStart,
		handleHtml5DragEnd,
		handleFolderExternalDragOver,
		handleFolderExternalDragLeave,
		handleFolderExternalDrop,
	} = useDesktopIconExternalDrag({
		item,
		allItems,
		selectedIds,
		onExternalContentDropToFolder,
	});

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: wrapper for HTML5 drag/drop + folder drop zone; interactive semantics are on the inner role=button.
		<div
			ref={wrapperRef}
			data-desktop-icon
			data-desktop-icon-id={item.id}
			className="pointer-events-auto absolute cursor-grab active:cursor-grabbing"
			draggable={item.type === 'file' && contentManagerDragArmed}
			onDragStart={handleHtml5DragStart}
			onDragEnd={handleHtml5DragEnd}
			onDragOver={
				item.type === 'folder' && onExternalContentDropToFolder
					? handleFolderExternalDragOver
					: undefined
			}
			onDragLeave={
				item.type === 'folder' && onExternalContentDropToFolder
					? handleFolderExternalDragLeave
					: undefined
			}
			onDrop={
				item.type === 'folder' && onExternalContentDropToFolder
					? handleFolderExternalDrop
					: undefined
			}
		>
			<DesktopIconSurface
				item={item}
				displayName={displayName}
				labelText={labelText}
				sizes={sizes}
				visual={visual}
				visualStyle={visualStyle}
				iconSize={iconSize}
				isSelected={isSelected}
				isRenaming={isRenaming}
				isCut={isCut}
				isDragging={isDragging}
				isDropTarget={isDropTarget}
				externalContentOver={externalContentOver}
				isFolderDropTarget={isFolderDropTarget}
				tabIndex={tabIndex}
				iconRef={iconRef}
				badgeCount={badgeCount}
				folderChildCount={folderChildCount}
				folderPreviewEntries={folderPreviewEntries}
				onSelect={onSelect}
				onDoubleClick={onDoubleClick}
				onContextMenu={onContextMenu}
				onKeyDown={onKeyDown}
				onRename={onRename}
				onCancelRename={onCancelRename}
				handleMouseDown={handleMouseDown}
				consumeDidDrag={consumeDidDrag}
			/>
		</div>
	);
});

DesktopIcon.displayName = 'DesktopIcon';

export default DesktopIcon;
