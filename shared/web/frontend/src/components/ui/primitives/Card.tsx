/**
 * Card - Compound Component with Variants
 * Flexible card component with glass morphism, glow effects, and compound pattern
 *
 * @version 1.0.0
 * @date 2025-10-13
 *
 * Features:
 * - Compound component pattern (Card.Header, Card.Body, Card.Footer)
 * - Multiple variants using design tokens
 * - Glass morphism support
 * - Glow effects
 * - Hover animations
 * - Full TypeScript support
 *
 * Usage:
 * ```tsx
 * <Card variant="glass" glow glowColor="pink" glowIntensity="lg">
 *   <Card.Header>
 *     <h3>Card Title</h3>
 *   </Card.Header>
 *   <Card.Body>
 *     Card content goes here
 *   </Card.Body>
 *   <Card.Footer>
 *     <button>Action</button>
 *   </Card.Footer>
 * </Card>
 * ```
 */

import * as React from 'react';
import { forwardRef, type HTMLAttributes, type CSSProperties } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { tokens } from '@/styles/tokens';
import {
	getGlassStyles,
	getGlowShadow,
	combineShadows,
} from '@/utils/designHelpers';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type CardVariant = 'glass' | 'solid' | 'bordered' | 'gradient';
type GlowColor = 'pink' | 'purple' | 'blue' | 'green' | 'amber';
type GlowIntensity = 'sm' | 'default' | 'lg' | 'xl';
type PaddingSize = 'sm' | 'md' | 'lg';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
	variant?: CardVariant;
	glow?: boolean;
	glowColor?: GlowColor;
	glowIntensity?: GlowIntensity;
	hover?: boolean;
	padding?: PaddingSize;
	children?: React.ReactNode;
}

interface CardSubComponentProps extends HTMLAttributes<HTMLDivElement> {
	children?: React.ReactNode;
}

// ============================================================================
// STYLE BUILDERS
// ============================================================================

function getCardStyles(variant: CardVariant): CSSProperties {
	const baseStyles: CSSProperties = {
		borderRadius: tokens.radius.xl,
		transition: `all ${tokens.animation.duration.normal} ${tokens.animation.easing.out}`,
	};

	switch (variant) {
		case 'glass':
			return {
				...baseStyles,
				...getGlassStyles('default'),
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

		case 'gradient':
			return {
				...baseStyles,
				background: tokens.gradients.marketing.primary,
				border: 'none',
			};

		default:
			return baseStyles;
	}
}

function getPaddingFromSize(size: PaddingSize): string {
	return tokens.components.card.glassPadding[size];
}

// ============================================================================
// CARD ROOT COMPONENT
// ============================================================================

/**
 * Card root component
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
	(
		{
			variant = 'glass',
			glow = false,
			glowColor = 'pink',
			glowIntensity = 'default',
			hover = true,
			padding = 'md',
			children,
			style,
			className = '',
			...props
		},
		ref
	) => {
		const cardStyles = getCardStyles(variant);

		const staticBoxShadow: string = glow
			? combineShadows(
					tokens.shadows.default,
					getGlowShadow(glowColor, glowIntensity)
				)
			: tokens.shadows.default;

		const paddingValue: string = getPaddingFromSize(padding);

		const hoverAnimation = hover
			? {
					scale: tokens.animation.scale.hover,
					boxShadow: glow
						? combineShadows(tokens.shadows.lg, getGlowShadow(glowColor, 'xl'))
						: tokens.shadows.lg,
				}
			: {};

		return (
			<motion.div
				ref={ref}
				className={`card ${className}`}
				style={{
					...cardStyles,
					padding: paddingValue,
					boxShadow: staticBoxShadow,
					...style,
				}}
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				whileHover={hoverAnimation}
				transition={{
					duration: parseFloat(tokens.animation.duration.normal) / 1000,
					ease: tokens.animation.easing.out as unknown as [
						number,
						number,
						number,
						number,
					],
				}}
				{...props}
			>
				{children}
			</motion.div>
		);
	}
);

Card.displayName = 'Card';

// ============================================================================
// CARD SUB-COMPONENTS
// ============================================================================

/**
 * Card Header
 */
const CardHeader = forwardRef<HTMLDivElement, CardSubComponentProps>(
	({ children, className = '', style, ...props }, ref) => {
		const headerStyles: CSSProperties = {
			marginBottom: tokens.spacing[4],
			paddingBottom: tokens.spacing[4],
			borderBottom: `1px solid ${tokens.glass.border.default}`,
			...style,
		};

		return (
			<div
				ref={ref}
				className={`card-header ${className}`}
				style={headerStyles}
				{...props}
			>
				{children}
			</div>
		);
	}
);

CardHeader.displayName = 'Card.Header';

/**
 * Card Body
 */
const CardBody = forwardRef<HTMLDivElement, CardSubComponentProps>(
	({ children, className = '', style, ...props }, ref) => {
		const bodyStyles: CSSProperties = {
			flex: 1,
			...style,
		};

		return (
			<div
				ref={ref}
				className={`card-body ${className}`}
				style={bodyStyles}
				{...props}
			>
				{children}
			</div>
		);
	}
);

CardBody.displayName = 'Card.Body';

/**
 * Card Footer
 */
const CardFooter = forwardRef<HTMLDivElement, CardSubComponentProps>(
	({ children, className = '', style, ...props }, ref) => {
		const footerStyles: CSSProperties = {
			marginTop: tokens.spacing[4],
			paddingTop: tokens.spacing[4],
			borderTop: `1px solid ${tokens.glass.border.default}`,
			display: 'flex',
			gap: tokens.spacing[2],
			alignItems: 'center',
			justifyContent: 'flex-end',
			...style,
		};

		return (
			<div
				ref={ref}
				className={`card-footer ${className}`}
				style={footerStyles}
				{...props}
			>
				{children}
			</div>
		);
	}
);

CardFooter.displayName = 'Card.Footer';

// ============================================================================
// COMPOUND COMPONENT EXPORTS
// ============================================================================

const CardCompound = Object.assign(Card, {
	Header: CardHeader,
	Body: CardBody,
	Footer: CardFooter,
});

export { CardCompound as default };
export type { CardProps, CardSubComponentProps };
