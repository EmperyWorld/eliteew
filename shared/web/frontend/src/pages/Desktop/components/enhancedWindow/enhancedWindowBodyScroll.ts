/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EnhancedWindow geometry / resize / body-scroll helpers shared by the Rnd frame.
 *
 * Invariants:
 * - Viewport max size follows desktop work area (snap/maximize parity).
 * - isDesktopAppWindowBodySelfScroll delegates to Shell App Registry self-scroll.
 *
 * Related:
 * - EnhancedWindow.tsx
 * - shell/shellScroll.ts
 */

import { DESKTOP_LAYOUT } from '../../constants';
import { isShellAppSelfScroll } from '../../shell/shellScroll';
import type { WindowState } from '../../types/desktop.types';
import { readDesktopWorkArea } from '../../utils/desktopSnapGeometry';

export const MAX_WINDOW_WIDTH = DESKTOP_LAYOUT.MAX_WINDOW_WIDTH_PX;
export const MAX_WINDOW_HEIGHT = DESKTOP_LAYOUT.MAX_WINDOW_HEIGHT_PX;

/**
 * Верхняя граница размера для Rnd: ровно рабочая область (`readDesktopWorkArea`), как у snap / maximize.
 * Не вычитать WINDOW_MARGIN и не ужимать по MAX_* — иначе полноширинные/полновысотные пресеты (низ, трети)
 * визуально сужаются или «пружинят» относительно состояния после snap.
 */
export function computeViewportMaxFromWorkArea(): {
	width: number;
	height: number;
} {
	if (typeof document === 'undefined') {
		return {
			width: MAX_WINDOW_WIDTH,
			height: MAX_WINDOW_HEIGHT,
		};
	}
	const gw = globalThis as unknown as Window;
	if (typeof gw.innerWidth !== 'number') {
		return {
			width: MAX_WINDOW_WIDTH,
			height: MAX_WINDOW_HEIGHT,
		};
	}
	const wa = readDesktopWorkArea();
	return {
		width: Math.max(320, wa.width),
		height: Math.max(240, wa.height),
	};
}

/** Higher-contrast resize affordances (react-rnd handles) + explicit resize cursors */
export const DESKTOP_RND_RESIZE_HANDLE_CLASSES = {
	top: '!h-2.5 !top-0 cursor-ns-resize border-t-2 border-[rgb(var(--desktop-accent-rgb)/0.42)] hover:border-[rgb(var(--desktop-accent-rgb)/0.72)] motion-reduce:transition-none',
	right:
		'!w-2.5 !right-0 cursor-ew-resize border-r-2 border-[rgb(var(--desktop-accent-rgb)/0.42)] hover:border-[rgb(var(--desktop-accent-rgb)/0.72)] motion-reduce:transition-none',
	bottom:
		'!h-2.5 !bottom-0 cursor-ns-resize border-b-2 border-[rgb(var(--desktop-accent-rgb)/0.42)] hover:border-[rgb(var(--desktop-accent-rgb)/0.72)] motion-reduce:transition-none',
	left: '!w-2.5 !left-0 cursor-ew-resize border-l-2 border-[rgb(var(--desktop-accent-rgb)/0.42)] hover:border-[rgb(var(--desktop-accent-rgb)/0.72)] motion-reduce:transition-none',
	topRight:
		'!h-4 !w-4 !top-0 !right-0 cursor-nesw-resize rounded-br-md bg-[rgb(var(--desktop-accent-rgb)/0.28)] hover:bg-[rgb(var(--desktop-accent-rgb)/0.48)] motion-reduce:transition-none',
	bottomRight:
		'!h-4 !w-4 !bottom-0 !right-0 cursor-nwse-resize rounded-tl-md bg-[rgb(var(--desktop-accent-rgb)/0.28)] hover:bg-[rgb(var(--desktop-accent-rgb)/0.48)] motion-reduce:transition-none',
	bottomLeft:
		'!h-4 !w-4 !bottom-0 !left-0 cursor-nesw-resize rounded-tr-md bg-[rgb(var(--desktop-accent-rgb)/0.28)] hover:bg-[rgb(var(--desktop-accent-rgb)/0.48)] motion-reduce:transition-none',
	topLeft:
		'!h-4 !w-4 !top-0 !left-0 cursor-nwse-resize rounded-br-md bg-[rgb(var(--desktop-accent-rgb)/0.28)] hover:bg-[rgb(var(--desktop-accent-rgb)/0.48)] motion-reduce:transition-none',
} as const;

/** Координаты указателя в viewport; для программного clamp позиции не передаются (без snap). */
export type DesktopWindowDragPointer = { clientX: number; clientY: number };

export function pointerFromDragEvent(e: unknown): DesktopWindowDragPointer {
	if (!e || typeof e !== 'object') {
		return { clientX: 0, clientY: 0 };
	}
	const v = e as { touches?: TouchList; clientX?: number; clientY?: number };
	if (v.touches && v.touches.length > 0) {
		const t = v.touches[0];
		return { clientX: t.clientX, clientY: t.clientY };
	}
	if (typeof v.clientX === 'number' && typeof v.clientY === 'number') {
		return { clientX: v.clientX, clientY: v.clientY };
	}
	return { clientX: 0, clientY: 0 };
}

export function isDesktopAppWindowBodySelfScroll(
	windowType: WindowState['type'],
	appComponent?: string | null
): boolean {
	return isShellAppSelfScroll(windowType, appComponent);
}
