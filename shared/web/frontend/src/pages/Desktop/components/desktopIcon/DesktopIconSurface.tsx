/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Interactive desktop icon surface (glyph, badges, label/rename) — inner role=button chrome.
 *
 * Invariants:
 * - aria-pressed on role=button for multi-select; rename mode drops role while keeping layout.
 * - No hover tooltip overlays or native `title` — visible label under the glyph is the name SSOT.
 *
 * Related:
 * - desktopIcon/DesktopIcon.tsx
 */

import { cn } from '@/utils/cn';
import { MapPinIcon } from '@heroicons/react/24/outline';
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	isProjectDesktopFolderItemId,
	projectDesktopFolderInitialGlyph,
} from '@/pages/ContentManager/projectDesktopFolder';
import type { DesktopIconStyle } from '@/types/profile';
import {
	DESKTOP_APP_ICON,
	DESKTOP_ICON_SVG_QUALITY,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
	type IconSizePreference,
} from '../../constants';
import type {
	DesktopFolderPreviewEntry,
	DesktopItem,
} from '../../types/desktop.types';
import { preloadDesktopApp } from '../../utils/preloadDesktopApp';
import {
	DesktopAppSymbol,
	DesktopFolderSymbol,
} from '../../utils/desktopVisualSystem';
import { DesktopFolderIconPreviewMosaic } from '../DesktopFolderIconPreviewMosaic';
import { isFriendsAppBadge, isGafChatAppBadge } from './badgeHelpers';
import { getFileIcon } from './fileIcon';
import type { ICON_VISUAL_STYLES } from './iconVisualStyles';

export interface DesktopIconSurfaceProps {
	item: DesktopItem;
	displayName: string;
	labelText: string;
	sizes: { width: number; height: number; iconBox: string; label: string };
	visual: (typeof ICON_VISUAL_STYLES)[DesktopIconStyle];
	visualStyle: DesktopIconStyle;
	iconSize: IconSizePreference;
	isSelected: boolean;
	isRenaming: boolean;
	isCut: boolean;
	isDragging: boolean;
	isDropTarget: boolean;
	externalContentOver: boolean;
	isFolderDropTarget: boolean;
	tabIndex: number;
	iconRef?:
		| React.RefCallback<HTMLDivElement>
		| React.RefObject<HTMLDivElement | null>;
	badgeCount?: number;
	folderChildCount?: number;
	folderPreviewEntries?: readonly DesktopFolderPreviewEntry[];
	onSelect: (e: React.MouseEvent) => void;
	onDoubleClick: () => void;
	onContextMenu: (e: React.MouseEvent) => void;
	onKeyDown?: (e: React.KeyboardEvent) => void;
	onRename?: (newName: string) => void;
	onCancelRename?: () => void;
	handleMouseDown: (e: React.MouseEvent) => void;
	consumeDidDrag: () => boolean;
}

export function DesktopIconSurface({
	item,
	displayName,
	labelText,
	sizes,
	visual,
	visualStyle,
	iconSize,
	isSelected,
	isRenaming,
	isCut,
	isDragging,
	isDropTarget,
	externalContentOver,
	isFolderDropTarget,
	tabIndex,
	iconRef,
	badgeCount,
	folderChildCount,
	folderPreviewEntries,
	onSelect,
	onDoubleClick,
	onContextMenu,
	onKeyDown,
	onRename,
	onCancelRename,
	handleMouseDown,
	consumeDidDrag,
}: DesktopIconSurfaceProps) {
	const { t } = useTranslation('desktopUi');
	const [renameValue, setRenameValue] = useState(item.name);
	const inputRef = useRef<HTMLInputElement>(null);

	const isProjectFolder =
		item.type === 'folder' && isProjectDesktopFolderItemId(item.id);
	const projectInitialGlyph = isProjectFolder
		? projectDesktopFolderInitialGlyph(item.name)
		: '';
	const projectFolderLetterClass =
		iconSize === 'small'
			? cn(DESKTOP_TYPOGRAPHY.captionInherit, 'leading-none')
			: iconSize === 'large'
				? 'text-base leading-none'
				: 'text-sm leading-none';
	const projectFolderLetterOffset =
		iconSize === 'small'
			? 'pt-[3px]'
			: iconSize === 'large'
				? 'pt-1.5'
				: 'pt-1';
	const showPriorityGlow = item.isSystem || item.appComponent === 'AppStore';
	const accentGlowVisual =
		visualStyle === 'aurora' ||
		visualStyle === 'neon' ||
		visualStyle === 'premium' ||
		visualStyle === 'chameleon' ||
		visualStyle === 'prism' ||
		visualStyle === 'mercury' ||
		visualStyle === 'vhs';
	const priorityGlowClass =
		showPriorityGlow && accentGlowVisual
			? 'shadow-[0_0_24px_rgb(var(--desktop-accent-rgb)/0.18),var(--desktop-shadow-soft)]'
			: showPriorityGlow
				? 'shadow-[var(--desktop-shadow-soft)]'
				: undefined;

	useEffect(() => {
		if (isRenaming) {
			setRenameValue(item.name);
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isRenaming, item.name]);

	const handleRenameSubmit = () => {
		const trimmed = renameValue.trim();
		if (trimmed && trimmed !== item.name) {
			onRename?.(trimmed);
			return;
		}
		setRenameValue(item.name);
		onCancelRename?.();
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: interactive when not renaming (role=button); rename mode drops role while keeping surface layout.
		// biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-* applied only with role=button (ternary); rename mode omits both.
		<div
			ref={iconRef as React.Ref<HTMLDivElement>}
			role={isRenaming ? undefined : 'button'}
			tabIndex={isRenaming ? -1 : tabIndex}
			aria-label={isRenaming ? undefined : displayName}
			aria-pressed={isRenaming ? undefined : isSelected}
			style={{
				width: sizes.width,
				height: sizes.height,
				zIndex: isDragging ? 100 : undefined,
			}}
			onMouseDown={handleMouseDown}
			className={`
          group flex h-full w-full flex-col items-center px-1.5 pt-1.5 pb-1 rounded-2xl cursor-pointer select-none
          transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))] focus-visible:ring-inset
          ${visual.idle}
          ${isSelected ? visual.selected : ''}
          ${isDropTarget || externalContentOver ? 'border-[rgb(var(--desktop-accent-rgb))] bg-[rgb(var(--desktop-accent-rgb)/0.16)]' : ''}
          ${isFolderDropTarget ? 'border-[rgb(var(--desktop-accent-rgb))] bg-[rgb(var(--desktop-accent-rgb)/0.2)]' : ''}
          ${isCut ? 'opacity-60 border-dashed border-[rgb(var(--desktop-accent-rgb)/0.7)]' : ''}
        `}
			onPointerEnter={() => {
				if (item.type === 'app' && item.appComponent) {
					void preloadDesktopApp(item.appComponent);
				}
			}}
			onFocus={() => {
				if (item.type === 'app' && item.appComponent) {
					preloadDesktopApp(item.appComponent);
				}
			}}
			onClick={(e) => {
				if (consumeDidDrag()) {
					e.preventDefault();
					e.stopPropagation();
					return;
				}
				onSelect(e);
			}}
			onDoubleClick={onDoubleClick}
			onContextMenu={onContextMenu}
			onKeyDown={onKeyDown}
		>
			<div className="relative">
				{item.type === 'app' ? (
					<div
						className={cn(
							`relative ${sizes.iconBox} ${visual.appBox}`,
							priorityGlowClass
						)}
					>
						<div className={DESKTOP_APP_ICON.inner}>
							<DesktopAppSymbol
								appComponent={item.appComponent}
								fallback={item.icon}
								iconStyle={visualStyle}
							/>
						</div>
						{typeof badgeCount === 'number' && badgeCount > 0 && (
							<span className="pointer-events-none absolute -top-1 -right-1">
								{isFriendsAppBadge(item.appComponent) ||
								isGafChatAppBadge(item.appComponent) ? (
									<span
										aria-hidden
										className={`absolute inset-0 rounded-full blur-[1px] ${
											isFriendsAppBadge(item.appComponent)
												? 'bg-fuchsia-400/35'
												: 'bg-rose-400/35'
										}`}
									/>
								) : null}
								<span
									role="status"
									aria-label={
										badgeCount > 99
											? t('desktopIcon.unreadBadgeOverflow')
											: t('desktopIcon.unreadBadge', { count: badgeCount })
									}
									className={cn(
										'relative flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1',
										DESKTOP_TYPOGRAPHY.iconBadgeNumeric,
										isFriendsAppBadge(item.appComponent)
											? 'border border-fuchsia-200/70 bg-linear-to-br from-fuchsia-500 via-rose-500 to-orange-400 shadow-[0_0_18px_rgba(236,72,153,0.48)]'
											: isGafChatAppBadge(item.appComponent)
												? 'border border-rose-200/60 bg-linear-to-br from-rose-500 via-red-500 to-orange-500 shadow-[0_0_18px_rgba(244,63,94,0.45)]'
												: 'bg-red-500 shadow-lg'
									)}
								>
									{badgeCount > 99 ? '99+' : badgeCount}
								</span>
							</span>
						)}
					</div>
				) : item.type === 'file' ? (
					<div
						className={cn(
							`relative ${sizes.iconBox} ${visual.fileBox} ${DESKTOP_ICON_SVG_QUALITY}`,
							priorityGlowClass
						)}
					>
						{getFileIcon(item.fileType)}
					</div>
				) : (
					<div
						className={cn(
							`relative ${sizes.iconBox} ${visual.appBox}`,
							priorityGlowClass
						)}
					>
						<div className={DESKTOP_APP_ICON.inner}>
							<div
								className={cn(
									'relative h-full w-full overflow-hidden rounded-[1.05rem]',
									isProjectFolder &&
										'shadow-[0_0_0_2px_rgb(var(--desktop-accent-rgb)/0.48),0_10px_26px_rgba(var(--desktop-accent-rgb)/0.2)]',
									(isDropTarget || isFolderDropTarget || externalContentOver) &&
										'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.8)]'
								)}
							>
								<DesktopFolderSymbol
									iconStyle={visualStyle}
									isProjectFolder={isProjectFolder}
									systemKey={item.systemKey}
								/>

								{folderPreviewEntries &&
									folderPreviewEntries.length > 0 &&
									!isProjectFolder &&
									!item.icon &&
									!(
										isDropTarget ||
										isFolderDropTarget ||
										externalContentOver
									) && (
										<DesktopFolderIconPreviewMosaic
											entries={folderPreviewEntries}
											iconSize={iconSize}
											visualStyle={visualStyle}
										/>
									)}

								{isProjectFolder &&
									!item.icon &&
									!(
										isDropTarget ||
										isFolderDropTarget ||
										externalContentOver
									) && (
										<div
											className={cn(
												'pointer-events-none absolute inset-0 flex items-center justify-center',
												projectFolderLetterOffset
											)}
											aria-hidden
										>
											<span
												className={cn(
													projectFolderLetterClass,
													'font-bold tracking-tight text-[rgb(var(--desktop-accent-rgb))]',
													'drop-shadow-[0_2px_3px_rgb(var(--desktop-fg-primary-rgb)/0.85)]'
												)}
											>
												{projectInitialGlyph}
											</span>
										</div>
									)}

								{item.icon && (
									<div className="absolute inset-0 flex items-center justify-center [&>svg]:h-[42%] [&>svg]:w-[42%]">
										{item.icon}
									</div>
								)}

								{(isDropTarget ||
									isFolderDropTarget ||
									externalContentOver) && (
									<div className="absolute inset-0 flex items-center justify-center">
										<div className="w-6 h-6 bg-[rgb(var(--desktop-accent-rgb))] rounded-full flex items-center justify-center">
											<span className="text-white text-lg font-bold">+</span>
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				{item.isPinned && (
					<div className="absolute -top-1 -right-1">
						<MapPinIcon
							className="h-4 w-4 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) p-0.5 text-(--desktop-text-primary) shadow-lg"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					</div>
				)}

				{item.type === 'folder' &&
					typeof folderChildCount === 'number' &&
					folderChildCount > 0 && (
						<div
							className="pointer-events-none absolute -bottom-1 -left-1"
							role="img"
							aria-label={
								folderChildCount > 99
									? t('workspace.folderItemCountAriaOverflow')
									: t('workspace.folderItemCountAria', {
											count: folderChildCount,
										})
							}
						>
							<span
								className={cn(
									'flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1',
									DESKTOP_TYPOGRAPHY.shellMeta10,
									'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary) shadow-(--desktop-shadow-soft)'
								)}
							>
								{folderChildCount > 99 ? '99+' : folderChildCount}
							</span>
						</div>
					)}

				{item.type === 'file' && item.size && (
					<div
						className={cn(
							'absolute -bottom-1 -right-1 rounded px-1.5 py-0.5 bg-(--desktop-surface-soft) border border-(--desktop-border-subtle)',
							DESKTOP_TYPOGRAPHY.shellMeta10
						)}
					>
						{item.size < 1024
							? `${item.size}B`
							: item.size < 1048576
								? `${(item.size / 1024).toFixed(1)}KB`
								: `${(item.size / 1048576).toFixed(1)}MB`}
					</div>
				)}
			</div>

			{isRenaming ? (
				<input
					ref={inputRef}
					type="text"
					value={renameValue}
					onChange={(e) => setRenameValue(e.target.value)}
					onBlur={handleRenameSubmit}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							handleRenameSubmit();
						}
						if (e.key === 'Escape') {
							e.preventDefault();
							setRenameValue(item.name);
							onCancelRename?.();
						}
					}}
					aria-label={t('desktopIcon.renameAria', { name: item.name })}
					className={`${sizes.label} mt-2 rounded-lg border border-[rgb(var(--desktop-accent-rgb))] bg-(--desktop-surface-panel-strong) px-2 py-1 text-center text-(--desktop-text-primary) outline-none`}
					onClick={(e) => e.stopPropagation()}
				/>
			) : (
				<span
					className={`${sizes.label} ${visual.label}`}
					style={{
						display: '-webkit-box',
						WebkitBoxOrient: 'vertical',
						WebkitLineClamp: 2,
						overflow: 'hidden',
						overflowWrap: 'anywhere',
						wordBreak: 'break-word',
					}}
				>
					{labelText}
				</span>
			)}
		</div>
	);
}
