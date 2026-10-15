/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Swipe-down-to-dismiss hook for companion mobile bottom sheets (U5.7).
 *
 * Invariants:
 * - Only downward drags from the sheet header / drag handle apply.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionMobileBottomSheet.tsx
 */

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type RefObject,
} from 'react';

import {
	companionMobileSheetDismissOffset,
	shouldDismissCompanionMobileSheet,
} from '@/features/ewa/companionUx/companionMobileSheetSwipe';

export type UseCompanionMobileSheetSwipeDismissOptions = {
	enabled: boolean;
	open: boolean;
	onDismiss: () => void;
};

export type UseCompanionMobileSheetSwipeDismissResult = {
	panelRef: RefObject<HTMLDivElement | null>;
	dragPx: number;
	dragging: boolean;
	headerProps: {
		onTouchStart: (event: React.TouchEvent) => void;
		onTouchMove: (event: React.TouchEvent) => void;
		onTouchEnd: () => void;
		onTouchCancel: () => void;
	};
};

export function useCompanionMobileSheetSwipeDismiss({
	enabled,
	open,
	onDismiss,
}: UseCompanionMobileSheetSwipeDismissOptions): UseCompanionMobileSheetSwipeDismissResult {
	const panelRef = useRef<HTMLDivElement | null>(null);
	const [dragPx, setDragPx] = useState(0);
	const [dragging, setDragging] = useState(false);
	const touchStartYRef = useRef(0);
	const draggingRef = useRef(false);
	const dragPxRef = useRef(0);
	const onDismissRef = useRef(onDismiss);

	useEffect(() => {
		onDismissRef.current = onDismiss;
	}, [onDismiss]);

	useEffect(() => {
		dragPxRef.current = dragPx;
	}, [dragPx]);

	useEffect(() => {
		if (!open) {
			setDragPx(0);
			setDragging(false);
			draggingRef.current = false;
		}
	}, [open]);

	const onTouchStart = useCallback(
		(event: React.TouchEvent) => {
			if (!enabled || !open) return;
			touchStartYRef.current = event.touches[0]?.clientY ?? 0;
			draggingRef.current = true;
			setDragging(true);
		},
		[enabled, open]
	);

	const onTouchMove = useCallback(
		(event: React.TouchEvent) => {
			if (!draggingRef.current || !enabled || !open) return;
			const deltaY = (event.touches[0]?.clientY ?? 0) - touchStartYRef.current;
			const offset = companionMobileSheetDismissOffset(deltaY, true);
			setDragPx(offset);
			if (offset > 4) {
				event.preventDefault();
			}
		},
		[enabled, open]
	);

	const finishDrag = useCallback(() => {
		if (!draggingRef.current) return;
		draggingRef.current = false;
		setDragging(false);
		if (shouldDismissCompanionMobileSheet(dragPxRef.current)) {
			onDismissRef.current();
		}
		setDragPx(0);
	}, []);

	const onTouchEnd = useCallback(() => {
		finishDrag();
	}, [finishDrag]);

	const onTouchCancel = useCallback(() => {
		draggingRef.current = false;
		setDragging(false);
		setDragPx(0);
	}, []);

	return {
		panelRef,
		dragPx,
		dragging,
		headerProps: {
			onTouchStart,
			onTouchMove,
			onTouchEnd,
			onTouchCancel,
		},
	};
}
