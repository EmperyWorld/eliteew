/**
 * IconContainer - Icon Wrapper Component
 * Colored containers for icons with size and shape variants
 *
 * @version 1.0.0
 * @date 2025-10-13
 *
 * Features:
 * - Color variants using design tokens
 * - Size variants
 * - Shape variants (circle, rounded, square)
 * - Glow effects
 * - Responsive icon sizing
 *
 * Usage:
 * ```tsx
 * <IconContainer color="pink" size="md" shape="circle">
 *   <Target />
 * </IconContainer>
 *
 * <IconContainer color="purple" size="lg" shape="rounded" glow>
 *   <Sparkles />
 * </IconContainer>
 * ```
 */

import * as React from 'react';
import { forwardRef, type CSSProperties, type HTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '@/styles/tokens';
import { getGlowShadow, colorWithOpacity } from '@/utils/designHelpers';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type IconColor = 'pink' | 'purple' | 'blue' | 'green' | 'amber' | 'cyan';
type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type IconShape = 'circle' | 'rounded-sm' | 'square';

interface IconContainerProps
	extends Omit<
		HTMLAttributes<HTMLDivElement>,
		| 'onDrag'
		| 'onDragEnd'
		| 'onDragStart'
		| 'onAnimationStart'
		| 'onAnimationEnd'
		| 'onAnimationIteration'
	> {
	color?: IconColor;
	size?: IconSize;
	shape?: IconShape;
	glow?: boolean;
	children: React.ReactNode;
}

// ============================================================================
// STYLE BUILDERS
// ============================================================================

const sizeMap: Record<IconSize, { container: string; icon: string }> = {
	xs: { container: '2rem', icon: tokens.components.icon.xs },
	sm: { container: '2.5rem', icon: tokens.components.icon.sm },
	md: { container: '3rem', icon: tokens.components.icon.md },
	lg: { container: '3.5rem', icon: tokens.components.icon.lg },
	xl: { container: '4rem', icon: tokens.components.icon.xl },
};

function getIconContainerStyles(
	color: IconColor,
	size: IconSize,
	shape: IconShape,
	glow: boolean
): CSSProperties {
	const colorValue = tokens.colors.marketing[color][500];

	// Map IconColor to GlowColor for getGlowShadow (cyan -> blue)
	const glowColorMap: Record<
		IconColor,
		'pink' | 'purple' | 'blue' | 'green' | 'amber'
	> = {
		pink: 'pink',
		purple: 'purple',
		blue: 'blue',
		green: 'green',
		amber: 'amber',
		cyan: 'blue', // Map cyan to blue for glow effects
	};

	const baseStyles: CSSProperties = {
		width: sizeMap[size].container,
		height: sizeMap[size].container,
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		background: colorWithOpacity(colorValue, 0.1),
		border: `1px solid ${colorWithOpacity(colorValue, 0.3)}`,
		color: colorValue,
		transition: `all ${tokens.animation.duration.normal} cubic-bezier(0, 0, 0.2, 1)`,
		boxShadow: glow ? getGlowShadow(glowColorMap[color], 'sm') : 'none',
	};

	switch (shape) {
		case 'circle':
			return {
				...baseStyles,
				borderRadius: tokens.radius.full,
			};

		case 'rounded-sm':
			return {
				...baseStyles,
				borderRadius: tokens.radius.lg,
			};

		case 'square':
			return {
				...baseStyles,
				borderRadius: tokens.radius.none,
			};

		default:
			return baseStyles;
	}
}

// ============================================================================
// ICON CONTAINER COMPONENT
// ============================================================================

/**
 * IconContainer - Colored container for icons
 */
export const IconContainer = forwardRef<HTMLDivElement, IconContainerProps>(
	(
		{
			color = 'pink',
			size = 'md',
			shape = 'rounded-sm',
			glow = false,
			children,
			style,
			className = '',
			...props
		},
		ref
	) => {
		const containerStyles = getIconContainerStyles(color, size, shape, glow);
		const iconSize = sizeMap[size].icon;

		// Map IconColor to GlowColor for hover effect
		const glowColorMap: Record<
			IconColor,
			'pink' | 'purple' | 'blue' | 'green' | 'amber'
		> = {
			pink: 'pink',
			purple: 'purple',
			blue: 'blue',
			green: 'green',
			amber: 'amber',
			cyan: 'blue', // Map cyan to blue for glow effects
		};

		const computedStyles: CSSProperties = {
			...containerStyles,
			...style,
		};

		return (
			<motion.div
				ref={ref}
				className={`icon-container icon-container-${color} icon-container-${size} ${className}`}
				style={computedStyles}
				whileHover={{
					scale: tokens.animation.scale.hover,
					boxShadow: glow
						? getGlowShadow(glowColorMap[color], 'default')
						: tokens.shadows.md,
				}}
				transition={{
					duration: parseFloat(tokens.animation.duration.fast) / 1000,
					ease: [0, 0, 0.2, 1],
				}}
				{...props}
			>
				<div
					style={{
						width: iconSize,
						height: iconSize,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					{children}
				</div>
			</motion.div>
		);
	}
);

IconContainer.displayName = 'IconContainer';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { IconContainerProps, IconColor, IconSize, IconShape };
