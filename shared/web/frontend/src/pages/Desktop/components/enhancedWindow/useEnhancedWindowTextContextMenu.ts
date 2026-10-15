/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Text selection / editable paste context-menu state for EnhancedWindow body.
 *
 * Invariants:
 * - Opens only when selection or editable target warrants it; otherwise caller
 *   may dispatch desktop-window-context-menu.
 * - `data-desktop-window-ignore-context` skips window chrome menu but still
 *   suppresses native browser menu on non-editable chrome (policy SSOT).
 *
 * Related:
 * - EnhancedWindow.tsx
 * - EnhancedWindowTextContextMenu.tsx
 * - documentation/product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md
 */

import {
	useCallback,
	useRef,
	useState,
	type MouseEvent as ReactMouseEvent,
} from 'react';
import { applyDesktopContextMenuPolicy } from '../../utils/desktopContextMenuPolicy';

export type EnhancedWindowTextContextMenuState = {
	x: number;
	y: number;
	mode: 'copy' | 'paste' | 'copy-paste';
	editableElement: HTMLElement | null;
	selectionText: string;
	inputSelection: { start: number; end: number } | null;
};

export function useEnhancedWindowTextContextMenu(windowId: string) {
	const [textContextMenu, setTextContextMenu] =
		useState<EnhancedWindowTextContextMenuState | null>(null);
	const textContextRangeRef = useRef<Range | null>(null);

	const closeTextContextMenu = useCallback((): void => {
		textContextRangeRef.current = null;
		setTextContextMenu(null);
	}, []);

	const onBodyContextMenu = useCallback(
		(e: ReactMouseEvent<HTMLElement>) => {
			// Child already handled menu (e.g. track row with preventDefault); avoid stacking
			// the window chrome menu (Свернуть / Восстановить / Закрыть) on top.
			if (e.defaultPrevented) {
				return;
			}
			const target = e.target as HTMLElement;
			const ignoreWindowContext = !!target.closest(
				'[data-desktop-window-ignore-context]'
			);
			const editableRoot = target.closest(
				'input, textarea, [contenteditable]:not([contenteditable="false"])'
			) as HTMLElement | null;
			const isEditable = !!editableRoot;
			const selection =
				typeof window !== 'undefined' &&
				typeof window.getSelection === 'function'
					? window.getSelection()
					: null;
			let selectionText = '';
			let inputSelection: { start: number; end: number } | null = null;
			let selectionRange: Range | null = null;

			if (
				editableRoot instanceof HTMLInputElement ||
				editableRoot instanceof HTMLTextAreaElement
			) {
				const start = editableRoot.selectionStart ?? editableRoot.value.length;
				const end = editableRoot.selectionEnd ?? editableRoot.value.length;
				inputSelection = { start, end };
				if (end > start) {
					selectionText = editableRoot.value.slice(start, end);
				}
			} else if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				const inEditable = editableRoot
					? editableRoot.contains(range.commonAncestorContainer)
					: true;
				if (inEditable) {
					if (!selection.isCollapsed) {
						selectionText = selection.toString();
					}
					if (editableRoot?.isContentEditable) {
						selectionRange = range.cloneRange();
					}
				}
			}

			const hasSelection = selectionText.length > 0;

			if (hasSelection || isEditable) {
				e.preventDefault();
				e.stopPropagation();
				const mode: 'copy' | 'paste' | 'copy-paste' =
					hasSelection && isEditable
						? 'copy-paste'
						: hasSelection
							? 'copy'
							: 'paste';
				textContextRangeRef.current = selectionRange;
				setTextContextMenu({
					x: e.clientX,
					y: e.clientY,
					mode,
					editableElement: editableRoot,
					selectionText,
					inputSelection,
				});
				return;
			}

			textContextRangeRef.current = null;
			if (ignoreWindowContext) {
				// Skip window chrome menu; still suppress native on non-editable chrome.
				applyDesktopContextMenuPolicy(e);
				return;
			}

			e.preventDefault();
			e.stopPropagation();
			window.dispatchEvent(
				new CustomEvent('desktop-window-context-menu', {
					detail: {
						windowId,
						x: e.clientX,
						y: e.clientY,
					},
				})
			);
		},
		[windowId]
	);

	return {
		textContextMenu,
		textContextRangeRef,
		closeTextContextMenu,
		onBodyContextMenu,
	};
}
