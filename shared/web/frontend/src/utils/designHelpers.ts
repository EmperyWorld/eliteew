/**
 * Design Helper Utilities
 * Helper functions for working with design tokens
 *
 * @version 1.0.0
 * @date 2025-10-13
 *
 * Usage:
 * import { colorWithOpacity, getGlassStyles } from '@/utils/designHelpers';
 * const styles = getGlassStyles('default');
 */

import type { CSSProperties } from 'react';
import { tokens } from '@/styles/tokens';

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Add opacity to a color value
 *
 * @param color - Hex color or RGB color
 * @param opacity - Opacity value (0-1)
 * @returns RGBA color string
 *
 * @example
 * colorWithOpacity('#ec4899', 0.5) // 'rgba(236, 72, 153, 0.5)'
 * colorWithOpacity('rgb(236, 72, 153)', 0.3) // 'rgba(236, 72, 153, 0.3)'
 */
export function colorWithOpacity(color: string, opacity: number): string {
	// Handle existing rgba
	if (color.startsWith('rgba')) {
		return color.replace(/[\d.]+\)$/g, `${opacity})`);
	}

	// Handle rgb
	if (color.startsWith('rgb')) {
		return color.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
	}

	// Handle hex
	if (color.startsWith('#')) {
		const hex = color.replace('#', '');
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}

	return color;
}

/**
 * Get a color scale from tokens
 *
 * @param colorName - Color name from tokens.colors.marketing
 * @returns Color scale object
 *
 * @example
 * const pinkScale = getColorScale('pink');
 * log.info(pinkScale[500]); // '#ec4899'
 */
export function getColorScale(colorName: keyof typeof tokens.colors.marketing) {
	return tokens.colors.marketing[colorName];
}

/**
 * Get a semantic color from tokens
 *
 * @param semantic - Semantic color name
 * @returns Color value
 *
 * @example
 * getSemanticColor('success') // '#10b981'
 */
export function getSemanticColor(
	semantic: keyof typeof tokens.colors.semantic
): string {
	return tokens.colors.semantic[semantic];
}

// ============================================================================
// GLASSMORPHISM UTILITIES
// ============================================================================

/**
 * Get glassmorphism styles as CSS properties
 *
 * @param variant - Glass variant ('light' | 'default' | 'strong' | 'darker')
 * @returns CSS properties object
 *
 * @example
 * const glassStyles = getGlassStyles('default');
 * <div style={glassStyles}>Glass card</div>
 */
export function getGlassStyles(
	variant: keyof typeof tokens.glass.background = 'default'
): CSSProperties {
	return {
		background: tokens.glass.background[variant],
		backdropFilter: `blur(${tokens.glass.blur.default})`,
		border: `1px solid ${tokens.glass.border.default}`,
	};
}

/**
 * Get glassmorphism background with custom blur
 *
 * @param variant - Background variant
 * @param blur - Blur variant
 * @returns CSS properties object
 *
 * @example
 * const styles = getGlassStylesWithBlur('strong', 'lg');
 */
export function getGlassStylesWithBlur(
	variant: keyof typeof tokens.glass.background = 'default',
	blur: keyof typeof tokens.glass.blur = 'default'
): CSSProperties {
	return {
		background: tokens.glass.background[variant],
		backdropFilter: `blur(${tokens.glass.blur[blur]})`,
		border: `1px solid ${tokens.glass.border.default}`,
	};
}

// ============================================================================
// SHADOW & GLOW UTILITIES
// ============================================================================

/**
 * Get a glow shadow effect
 *
 * @param color - Color name from marketing palette
 * @param intensity - Glow intensity ('sm' | 'default' | 'lg' | 'xl')
 * @returns Box shadow string
 *
 * @example
 * getGlowShadow('pink', 'lg') // '0 0 30px rgba(236, 72, 153, 0.5)'
 */
export function getGlowShadow(
	color: keyof typeof tokens.shadows.glow,
	intensity: keyof typeof tokens.shadows.glow.pink = 'default'
): string {
	return tokens.shadows.glow[color][intensity];
}

/**
 * Combine multiple shadows
 *
 * @param shadows - Array of shadow strings
 * @returns Combined shadow string
 *
 * @example
 * combineShadows([tokens.shadows.lg, getGlowShadow('pink', 'default')])
 */
export function combineShadows(...shadows: string[]): string {
	return shadows.join(', ');
}

// ============================================================================
// MOTION UTILITIES
// ============================================================================

/**
 * Get framer-motion animation values
 *
 * @param type - Animation type
 * @returns Framer Motion props
 *
 * @example
 * <motion.div {...getMotionValues('fade')}>Content</motion.div>
 */
export function getMotionValues(
	type: 'fade' | 'slide' | 'scale' | 'slideUp' | 'slideDown'
) {
	const baseTransition = {
		duration: parseFloat(tokens.animation.duration.normal) / 1000,
		// Framer Motion v11 expects either a function or [x1, y1, x2, y2] array, not CSS string.
		ease: [0, 0, 0.2, 1] as [number, number, number, number],
	};

	switch (type) {
		case 'fade':
			return {
				initial: { opacity: 0 },
				animate: { opacity: 1 },
				exit: { opacity: 0 },
				transition: baseTransition,
			};

		case 'slide':
			return {
				initial: {
					opacity: 0,
					x: parseFloat(tokens.animation.translate.slideIn),
				},
				animate: { opacity: 1, x: 0 },
				exit: {
					opacity: 0,
					x: -parseFloat(tokens.animation.translate.slideIn),
				},
				transition: baseTransition,
			};

		case 'slideUp':
			return {
				initial: {
					opacity: 0,
					y: parseFloat(tokens.animation.translate.slideIn),
				},
				animate: { opacity: 1, y: 0 },
				exit: {
					opacity: 0,
					y: -parseFloat(tokens.animation.translate.slideIn),
				},
				transition: baseTransition,
			};

		case 'slideDown':
			return {
				initial: {
					opacity: 0,
					y: -parseFloat(tokens.animation.translate.slideIn),
				},
				animate: { opacity: 1, y: 0 },
				exit: { opacity: 0, y: parseFloat(tokens.animation.translate.slideIn) },
				transition: baseTransition,
			};

		case 'scale':
			return {
				initial: { opacity: 0, scale: 0.9 },
				animate: { opacity: 1, scale: 1 },
				exit: { opacity: 0, scale: 0.9 },
				transition: baseTransition,
			};

		default:
			return {
				initial: { opacity: 0 },
				animate: { opacity: 1 },
				exit: { opacity: 0 },
				transition: baseTransition,
			};
	}
}

/**
 * Get hover motion values
 *
 * @returns Framer Motion whileHover props
 *
 * @example
 * <motion.button {...getHoverMotion()}>Hover me</motion.button>
 */
export function getHoverMotion() {
	return {
		whileHover: { scale: tokens.animation.scale.hover },
		whileTap: { scale: tokens.animation.scale.active },
		transition: { duration: parseFloat(tokens.animation.duration.fast) / 1000 },
	};
}

// ============================================================================
// SPACING UTILITIES
// ============================================================================

/**
 * Get spacing value from token
 *
 * @param size - Spacing size from tokens
 * @returns Spacing value as string
 *
 * @example
 * getSpacing(4) // '1rem'
 * getSpacing(6) // '1.5rem'
 */
export function getSpacing(size: keyof typeof tokens.spacing): string {
	return tokens.spacing[size];
}

/**
 * Create padding shorthand from spacing tokens
 *
 * @param values - Spacing values (1-4 values)
 * @returns Padding string
 *
 * @example
 * getPadding(4, 6) // '1rem 1.5rem'
 * getPadding(4) // '1rem'
 */
export function getPadding(
	...values: Array<keyof typeof tokens.spacing>
): string {
	return values.map((v) => tokens.spacing[v]).join(' ');
}

// ============================================================================
// GRADIENT UTILITIES
// ============================================================================

/**
 * Get marketing gradient
 *
 * @param variant - Gradient variant
 * @returns Gradient string
 *
 * @example
 * getGradient('primary') // 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)'
 */
export function getGradient(
	variant: keyof typeof tokens.gradients.marketing
): string {
	return tokens.gradients.marketing[variant];
}

/**
 * Create custom gradient from colors
 *
 * @param colors - Array of color stops
 * @param angle - Gradient angle in degrees
 * @returns Gradient string
 *
 * @example
 * createGradient(['#ec4899', '#8b5cf6'], 135)
 */
export function createGradient(colors: string[], angle = 135): string {
	const stops = colors
		.map((color, i) => {
			const percent = (i / (colors.length - 1)) * 100;
			return `${color} ${percent}%`;
		})
		.join(', ');

	return `linear-gradient(${angle}deg, ${stops})`;
}

// ============================================================================
// RESPONSIVE UTILITIES
// ============================================================================

/**
 * Create media query string
 *
 * @param breakpoint - Breakpoint name
 * @returns Media query string
 *
 * @example
 * const query = mediaQuery('md'); // '@media (min-width: 768px)'
 */
export function mediaQuery(
	breakpoint: keyof typeof tokens.breakpoints
): string {
	return `@media (min-width: ${tokens.breakpoints[breakpoint]})`;
}

// ============================================================================
// COMPONENT STYLE GENERATORS
// ============================================================================

/**
 * Generate button styles from tokens
 *
 * @param size - Button size
 * @param variant - Button variant
 * @returns CSS properties object
 */
export function getButtonStyles(
	size: 'sm' | 'md' | 'lg' = 'md',
	variant: 'primary' | 'secondary' | 'ghost' = 'primary'
): CSSProperties {
	const baseStyles: CSSProperties = {
		height: tokens.components.button.height[size],
		padding: tokens.components.button.padding[size],
		borderRadius: tokens.radius.lg,
		fontSize:
			tokens.typography.fontSize[
				size === 'md' ? 'base' : size === 'sm' ? 'sm' : 'lg'
			],
		fontWeight: tokens.typography.fontWeight.medium,
		transition: `all ${tokens.animation.duration.normal} ${tokens.animation.easing.out}`,
		cursor: 'pointer',
		border: 'none',
		outline: 'none',
	};

	switch (variant) {
		case 'primary':
			return {
				...baseStyles,
				background: tokens.gradients.marketing.primary,
				color: tokens.colors.white[100],
				boxShadow: tokens.shadows.md,
			};

		case 'secondary':
			return {
				...baseStyles,
				background: tokens.glass.background.default,
				backdropFilter: `blur(${tokens.glass.blur.default})`,
				border: `1px solid ${tokens.glass.border.default}`,
				color: tokens.colors.white[100],
			};

		case 'ghost':
			return {
				...baseStyles,
				background: 'transparent',
				color: tokens.colors.white[80],
			};

		default:
			return baseStyles;
	}
}

/**
 * Generate card styles from tokens
 *
 * @param variant - Card variant
 * @returns CSS properties object
 */
export function getCardStyles(
	variant: 'glass' | 'solid' | 'bordered' = 'glass'
): CSSProperties {
	const baseStyles: CSSProperties = {
		borderRadius: tokens.components.card.glass.borderRadius,
		padding: tokens.components.card.glass.padding,
	};

	switch (variant) {
		case 'glass':
			return {
				...baseStyles,
				background: tokens.glass.background.default,
				backdropFilter: `blur(${tokens.glass.blur.default})`,
				border: `1px solid ${tokens.glass.border.default}`,
			};

		case 'solid':
			return {
				...baseStyles,
				background: tokens.colors.slate[800],
				border: `1px solid ${tokens.colors.slate[700]}`,
			};

		case 'bordered':
			return {
				...baseStyles,
				background: 'transparent',
				border: `1px solid ${tokens.glass.border.default}`,
			};

		default:
			return baseStyles;
	}
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

type FocusVariant = 'primary' | 'neutral' | 'danger';

export const focusRing = (variant: FocusVariant = 'primary'): string => {
	const variantClasses: Record<FocusVariant, string> = {
		primary: 'focus-visible:ring-blue-400/70',
		neutral: 'focus-visible:ring-white/60',
		danger: 'focus-visible:ring-rose-400/70',
	} as const;

	return [
		'focus:outline-none',
		'focus-visible:ring-2',
		'focus-visible:ring-offset-2',
		'focus-visible:ring-offset-slate-900',
		variantClasses[variant],
	].join(' ');
};

export const animations = {
	fadeIn: getMotionValues('fade'),
	slideUp: getMotionValues('slideUp'),
	slideDown: getMotionValues('slideDown'),
	scaleIn: getMotionValues('scale'),
};

export type GlassVariant = keyof typeof tokens.glass.background;
export type GlowColor = keyof typeof tokens.shadows.glow;
export type GlowIntensity = keyof typeof tokens.shadows.glow.pink;
export type MotionType = 'fade' | 'slide' | 'scale' | 'slideUp' | 'slideDown';
