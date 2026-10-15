/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Positioning, flyout layout, keyboard, and pointer-dismiss controller for EnhancedContextMenu.
 *
 * Invariants:
 * - Flyout uses position:fixed viewport pixels (not clipped by inner scroll).
 * - Escape closes flyout first, then root menu.
 *
 * Related:
 * - EnhancedContextMenu.tsx (P30 atomization)
 */

import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useReducer,
	useRef,
	useState,
} from 'react';
import { clampFixedBoxToViewport } from '../../utils/desktopUi';
import type { ContextMenuPosition } from './types';

export type UseEnhancedContextMenuControllerParams = {
	isVisible: boolean;
	position: ContextMenuPosition;
	onClose: () => void;
};

export function useEnhancedContextMenuController({
	isVisible,
	position,
	onClose,
}: UseEnhancedContextMenuControllerParams) {
	const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
	/** viewport position:fixed координаты flyout; null — ещё не измерено (скрыт до раскладки). */
	const [flyoutViewportPos, setFlyoutViewportPos] = useState<{
		top: number;
		left: number;
	} | null>(null);
	const [_submenuMeasureTick, bumpSubmenuMeasure] = useReducer(
		(x: number) => x + 1,
		0
	);
	const [menuPos, setMenuPos] = useState(() => position);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isVisible) {
			setActiveSubmenu(null);
			setFlyoutViewportPos(null);
		}
	}, [isVisible]);

	/** Якорь и поджатие по вьюпорту: размеры из DOM, точка — `position` от родителя. */
	useLayoutEffect(() => {
		if (!isVisible || !menuRef.current) return;
		const el = menuRef.current;
		const w = el.offsetWidth;
		const h = el.offsetHeight;
		if (w <= 0 || h <= 0) return;
		const vh = typeof window !== 'undefined' ? window.innerHeight : undefined;
		const next = clampFixedBoxToViewport(position.x, position.y, w, h, {
			padding: 12,
			viewportHeight: vh,
		});
		setMenuPos((prev) =>
			prev.x === next.x && prev.y === next.y ? prev : next
		);
	}, [isVisible, position.x, position.y]);

	const repositionRootMenu = useCallback(() => {
		const el = menuRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		setMenuPos(
			clampFixedBoxToViewport(r.left, r.top, r.width, r.height, {
				padding: 12,
				viewportHeight:
					typeof window !== 'undefined' ? window.innerHeight : undefined,
			})
		);
	}, []);

	useEffect(() => {
		if (!isVisible) return;
		const onResize = () => {
			repositionRootMenu();
			bumpSubmenuMeasure();
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, [isVisible, repositionRootMenu]);

	/** Flyout: position:fixed пиксели + отражение горизонтали/вертикали при нехватке места во вьюпорте. */
	// biome-ignore lint/correctness/useExhaustiveDependencies: якорь смещается при поджатии корня меню по menuPos
	useLayoutEffect(() => {
		if (!isVisible || !activeSubmenu || !menuRef.current) {
			setFlyoutViewportPos(null);
			return;
		}

		let rafId = 0;
		let attempts = 0;
		const run = () => {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				const root = menuRef.current;
				if (!root) {
					setFlyoutViewportPos(null);
					return;
				}
				const parent = root.querySelector(
					`[data-submenu-parent="${CSS.escape(activeSubmenu)}"]`
				);
				const fly = root.querySelector(
					`[data-submenu-flyout="${CSS.escape(activeSubmenu)}"]`
				);
				if (!(parent instanceof HTMLElement) || !(fly instanceof HTMLElement)) {
					setFlyoutViewportPos(null);
					return;
				}
				let fw = fly.offsetWidth;
				let fh = fly.offsetHeight;
				if ((fw < 8 || fh < 8) && attempts < 6) {
					attempts += 1;
					run();
					return;
				}
				if (fw < 8) fw = 220;
				if (fh < 8) fh = 120;

				const pad = 12;
				const gap = 6;
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				const pr = parent.getBoundingClientRect();
				const spaceRight = vw - pad - pr.right - gap;
				const spaceLeft = pr.left - pad - gap;
				const openLeft =
					fw > spaceRight && (spaceLeft >= fw || spaceLeft > spaceRight);
				const left = openLeft ? pr.left - fw - gap : pr.right + gap;

				const overflowDown = pr.top + fh > vh - pad;
				const fitsOpeningUp = pr.bottom - fh >= pad;
				let openAbove = false;
				if (overflowDown && fitsOpeningUp) openAbove = true;
				else if (overflowDown && !fitsOpeningUp) {
					const roomBelow = vh - pad - pr.top;
					const roomAbove = pr.bottom - pad;
					openAbove = roomAbove > roomBelow;
				}
				const top = openAbove ? pr.bottom - fh : pr.top;

				const clampedLeft = Math.min(
					Math.max(left, pad),
					Math.max(pad, vw - fw - pad)
				);
				const clampedTop = Math.min(
					Math.max(top, pad),
					Math.max(pad, vh - fh - pad)
				);
				setFlyoutViewportPos({ top: clampedTop, left: clampedLeft });
			});
		};
		run();
		return () => cancelAnimationFrame(rafId);
	}, [activeSubmenu, isVisible, _submenuMeasureTick, menuPos.x, menuPos.y]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				onClose();
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			if (activeSubmenu !== null) {
				setActiveSubmenu(null);
			} else {
				onClose();
			}
		};

		if (isVisible) {
			document.addEventListener('mousedown', handleClickOutside);
			document.addEventListener('keydown', handleEscape);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isVisible, onClose, activeSubmenu]);

	/** Клик по другому пункту корня меню или по разделителю — закрыть открытый flyout (не только всё меню). */
	useEffect(() => {
		if (!isVisible || activeSubmenu === null) return;

		const handlePointerDownCapture = (event: PointerEvent) => {
			const t = event.target as Node | null;
			if (!t || !menuRef.current?.contains(t)) return;
			const parent = menuRef.current.querySelector(
				`[data-submenu-parent="${CSS.escape(activeSubmenu)}"]`
			);
			const fly = menuRef.current.querySelector(
				`[data-submenu-flyout="${CSS.escape(activeSubmenu)}"]`
			);
			if (parent?.contains(t) || fly?.contains(t)) return;
			setActiveSubmenu(null);
		};

		document.addEventListener('pointerdown', handlePointerDownCapture, true);
		return () => {
			document.removeEventListener(
				'pointerdown',
				handlePointerDownCapture,
				true
			);
		};
	}, [isVisible, activeSubmenu]);

	return {
		menuRef,
		menuPos,
		activeSubmenu,
		setActiveSubmenu,
		flyoutViewportPos,
	};
}
