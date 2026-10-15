/**
 * 🔥 CARD V2 - React UI God Edition
 *
 * Production-ready card component с:
 * - Compound Component Pattern (Card.Header, Card.Body, Card.Footer)
 * - Hover animations (lift effect, glow)
 * - Glassmorphism design
 * - Multiple variants
 * - Interactive states
 * - Accessibility
 *
 * @version 2.0.0
 * @author React UI God
 */

import * as React from 'react';
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cva, type VariantProps } from '@/utils/cva';
import { cn } from '../../utils/cn';

// ============================================================================
// VARIANTS DEFINITION (CVA)
// ============================================================================

const cardVariants = cva(
	// Base styles
	`
    rounded-2xl overflow-hidden
    transition-all duration-300
    border-2
  `,
	{
		variants: {
			// ========================================
			// VARIANT (стиль)
			// ========================================
			variant: {
				default: `
          bg-linear-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90
          backdrop-blur-xl
          border-white/10
          shadow-xl shadow-black/20
        `,
				glassmorphism: `
          bg-white/5 backdrop-blur-2xl
          border-white/20
          shadow-2xl shadow-black/30
        `,
				gradient: `
          bg-linear-to-br from-purple-900/40 via-blue-900/40 to-cyan-900/40
          backdrop-blur-xl
          border-purple-500/30
          shadow-2xl shadow-purple-900/40
        `,
				bordered: `
          bg-slate-900/60
          backdrop-blur-md
          border-white/30
          shadow-lg shadow-black/20
        `,
				elevated: `
          bg-linear-to-br from-slate-800 via-slate-900 to-slate-800
          border-slate-700/50
          shadow-2xl shadow-black/50
        `,
			},

			// ========================================
			// PADDING
			// ========================================
			padding: {
				none: 'p-0',
				sm: 'p-4',
				md: 'p-6',
				lg: 'p-8',
			},

			// ========================================
			// HOVER EFFECT
			// ========================================
			hoverEffect: {
				none: '',
				lift: 'hover:-translate-y-2 hover:shadow-2xl',
				glow: 'hover:shadow-2xl hover:border-white/30',
				scale: 'hover:scale-[1.02]',
			},

			// ========================================
			// INTERACTIVE (clickable)
			// ========================================
			interactive: {
				true: 'cursor-pointer active:scale-[0.98]',
				false: '',
			},
		},
		defaultVariants: {
			variant: 'default',
			padding: 'md',
			hoverEffect: 'lift',
			interactive: false,
		},
	}
);

// ============================================================================
// TYPES
// ============================================================================

type CardVariantsType = VariantProps<typeof cardVariants>;

export interface CardV2Props
	extends Omit<
			HTMLAttributes<HTMLDivElement>,
			| 'onClick'
			| 'onDrag'
			| 'onDragStart'
			| 'onDragEnd'
			| 'onAnimationStart'
			| 'onAnimationEnd'
		>,
		CardVariantsType {
	/** Дети */
	children: ReactNode;
	/** Click handler (makes card interactive automatically) */
	onClick?: () => void;
	/** Кастомный className */
	className?: string;
}

interface CardSubComponentProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const CardV2Root = forwardRef<HTMLDivElement, CardV2Props>(
	(
		{
			variant,
			padding,
			hoverEffect,
			interactive,
			onClick,
			children,
			className,
			...props
		},
		ref
	) => {
		// Если есть onClick, делаем карточку interactive
		const isInteractive = interactive || !!onClick;

		return (
			<motion.div
				ref={ref}
				className={cn(
					cardVariants({
						variant,
						padding,
						hoverEffect,
						interactive: isInteractive,
					}),
					className
				)}
				onClick={onClick}
				whileHover={
					isInteractive
						? {
								y: -4,
								transition: { type: 'spring', stiffness: 400, damping: 25 },
							}
						: undefined
				}
				whileTap={isInteractive ? { scale: 0.98 } : undefined}
				role={onClick ? 'button' : undefined}
				tabIndex={onClick ? 0 : undefined}
				onKeyDown={
					onClick
						? (e: React.KeyboardEvent<HTMLDivElement>): void => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									onClick();
								}
							}
						: undefined
				}
				{...props}
			>
				{children}
			</motion.div>
		);
	}
);

CardV2Root.displayName = 'CardV2';

// ============================================================================
// SUB-COMPONENTS (Compound Component Pattern)
// ============================================================================

export const CardHeader = forwardRef<HTMLDivElement, CardSubComponentProps>(
	({ children, className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn('px-6 py-4 border-b border-white/10', className)}
			{...props}
		>
			{children}
		</div>
	)
);

CardHeader.displayName = 'CardHeader';

export const CardBody = forwardRef<HTMLDivElement, CardSubComponentProps>(
	({ children, className, ...props }, ref) => (
		<div ref={ref} className={cn('px-6 py-4', className)} {...props}>
			{children}
		</div>
	)
);

CardBody.displayName = 'CardBody';

export const CardFooter = forwardRef<HTMLDivElement, CardSubComponentProps>(
	({ children, className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn('px-6 py-4 border-t border-white/10', className)}
			{...props}
		>
			{children}
		</div>
	)
);

CardFooter.displayName = 'CardFooter';

export const CardTitle = forwardRef<HTMLHeadingElement, CardSubComponentProps>(
	({ children, className, ...props }, ref) => (
		<h3
			ref={ref}
			className={cn('text-xl font-bold text-white mb-1', className)}
			{...props}
		>
			{children}
		</h3>
	)
);

CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<
	HTMLParagraphElement,
	CardSubComponentProps
>(({ children, className, ...props }, ref) => (
	<p ref={ref} className={cn('text-sm text-white/60', className)} {...props}>
		{children}
	</p>
));

CardDescription.displayName = 'CardDescription';

// ============================================================================
// COMPOSE SUB-COMPONENTS WITH PROPER TYPING
// ============================================================================

export interface CardV2Compound
	extends React.ForwardRefExoticComponent<
		CardV2Props & React.RefAttributes<HTMLDivElement>
	> {
	Header: typeof CardHeader;
	Body: typeof CardBody;
	Footer: typeof CardFooter;
	Title: typeof CardTitle;
	Description: typeof CardDescription;
}

export const CardV2 = CardV2Root as CardV2Compound;

CardV2.Header = CardHeader;
CardV2.Body = CardBody;
CardV2.Footer = CardFooter;
CardV2.Title = CardTitle;
CardV2.Description = CardDescription;

// ============================================================================
// EXPORTS
// ============================================================================

export { cardVariants };
export type { CardVariantsType, CardSubComponentProps };
