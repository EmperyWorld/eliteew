/**
 * Skeleton - Loading Skeleton Component
 * Placeholder for loading content with pulse animation
 *
 * @version 1.0.0
 * @date 2025-10-13
 *
 * Features:
 * - Multiple variants (text, circle, rect)
 * - Pulse animation using design tokens
 * - Responsive sizing
 * - Composition support
 *
 * Usage:
 * ```tsx
 * <Skeleton variant="text" width="200px" />
 * <Skeleton variant="circle" size="48px" />
 * <Skeleton variant="rect" width="100%" height="200px" />
 * ```
 */

import * as React from 'react';
import type { CSSProperties } from 'react';
import { useId, useMemo } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '@/styles/tokens';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type SkeletonVariant = 'text' | 'circle' | 'rect';

interface SkeletonProps {
	variant?: SkeletonVariant;
	width?: string | number;
	height?: string | number;
	size?: string | number;
	count?: number;
	spacing?: keyof typeof tokens.spacing;
	className?: string;
	style?: CSSProperties;
}

// ============================================================================
// SKELETON COMPONENT
// ============================================================================

/**
 * Skeleton component with design token integration
 */
export const Skeleton: React.FC<SkeletonProps> = ({
	variant = 'text',
	width,
	height,
	size,
	count = 1,
	spacing = 2,
	className = '',
	style,
}) => {
	const baseId = useId();
	const multiKeys = useMemo(
		() => Array.from({ length: count }, (_, i) => `${baseId}-sk-${i}`),
		[baseId, count]
	);

	const baseStyles: CSSProperties = {
		background: tokens.colors.slate[800],
		animation: 'skeleton-pulse 1.5s ease-in-out infinite',
		...style,
	};

	// Variant-specific styles
	let variantStyles: CSSProperties = {};

	switch (variant) {
		case 'text':
			variantStyles = {
				width: width || '100%',
				height: height || tokens.typography.fontSize.base,
				borderRadius: tokens.radius.sm,
			};
			break;

		case 'circle': {
			const circleSize = size || width || height || '48px';
			variantStyles = {
				width: circleSize,
				height: circleSize,
				borderRadius: tokens.radius.full,
			};
			break;
		}

		case 'rect':
			variantStyles = {
				width: width || '100%',
				height: height || '200px',
				borderRadius: tokens.radius.lg,
			};
			break;
	}

	const skeletonStyles: CSSProperties = {
		...baseStyles,
		...variantStyles,
	};

	// Render multiple skeletons if count > 1
	if (count > 1) {
		const stackGap =
			spacing === 2
				? tokens.components.card.glassPadding.sm
				: tokens.spacing[spacing];

		return (
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: stackGap,
				}}
			>
				{multiKeys.map((multiKey, index) => (
					<motion.div
						key={multiKey}
						className={`skeleton skeleton-${variant} ${className}`}
						style={skeletonStyles}
						animate={{
							opacity: [0.5, 1, 0.5],
						}}
						transition={{
							duration: 1.5,
							repeat: Infinity,
							ease: 'easeInOut' as const,
							delay: index * 0.1,
						}}
					/>
				))}
			</div>
		);
	}

	return (
		<motion.div
			className={`skeleton skeleton-${variant} ${className}`}
			style={skeletonStyles}
			animate={{
				opacity: [0.5, 1, 0.5],
			}}
			transition={{
				duration: 1.5,
				repeat: Infinity,
				ease: 'easeInOut' as const,
			}}
		/>
	);
};

Skeleton.displayName = 'Skeleton';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { SkeletonProps, SkeletonVariant };
export default Skeleton;
