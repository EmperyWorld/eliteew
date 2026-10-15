/**
 * Button - Primitive Component
 * Flexible button with variants, sizes, and polymorphic support
 *
 * @version 1.0.0
 * @date 2025-10-13
 *
 * Features:
 * - Multiple variants using design tokens
 * - Size variants
 * - Loading states
 * - Icon support (left/right)
 * - Polymorphic (button, a, Link)
 * - Full accessibility
 * - Forwarded refs
 *
 * Usage:
 * ```tsx
 * <Button variant="primary" size="md">Click me</Button>
 * <Button variant="secondary" size="lg" leftIcon={<Icon />}>Action</Button>
 * <Button variant="ghost" loading>Loading...</Button>
 * <Button as="a" href="/path" variant="primary">Link Button</Button>
 * ```
 */

import * as React from 'react';
import {
	forwardRef,
	type ElementType,
	type ComponentPropsWithRef,
	type CSSProperties,
} from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { tokens } from '@/styles/tokens';
import {
	getGradient,
	combineShadows,
	getGlowShadow,
} from '@/utils/designHelpers';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ButtonVariant =
	| 'primary'
	| 'secondary'
	| 'ghost'
	| 'danger'
	| 'success'
	| 'gradient';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonOwnProps {
	as?: ElementType;
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	disabled?: boolean;
	leftIcon?: React.ReactNode;
	rightIcon?: React.ReactNode;
	fullWidth?: boolean;
	glow?: boolean;
	children?: React.ReactNode;
}

type ButtonProps<C extends ElementType = 'button'> = ButtonOwnProps &
	Omit<ComponentPropsWithRef<C>, keyof ButtonOwnProps>;

// ============================================================================
// STYLE BUILDERS
// ============================================================================

function getButtonStyles(
	variant: ButtonVariant,
	size: ButtonSize,
	disabled: boolean,
	fullWidth: boolean,
	glow: boolean
): CSSProperties {
	const baseStyles: CSSProperties = {
		height: tokens.components.button.height[size],
		padding: tokens.components.button.padding[size],
		fontSize:
			tokens.typography.fontSize[
				size === 'md' ? 'base' : size === 'sm' ? 'sm' : 'lg'
			],
		fontWeight: tokens.typography.fontWeight.medium,
		borderRadius: tokens.radius.lg,
		border: 'none',
		outline: 'none',
		cursor: disabled ? 'not-allowed' : 'pointer',
		transition: `all ${tokens.animation.duration.normal} cubic-bezier(0, 0, 0.2, 1)`,
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: tokens.spacing[2],
		width: fullWidth ? '100%' : 'auto',
		opacity: disabled ? 0.5 : 1,
		textDecoration: 'none',
		position: 'relative',
		overflow: 'hidden',
	};

	switch (variant) {
		case 'primary':
			return {
				...baseStyles,
				background: tokens.colors.marketing.purple[500],
				color: tokens.colors.white[100],
				boxShadow: glow
					? combineShadows(
							tokens.shadows.md,
							getGlowShadow('purple', 'default')
						)
					: tokens.shadows.md,
			};

		case 'secondary':
			return {
				...baseStyles,
				background: tokens.glass.background.default,
				backdropFilter: `blur(${tokens.glass.blur.default})`,
				border: `1px solid ${tokens.glass.border.default}`,
				color: tokens.colors.white[100],
				boxShadow: tokens.shadows.sm,
			};

		case 'ghost':
			return {
				...baseStyles,
				background: 'transparent',
				color: tokens.colors.white[80],
				boxShadow: 'none',
			};

		case 'danger':
			return {
				...baseStyles,
				background: tokens.colors.semantic.error,
				color: tokens.colors.white[100],
				boxShadow: tokens.shadows.md,
			};

		case 'success':
			return {
				...baseStyles,
				background: tokens.colors.semantic.success,
				color: tokens.colors.white[100],
				boxShadow: tokens.shadows.md,
			};

		case 'gradient':
			return {
				...baseStyles,
				background: getGradient('primary'),
				color: tokens.colors.white[100],
				boxShadow: glow
					? combineShadows(tokens.shadows.md, getGlowShadow('pink', 'default'))
					: tokens.shadows.md,
			};

		default:
			return baseStyles;
	}
}

// ============================================================================
// LOADING SPINNER
// ============================================================================

const LoadingSpinner: React.FC<{ size: ButtonSize }> = ({ size }) => {
	const spinnerSize = size === 'sm' ? '14px' : size === 'md' ? '16px' : '20px';

	return (
		<div
			className="ew-spinner-ring"
			style={{
				width: spinnerSize,
				height: spinnerSize,
				borderWidth: '2px',
				borderStyle: 'solid',
				borderColor: tokens.colors.white[30],
				borderTopColor: tokens.colors.white[100],
			}}
		/>
	);
};

// ============================================================================
// BUTTON COMPONENT
// ============================================================================

/**
 * Button primitive component with design token integration
 */
const ButtonInner = forwardRef(
	<C extends ElementType = 'button'>(
		props: ButtonProps<C>,
		ref: React.Ref<HTMLButtonElement>
	): React.ReactElement | null => {
		const {
			as,
			variant = 'primary',
			size = 'md',
			loading = false,
			disabled = false,
			leftIcon,
			rightIcon,
			fullWidth = false,
			glow = false,
			children,
			style: customStyle,
			className = '',
			...restProps
		} = props;

		const buttonStyles = getButtonStyles(
			variant,
			size,
			disabled || loading,
			fullWidth,
			glow
		);

		const computedStyles: CSSProperties = {
			...buttonStyles,
			...customStyle,
		};

		const hoverAnimation =
			!disabled && !loading
				? {
						scale: tokens.animation.scale.hover,
						boxShadow:
							variant === 'primary' || variant === 'gradient'
								? combineShadows(
										tokens.shadows.lg,
										getGlowShadow(
											variant === 'gradient' ? 'pink' : 'purple',
											'lg'
										)
									)
								: tokens.shadows.lg,
					}
				: {};

		const tapAnimation =
			!disabled && !loading ? { scale: tokens.animation.scale.active } : {};

		return (
			<motion.button
				ref={ref}
				className={cn(
					`button button-${variant} button-${size}`,
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
					className
				)}
				style={computedStyles}
				disabled={disabled || loading}
				whileHover={hoverAnimation}
				whileTap={tapAnimation}
				transition={{
					duration: parseFloat(tokens.animation.duration.fast) / 1000,
					ease: [0, 0, 0.2, 1],
				}}
				{...restProps}
			>
				{loading && <LoadingSpinner size={size} />}
				{!loading && leftIcon && (
					<span className="button-icon-left">{leftIcon}</span>
				)}
				{children && <span className="button-content">{children}</span>}
				{!loading && rightIcon && (
					<span className="button-icon-right">{rightIcon}</span>
				)}
			</motion.button>
		);
	}
);

ButtonInner.displayName = 'Button';

export const Button = ButtonInner as <C extends ElementType = 'button'>(
	props: ButtonProps<C> & { ref?: React.Ref<HTMLButtonElement> }
) => React.ReactElement | null;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { ButtonProps, ButtonOwnProps, ButtonVariant, ButtonSize };
