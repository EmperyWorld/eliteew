/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map ShellPortalLayerKind → DESKTOP_PORTAL_STACK_BUMP (U1.d). Single place for layer floors.
 *
 * Invariants:
 * - Apps pass kind only; numeric bumps stay in Shell constants.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md §4.2
 * - pages/Desktop/constants DESKTOP_PORTAL_STACK_BUMP
 */

import { DESKTOP_PORTAL_STACK_BUMP } from '../constants';
import type { ShellPortalLayerKind } from './appRegistry';

/** Relative bump above window portal base for each registry layer kind. */
export function resolveShellPortalLayerBump(
	layer: ShellPortalLayerKind
): number {
	switch (layer) {
		case 'window_menu':
			return 0;
		case 'embedded_popover':
			return DESKTOP_PORTAL_STACK_BUMP.NOTIFICATION_HUB_ITEM_MENU;
		case 'embedded_modal_backdrop':
			return DESKTOP_PORTAL_STACK_BUMP.EMBEDDED_MODAL_BACKDROP;
		case 'embedded_modal':
			return DESKTOP_PORTAL_STACK_BUMP.EMBEDDED_MODAL_CONTENT;
		case 'doc_side_panel':
			return DESKTOP_PORTAL_STACK_BUMP.DOC_EDITOR_IN_WINDOW_SIDE_PANEL;
		case 'doc_toolbar_popover':
			return DESKTOP_PORTAL_STACK_BUMP.DOC_EDITOR_IN_WINDOW_TOOLBAR_PORTAL_POPOVER;
		case 'doc_context_menu':
			return DESKTOP_PORTAL_STACK_BUMP.DOC_EDITOR_IN_WINDOW_CONTEXT_MENU;
		case 'shell_global':
			return 0;
		default: {
			const _exhaustive: never = layer;
			return _exhaustive;
		}
	}
}
