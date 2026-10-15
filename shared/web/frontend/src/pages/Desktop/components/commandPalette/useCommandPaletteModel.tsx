/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Command Palette controller: catalog rows, focus restore, search reset (P26 extract).
 *
 * Invariants:
 * - P12: no Apps / Open-{name} group from desktop items (Start owns catalog).
 * - Info rows (`calendar`, `time`) use `action: () => {}` and `isInfo: true`.
 * - Shortcut badges from i18n via `getCommandPaletteShortcutLabel`.
 *
 * Related:
 * - components/CommandPalette.tsx
 * - __tests__/CommandPalette.commands.contract.test.ts
 */

import {
	ArrowLeftIcon,
	ArrowPathIcon,
	ArrowRightIcon,
	ArrowsPointingOutIcon,
	BellIcon,
	CalendarIcon,
	ClipboardIcon,
	ClockIcon,
	Cog6ToothIcon,
	ComputerDesktopIcon,
	FolderIcon,
	FolderOpenIcon,
	MagnifyingGlassIcon,
	MicrophoneIcon,
	MinusSmallIcon,
	PhotoIcon,
	PlusIcon,
	Squares2X2Icon,
	SwatchIcon,
	UserIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	formatShortcutKeysForPlatform,
	getCommandPaletteShortcutLabel,
} from '../../hooks/useKeyboardShortcuts';
import { telemetryCommandPaletteOpen } from '../../utils/desktopTelemetry';
import type { CommandItem, CommandPaletteProps } from './types';

export type UseCommandPaletteModelInput = Pick<
	CommandPaletteProps,
	'isOpen' | 'onClose' | 'onAction'
>;

export function useCommandPaletteModel({
	isOpen,
	onClose,
	onAction,
}: UseCommandPaletteModelInput) {
	const { t, i18n } = useTranslation('desktopUi');
	const [search, setSearch] = useState('');
	const previouslyFocusedRef = useRef<HTMLElement | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const togglePaletteShortcutLabel = useMemo(
		() =>
			formatShortcutKeysForPlatform(t('shortcuts.shell.commandPalette.keys')),
		[t]
	);

	const paletteShortcut = useCallback(
		(commandId: string) => getCommandPaletteShortcutLabel(t, commandId),
		[t]
	);

	const handleClose = useCallback(() => {
		onClose();
		setTimeout(() => {
			previouslyFocusedRef.current?.focus?.();
			previouslyFocusedRef.current = null;
		}, 0);
	}, [onClose]);

	useEffect(() => {
		if (isOpen) {
			previouslyFocusedRef.current =
				document.activeElement as HTMLElement | null;
			telemetryCommandPaletteOpen();
			const focusTimer = window.setTimeout(() => {
				const first =
					containerRef.current?.querySelector<HTMLInputElement>('input');
				first?.focus();
			}, 50);
			return () => window.clearTimeout(focusTimer);
		}
	}, [isOpen]);

	useEffect(() => {
		if (isOpen) {
			setSearch('');
		}
	}, [isOpen]);

	const runAction = useCallback(
		(action: () => void) => {
			action();
			handleClose();
		},
		[handleClose]
	);

	const cmdLine = useCallback(
		(id: string) => ({
			name: t(`commandPalette.commandDefs.${id}.name`),
			description: t(`commandPalette.commandDefs.${id}.description`),
		}),
		[t]
	);

	const systemCommands: CommandItem[] = useMemo(
		() => [
			{
				id: 'new-folder',
				...cmdLine('newFolder'),
				icon: <FolderIcon />,
				shortcut: paletteShortcut('new-folder'),
				action: () => onAction?.('create_folder'),
				groupKind: 'actions',
			},
			{
				id: 'refresh',
				...cmdLine('refresh'),
				icon: <ArrowPathIcon />,
				shortcut: paletteShortcut('refresh'),
				action: () => onAction?.('refresh'),
				groupKind: 'actions',
			},
			{
				id: 'quick-search',
				...cmdLine('quickSearch'),
				icon: <MagnifyingGlassIcon />,
				shortcut: paletteShortcut('quick-search'),
				action: () => onAction?.('quick_search'),
				groupKind: 'actions',
			},
			{
				id: 'minimize-all',
				...cmdLine('minimizeAll'),
				icon: <ComputerDesktopIcon />,
				shortcut: paletteShortcut('minimize-all'),
				action: () => onAction?.('minimize_all'),
				groupKind: 'actions',
			},
			{
				id: 'task-switcher',
				...cmdLine('taskSwitcher'),
				icon: <Squares2X2Icon />,
				shortcut: paletteShortcut('task-switcher'),
				action: () => onAction?.('task_switcher'),
				groupKind: 'actions',
			},
			{
				id: 'snap-window-left',
				...cmdLine('snapWindowLeft'),
				icon: <ArrowLeftIcon />,
				shortcut: paletteShortcut('snap-window-left'),
				action: () => onAction?.('snap_window_left'),
				groupKind: 'actions',
			},
			{
				id: 'snap-window-right',
				...cmdLine('snapWindowRight'),
				icon: <ArrowRightIcon />,
				shortcut: paletteShortcut('snap-window-right'),
				action: () => onAction?.('snap_window_right'),
				groupKind: 'actions',
			},
			{
				id: 'maximize-active-window',
				...cmdLine('maximizeActiveWindow'),
				icon: <ArrowsPointingOutIcon />,
				shortcut: paletteShortcut('maximize-active-window'),
				action: () => onAction?.('maximize_active_window'),
				groupKind: 'actions',
			},
			{
				id: 'restore-active-window',
				...cmdLine('restoreActiveWindow'),
				icon: <MinusSmallIcon />,
				shortcut: paletteShortcut('restore-active-window'),
				action: () => onAction?.('restore_active_window'),
				groupKind: 'actions',
			},
			{
				id: 'settings',
				...cmdLine('settings'),
				icon: <Cog6ToothIcon />,
				shortcut: paletteShortcut('settings'),
				action: () => onAction?.('settings'),
				groupKind: 'system',
			},
			{
				id: 'open_profile',
				...cmdLine('openProfile'),
				icon: <UserIcon />,
				shortcut: paletteShortcut('open_profile'),
				action: () => onAction?.('open_profile'),
				groupKind: 'system',
			},
			{
				id: 'open_explorer',
				...cmdLine('openExplorer'),
				icon: <FolderOpenIcon />,
				shortcut: paletteShortcut('open_explorer'),
				action: () => onAction?.('open_explorer'),
				groupKind: 'system',
			},
			{
				id: 'theme',
				...cmdLine('theme'),
				icon: <SwatchIcon />,
				shortcut: paletteShortcut('theme'),
				action: () => onAction?.('toggle_theme'),
				groupKind: 'system',
			},
			{
				id: 'wallpaper',
				...cmdLine('wallpaper'),
				icon: <PhotoIcon />,
				action: () => onAction?.('wallpaper'),
				groupKind: 'system',
			},
			{
				id: 'notifications',
				...cmdLine('notifications'),
				icon: <BellIcon />,
				shortcut: paletteShortcut('notifications'),
				action: () => onAction?.('notifications'),
				groupKind: 'system',
			},
			{
				id: 'voice',
				...cmdLine('voice'),
				icon: <MicrophoneIcon />,
				action: () => onAction?.('voice'),
				groupKind: 'system',
			},
			{
				id: 'shortcuts-help',
				...cmdLine('shortcutsHelp'),
				icon: <ComputerDesktopIcon />,
				shortcut: paletteShortcut('shortcuts-help'),
				action: () => onAction?.('shortcuts_help'),
				groupKind: 'system',
			},
			{
				id: 'clipboard',
				...cmdLine('clipboard'),
				icon: <ClipboardIcon />,
				action: () => onAction?.('clipboard'),
				groupKind: 'tools',
				shortcut: paletteShortcut('clipboard'),
			},
			{
				id: 'create_virtual_desktop',
				...cmdLine('createVirtualDesktop'),
				icon: <PlusIcon />,
				shortcut: paletteShortcut('create_virtual_desktop'),
				action: () => onAction?.('create_virtual_desktop'),
				groupKind: 'virtualDesktops',
			},
			{
				id: 'next_virtual_desktop',
				...cmdLine('nextVirtualDesktop'),
				icon: <ArrowRightIcon />,
				shortcut: paletteShortcut('next_virtual_desktop'),
				action: () => onAction?.('next_virtual_desktop'),
				groupKind: 'virtualDesktops',
			},
			{
				id: 'prev_virtual_desktop',
				...cmdLine('prevVirtualDesktop'),
				icon: <ArrowLeftIcon />,
				shortcut: paletteShortcut('prev_virtual_desktop'),
				action: () => onAction?.('prev_virtual_desktop'),
				groupKind: 'virtualDesktops',
			},
		],
		[cmdLine, onAction, paletteShortcut]
	);

	const quickActions: CommandItem[] = useMemo(() => {
		const lang = i18n.language || 'en';
		return [
			{
				id: 'time',
				name: t('commandPalette.commandDefs.time.name'),
				description: new Date().toLocaleTimeString(lang),
				infoHint: t('commandPalette.commandDefs.time.infoHint'),
				icon: <ClockIcon />,
				action: () => {},
				groupKind: 'info',
				isInfo: true,
			},
			{
				id: 'calendar',
				name: t('commandPalette.commandDefs.calendar.name'),
				description: new Date().toLocaleDateString(lang, {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				}),
				infoHint: t('commandPalette.commandDefs.calendar.infoHint'),
				searchExtra: t('commandPalette.commandDefs.calendar.searchHints'),
				icon: <CalendarIcon />,
				action: () => {},
				groupKind: 'info',
				isInfo: true,
			},
		];
	}, [i18n.language, t]);

	return {
		t,
		search,
		setSearch,
		containerRef,
		handleClose,
		runAction,
		togglePaletteShortcutLabel,
		systemCommands,
		quickActions,
	};
}
