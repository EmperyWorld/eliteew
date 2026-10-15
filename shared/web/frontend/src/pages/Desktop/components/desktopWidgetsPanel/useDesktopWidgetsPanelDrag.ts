/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pointer-drag state and handlers for stacked panel, free strip, and slot cards.
 *
 * Invariants:
 * - Commits layout px on pointer up; visual offset cleared after commit.
 *
 * Related:
 * - DesktopWidgetsPanel.tsx
 */

import type * as React from 'react';
import { useCallback, useRef, useState } from 'react';
import { DESKTOP_LAYOUT } from '../../constants';
import { readDesktopWorkArea } from '../../utils/desktopSnapGeometry';
import {
	clampWidgetPositionInWorkArea,
	WIDGET_SLOT_CARD_WIDTH_LAYOUT,
	WIDGET_WORK_MARGIN_PX,
} from '../../utils/desktopWidgetLayoutUtils';

type UseDesktopWidgetsPanelDragParams = {
	panelOffset: { x: number; y: number };
	onPanelOffsetCommit?: (next: { x: number; y: number }) => void;
	onSlotPositionCommit?: (
		slotId: string,
		next: { x: number; y: number }
	) => void;
	onAllWidgetSlotsOffsetCommit?: (delta: { x: number; y: number }) => void;
};

export function useDesktopWidgetsPanelDrag({
	panelOffset,
	onPanelOffsetCommit,
	onSlotPositionCommit,
	onAllWidgetSlotsOffsetCommit,
}: UseDesktopWidgetsPanelDragParams) {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const dragStartRef = useRef<{ x: number; y: number } | null>(null);
	const [drag, setDrag] = useState({ dx: 0, dy: 0 });

	const freeStripDragRef = useRef<{ x: number; y: number } | null>(null);
	const [freeStripDrag, setFreeStripDrag] = useState({ dx: 0, dy: 0 });

	const slotDragRef = useRef<{
		slotId: string;
		clientStartX: number;
		clientStartY: number;
		origX: number;
		origY: number;
	} | null>(null);
	const [slotDragLive, setSlotDragLive] = useState<{
		id: string;
		dx: number;
		dy: number;
	} | null>(null);

	const ox = panelOffset.x;
	const oy = panelOffset.y;

	const handlePanelDragPointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!onPanelOffsetCommit || e.button !== 0) return;
			e.preventDefault();
			e.stopPropagation();
			dragStartRef.current = { x: e.clientX, y: e.clientY };
			(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
		},
		[onPanelOffsetCommit]
	);

	const handlePanelDragPointerMove = useCallback((e: React.PointerEvent) => {
		if (!dragStartRef.current) return;
		setDrag({
			dx: e.clientX - dragStartRef.current.x,
			dy: e.clientY - dragStartRef.current.y,
		});
	}, []);

	const cancelPanelDragVisual = useCallback(() => {
		dragStartRef.current = null;
		setDrag({ dx: 0, dy: 0 });
	}, []);

	const handlePanelDragPointerUp = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!dragStartRef.current || !onPanelOffsetCommit) {
				cancelPanelDragVisual();
				return;
			}
			const start = dragStartRef.current;
			dragStartRef.current = null;
			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
			const dx = e.clientX - start.x;
			const dy = e.clientY - start.y;
			setDrag({ dx: 0, dy: 0 });
			const el = rootRef.current;
			if (!el) return;
			const pad = 8;
			const tb = DESKTOP_LAYOUT.TASKBAR_HEIGHT_PX;
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			let nx = ox + dx;
			let ny = oy + dy;
			el.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
			const r = el.getBoundingClientRect();
			el.style.transform = '';
			if (r.left < pad) nx += pad - r.left;
			if (r.top < pad) ny += pad - r.top;
			if (r.right > vw - pad) nx -= r.right - (vw - pad);
			if (r.bottom > vh - tb - pad) ny -= r.bottom - (vh - tb - pad);
			onPanelOffsetCommit({ x: Math.round(nx), y: Math.round(ny) });
		},
		[cancelPanelDragVisual, ox, oy, onPanelOffsetCommit]
	);

	const handlePanelDragPointerCancel = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!dragStartRef.current) return;
			dragStartRef.current = null;
			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
			setDrag({ dx: 0, dy: 0 });
		},
		[]
	);

	const cancelFreeStripDrag = useCallback(() => {
		freeStripDragRef.current = null;
		setFreeStripDrag({ dx: 0, dy: 0 });
	}, []);

	const handleFreeStripPointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!onAllWidgetSlotsOffsetCommit || e.button !== 0) return;
			e.preventDefault();
			e.stopPropagation();
			freeStripDragRef.current = { x: e.clientX, y: e.clientY };
			(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
		},
		[onAllWidgetSlotsOffsetCommit]
	);

	const handleFreeStripPointerMove = useCallback((e: React.PointerEvent) => {
		if (!freeStripDragRef.current) return;
		setFreeStripDrag({
			dx: e.clientX - freeStripDragRef.current.x,
			dy: e.clientY - freeStripDragRef.current.y,
		});
	}, []);

	const handleFreeStripPointerUp = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!freeStripDragRef.current || !onAllWidgetSlotsOffsetCommit) {
				cancelFreeStripDrag();
				return;
			}
			const start = freeStripDragRef.current;
			freeStripDragRef.current = null;
			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
			setFreeStripDrag({ dx: 0, dy: 0 });
			const work = readDesktopWorkArea();
			const dx = Math.round((e.clientX - start.x) / work.layoutScale);
			const dy = Math.round((e.clientY - start.y) / work.layoutScale);
			if (dx !== 0 || dy !== 0) {
				onAllWidgetSlotsOffsetCommit({ x: dx, y: dy });
			}
		},
		[cancelFreeStripDrag, onAllWidgetSlotsOffsetCommit]
	);

	const handleFreeStripPointerCancel = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!freeStripDragRef.current) return;
			freeStripDragRef.current = null;
			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
			setFreeStripDrag({ dx: 0, dy: 0 });
		},
		[]
	);

	const handleSlotDragPointerDown = useCallback(
		(slotId: string, base: { x: number; y: number }) =>
			(e: React.PointerEvent<HTMLDivElement>) => {
				if (!onSlotPositionCommit || e.button !== 0) return;
				e.preventDefault();
				e.stopPropagation();
				slotDragRef.current = {
					slotId,
					clientStartX: e.clientX,
					clientStartY: e.clientY,
					origX: base.x,
					origY: base.y,
				};
				(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
			},
		[onSlotPositionCommit]
	);

	const handleSlotDragPointerMove = useCallback((e: React.PointerEvent) => {
		const s = slotDragRef.current;
		if (!s) return;
		setSlotDragLive({
			id: s.slotId,
			dx: e.clientX - s.clientStartX,
			dy: e.clientY - s.clientStartY,
		});
	}, []);

	const handleSlotDragPointerUp = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const s = slotDragRef.current;
			if (!s || !onSlotPositionCommit) {
				slotDragRef.current = null;
				setSlotDragLive(null);
				return;
			}
			slotDragRef.current = null;
			setSlotDragLive(null);
			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
			const work = readDesktopWorkArea();
			const sc = work.layoutScale;
			const dx = (e.clientX - s.clientStartX) / sc;
			const dy = (e.clientY - s.clientStartY) / sc;
			const card = e.currentTarget.closest(
				'[data-widget-slot-card]'
			) as HTMLElement | null;
			const h = card?.offsetHeight ?? 180;
			const next = clampWidgetPositionInWorkArea(
				{ x: s.origX + dx, y: s.origY + dy },
				work.width,
				work.height,
				WIDGET_SLOT_CARD_WIDTH_LAYOUT,
				h,
				WIDGET_WORK_MARGIN_PX
			);
			onSlotPositionCommit(s.slotId, next);
		},
		[onSlotPositionCommit]
	);

	const handleSlotDragPointerCancel = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!slotDragRef.current) return;
			slotDragRef.current = null;
			setSlotDragLive(null);
			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
		},
		[]
	);

	return {
		rootRef,
		drag,
		freeStripDrag,
		slotDragLive,
		panelTranslate: `translate3d(${ox + drag.dx}px, ${oy + drag.dy}px, 0)`,
		handlePanelDragPointerDown,
		handlePanelDragPointerMove,
		handlePanelDragPointerUp,
		handlePanelDragPointerCancel,
		handleFreeStripPointerDown,
		handleFreeStripPointerMove,
		handleFreeStripPointerUp,
		handleFreeStripPointerCancel,
		handleSlotDragPointerDown,
		handleSlotDragPointerMove,
		handleSlotDragPointerUp,
		handleSlotDragPointerCancel,
	};
}
