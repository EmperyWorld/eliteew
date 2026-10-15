/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dimmed vignette + glow/ring frame for Desktop AI Chat guided-tour spotlight.
 *
 * Invariants:
 * - Dim regions are clickable to advance/dismiss via onDimClick; ring is non-interactive.
 *
 * Related:
 * - features/desktop-ai-chat/DesktopAiChatGuideModal.tsx
 */

import { DESKTOP_Z_INDEX } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { motion, useReducedMotion } from 'framer-motion';

export function SpotlightFrame({
	rect,
	onDimClick,
	padding = 10,
}: {
	rect: DOMRect;
	onDimClick: () => void;
	padding?: number;
}) {
	const reduceMotion = useReducedMotion();
	const t = rect.top - padding;
	const l = rect.left - padding;
	const w = rect.width + padding * 2;
	const h = rect.height + padding * 2;
	const topH = Math.max(0, t);
	const leftW = Math.max(0, l);
	const bottomTop = t + h;
	const zMask = DESKTOP_Z_INDEX.MODAL;
	const zGlow = DESKTOP_Z_INDEX.MODAL;
	const zRing = DESKTOP_Z_INDEX.MODAL_CONTENT;
	const dimClass =
		'fixed cursor-default border-0 bg-[rgb(var(--desktop-bg-primary-rgb)/0.82)] p-0 backdrop-blur-[2px]';
	const ringTransition = reduceMotion
		? { duration: 0 }
		: { type: 'spring' as const, stiffness: 360, damping: 32, mass: 0.82 };
	const glowExpand = 10;
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
					'bg-[rgb(var(--desktop-accent-rgb)/0.22)] blur-2xl'
				)}
				initial={false}
				animate={{ top: gt, left: gl, width: gw, height: gh }}
				transition={ringTransition}
				style={{ position: 'fixed', zIndex: zGlow }}
				aria-hidden
			/>
			<motion.div
				className={cn(
					'pointer-events-none fixed will-change-[top,left,width,height]',
					'border-2 border-[rgb(var(--desktop-accent-rgb)/0.55)] shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.2),0_0_40px_-6px_rgb(var(--desktop-accent-rgb)/0.35),0_20px_48px_rgba(0,0,0,0.35)]',
					rounded
				)}
				initial={false}
				animate={{ top: t, left: l, width: w, height: h }}
				transition={ringTransition}
				style={{ position: 'fixed', zIndex: zRing }}
				aria-hidden
			/>
		</>
	);
}
