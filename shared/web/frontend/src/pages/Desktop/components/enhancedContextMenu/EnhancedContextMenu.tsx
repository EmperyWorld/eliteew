/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Enhanced context menu orchestrator — portal shell, flyout, and action dispatch.
 *
 * Invariants:
 * - Root shell without transform scale/y so flyout position:fixed stays viewport-true.
 * - ShellPortalMount wraps body portal theme shell.
 *
 * Related:
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md (P30)
 * - components/DesktopWorkspaceCanvas.tsx
 */

import { AnimatePresence, m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { DESKTOP_PORTAL_STACK_BUMP, DESKTOP_TYPOGRAPHY } from '../../constants';
import { useDesktopWindowPortalStackBase } from '../../context/DesktopWindowPortalStackContext';
import { getDesktopPortalShellProps } from '../../utils/desktopUi';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { DesktopAppMenuSurface } from '../DesktopAppChrome';
import { findEnhancedContextBranchById } from './branchHelpers';
import { ContextMenuItemRow } from './ContextMenuItemRow';
import { createContextMenuItems } from './createContextMenuItems';
import {
	ENHANCED_CTX_MENU_FLYOUT_SURFACE_CLASS,
	ENHANCED_CTX_MENU_INNER_SCROLL_CLASS,
	ENHANCED_CTX_MENU_OUTER_SHELL_CLASS,
} from './styleContract';
import type { EnhancedContextMenuProps } from './types';
import { useEnhancedContextMenuController } from './useEnhancedContextMenuController';

export function EnhancedContextMenu({
	isVisible,
	position,
	onClose,
	selectedItems,
	contextType,
	onAction,
	hasClipboard = false,
	iconSize = 'medium',
	snapToGrid = true,
	desktopUiScale = 1,
	targetItem = null,
	activeWindowAlwaysOnTop = false,
	shellWindowStyle = 'glass',
}: EnhancedContextMenuProps) {
	const { t } = useTranslation('desktopUi');
	const portalStackBase = useDesktopWindowPortalStackBase();
	const {
		menuRef,
		menuPos,
		activeSubmenu,
		setActiveSubmenu,
		flyoutViewportPos,
	} = useEnhancedContextMenuController({ isVisible, position, onClose });

	const fireAction = (id: string) => {
		onAction?.(id);
		onClose();
	};

	if (!isVisible) return null;

	const menuItems = createContextMenuItems({
		contextType,
		selectedItems,
		targetItem,
		hasClipboard,
		iconSize,
		snapToGrid,
		desktopUiScale,
		activeWindowAlwaysOnTop,
		fireAction,
		t,
	});

	const activeFlyoutOwner = activeSubmenu
		? findEnhancedContextBranchById(menuItems, activeSubmenu)
		: null;
	const activeFlyoutBranch =
		activeFlyoutOwner?.submenu && activeFlyoutOwner.submenu.length > 0
			? activeFlyoutOwner
			: null;
	const { style: portalShellStyle, theme: portalTheme } =
		getDesktopPortalShellProps();

	const renderMenuItem = (item: (typeof menuItems)[number]) => (
		<ContextMenuItemRow
			key={item.id}
			item={item}
			activeSubmenu={activeSubmenu}
			setActiveSubmenu={setActiveSubmenu}
			onClose={onClose}
		/>
	);

	const menuTree = (
		<AnimatePresence>
			{/*
			 Корневая оболочка без transform scale/y: иначе position:fixed у flyout
			 привязывается к motion-слою и координаты из getBoundingClientRect «уезжают» вправо.
			*/}
			<div
				ref={menuRef}
				data-desktop-enhanced-context-menu
				className="fixed text-(--desktop-text-primary)"
				style={{
					left: menuPos.x,
					top: menuPos.y,
					zIndex: portalStackBase,
				}}
			>
				<m.div
					initial={{ opacity: 0, scale: 0.95, y: -10 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.95, y: -10 }}
					transition={{ duration: 0.15 }}
				>
					<DesktopAppMenuSurface
						clipOverflow={false}
						windowStyle={shellWindowStyle}
						className={ENHANCED_CTX_MENU_OUTER_SHELL_CLASS}
					>
						<div className={ENHANCED_CTX_MENU_INNER_SCROLL_CLASS}>
							{menuItems.map((item) => renderMenuItem(item))}

							{selectedItems.length > 1 && (
								<div className="mx-3 my-2 border-t border-[color-mix(in_srgb,var(--desktop-border-menu)_35%,transparent)] pt-2">
									<div className={DESKTOP_TYPOGRAPHY.meta}>
										{t('enhancedContextMenu.multiSelectLabel', {
											count: selectedItems.length,
										})}
									</div>
								</div>
							)}
						</div>
					</DesktopAppMenuSurface>
				</m.div>

				<AnimatePresence>
					{activeSubmenu && activeFlyoutBranch ? (
						<m.div
							key={activeSubmenu}
							initial={{ opacity: 0 }}
							animate={{ opacity: flyoutViewportPos ? 1 : 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.1 }}
							data-submenu-flyout={activeSubmenu}
							style={{
								position: 'fixed',
								top: flyoutViewportPos?.top ?? -9999,
								left: flyoutViewportPos?.left ?? -9999,
								zIndex:
									portalStackBase +
									DESKTOP_PORTAL_STACK_BUMP.ENHANCED_CONTEXT_SUBMENU,
								visibility: flyoutViewportPos ? 'visible' : 'hidden',
								pointerEvents: flyoutViewportPos ? 'auto' : 'none',
							}}
						>
							<DesktopAppMenuSurface
								windowStyle={shellWindowStyle}
								className={ENHANCED_CTX_MENU_FLYOUT_SURFACE_CLASS}
							>
								{(activeFlyoutBranch.submenu ?? []).map((subItem) =>
									renderMenuItem(subItem)
								)}
							</DesktopAppMenuSurface>
						</m.div>
					) : null}
				</AnimatePresence>
			</div>
		</AnimatePresence>
	);

	if (typeof document === 'undefined') {
		return menuTree;
	}

	return (
		<ShellPortalMount>
			<div
				style={portalShellStyle}
				className={portalTheme === 'dark' ? 'dark' : ''}
			>
				{menuTree}
			</div>
		</ShellPortalMount>
	);
}
