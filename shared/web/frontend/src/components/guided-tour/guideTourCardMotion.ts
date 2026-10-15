/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Framer Motion targets for guided tour card center vs floating placement.
 *
 * Invariants:
 * - Center steps set top/left/x/y via motion — not Tailwind translate — so transition
 *   from floating steps does not leave stale inline top/left/transform.
 *
 * Related:
 * - SpotlightGuideModal.tsx, useGuideTourFloatingCardPosition.ts
 * - documentation/product/GUIDED-TOUR-EXCURSION.md
 */

import type { TargetAndTransition, Transition } from 'framer-motion';

export const GUIDE_TOUR_CARD_SHELL_CLASS =
	'fixed flex max-h-[min(90vh,44rem)] flex-col overflow-hidden p-3 sm:p-5 w-[min(94vw,27rem)]';

const CENTER = {
	top: '50%',
	left: '50%',
	x: '-50%',
} as const;

export function guideTourCardMotionInitial(
	useCenterCard: boolean,
	reduceMotion: boolean | null
): TargetAndTransition {
	if (useCenterCard) {
		if (reduceMotion) {
			return { opacity: 0, ...CENTER, y: '-50%' };
		}
		return { opacity: 0, scale: 0.96, ...CENTER, y: 'calc(-50% + 16px)' };
	}
	return { opacity: 0, scale: 0.96 };
}

export function guideTourCardMotionAnimate(
	useCenterCard: boolean,
	floatingCardStyle: { top: number; left: number } | null,
	reduceMotion: boolean | null
): TargetAndTransition {
	if (useCenterCard) {
		if (reduceMotion) {
			return { opacity: 1, ...CENTER, y: '-50%' };
		}
		return { opacity: 1, scale: 1, ...CENTER, y: '-50%' };
	}
	if (floatingCardStyle) {
		if (reduceMotion) {
			return {
				opacity: 1,
				top: floatingCardStyle.top,
				left: floatingCardStyle.left,
				x: 0,
				y: 0,
			};
		}
		return {
			opacity: 1,
			scale: 1,
			top: floatingCardStyle.top,
			left: floatingCardStyle.left,
			x: 0,
			y: 0,
		};
	}
	return reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 };
}

export function guideTourCardMotionExit(
	useCenterCard: boolean,
	reduceMotion: boolean | null
): TargetAndTransition {
	if (useCenterCard) {
		if (reduceMotion) {
			return { opacity: 0, ...CENTER, y: '-50%' };
		}
		return { opacity: 0, scale: 0.98, ...CENTER, y: 'calc(-50% + 10px)' };
	}
	return reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 };
}

export function guideTourCardPositionTransition(
	useCenterCard: boolean,
	spring: Transition
): Transition {
	if (useCenterCard) {
		return spring;
	}
	return {
		opacity: spring,
		scale: spring,
		top: spring,
		left: spring,
		x: spring,
		y: spring,
	};
}
