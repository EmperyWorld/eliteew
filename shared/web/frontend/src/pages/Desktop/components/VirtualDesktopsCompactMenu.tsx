/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact-layout overflow for virtual desktops when the strip is hidden (mobile/narrow).
 *
 * Related:
 * - DesktopWorkspaceTaskbar.tsx, VirtualDesktops.tsx
 */

import {
	ChevronUpIcon,
	ComputerDesktopIcon,
} from '@heroicons/react/24/outline';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE } from '../constants';
import { useShellPortal } from '../shell/shellPortal';
import { getFloatingMenuPosition } from '../utils/desktopUi';
import { DesktopAppMenuItem, DesktopAppMenuSurface } from './DesktopAppChrome';
import { DesktopChromeTooltip } from './DesktopChromeTooltip';
import { VirtualDesktopDeleteConfirm } from './VirtualDesktopDeleteConfirm';
import type { VirtualDesktopsProps } from './VirtualDesktops';
import { TASKBAR_VD_COMPACT_MENU_TITLE_CLASS } from './taskbarStrip/taskbarChrome';

type CompactVdProps = Pick<
	VirtualDesktopsProps,
	| 'desktops'
	| 'activeDesktopId'
	| 'createDesktop'
	| 'deleteDesktop'
	| 'switchToDesktop'
	| 'updateDesktopName'
>;

export function VirtualDesktopsCompactMenu({
	desktops,
	activeDesktopId,
	createDesktop,
	deleteDesktop,
	switchToDesktop,
}: CompactVdProps): React.JSX.Element {
	const { t } = useTranslation('desktopUi');
	const [open, setOpen] = useState(false);
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
	const { Portal, portalProps } = useShellPortal({
		layer: 'window_menu',
		dismissOnEscape: false,
		trapFocus: false,
		onDismiss: () => setOpen(false),
	});
	const anchorRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	const activeIndex = Math.max(
		0,
		desktops.findIndex((d) => d.id === activeDesktopId)
	);

	const close = useCallback(() => setOpen(false), []);

	useEffect(() => {
		if (!open) return;
		const onPointer = (event: MouseEvent) => {
			const target = event.target as Node;
			if (menuRef.current?.contains(target)) return;
			if (anchorRef.current?.contains(target)) return;
			close();
		};
		const onEsc = (event: KeyboardEvent) => {
			if (event.key === 'Escape') close();
		};
		window.addEventListener('mousedown', onPointer);
		window.addEventListener('keydown', onEsc);
		return () => {
			window.removeEventListener('mousedown', onPointer);
			window.removeEventListener('keydown', onEsc);
		};
	}, [open, close]);

	const menuPos =
		open && anchorRef.current
			? (() => {
					const rect = anchorRef.current.getBoundingClientRect();
					const menuWidth = 192;
					const menuHeight = Math.min(
						360,
						56 + desktops.length * 36 + (desktops.length > 1 ? 40 : 0)
					);
					return getFloatingMenuPosition(
						{ x: rect.left, y: rect.top },
						{
							menuWidth,
							menuHeight,
							preferAbove: true,
							anchorGap: 8,
						}
					);
				})()
			: null;

	return (
		<>
			<DesktopChromeTooltip
				content={t('virtualDesktops.compactMenuTooltip')}
				placement="top"
				offsetExtra={8}
			>
				<button
					ref={anchorRef}
					type="button"
					data-testid="virtual-desktops-compact-menu"
					aria-expanded={open}
					aria-haspopup="menu"
					onClick={() => setOpen((v) => !v)}
					className="relative inline-flex size-8 items-center justify-center rounded-lg text-(--desktop-text-primary) fine-hover:bg-(--desktop-surface-soft-hover)"
				>
					<ComputerDesktopIcon
						className="size-4"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					<span className="absolute -right-0.5 -top-0.5 rounded-md bg-[rgb(var(--desktop-accent-rgb))] px-1 text-[9px] font-medium tabular-nums tracking-normal text-white antialiased">
						{activeIndex + 1}
					</span>
				</button>
			</DesktopChromeTooltip>
			{open && menuPos ? (
				<Portal>
					<div
						ref={menuRef}
						role="menu"
						className="fixed"
						style={{
							left: menuPos.x,
							top: menuPos.y,
							zIndex: portalProps?.zIndex,
						}}
					>
						<DesktopAppMenuSurface className="min-w-48 py-1">
							<div className={TASKBAR_VD_COMPACT_MENU_TITLE_CLASS}>
								{t('virtualDesktops.compactMenuTitle')}
							</div>
							{desktops.map((desktop, index) => (
								<DesktopAppMenuItem
									key={desktop.id}
									role="menuitem"
									aria-current={
										desktop.id === activeDesktopId ? 'true' : undefined
									}
									onClick={() => {
										switchToDesktop(desktop.id);
										close();
									}}
								>
									{t('virtualDesktops.desktopTitle', { index: index + 1 })}
									{desktop.name ? ` — ${desktop.name}` : ''}
								</DesktopAppMenuItem>
							))}
							<DesktopAppMenuItem
								role="menuitem"
								onClick={() => {
									createDesktop();
									close();
								}}
							>
								<ChevronUpIcon className="size-3.5 rotate-180" aria-hidden />
								{t('virtualDesktops.ctxNewDesktop')}
							</DesktopAppMenuItem>
							{desktops.length > 1 ? (
								<DesktopAppMenuItem
									role="menuitem"
									className="text-red-300"
									onClick={() => {
										const victim = desktops.find(
											(d) => d.id !== activeDesktopId
										);
										if (victim) setPendingDeleteId(victim.id);
										close();
									}}
								>
									{t('virtualDesktops.deleteTitle')}
								</DesktopAppMenuItem>
							) : null}
						</DesktopAppMenuSurface>
					</div>
				</Portal>
			) : null}
			<VirtualDesktopDeleteConfirm
				open={Boolean(pendingDeleteId)}
				desktopLabel={
					desktops.find((d) => d.id === pendingDeleteId)?.name?.trim() ||
					t('virtualDesktops.deleteTitle')
				}
				zIndex={(portalProps?.zIndex ?? 1200) + 40}
				onClose={() => setPendingDeleteId(null)}
				onConfirm={() => {
					if (pendingDeleteId) {
						deleteDesktop(pendingDeleteId);
					}
					setPendingDeleteId(null);
				}}
			/>
		</>
	);
}
