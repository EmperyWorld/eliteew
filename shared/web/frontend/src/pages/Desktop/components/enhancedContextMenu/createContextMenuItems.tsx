/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Context-type menu item tree factory for EnhancedContextMenu.
 *
 * Invariants:
 * - Sort/reflow empty-desktop actions stay out of desktop context (declutter contract).
 *
 * Related:
 * - EnhancedContextMenu.tsx (P30 atomization)
 * - __tests__/EnhancedContextMenu.desktopDeclutter.contract.test.ts
 */

import {
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
	ArrowUpTrayIcon,
	BriefcaseIcon,
	BuildingStorefrontIcon,
	ChatBubbleLeftRightIcon,
	Cog6ToothIcon,
	ComputerDesktopIcon,
	CpuChipIcon,
	DocumentDuplicateIcon,
	DocumentTextIcon,
	EyeIcon,
	FolderOpenIcon,
	InformationCircleIcon,
	ListBulletIcon,
	MapPinIcon,
	PencilSquareIcon,
	PercentBadgeIcon,
	PlayIcon,
	PlusIcon,
	RectangleStackIcon,
	ScissorsIcon,
	SparklesIcon,
	Squares2X2Icon,
	SwatchIcon,
	TrashIcon,
	UserIcon,
	ViewColumnsIcon,
} from '@heroicons/react/24/outline';
import { DESKTOP_LUCIDE } from '../../constants';
import type { DesktopItem } from '../../types/desktop.types';
import { isSystemDesktopApp } from '../../utils/desktopAppRegistry';
import { isUnifiedContentAudioLike } from '../../utils/desktopAudioContent';
import { isDesktopSystemFolder } from '../../utils/desktopItemTree';
import { DESKTOP_UI_SCALE_PRESETS } from '../../utils/desktopUiScale';
import type { ContextMenuItem, CreateContextMenuItemsParams } from './types';

export function createContextMenuItems({
	contextType,
	selectedItems,
	targetItem,
	hasClipboard,
	iconSize,
	snapToGrid,
	desktopUiScale,
	fireAction,
	t,
}: CreateContextMenuItemsParams): ContextMenuItem[] {
	const baseItems: ContextMenuItem[] = [];

	switch (contextType) {
		case 'desktop':
			baseItems.push(
				{
					id: 'refresh',
					label: t('enhancedContextMenu.desktop.refresh'),
					icon: (
						<ArrowPathIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					shortcut: 'F5',
					action: () => fireAction('refresh'),
				},
				{
					id: 'create',
					label: t('enhancedContextMenu.desktop.create'),
					icon: (
						<PlusIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					submenu: [
						{
							id: 'new-folder',
							label: t('enhancedContextMenu.desktop.newFolder'),
							icon: (
								<FolderOpenIcon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							),
							shortcut: 'Ctrl+Shift+N',
							action: () => fireAction('new-folder'),
						},
						{
							id: 'new-markdown-file',
							label: t('enhancedContextMenu.desktop.newMarkdownFile'),
							icon: (
								<DocumentTextIcon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							),
							action: () => fireAction('new-markdown-file'),
						},
					],
				},
				{ id: 'separator1', label: '', separator: true },
				{
					id: 'paste',
					label: t('enhancedContextMenu.desktop.paste'),
					icon: (
						<PlusIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					shortcut: 'Ctrl+V',
					disabled: !hasClipboard,
					action: () => fireAction('paste'),
				},
				{ id: 'separator2-desktop', label: '', separator: true },
				{
					id: 'view',
					label: t('enhancedContextMenu.desktop.view'),
					icon: (
						<EyeIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					submenu: [
						{
							id: 'view-icon-large',
							label: t('enhancedContextMenu.desktop.viewIconLarge'),
							icon: (
								<Squares2X2Icon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							),
							action: () => fireAction('view-icon-large'),
							checked: iconSize === 'large',
						},
						{
							id: 'view-icon-medium',
							label: t('enhancedContextMenu.desktop.viewIconMedium'),
							icon: (
								<Squares2X2Icon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							),
							action: () => fireAction('view-icon-medium'),
							checked: iconSize === 'medium',
						},
						{
							id: 'view-icon-small',
							label: t('enhancedContextMenu.desktop.viewIconSmall'),
							icon: (
								<ListBulletIcon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							),
							action: () => fireAction('view-icon-small'),
							checked: iconSize === 'small',
						},
						{ id: 'separator-view', label: '', separator: true },
						{
							id: 'view-snap-to-grid',
							label: t('enhancedContextMenu.desktop.viewSnapToGrid'),
							icon: (
								<Squares2X2Icon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							),
							action: () => fireAction('view-snap-to-grid'),
							checked: snapToGrid,
						},
					],
				},
				{
					id: 'ui-scale-submenu',
					label: t('enhancedContextMenu.desktop.uiScale'),
					icon: (
						<PercentBadgeIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					submenu: DESKTOP_UI_SCALE_PRESETS.map((scale) => {
						const pct = Math.round(scale * 100);
						return {
							id: `ui-scale-${pct}`,
							label: `${pct}%`,
							action: () => fireAction(`ui-scale-${pct}`),
							checked: Math.round(desktopUiScale * 100) === pct,
						};
					}),
				},
				{ id: 'separator-desktop-extras', label: '', separator: true },
				{
					id: 'app-store',
					label: t('enhancedContextMenu.desktop.appStore'),
					icon: (
						<BuildingStorefrontIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					action: () => fireAction('app-store'),
				},
				{
					id: 'session-info',
					label: t('enhancedContextMenu.desktop.sessionInfo'),
					icon: (
						<ComputerDesktopIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					action: () => fireAction('session-info'),
				},
				{
					id: 'profile',
					label: t('enhancedContextMenu.desktop.profile'),
					icon: (
						<UserIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					action: () => fireAction('profile'),
				},
				{
					id: 'desktop-control-center',
					label: t('enhancedContextMenu.desktop.controlCenter'),
					icon: (
						<Cog6ToothIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					submenu: [
						{
							id: 'settings-personalize',
							label: t('enhancedContextMenu.desktop.settingsPersonalize'),
							icon: (
								<SwatchIcon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							),
							action: () => fireAction('settings-personalize'),
						},
						{
							id: 'settings-icons',
							label: t('enhancedContextMenu.desktop.settingsIcons'),
							icon: (
								<Squares2X2Icon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							),
							action: () => fireAction('settings-icons'),
						},
						{
							id: 'settings-chrome',
							label: t('enhancedContextMenu.desktop.settingsChrome'),
							icon: (
								<ComputerDesktopIcon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							),
							action: () => fireAction('settings-chrome'),
						},
						{
							id: 'settings-widgets',
							label: t('enhancedContextMenu.desktop.settingsWidgets'),
							icon: (
								<ViewColumnsIcon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							),
							action: () => fireAction('settings-widgets'),
						},
						{
							id: 'settings-shell',
							label: t('enhancedContextMenu.desktop.settingsShell'),
							icon: (
								<RectangleStackIcon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							),
							action: () => fireAction('settings-shell'),
						},
						{
							id: 'settings-performance',
							label: t('enhancedContextMenu.desktop.settingsPerformance'),
							icon: (
								<CpuChipIcon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							),
							action: () => fireAction('settings-performance'),
						},
					],
				}
			);
			break;

		case 'app': {
			const appItem = targetItem ?? selectedItems[0];
			const systemApp = appItem ? isSystemDesktopApp(appItem) : false;
			baseItems.push(
				{
					id: 'open',
					label: t('enhancedContextMenu.itemOpen'),
					icon: (
						<PlayIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					shortcut: 'Enter',
					action: () => fireAction('open'),
				},
				{
					id: 'open-new',
					label: t('enhancedContextMenu.app.openNewWindow'),
					icon: (
						<ArrowTopRightOnSquareIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					action: () => fireAction('open-new'),
				},
				{ id: 'separator-app-1', label: '', separator: true },
				{
					id: 'pin',
					label: appItem?.isPinned
						? t('enhancedContextMenu.app.unpinFromTaskbar')
						: t('enhancedContextMenu.app.pinToTaskbar'),
					icon: (
						<MapPinIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					action: () => fireAction('pin'),
				},
				{ id: 'separator-app-clipboard', label: '', separator: true },
				{
					id: 'copy',
					label: t('enhancedContextMenu.itemCopy'),
					icon: (
						<DocumentDuplicateIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					shortcut: 'Ctrl+C',
					action: () => fireAction('copy'),
				},
				{
					id: 'cut',
					label: t('enhancedContextMenu.itemCut'),
					icon: (
						<ScissorsIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					shortcut: 'Ctrl+X',
					action: () => fireAction('cut'),
				},
				{
					id: 'properties',
					label: t('enhancedContextMenu.app.properties'),
					icon: (
						<InformationCircleIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					action: () => fireAction('properties'),
				}
			);
			if (!systemApp) {
				baseItems.push(
					{ id: 'separator-app-remove', label: '', separator: true },
					{
						id: 'delete',
						label: t('enhancedContextMenu.app.removeFromDesktop'),
						icon: (
							<TrashIcon
								className={DESKTOP_LUCIDE.md}
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						),
						action: () => fireAction('delete'),
					}
				);
			}
			break;
		}

		case 'folder':
		case 'file': {
			const isSystemFolder =
				contextType === 'folder' &&
				selectedItems[0] != null &&
				isDesktopSystemFolder(selectedItems[0] as DesktopItem);
			const canMoveSelectedHere =
				contextType === 'folder' &&
				targetItem &&
				selectedItems.length > 0 &&
				(selectedItems.length > 1 || selectedItems[0]?.id !== targetItem.id);
			const canMoveToDesktopRoot =
				selectedItems.some((row) => Boolean((row as DesktopItem).parentId)) ||
				Boolean(targetItem && (targetItem as DesktopItem).parentId);
			const fileSel = selectedItems[0] as DesktopItem | undefined;
			const showPlayInMusicPlayer =
				contextType === 'file' &&
				fileSel?.type === 'file' &&
				isUnifiedContentAudioLike({
					content_type: fileSel.fileType,
					name: fileSel.name,
				});
			const openWithSubmenuItems: ContextMenuItem[] = [];
			if (contextType === 'file') {
				openWithSubmenuItems.push({
					id: 'open-in-doc-editor',
					label: t('enhancedContextMenu.openInDocEditor'),
					icon: (
						<DocumentTextIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					action: () => fireAction('open-in-doc-editor'),
				});
			}
			if (contextType === 'file' || contextType === 'folder') {
				openWithSubmenuItems.push({
					id: 'open-in-content-manager',
					label: t('enhancedContextMenu.openInContentManager'),
					icon: (
						<Squares2X2Icon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					action: () => fireAction('open-in-content-manager'),
				});
			}
			if (showPlayInMusicPlayer) {
				openWithSubmenuItems.push({
					id: 'play-in-music-player',
					label: t('enhancedContextMenu.playInMusicPlayer'),
					icon: (
						<PlayIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					action: () => fireAction('play-in-music-player'),
				});
			}
			if (contextType === 'file') {
				openWithSubmenuItems.push(
					{
						id: 'send-to-gaf-chat',
						label: t('enhancedContextMenu.sendToGafChat'),
						icon: (
							<ChatBubbleLeftRightIcon
								className={DESKTOP_LUCIDE.md}
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						),
						action: () => fireAction('send-to-gaf-chat'),
					},
					{
						id: 'send-to-desktop-ai',
						label: t('enhancedContextMenu.sendToDesktopAi'),
						icon: (
							<SparklesIcon
								className={DESKTOP_LUCIDE.md}
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						),
						action: () => fireAction('send-to-desktop-ai'),
					}
				);
			}
			baseItems.push(
				...(canMoveToDesktopRoot
					? [
							{
								id: 'move-to-desktop-root',
								label: t('enhancedContextMenu.moveToDesktopRoot'),
								icon: (
									<ArrowUpTrayIcon
										className={DESKTOP_LUCIDE.md}
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								),
								action: () => fireAction('move-to-desktop-root'),
							},
							{ id: 'separator-move-root', label: '', separator: true },
						]
					: []),
				...(contextType === 'folder' && canMoveSelectedHere
					? [
							{
								id: 'move-selected-here',
								label: t('enhancedContextMenu.moveSelectedHere'),
								icon: (
									<FolderOpenIcon
										className={DESKTOP_LUCIDE.md}
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								),
								action: () => fireAction('move-selected-here'),
							},
							{ id: 'separator-move', label: '', separator: true },
						]
					: []),
				{
					id: 'open',
					label: t('enhancedContextMenu.itemOpen'),
					icon: (
						<FolderOpenIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					shortcut: 'Enter',
					action: () => fireAction('open'),
				},
				...(openWithSubmenuItems.length > 0
					? [
							{
								id: 'open-with',
								label: t('enhancedContextMenu.openWith'),
								icon: (
									<ComputerDesktopIcon
										className={DESKTOP_LUCIDE.md}
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								),
								submenu: openWithSubmenuItems,
							},
						]
					: []),
				{
					id: 'edit',
					label: t('enhancedContextMenu.itemRename'),
					icon: (
						<PencilSquareIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					shortcut: 'F2',
					disabled: isSystemFolder,
					action: () => fireAction('edit'),
				},
				...(contextType === 'folder'
					? [
							{
								id: 'change-icon',
								label: t('enhancedContextMenu.changeFolderIcon'),
								icon: (
									<SwatchIcon
										className={DESKTOP_LUCIDE.md}
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								),
								disabled: isSystemFolder,
								action: () => fireAction('change-icon'),
							},
						]
					: []),
				{ id: 'separator1', label: '', separator: true },
				{
					id: 'copy',
					label: t('enhancedContextMenu.itemCopy'),
					icon: (
						<DocumentDuplicateIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					shortcut: 'Ctrl+C',
					action: () => fireAction('copy'),
				},
				{
					id: 'cut',
					label: t('enhancedContextMenu.itemCut'),
					icon: (
						<ScissorsIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					shortcut: 'Ctrl+X',
					action: () => fireAction('cut'),
				},
				{
					id: 'paste',
					label: t('enhancedContextMenu.itemPaste'),
					icon: (
						<PlusIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					shortcut: 'Ctrl+V',
					action: () => fireAction('paste'),
				},
				{
					id: 'properties',
					label: t('enhancedContextMenu.itemProperties'),
					icon: (
						<InformationCircleIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					disabled: isSystemFolder,
					action: () => fireAction('properties'),
				},
				...(contextType === 'file'
					? [
							{
								id: 'assign-to-project',
								label: t('enhancedContextMenu.assignToProject'),
								icon: (
									<BriefcaseIcon
										className={DESKTOP_LUCIDE.md}
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								),
								action: () => fireAction('assign-content-to-project'),
							} satisfies ContextMenuItem,
						]
					: []),
				{ id: 'separator2', label: '', separator: true },
				{
					id: 'delete',
					label: t('enhancedContextMenu.itemDelete'),
					icon: (
						<TrashIcon
							className={DESKTOP_LUCIDE.md}
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					),
					shortcut: 'Del',
					disabled: isSystemFolder,
					action: () => fireAction('delete'),
				}
			);
			break;
		}
	}

	/** Сортировка и размер значков — только из меню пустого стола (`contextType === 'desktop'`), не дублируем как «Вид» на одном файле/папке. */
	const commonItems: ContextMenuItem[] = [];

	return [...baseItems, ...commonItems];
}
