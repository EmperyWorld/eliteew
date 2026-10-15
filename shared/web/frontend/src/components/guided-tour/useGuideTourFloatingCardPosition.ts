import {
	computeGuideCardPlacement,
	type GuideCardPlacement,
	type GuideCardPlacementSide,
} from '@/components/guided-tour/guideTourPlacement';
import {
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type RefObject,
} from 'react';

/**
 * Позиция плавающей карточки относительно spotlight без пересечения с подсветкой.
 */
export function useGuideTourFloatingCardPosition(opts: {
	open: boolean;
	spotlightRect: DOMRect | null;
	hasHighlight: boolean;
	stepIndex: number;
	spotlightLayoutKey?: string;
}): {
	guideCardWrapRef: RefObject<HTMLDivElement | null>;
	floatingCardStyle: { top: number; left: number } | null;
	cardPlacementSide: GuideCardPlacementSide;
	useCenterCard: boolean;
} {
	const {
		open,
		spotlightRect,
		hasHighlight,
		stepIndex,
		spotlightLayoutKey = '',
	} = opts;

	const guideCardWrapRef = useRef<HTMLDivElement | null>(null);
	const measuredForStepIndexRef = useRef<number | null>(null);
	const measuredSpotlightSigRef = useRef<string>('');

	const useCenterCard = !open || !spotlightRect || !hasHighlight;

	const estimatedFloatingPos = useMemo((): GuideCardPlacement | null => {
		if (!spotlightRect || !hasHighlight || typeof window === 'undefined')
			return null;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const cardW = Math.min(432, vw - 32);
		const cardH = Math.min(420, vh * 0.5);
		return computeGuideCardPlacement(spotlightRect, cardW, cardH, vw, vh);
	}, [spotlightRect, hasHighlight]);

	const [measuredFloatingPos, setMeasuredFloatingPos] =
		useState<GuideCardPlacement | null>(null);

	useLayoutEffect(() => {
		if (!open || !spotlightRect || !hasHighlight) {
			setMeasuredFloatingPos(null);
			measuredForStepIndexRef.current = null;
			measuredSpotlightSigRef.current = '';
			return;
		}

		measuredForStepIndexRef.current = null;
		measuredSpotlightSigRef.current = '';
		setMeasuredFloatingPos(null);

		const spotlightSig = [
			Math.round(spotlightRect.top),
			Math.round(spotlightRect.left),
			Math.round(spotlightRect.width),
			Math.round(spotlightRect.height),
			spotlightLayoutKey,
		].join(':');

		const run = () => {
			const el = guideCardWrapRef.current;
			if (!el) return;
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const r = el.getBoundingClientRect();
			setMeasuredFloatingPos(
				computeGuideCardPlacement(spotlightRect, r.width, r.height, vw, vh)
			);
			measuredForStepIndexRef.current = stepIndex;
			measuredSpotlightSigRef.current = spotlightSig;
		};

		run();
		let innerRaf = 0;
		const outerRaf = window.requestAnimationFrame(() => {
			innerRaf = window.requestAnimationFrame(run);
		});
		return () => {
			window.cancelAnimationFrame(outerRaf);
			window.cancelAnimationFrame(innerRaf);
		};
	}, [open, spotlightRect, hasHighlight, stepIndex, spotlightLayoutKey]);

	const spotlightSigForRender = spotlightRect
		? [
				Math.round(spotlightRect.top),
				Math.round(spotlightRect.left),
				Math.round(spotlightRect.width),
				Math.round(spotlightRect.height),
				spotlightLayoutKey,
			].join(':')
		: '';

	const resolvedPlacement: GuideCardPlacement | null =
		measuredFloatingPos &&
		measuredForStepIndexRef.current === stepIndex &&
		measuredSpotlightSigRef.current === spotlightSigForRender
			? measuredFloatingPos
			: estimatedFloatingPos;

	const floatingCardTop = resolvedPlacement?.top ?? null;
	const floatingCardLeft = resolvedPlacement?.left ?? null;
	const floatingCardStyle = useMemo(
		(): { top: number; left: number } | null =>
			floatingCardTop != null && floatingCardLeft != null
				? { top: floatingCardTop, left: floatingCardLeft }
				: null,
		[floatingCardTop, floatingCardLeft]
	);

	const cardPlacementSide: GuideCardPlacementSide =
		resolvedPlacement?.side ?? 'center';

	return {
		guideCardWrapRef,
		floatingCardStyle,
		cardPlacementSide,
		useCenterCard,
	};
}
