/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Free-placement drag, viewport clamp, and expanded max-height for the floating widget.
 *
 * Invariants:
 * - Commits clamped coordinates via `onWidgetPositionCommit`; no orphan drag offset after drop.
 *
 * Related:
 * - utils/desktopFloatingWidgetPlacement.ts
 * - helpers.ts (floatingWidgetViewportSize)
 */

import type { CSSProperties, RefObject } from 'react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
	DESKTOP_FLOATING_WIDGET_POSITION_SEED,
	DESKTOP_LAYOUT,
	STORAGE_KEYS,
} from '../../constants';
import {
	resolveFloatingWidgetViewportPosition,
	type ViewportRect,
} from '../../utils/desktopFloatingWidgetPlacement';
import { floatingWidgetViewportSize } from './helpers';

export interface UseFloatingWidgetDragArgs {
	widgetPosition: { x: number; y: number };
	onWidgetPositionCommit?: (next: { x: number; y: number }) => void;
	iconReservedViewportBounds?: ViewportRect | null;
	isExpanded: boolean;
}

export interface UseFloatingWidgetDragResult {
	widgetRootRef: RefObject<HTMLDivElement | null>;
	widgetRootStyle: CSSProperties;
	isPresetFloatingLayout: boolean;
	handleWidgetDragPointerDown: (e: React.PointerEvent) => void;
	handleWidgetDragPointerMove: (e: React.PointerEvent) => void;
	handleWidgetDragPointerUp: (e: React.PointerEvent) => void;
	handleWidgetDragLostCapture: () => void;
}

export function useFloatingWidgetDrag({
	widgetPosition,
	onWidgetPositionCommit,
	iconReservedViewportBounds = null,
	isExpanded,
}: UseFloatingWidgetDragArgs): UseFloatingWidgetDragResult {
	const widgetRootRef = useRef<HTMLDivElement>(null);
	const widgetDragStartRef = useRef<{ x: number; y: number } | null>(null);
	const [widgetDragOffset, setWidgetDragOffset] = useState({ dx: 0, dy: 0 });

	const isPresetFloatingLayout = useMemo(() => {
		if (typeof localStorage === 'undefined') return false;
		if (
			localStorage.getItem(STORAGE_KEYS.FLOATING_WIDGET_USER_POSITIONED) === '1'
		) {
			return false;
		}
		return (
			widgetPosition.x === DESKTOP_FLOATING_WIDGET_POSITION_SEED.x &&
			widgetPosition.y === DESKTOP_FLOATING_WIDGET_POSITION_SEED.y
		);
	}, [widgetPosition.x, widgetPosition.y]);

	const widgetRootStyle = useMemo((): CSSProperties => {
		const style: CSSProperties = {};
		if (!isPresetFloatingLayout) {
			style.left = widgetPosition.x;
			style.top = widgetPosition.y;
		}
		if (widgetDragOffset.dx !== 0 || widgetDragOffset.dy !== 0) {
			style.transform = `translate3d(${widgetDragOffset.dx}px, ${widgetDragOffset.dy}px, 0)`;
		}
		return style;
	}, [
		isPresetFloatingLayout,
		widgetPosition.x,
		widgetPosition.y,
		widgetDragOffset.dx,
		widgetDragOffset.dy,
	]);

	const handleWidgetDragPointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (!onWidgetPositionCommit || e.button !== 0) return;
			e.preventDefault();
			e.stopPropagation();
			widgetDragStartRef.current = { x: e.clientX, y: e.clientY };
			widgetRootRef.current?.setPointerCapture(e.pointerId);
		},
		[onWidgetPositionCommit]
	);

	const handleWidgetDragPointerMove = useCallback((e: React.PointerEvent) => {
		if (!widgetDragStartRef.current) return;
		setWidgetDragOffset({
			dx: e.clientX - widgetDragStartRef.current.x,
			dy: e.clientY - widgetDragStartRef.current.y,
		});
	}, []);

	const cancelWidgetDragVisual = useCallback(() => {
		widgetDragStartRef.current = null;
		setWidgetDragOffset({ dx: 0, dy: 0 });
	}, []);

	const handleWidgetDragPointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (!widgetDragStartRef.current) return;
			const el = widgetRootRef.current;
			widgetDragStartRef.current = null;
			try {
				el?.releasePointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
			if (!el || !onWidgetPositionCommit) {
				setWidgetDragOffset({ dx: 0, dy: 0 });
				return;
			}
			const r = el.getBoundingClientRect();
			setWidgetDragOffset({ dx: 0, dy: 0 });
			const resolved = resolveFloatingWidgetViewportPosition({
				x: r.left,
				y: r.top,
				widgetWidth: r.width,
				widgetHeight: r.height,
				viewport: floatingWidgetViewportSize(),
				iconReserved: iconReservedViewportBounds,
			});
			try {
				localStorage.setItem(STORAGE_KEYS.FLOATING_WIDGET_USER_POSITIONED, '1');
			} catch {
				/* ignore */
			}
			onWidgetPositionCommit({
				x: Math.round(resolved.x),
				y: Math.round(resolved.y),
			});
		},
		[iconReservedViewportBounds, onWidgetPositionCommit]
	);

	useLayoutEffect(() => {
		if (
			isPresetFloatingLayout ||
			!onWidgetPositionCommit ||
			widgetDragStartRef.current
		) {
			return;
		}
		const resolved = resolveFloatingWidgetViewportPosition({
			x: widgetPosition.x,
			y: widgetPosition.y,
			viewport: floatingWidgetViewportSize(),
			iconReserved: iconReservedViewportBounds,
		});
		if (resolved.x === widgetPosition.x && resolved.y === widgetPosition.y) {
			return;
		}
		onWidgetPositionCommit({
			x: Math.round(resolved.x),
			y: Math.round(resolved.y),
		});
	}, [
		iconReservedViewportBounds,
		isPresetFloatingLayout,
		onWidgetPositionCommit,
		widgetPosition.x,
		widgetPosition.y,
	]);

	const handleWidgetDragLostCapture = useCallback(() => {
		if (widgetDragStartRef.current) {
			cancelWidgetDragVisual();
		}
	}, [cancelWidgetDragVisual]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: пересчёт после переноса/драга, не только toggle expanded
	useLayoutEffect(() => {
		const el = widgetRootRef.current;
		if (!el) return;

		const clearSizing = () => {
			el.style.maxHeight = '';
			el.style.overflowY = '';
		};

		const apply = () => {
			if (!isExpanded) {
				clearSizing();
				return;
			}
			const pad = 8;
			const tb = DESKTOP_LAYOUT.TASKBAR_HEIGHT_PX;
			const top = el.getBoundingClientRect().top;
			const roomBelow = window.innerHeight - top - tb - pad;
			const maxH = Math.max(240, Math.floor(roomBelow));
			el.style.maxHeight = `${maxH}px`;
			el.style.overflowY = 'auto';
		};

		apply();
		let nestedRaf = 0;
		const outerRaf = requestAnimationFrame(() => {
			nestedRaf = requestAnimationFrame(apply);
		});
		window.addEventListener('resize', apply);

		return () => {
			cancelAnimationFrame(outerRaf);
			cancelAnimationFrame(nestedRaf);
			window.removeEventListener('resize', apply);
			clearSizing();
		};
	}, [
		isExpanded,
		isPresetFloatingLayout,
		widgetPosition.x,
		widgetPosition.y,
		widgetDragOffset.dx,
		widgetDragOffset.dy,
	]);

	return {
		widgetRootRef,
		widgetRootStyle,
		isPresetFloatingLayout,
		handleWidgetDragPointerDown,
		handleWidgetDragPointerMove,
		handleWidgetDragPointerUp,
		handleWidgetDragLostCapture,
	};
}
