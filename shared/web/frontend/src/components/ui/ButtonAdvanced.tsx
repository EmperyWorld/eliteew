/**
 * Advanced Button Component - EliteEW UI System 2025
 * Features: Ripple effect, magnetic hover, loading states, GPU-accelerated animations
 * Performance: 60 FPS guaranteed with transform-based animations
 *
 * @version 2.0.0
 * @date 2025-10-13
 */

import { cva, type VariantProps } from '@/utils/cva';
import {
	motion,
	useMotionValue,
	useSpring,
	useTransform,
	type HTMLMotionProps,
} from 'framer-motion';
import * as React from 'react';
import { type MouseEvent, useCallback, useRef, useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';

/* ============================================================================
   BUTTON VARIANTS - Design System
   ============================================================================ */

const buttonVariants = cva(
	// Base styles - GPU accelerated
	'relative inline-flex items-center justify-center gap-2 font-medium transition-all overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 select-none',
	{
		variants: {
			variant: {
				primary:
					'bg-linear-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/50 border border-purple-400/30',
				secondary:
					'bg-linear-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-blue-500/50 border border-blue-400/30',
				ghost:
					'bg-white/5 text-white hover:bg-white/10 border border-white/10 hover:border-white/20',
				gradient:
					'bg-linear-to-r from-purple-600 via-pink-500 to-rose-500 text-white hover:shadow-xl hover:shadow-pink-500/50',
				outline:
					'bg-transparent border-2 border-purple-500 text-purple-300 hover:bg-purple-500/20 hover:text-white',
				danger:
					'bg-linear-to-r from-red-500 to-rose-500 text-white hover:shadow-lg hover:shadow-red-500/50 border border-red-400/30',
				success:
					'bg-linear-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg hover:shadow-green-500/50 border border-green-400/30',
				glass:
					'bg-black/40 backdrop-blur-md text-white border border-white/20 hover:bg-black/60 hover:border-white/30',
			},
			size: {
				xs: 'px-2 py-1 text-xs rounded-md',
				sm: 'px-3 py-1.5 text-sm rounded-lg',
				md: 'px-4 py-2 text-base rounded-lg',
				lg: 'px-6 py-3 text-lg rounded-xl',
				xl: 'px-8 py-4 text-xl rounded-xl',
			},
			fullWidth: {
				true: 'w-full',
				false: 'w-auto',
			},
		},
		defaultVariants: {
			variant: 'primary',
			size: 'md',
			fullWidth: false,
		},
	}
);

/* ============================================================================
   TYPES
   ============================================================================ */

interface RippleEffect {
	x: number;
	y: number;
	size: number;
	id: number;
}

export interface ButtonAdvancedProps
	extends Omit<
			React.ButtonHTMLAttributes<HTMLButtonElement>,
			'onDrag' | 'onDragStart' | 'onDragEnd'
		>,
		VariantProps<typeof buttonVariants> {
	loading?: boolean;
	leftIcon?: React.ReactNode;
	rightIcon?: React.ReactNode;
	magnetic?: boolean;
	ripple?: boolean;
	shine?: boolean;
}

/* ============================================================================
   BUTTON COMPONENT
   ============================================================================ */

export const ButtonAdvanced = React.forwardRef<
	HTMLButtonElement,
	ButtonAdvancedProps
>(
	(
		{
			className,
			variant,
			size,
			fullWidth,
			children,
			loading = false,
			disabled,
			leftIcon,
			rightIcon,
			magnetic = true,
			ripple = true,
			shine = true,
			onClick,
			...props
		},
		ref
	) => {
		// Ripple effect state
		const [ripples, setRipples] = useState<RippleEffect[]>([]);
		const rippleCounter = useRef(0);

		// Magnetic hover effect
		const buttonRef = useRef<HTMLButtonElement>(null);
		const x = useMotionValue(0);
		const y = useMotionValue(0);

		// Smooth spring animation for magnetic effect (60 FPS)
		const springConfig = { damping: 20, stiffness: 300 };
		const xSpring = useSpring(x, springConfig);
		const ySpring = useSpring(y, springConfig);

		// Transform for 3D tilt effect
		const rotateX = useTransform(ySpring, [-0.5, 0.5], [5, -5]);
		const rotateY = useTransform(xSpring, [-0.5, 0.5], [-5, 5]);

		/* ========================================================================
       MAGNETIC HOVER EFFECT
       ======================================================================== */

		const handleMouseMove = useCallback(
			(e: MouseEvent<HTMLButtonElement>) => {
				if (!magnetic || disabled || loading) {
					return;
				}

				const button = buttonRef.current;
				if (!button) {
					return;
				}

				const rect = button.getBoundingClientRect();
				const centerX = rect.left + rect.width / 2;
				const centerY = rect.top + rect.height / 2;

				// Calculate normalized distance from center (-1 to 1)
				const distanceX = (e.clientX - centerX) / (rect.width / 2);
				const distanceY = (e.clientY - centerY) / (rect.height / 2);

				// Apply magnetic pull effect
				x.set(distanceX * 0.3);
				y.set(distanceY * 0.3);
			},
			[magnetic, disabled, loading, x, y]
		);

		const handleMouseLeave = useCallback(() => {
			x.set(0);
			y.set(0);
		}, [x, y]);

		/* ========================================================================
       RIPPLE EFFECT
       ======================================================================== */

		const handleRipple = useCallback(
			(e: MouseEvent<HTMLButtonElement>) => {
				if (!ripple || disabled || loading) {
					return;
				}

				const button = buttonRef.current;
				if (!button) {
					return;
				}

				const rect = button.getBoundingClientRect();
				const size = Math.max(rect.width, rect.height);
				const x = e.clientX - rect.left - size / 2;
				const y = e.clientY - rect.top - size / 2;

				const newRipple: RippleEffect = {
					x,
					y,
					size,
					id: rippleCounter.current++,
				};

				setRipples((prev) => [...prev, newRipple]);

				// Remove ripple after animation completes
				setTimeout(() => {
					setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
				}, 600);
			},
			[ripple, disabled, loading]
		);

		const handleClick = useCallback(
			(e: MouseEvent<HTMLButtonElement>) => {
				handleRipple(e);
				onClick?.(e);
			},
			[handleRipple, onClick]
		);

		/* ========================================================================
       RENDER
       ======================================================================== */

		return (
			<motion.button
				ref={(node) => {
					buttonRef.current = node;
					if (typeof ref === 'function') {
						ref(node);
					} else if (ref) {
						ref.current = node;
					}
				}}
				className={cn(buttonVariants({ variant, size, fullWidth, className }))}
				disabled={disabled || loading}
				onClick={handleClick}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
				style={
					magnetic
						? {
								x: xSpring,
								y: ySpring,
								rotateX,
								rotateY,
								transformStyle: 'preserve-3d',
							}
						: undefined
				}
				whileHover={!disabled && !loading ? { scale: 1.02 } : undefined}
				whileTap={!disabled && !loading ? { scale: 0.98 } : undefined}
				transition={{ duration: 0.15, ease: 'easeOut' as const }}
				{...(props as HTMLMotionProps<'button'>)}
			>
				{/* Ripple Effects */}
				{ripples.map((ripple) => (
					<motion.span
						key={ripple.id}
						className="absolute rounded-full bg-white/30 pointer-events-none"
						style={{
							left: ripple.x,
							top: ripple.y,
							width: ripple.size,
							height: ripple.size,
						}}
						initial={{ scale: 0, opacity: 1 }}
						animate={{ scale: 2, opacity: 0 }}
						transition={{ duration: 0.6, ease: 'easeOut' as const }}
					/>
				))}

				{/* Content */}
				<span className="relative z-10 flex items-center justify-center gap-2">
					{loading ? (
						<>
							<ArrowPathIcon className="w-4 h-4 animate-spin" />
							<span>Loading...</span>
						</>
					) : (
						<>
							{leftIcon && <span className="shrink-0">{leftIcon}</span>}
							{children}
							{rightIcon && <span className="shrink-0">{rightIcon}</span>}
						</>
					)}
				</span>

				{/* Shine effect on hover */}
				{shine && !disabled && !loading && (
					<motion.span
						className="absolute inset-0 opacity-0 bg-linear-to-r from-transparent via-white/20 to-transparent pointer-events-none"
						style={{ transform: 'translateX(-100%)' }}
						whileHover={{
							opacity: [0, 1, 0],
							x: ['0%', '200%'],
						}}
						transition={{ duration: 0.6, ease: 'easeInOut' as const }}
					/>
				)}

				{/* Glow effect on hover */}
				<motion.span
					className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0"
					style={{
						background:
							variant === 'primary'
								? 'radial-gradient(circle at center, rgba(168, 85, 247, 0.3), transparent 70%)'
								: variant === 'secondary'
									? 'radial-gradient(circle at center, rgba(59, 130, 246, 0.3), transparent 70%)'
									: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.1), transparent 70%)',
					}}
					whileHover={{ opacity: 1 }}
					transition={{ duration: 0.3 }}
				/>
			</motion.button>
		);
	}
);

ButtonAdvanced.displayName = 'ButtonAdvanced';

export default ButtonAdvanced;
