/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tree lookup helpers for nested EnhancedContextMenu flyout branches.
 *
 * Invariants:
 * - Menu item ids are globally unique across nested submenus.
 *
 * Related:
 * - EnhancedContextMenu.tsx (P30 atomization)
 */

import type { ContextMenuItem } from './types';

/** Поиск пункта с подменю по id во всём дереве (глобально уникальные id пунктов меню). */
export function findEnhancedContextBranchById(
	items: ContextMenuItem[],
	id: string
): ContextMenuItem | null {
	for (const it of items) {
		if (it.separator) continue;
		if (it.id === id) return it;
		if (it.submenu?.length) {
			const nested = findEnhancedContextBranchById(it.submenu, id);
			if (nested) return nested;
		}
	}
	return null;
}
