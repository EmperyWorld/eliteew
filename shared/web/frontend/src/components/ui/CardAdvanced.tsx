/**
 * Advanced Card Component - EliteEW UI System 2025
 * Features: 3D tilt effect, glow on hover, glassmorphism, GPU-accelerated
 * Performance: 60 FPS with transform-based animations
 *
 * @version 2.0.0
 * @date 2025-10-13
 */

import * as React from 'react';
import { useRef, type MouseEvent } from 'react';
import {
	motion,
	useMotionValue,
	useSpring,
	useTransform,
	type HTMLMotionProps,
} from 'framer-motion';
import { cva, type VariantProps } from '@/utils/cva';
import { cn } from '../../utils/cn';

/* ============================================================================
   CARD VARIANTS - Design System
   ============================================================================ */

const cardVariants = cva(
	// Base styles - GPU accelerated
	'relative rounded-xl transition-all',
	{
		variants: {
			variant: {
				default:
					'bg-black/40 backdrop-blur-md border border-white/10 shadow-xl shadow-black/20',
				elevated:
					'bg-black/50 backdrop-blur-lg border border-white/20 shadow-2xl shadow-black/30',
				flat: 'bg-black/30 backdrop-blur-xs border border-white/5',
				bordered: 'bg-transparent backdrop-blur-xs border-2 border-white/20',
				glass: 'bg-white/5 backdrop-blur-xl border border-white/10',
				gradient:
					'bg-linear-to-br from-purple-500/10 via-pink-500/10 to-rose-500/10 backdrop-blur-lg border border-purple-500/20',
			},
			padding: {
				none: '',
				sm: 'p-3',
				md: 'p-4',
				lg: 'p-6',
				xl: 'p-8',
			},
			hoverable: {
				true: 'cursor-pointer',
				false: '',
			},
		},
		defaultVariants: {
			variant: 'default',
			padding: 'md',
			hoverable: false,
		},
	}
);

/* ============================================================================
   TYPES
   ============================================================================ */

export interface CardAdvancedProps
	extends Omit<
			React.HTMLAttributes<HTMLDivElement>,
			'onDrag' | 'onDragStart' | 'onDragEnd'
		>,
		VariantProps<typeof cardVariants> {
	tilt?: boolean;
	glow?: boolean;
	glowColor?: string;
	interactive?: boolean;
}

/* ============================================================================
   CARD COMPONENT
   ============================================================================ */

export const CardAdvanced = React.forwardRef<HTMLDivElement, CardAdvancedProps>(
	(
		{
			className,
			variant,
			padding,
			hoverable,
			tilt = true,
			glow = true,
			glowColor = 'rgba(168, 85, 247, 0.3)',
			interactive = true,
			children,
			...props
		},
		ref
	) => {
		// Tilt effect
		const cardRef = useRef<HTMLDivElement>(null);
		const x = useMotionValue(0);
		const y = useMotionValue(0);

		// Smooth spring animation (60 FPS)
		const springConfig = { damping: 25, stiffness: 400 };
		const xSpring = useSpring(x, springConfig);
		const ySpring = useSpring(y, springConfig);

		// 3D rotation transforms
		const rotateX = useTransform(ySpring, [-0.5, 0.5], [10, -10]);
		const rotateY = useTransform(xSpring, [-0.5, 0.5], [-10, 10]);

		// Glow position
		const glowX = useTransform(xSpring, [-0.5, 0.5], ['0%', '100%']);
		const glowY = useTransform(ySpring, [-0.5, 0.5], ['0%', '100%']);

		// Glow background
		const glowBackground = useTransform(
			[glowX, glowY],
			([x, y]) =>
				`radial-gradient(circle at ${x} ${y}, ${glowColor}, transparent 70%)`
		);

		/* ========================================================================
       3D TILT EFFECT
       ======================================================================== */

		const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
			if (!tilt || !interactive) {
				return;
			}

			const card = cardRef.current;
			if (!card) {
				return;
			}

			const rect = card.getBoundingClientRect();
			const centerX = rect.left + rect.width / 2;
			const centerY = rect.top + rect.height / 2;

			// Calculate normalized distance from center (-1 to 1)
			const distanceX = (e.clientX - centerX) / (rect.width / 2);
			const distanceY = (e.clientY - centerY) / (rect.height / 2);

			x.set(distanceX * 0.5);
			y.set(distanceY * 0.5);
		};

		const handleMouseLeave = () => {
			x.set(0);
			y.set(0);
		};

		/* ========================================================================
       RENDER
       ======================================================================== */

		return (
			<motion.div
				ref={(node) => {
					cardRef.current = node;
					if (typeof ref === 'function') {
						ref(node);
					} else if (ref) {
						ref.current = node;
					}
				}}
				className={cn(cardVariants({ variant, padding, hoverable, className }))}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
				style={
					tilt && interactive
						? {
								rotateX,
								rotateY,
								transformStyle: 'preserve-3d',
								transformPerspective: 1000,
							}
						: undefined
				}
				whileHover={
					interactive
						? {
								scale: 1.02,
								transition: { duration: 0.2, ease: 'easeOut' as const },
							}
						: undefined
				}
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4, ease: 'easeOut' as const }}
				{...(props as HTMLMotionProps<'div'>)}
			>
				{/* Glow effect on hover */}
				{glow && interactive && (
					<motion.div
						className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0"
						style={{
							background: glowBackground,
						}}
						whileHover={{ opacity: 1 }}
						transition={{ duration: 0.3 }}
					/>
				)}

				{/* Border glow on hover */}
				{interactive && (
					<motion.div
						className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0"
						style={{
							boxShadow: `0 0 30px ${glowColor}`,
						}}
						whileHover={{ opacity: 1 }}
						transition={{ duration: 0.3 }}
					/>
				)}

				{/* Content */}
				<div className="relative z-10">{children}</div>

				{/* Shine effect */}
				{interactive && (
					<motion.div
						className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0 overflow-hidden"
						whileHover={{ opacity: 1 }}
						transition={{ duration: 0.3 }}
					>
						<motion.div
							className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent"
							style={{ transform: 'translateX(-100%)' }}
							animate={{
								x: ['0%', '200%'],
							}}
							transition={{
								duration: 1.5,
								repeat: Infinity,
								ease: 'linear' as const,
							}}
						/>
					</motion.div>
				)}
			</motion.div>
		);
	}
);

CardAdvanced.displayName = 'CardAdvanced';

export default CardAdvanced;
