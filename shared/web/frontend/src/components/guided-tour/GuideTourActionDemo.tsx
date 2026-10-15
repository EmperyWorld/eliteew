/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Animated pointer + click ripple over a guided-tour spotlight, showing the
 * example gesture (click / double-click / right-click) rather than a box alone.
 *
 * Invariants:
 * - Decorative only: pointer-events none, hidden from assistive tech.
 * - Respects prefers-reduced-motion (static pointer, no loop).
 *
 * Related:
 * - SpotlightGuideModal.tsx, documentation/product/GUIDED-TOUR-EXCURSION.md
 */

import { cn } from '@/utils/cn';
import { motion, useReducedMotion } from 'framer-motion';
import type { GuideTourDemoAction } from './useBuiltGuideSteps';

export function GuideTourActionDemo({
	rect,
	action,
	caption,
	zIndex,
}: {
	rect: DOMRect;
	action: GuideTourDemoAction;
	caption?: string;
	zIndex: number;
}) {
	const reduceMotion = useReducedMotion();
	const targetX = rect.left + Math.min(rect.width * 0.62, rect.width - 18);
	const targetY = rect.top + Math.min(rect.height * 0.42, rect.height - 18);
	const startX = targetX + 36;
	const startY = targetY + 48;
	const clickCount = action === 'doubleClick' ? 2 : 1;
	const loopDuration = action === 'doubleClick' ? 2.8 : 2.2;

	return (
		<div className="pointer-events-none fixed" style={{ zIndex }} aria-hidden>
			{reduceMotion !== true ? (
				<motion.span
					className="absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-200/50 bg-violet-400/15"
					style={{ left: targetX, top: targetY }}
					animate={{
						opacity: [0.15, 0.55, 0],
						scale: [0.45, 1.15, 1.55],
					}}
					transition={{
						duration: 0.9,
						repeat: Number.POSITIVE_INFINITY,
						repeatDelay: loopDuration - 0.9,
						repeatType: 'loop',
						times: [0, 0.35, 1],
					}}
				/>
			) : null}
			<motion.div
				className="absolute"
				initial={false}
				animate={
					reduceMotion
						? { left: targetX, top: targetY, opacity: 1 }
						: {
								left: [startX, targetX, targetX, targetX],
								top: [startY, targetY, targetY, targetY],
								opacity: [0, 1, 1, 0.85],
							}
				}
				transition={
					reduceMotion
						? { duration: 0 }
						: {
								duration: loopDuration,
								repeat: Number.POSITIVE_INFINITY,
								ease: 'easeInOut',
							}
				}
			>
				<GuideTourDemoPointer
					rightClick={action === 'rightClick'}
					pulse={!reduceMotion}
					clickCount={clickCount}
				/>
			</motion.div>
			{caption ? (
				<div
					className={cn(
						'absolute max-w-44 rounded-lg border border-white/12 bg-slate-950/90 px-2 py-1',
						'text-[11px] leading-snug text-violet-50/95 shadow-lg shadow-black/30 backdrop-blur-md'
					)}
					style={{
						left: Math.max(12, targetX + 22),
						top: Math.max(12, targetY - 36),
					}}
				>
					{caption}
				</div>
			) : null}
		</div>
	);
}

function GuideTourDemoPointer({
	rightClick,
	pulse,
	clickCount,
}: {
	rightClick: boolean;
	pulse: boolean;
	clickCount: number;
}) {
	void clickCount;
	return (
		<motion.svg
			width="28"
			height="28"
			viewBox="0 0 28 28"
			fill="none"
			className="-translate-x-1 -translate-y-1 drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)]"
			animate={pulse ? { scale: [1, 0.92, 1] } : undefined}
			transition={
				pulse
					? {
							duration: 0.45,
							repeat: Number.POSITIVE_INFINITY,
							repeatDelay: 1.4,
							ease: 'easeInOut',
						}
					: undefined
			}
		>
			<path
				d="M5 3.5 9.2 22.4l4.1-4.3 5.6 6.7 2.3-1.9-5.5-6.6 5.6-1.2L5 3.5Z"
				fill="rgb(248 250 252)"
				stroke="rgb(15 23 42)"
				strokeWidth="1.2"
				strokeLinejoin="round"
			/>
			{rightClick ? (
				<circle cx="20" cy="8" r="3.2" fill="rgb(167 139 250)" />
			) : null}
		</motion.svg>
	);
}
