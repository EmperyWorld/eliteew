/**
 * 🔥 BUTTON V2 - React UI God Edition
 *
 * Production-ready button component с:
 * - CVA (class-variance-authority) для variants
 * - Polymorphic component (as prop)
 * - Framer Motion animations (60fps)
 * - Loading states с анимацией
 * - Icon support (left/right)
 * - Accessibility (ARIA, keyboard nav)
 * - Multiple variants и sizes
 *
 * @version 2.0.0
 * @author React UI God
 */

import { cva, type VariantProps } from '@/utils/cva';
import { motion } from 'framer-motion';
import * as React from 'react';
import {
	forwardRef,
	createElement,
	type ComponentPropsWithRef,
	type ElementType,
	type Ref,
} from 'react';
import { cn } from '../../utils/cn';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

// ============================================================================
// VARIANTS DEFINITION (CVA)
// ============================================================================

const buttonVariants = cva(
	// Base styles (всегда применяются)
	`
    inline-flex items-center justify-center gap-2
    font-semibold rounded-xl
    transition-all duration-200
    focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
    disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
    active:scale-95
  `,
	{
		variants: {
			// ========================================
			// VARIANT (цветовая схема)
			// ========================================
			variant: {
				primary: `
          bg-linear-to-r from-blue-600 to-blue-700
          hover:from-blue-700 hover:to-blue-800
          text-white shadow-lg shadow-blue-900/30
          border border-blue-500/30
          focus-visible:ring-blue-500/50
        `,
				secondary: `
          bg-linear-to-r from-emerald-500 to-emerald-600
          hover:from-emerald-600 hover:to-emerald-700
          text-white shadow-lg shadow-emerald-900/30
          border border-emerald-500/30
          focus-visible:ring-emerald-500/50
        `,
				success: `
          bg-linear-to-r from-green-600 to-green-700
          hover:from-green-700 hover:to-green-800
          text-white shadow-lg shadow-green-900/30
          border border-green-500/30
          focus-visible:ring-green-500/50
        `,
				danger: `
          bg-linear-to-r from-red-600 to-red-700
          hover:from-red-700 hover:to-red-800
          text-white shadow-lg shadow-red-900/30
          border border-red-500/30
          focus-visible:ring-red-500/50
        `,
				warning: `
          bg-linear-to-r from-yellow-500 to-yellow-600
          hover:from-yellow-600 hover:to-yellow-700
          text-white shadow-lg shadow-yellow-900/30
          border border-yellow-500/30
          focus-visible:ring-yellow-500/50
        `,
				ghost: `
          bg-transparent hover:bg-white/10
          text-white/80 hover:text-white
          border border-white/10 hover:border-white/20
          backdrop-blur-xs
          focus-visible:ring-white/50
        `,
				outline: `
          bg-transparent hover:bg-white/5
          text-white border-2 border-white/30
          hover:border-white/50
          focus-visible:ring-white/50
        `,
				gradient: `
          bg-linear-to-r from-emerald-500 via-cyan-500 to-blue-500
          hover:from-emerald-600 hover:via-cyan-600 hover:to-blue-600
          text-white shadow-lg shadow-emerald-900/40
          border border-emerald-400/30
          focus-visible:ring-emerald-500/50
        `,
				glassmorphism: `
          bg-white/10 hover:bg-white/20
          text-white backdrop-blur-xl
          border border-white/20 hover:border-white/30
          shadow-2xl
          focus-visible:ring-white/50
        `,
			},

			// ========================================
			// SIZE
			// ========================================
			size: {
				xs: 'px-2.5 py-1.5 text-xs',
				sm: 'px-3 py-2 text-sm',
				md: 'px-4 py-2.5 text-base',
				lg: 'px-6 py-3 text-lg',
				xl: 'px-8 py-4 text-xl',
				icon: 'p-2.5', // Квадратная кнопка для иконок
			},

			// ========================================
			// FULL WIDTH
			// ========================================
			fullWidth: {
				true: 'w-full',
				false: '',
			},

			// ========================================
			// LOADING STATE
			// ========================================
			loading: {
				true: 'cursor-wait',
				false: '',
			},
		},
		defaultVariants: {
			variant: 'primary',
			size: 'md',
			fullWidth: false,
			loading: false,
		},
	}
);

// ============================================================================
// TYPES
// ============================================================================

type ButtonVariantsType = VariantProps<typeof buttonVariants>;

// Polymorphic component type (позволяет использовать as="a", as="Link", etc.)
type PolymorphicProps<E extends ElementType = ElementType> = {
	as?: E;
};

type ButtonOwnProps<E extends ElementType = ElementType> = PolymorphicProps<E> &
	ButtonVariantsType & {
		/** Иконка слева */
		iconLeft?: React.ReactNode;
		/** Иконка справа */
		iconRight?: React.ReactNode;
		/** @deprecated Use iconLeft. Иконка слева (alias) */
		leftIcon?: React.ReactNode;
		/** @deprecated Use iconRight. Иконка справа (alias) */
		rightIcon?: React.ReactNode;
		/** Только иконка (без текста) */
		iconOnly?: React.ReactNode;
		/** Состояние загрузки */
		loading?: boolean;
		/** Текст при загрузке */
		loadingText?: string;
	};

type ButtonProps<E extends ElementType> = ButtonOwnProps<E> &
	Omit<ComponentPropsWithRef<E>, keyof ButtonOwnProps>;

// Default element type
const defaultElement = 'button';

// ============================================================================
// COMPONENT
// ============================================================================

const ButtonV2Impl = forwardRef(function ButtonV2Inner<
	E extends ElementType = typeof defaultElement,
>(
	{
		as,
		variant,
		size,
		fullWidth,
		loading,
		loadingText,
		iconLeft: iconLeftProp,
		iconRight: iconRightProp,
		leftIcon,
		rightIcon,
		iconOnly,
		className,
		children,
		disabled,
		...props
	}: ButtonProps<E>,
	ref: Ref<Element>
) {
	const Component = (as || defaultElement) as ElementType;
	const iconLeft = iconLeftProp ?? leftIcon;
	const iconRight = iconRightProp ?? rightIcon;

	// ========================================
	// RENDER CONTENT
	// ========================================

	const renderContent = (): React.ReactNode => {
		// Loading state
		if (loading) {
			return (
				<>
					<motion.div
						animate={{ rotate: 360 }}
						transition={{
							duration: 1,
							repeat: Infinity,
							ease: 'linear' as const,
						}}
					>
						<ArrowPathIcon className="w-4 h-4" />
					</motion.div>
					{loadingText && <span>{loadingText}</span>}
				</>
			);
		}

		// Icon only mode
		if (iconOnly) {
			return <span className="shrink-0">{iconOnly}</span>;
		}

		// Normal mode with optional icons
		return (
			<>
				{iconLeft && <span className="shrink-0">{iconLeft}</span>}
				{children && <span>{children}</span>}
				{iconRight && <span className="shrink-0">{iconRight}</span>}
			</>
		);
	};

	const isNativeButton = Component === defaultElement;

	return (
		<motion.div
			whileTap={!disabled && !loading ? { scale: 0.95 } : undefined}
			whileHover={!disabled && !loading ? { scale: 1.02 } : undefined}
			transition={{ type: 'spring', stiffness: 400, damping: 17 }}
			className="inline-block"
			style={{ width: fullWidth ? '100%' : 'auto' }}
		>
			{createElement(
				Component,
				{
					ref,
					className: cn(
						buttonVariants({ variant, size, fullWidth, loading }),
						className
					),
					...(isNativeButton ? { disabled: disabled || loading } : {}),
					...props,
				},
				renderContent()
			)}
		</motion.div>
	);
});

ButtonV2Impl.displayName = 'ButtonV2';

// Type cast for polymorphic component
export const ButtonV2 = ButtonV2Impl as <
	E extends ElementType = typeof defaultElement,
>(
	props: ButtonProps<E> & { ref?: Ref<Element> }
) => React.ReactElement;

// ============================================================================
// EXPORTS
// ============================================================================

export { buttonVariants };
export type { ButtonProps, ButtonVariantsType };
