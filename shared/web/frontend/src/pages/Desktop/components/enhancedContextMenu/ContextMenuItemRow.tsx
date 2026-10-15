/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single menu row renderer (root or flyout) for EnhancedContextMenu.
 *
 * Invariants:
 * - Submenu hover opens flyout; leaf click fires action and closes menu.
 *
 * Related:
 * - EnhancedContextMenu.tsx (P30 atomization)
 */

import { m } from 'framer-motion';
import { DESKTOP_ICON_SIZES_PANEL, DESKTOP_INTERACTIVE } from '../../constants';
import { DesktopAppMenuDivider, DesktopAppMenuItem } from '../DesktopAppChrome';
import type { ContextMenuItem } from './types';

export type ContextMenuItemRowProps = {
	item: ContextMenuItem;
	activeSubmenu: string | null;
	setActiveSubmenu: (id: string | null) => void;
	onClose: () => void;
};

export function ContextMenuItemRow({
	item,
	activeSubmenu,
	setActiveSubmenu,
	onClose,
}: ContextMenuItemRowProps) {
	if (item.separator) {
		return <DesktopAppMenuDivider key={item.id} />;
	}

	const hasSubmenu = item.submenu && item.submenu.length > 0;
	const submenuOpenHere = activeSubmenu === item.id;

	return (
		<div
			key={item.id}
			className="relative"
			data-submenu-parent={hasSubmenu ? item.id : undefined}
		>
			<m.div
				whileTap={{ scale: 0.99 }}
				onMouseEnter={() => hasSubmenu && setActiveSubmenu(item.id)}
			>
				<DesktopAppMenuItem
					type="button"
					onClick={(ev) => {
						if (item.action) {
							item.action();
							onClose();
						} else if (hasSubmenu) {
							ev.preventDefault();
							setActiveSubmenu(submenuOpenHere ? null : item.id);
						}
					}}
					disabled={item.disabled}
					icon={
						item.icon ? (
							<span className={DESKTOP_ICON_SIZES_PANEL.menu}>{item.icon}</span>
						) : undefined
					}
					badge={item.badge}
					shortcut={
						item.checked ? (
							<span className="text-[rgb(var(--desktop-accent-rgb))]">✓</span>
						) : (
							item.shortcut
						)
					}
					hasSubmenu={hasSubmenu}
					className={DESKTOP_INTERACTIVE.focusRing}
				>
					{item.label}
				</DesktopAppMenuItem>
			</m.div>
		</div>
	);
}
