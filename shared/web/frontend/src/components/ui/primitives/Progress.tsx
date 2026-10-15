/**
 * Progress - Progress Bar Component
 * Display progress with color variants and animations
 *
 * @version 1.0.0
 * @date 2025-10-13
 *
 * Features:
 * - Color variants using design tokens
 * - Size variants
 * - Animated gradient
 * - Label support
 * - Accessibility (aria attributes)
 *
 * Usage:
 * ```tsx
 * <Progress value={60} max={100} />
 * <Progress value={75} color="green" size="lg" showLabel />
 * <Progress value={30} color="pink" animated />
 * ```
 */

import * as React from 'react';
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '@/styles/tokens';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ProgressColor = 'pink' | 'purple' | 'blue' | 'green' | 'amber';
type ProgressSize = 'sm' | 'md' | 'lg';

interface ProgressProps {
	value: number;
	max?: number;
	color?: ProgressColor;
	size?: ProgressSize;
	showLabel?: boolean;
	animated?: boolean;
	className?: string;
	style?: CSSProperties;
}

// ============================================================================
// SIZE MAP
// ============================================================================

const sizeMap: Record<ProgressSize, string> = {
	sm: '0.5rem',
	md: '0.75rem',
	lg: '1rem',
};

// ============================================================================
// PROGRESS COMPONENT
// ============================================================================

/**
 * Progress bar component with design token integration
 */
export const Progress: React.FC<ProgressProps> = ({
	value,
	max = 100,
	color = 'purple',
	size = 'md',
	showLabel = false,
	animated = false,
	className = '',
	style,
}) => {
	const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
	const colorValue = tokens.colors.marketing[color][500];
	const height = sizeMap[size];

	const containerStyles: CSSProperties = {
		width: '100%',
		...style,
	};

	const trackStyles: CSSProperties = {
		width: '100%',
		height,
		background: tokens.colors.slate[800],
		border: `1px solid ${tokens.colors.slate[700]}`,
		borderRadius: tokens.radius.full,
		overflow: 'hidden',
		position: 'relative',
	};

	const barStyles: CSSProperties = {
		height: '100%',
		width: `${percentage}%`,
		background: animated
			? tokens.gradients.marketing[color === 'green' ? 'success' : 'primary']
			: colorValue,
		borderRadius: tokens.radius.full,
		transition: `width ${tokens.animation.duration.slow} cubic-bezier(0, 0, 0.2, 1)`,
		backgroundSize: animated ? '200% 100%' : undefined,
	};

	const labelStyles: CSSProperties = {
		fontSize: tokens.typography.fontSize.sm,
		fontWeight: tokens.typography.fontWeight.medium,
		color: tokens.colors.white[80],
		marginTop: tokens.spacing[1],
		textAlign: 'right',
	};

	return (
		<div
			className={`progress progress-${size} ${className}`}
			style={containerStyles}
		>
			<div
				className="progress-track"
				style={trackStyles}
				role="progressbar"
				aria-valuenow={value}
				aria-valuemin={0}
				aria-valuemax={max}
				aria-label="Progress"
			>
				<motion.div
					className="progress-bar"
					style={barStyles}
					initial={{ width: 0 }}
					animate={{
						width: `${percentage}%`,
						backgroundPosition: animated ? ['0% 0%', '100% 0%'] : undefined,
					}}
					transition={{
						width: {
							duration: parseFloat(tokens.animation.duration.slow) / 1000,
							ease: [0, 0, 0.2, 1],
						},
						backgroundPosition: animated
							? {
									duration: 2,
									repeat: Infinity,
									ease: 'linear' as const,
								}
							: undefined,
					}}
				/>
			</div>

			{showLabel && <div style={labelStyles}>{Math.round(percentage)}%</div>}
		</div>
	);
};

Progress.displayName = 'Progress';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { ProgressProps, ProgressColor, ProgressSize };
export default Progress;
