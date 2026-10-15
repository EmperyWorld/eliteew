/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Command Palette keyboard surface: Home/End, Arrow from search, Tab cycle (P26 extract).
 *
 * Invariants:
 * - Home/End jump to first/last visible cmdk item while palette is open.
 * - ArrowDown/ArrowUp from search input focus first/last visible cmdk item.
 * - Tab / Shift+Tab cycle inside palette (ModalAdvanced trapFocus={false}).
 *
 * Related:
 * - components/CommandPalette.tsx
 * - __tests__/CommandPalette.keyboard.contract.test.ts
 */

import type * as React from 'react';
import { useCallback } from 'react';

export function useCommandPaletteKeyboard(
	containerRef: React.RefObject<HTMLDivElement | null>
) {
	const handleContainerKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const el = containerRef.current;
			if (!el) return;

			const visibleItems = Array.from(
				el.querySelectorAll<HTMLElement>('[cmdk-item]')
			).filter((node) => node.offsetParent !== null);

			if (e.key === 'Home' || e.key === 'End') {
				if (visibleItems.length === 0) return;
				e.preventDefault();
				const target =
					e.key === 'Home'
						? visibleItems[0]
						: visibleItems[visibleItems.length - 1];
				target?.scrollIntoView({ block: 'nearest' });
				target?.focus();
				return;
			}

			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				const active = document.activeElement as HTMLElement | null;
				if (!active?.matches('[cmdk-input]')) return;
				if (visibleItems.length === 0) return;
				e.preventDefault();
				const target =
					e.key === 'ArrowDown'
						? visibleItems[0]
						: visibleItems[visibleItems.length - 1];
				target?.scrollIntoView({ block: 'nearest' });
				target?.focus();
				return;
			}

			if (e.key !== 'Tab') return;
			const focusables = el.querySelectorAll<HTMLElement>(
				'input, button, a[href], [tabindex]:not([tabindex="-1"])'
			);
			const arr = Array.from(focusables);
			if (arr.length === 0) return;
			const currentIndex = arr.indexOf(document.activeElement as HTMLElement);
			if (currentIndex === -1) return;
			if (e.shiftKey) {
				if (currentIndex === 0) {
					e.preventDefault();
					arr[arr.length - 1].focus();
				}
			} else {
				if (currentIndex === arr.length - 1) {
					e.preventDefault();
					arr[0].focus();
				}
			}
		},
		[containerRef]
	);

	return handleContainerKeyDown;
}
