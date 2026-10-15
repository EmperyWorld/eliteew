/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Spotlight mask, dim layers, glow, animated ring and corner brackets for guided tours.
 *
 * Invariants:
 * - Dim click targets stay as four fixed strips (reliable hit-testing around the cutout hole).
 * - Motion accents respect `prefers-reduced-motion`.
 *
 * Related:
 * - SpotlightGuideModal.tsx, documentation/product/GUIDED-TOUR-EXCURSION.md
 */

import { cn } from '@/utils/cn';
import { motion, useReducedMotion } from 'framer-motion';

const CORNER_SIZE = 14;
const CORNER_OFFSET = 6;

function SpotlightCornerBrackets({
	top,
	left,
	width,
	height,
	zIndex,
}: {
	top: number;
	left: number;
	width: number;
	height: number;
	zIndex: number;
}) {
	const bracketClass =
		'pointer-events-none fixed border-violet-300/75 shadow-[0_0_12px_rgba(167,139,250,0.35)]';
	const style = { zIndex } as const;

	return (
		<>
			<div
				className={cn(bracketClass, 'border-t-2 border-l-2 rounded-tl-md')}
				style={{
					...style,
					top: top - CORNER_OFFSET,
					left: left - CORNER_OFFSET,
					width: CORNER_SIZE,
					height: CORNER_SIZE,
				}}
				aria-hidden
			/>
			<div
				className={cn(bracketClass, 'border-t-2 border-r-2 rounded-tr-md')}
				style={{
					...style,
					top: top - CORNER_OFFSET,
					left: left + width + CORNER_OFFSET - CORNER_SIZE,
					width: CORNER_SIZE,
					height: CORNER_SIZE,
				}}
				aria-hidden
			/>
			<div
				className={cn(bracketClass, 'border-b-2 border-l-2 rounded-bl-md')}
				style={{
					...style,
					top: top + height + CORNER_OFFSET - CORNER_SIZE,
					left: left - CORNER_OFFSET,
					width: CORNER_SIZE,
					height: CORNER_SIZE,
				}}
				aria-hidden
			/>
			<div
				className={cn(bracketClass, 'border-b-2 border-r-2 rounded-br-md')}
				style={{
					...style,
					top: top + height + CORNER_OFFSET - CORNER_SIZE,
					left: left + width + CORNER_OFFSET - CORNER_SIZE,
					width: CORNER_SIZE,
					height: CORNER_SIZE,
				}}
				aria-hidden
			/>
		</>
	);
}

export function GuideTourSpotlightFrame({
	rect,
	onDimClick,
	padding = 10,
	zMask,
	zGlow,
	zRing,
}: {
	rect: DOMRect;
	onDimClick: () => void;
	padding?: number;
	zMask: number;
	zGlow: number;
	zRing: number;
}) {
	const reduceMotion = useReducedMotion();
	const t = rect.top - padding;
	const l = rect.left - padding;
	const w = rect.width + padding * 2;
	const h = rect.height + padding * 2;
	const topH = Math.max(0, t);
	const leftW = Math.max(0, l);
	const bottomTop = t + h;
	const dimClass =
		'fixed cursor-default border-0 bg-slate-950/84 p-0 backdrop-blur-[3px]';
	const ringTransition = reduceMotion
		? { duration: 0 }
		: { type: 'spring' as const, stiffness: 360, damping: 32, mass: 0.82 };
	const glowExpand = 14;
	const gt = t - glowExpand;
	const gl = l - glowExpand;
	const gw = w + glowExpand * 2;
	const gh = h + glowExpand * 2;
	const rounded = 'rounded-2xl';

	return (
		<>
			<button
				type="button"
				className={cn(dimClass, 'left-0 right-0')}
				style={{ top: 0, height: topH, zIndex: zMask }}
				aria-hidden
				tabIndex={-1}
				onClick={onDimClick}
			/>
			<button
				type="button"
				className={cn(dimClass, 'left-0')}
				style={{ top: t, width: leftW, height: h, zIndex: zMask }}
				aria-hidden
				tabIndex={-1}
				onClick={onDimClick}
			/>
			<button
				type="button"
				className={cn(dimClass)}
				style={{
					top: t,
					left: l + w,
					right: 0,
					height: h,
					zIndex: zMask,
				}}
				aria-hidden
				tabIndex={-1}
				onClick={onDimClick}
			/>
			<button
				type="button"
				className={cn(dimClass, 'bottom-0 left-0 right-0')}
				style={{ top: bottomTop, zIndex: zMask }}
				aria-hidden
				tabIndex={-1}
				onClick={onDimClick}
			/>
			<motion.div
				className={cn(
					'pointer-events-none fixed will-change-[top,left,width,height]',
					rounded,
					'bg-[radial-gradient(ellipse_at_center,rgba(157,255,0,0.12)_0%,rgba(139,92,246,0.28)_42%,transparent_72%)] blur-2xl'
				)}
				initial={false}
				animate={{ top: gt, left: gl, width: gw, height: gh }}
				transition={ringTransition}
				style={{ position: 'fixed', zIndex: zGlow }}
				aria-hidden
			/>
			{reduceMotion !== true ? (
				<motion.div
					className={cn(
						'pointer-events-none fixed will-change-[top,left,width,height]',
						rounded,
						'border border-violet-300/35'
					)}
					initial={false}
					animate={{
						top: t - 4,
						left: l - 4,
						width: w + 8,
						height: h + 8,
						opacity: [0.35, 0.75, 0.35],
						scale: [1, 1.015, 1],
					}}
					transition={{
						top: ringTransition,
						left: ringTransition,
						width: ringTransition,
						height: ringTransition,
						opacity: {
							duration: 2.4,
							repeat: Number.POSITIVE_INFINITY,
							ease: 'easeInOut',
						},
						scale: {
							duration: 2.4,
							repeat: Number.POSITIVE_INFINITY,
							ease: 'easeInOut',
						},
					}}
					style={{ position: 'fixed', zIndex: zRing - 1 }}
					aria-hidden
				/>
			) : null}
			<motion.div
				className={cn(
					'pointer-events-none fixed will-change-[top,left,width,height]',
					'border-2 border-violet-400/60 shadow-[0_0_0_1px_rgba(167,139,250,0.25),0_0_48px_-8px_rgba(139,92,246,0.45),0_0_32px_-12px_rgba(157,255,0,0.18),0_24px_56px_rgba(0,0,0,0.38)]',
					rounded
				)}
				initial={false}
				animate={{ top: t, left: l, width: w, height: h }}
				transition={ringTransition}
				style={{ position: 'fixed', zIndex: zRing }}
				aria-hidden
			/>
			<SpotlightCornerBrackets
				top={t}
				left={l}
				width={w}
				height={h}
				zIndex={zRing + 1}
			/>
		</>
	);
}
