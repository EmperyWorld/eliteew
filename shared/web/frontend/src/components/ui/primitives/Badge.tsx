/**
 * Badge - Status Badge Component
 * Small badge for status indicators, counts, and labels
 *
 * @version 1.0.0
 * @date 2025-10-13
 *
 * Features:
 * - Color variants using design tokens
 * - Size variants
 * - Dot indicator
 * - Pill shape
 * - Glow effects
 *
 * Usage:
 * ```tsx
 * <Badge color="green" size="sm">Active</Badge>
 * <Badge color="red" dot>3</Badge>
 * <Badge color="purple" glow>New</Badge>
 * ```
 */

import * as React from 'react';
import { forwardRef, type HTMLAttributes, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '@/styles/tokens';
import { colorWithOpacity, getGlowShadow } from '@/utils/designHelpers';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type BadgeColor =
	| 'pink'
	| 'purple'
	| 'blue'
	| 'green'
	| 'amber'
	| 'cyan'
	| 'red'
	| 'slate';
type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';
type BadgeVariant = 'solid' | 'subtle' | 'outline-solid';

interface BadgeProps
	extends Omit<
		HTMLAttributes<HTMLSpanElement>,
		| 'onDrag'
		| 'onDragEnd'
		| 'onDragStart'
		| 'onAnimationStart'
		| 'onAnimationEnd'
		| 'onAnimationIteration'
	> {
	color?: BadgeColor;
	size?: BadgeSize;
	variant?: BadgeVariant;
	dot?: boolean;
	glow?: boolean;
	children?: React.ReactNode;
}

// ============================================================================
// STYLE BUILDERS
// ============================================================================

const sizeStyles: Record<BadgeSize, CSSProperties> = {
	xs: {
		fontSize: tokens.typography.fontSize.xs,
		padding: `${tokens.spacing[0.5]} ${tokens.spacing[2]}`,
		height: '18px',
	},
	sm: {
		fontSize: tokens.typography.fontSize.xs,
		padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
		height: '20px',
	},
	md: {
		fontSize: tokens.typography.fontSize.sm,
		padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
		height: '24px',
	},
	lg: {
		fontSize: tokens.typography.fontSize.sm,
		padding: `${tokens.spacing[1.5]} ${tokens.spacing[4]}`,
		height: '28px',
	},
};

function getColorValue(color: BadgeColor): string {
	if (color === 'red') {
		return tokens.colors.semantic.error;
	}
	if (color === 'slate') {
		return tokens.colors.slate[500];
	}
	return tokens.colors.marketing[
		color as keyof typeof tokens.colors.marketing
	][500];
}

function getBadgeStyles(
	color: BadgeColor,
	size: BadgeSize,
	variant: BadgeVariant,
	glow: boolean
): CSSProperties {
	const colorValue = getColorValue(color);

	const baseStyles: CSSProperties = {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: tokens.spacing[1],
		borderRadius: tokens.radius.full,
		fontWeight: tokens.typography.fontWeight.medium,
		lineHeight: tokens.typography.lineHeight.none,
		whiteSpace: 'nowrap',
		transition: `all ${tokens.animation.duration.normal} ${tokens.animation.easing.out}`,
		...sizeStyles[size],
	};

	switch (variant) {
		case 'solid':
			return {
				...baseStyles,
				background: colorValue,
				color: tokens.colors.white[100],
				border: 'none',
				boxShadow: glow
					? getGlowShadow(
							color === 'cyan' || color === 'red' || color === 'slate'
								? 'blue'
								: color,
							'sm'
						)
					: 'none',
			};

		case 'subtle':
			return {
				...baseStyles,
				background: colorWithOpacity(colorValue, 0.1),
				color: colorValue,
				border: `1px solid ${colorWithOpacity(colorValue, 0.3)}`,
				boxShadow: 'none',
			};

		case 'outline-solid':
			return {
				...baseStyles,
				background: 'transparent',
				color: colorValue,
				border: `1px solid ${colorValue}`,
				boxShadow: 'none',
			};

		default:
			return baseStyles;
	}
}

// ============================================================================
// DOT INDICATOR
// ============================================================================

const DotIndicator: React.FC<{ color: string; size: BadgeSize }> = ({
	color,
	size,
}) => {
	const dotSize = size === 'xs' || size === 'sm' ? '6px' : '8px';

	return (
		<motion.span
			style={{
				width: dotSize,
				height: dotSize,
				borderRadius: tokens.radius.full,
				background: color,
				display: 'inline-block',
			}}
			animate={{ scale: [1, 1.2, 1] }}
			transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' as const }}
		/>
	);
};

// ============================================================================
// BADGE COMPONENT
// ============================================================================

/**
 * Badge component with design token integration
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
	(
		{
			color = 'purple',
			size = 'sm',
			variant = 'solid',
			dot = false,
			glow = false,
			children,
			style,
			className = '',
			...props
		},
		ref
	) => {
		const badgeStyles = getBadgeStyles(color, size, variant, glow);
		const colorValue = getColorValue(color);

		const computedStyles: CSSProperties = {
			...badgeStyles,
			...style,
		};

		return (
			<motion.span
				ref={ref}
				className={`badge badge-${color} badge-${size} badge-${variant} ${className}`}
				style={computedStyles}
				initial={{ opacity: 0, scale: 0.8 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{
					duration: parseFloat(tokens.animation.duration.fast) / 1000,
					ease: [0, 0, 0.2, 1],
				}}
				{...props}
			>
				{dot && (
					<DotIndicator
						color={variant === 'solid' ? tokens.colors.white[100] : colorValue}
						size={size}
					/>
				)}
				{children}
			</motion.span>
		);
	}
);

Badge.displayName = 'Badge';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { BadgeProps, BadgeColor, BadgeSize, BadgeVariant };
