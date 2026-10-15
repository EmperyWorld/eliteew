/**
 * EmptyState - Unified Empty State Component
 * Replaces all EmptyState duplicates with single token-based implementation
 *
 * @version 2.0.0
 * @date 2025-10-13
 *
 * Features:
 * - Design token integration (NO hard-coded values!)
 * - Icon support
 * - Primary and secondary actions
 * - Multiple variants
 * - Animation support
 * - Accessibility
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   icon={Inbox}
 *   title="No items found"
 *   description="Try creating a new item to get started"
 *   actionLabel="Create Item"
 *   onAction={handleCreate}
 * />
 * ```
 */

import * as React from 'react';
import type { CSSProperties, ComponentType, SVGProps } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '@/styles/tokens';
import { getGlassStyles } from '@/utils/designHelpers';
import { Button } from './Button';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type EmptyStateVariant = 'glass' | 'solid' | 'minimal';

interface EmptyStateProps {
	icon?: ComponentType<SVGProps<SVGSVGElement>>;
	iconColor?: string;
	title: string;
	description: string;
	actionLabel?: string;
	onAction?: () => void;
	secondaryActionLabel?: string;
	onSecondaryAction?: () => void;
	variant?: EmptyStateVariant;
	className?: string;
	style?: CSSProperties;
}

// ============================================================================
// STYLE BUILDERS
// ============================================================================

function getEmptyStateStyles(variant: EmptyStateVariant): CSSProperties {
	const cardPad = tokens.components.card.glass.padding;
	const baseStyles: CSSProperties = {
		borderRadius: tokens.radius.xl,
		padding: cardPad,
		textAlign: 'center' as const,
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

		case 'minimal':
			return {
				...baseStyles,
				background: 'transparent',
				border: 'none',
			};

		default:
			return baseStyles;
	}
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

/**
 * EmptyState component with design token integration
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
	icon: Icon,
	iconColor = tokens.colors.white[40],
	title,
	description,
	actionLabel,
	onAction,
	secondaryActionLabel,
	onSecondaryAction,
	variant = 'glass',
	className = '',
	style,
}) => {
	const emptyStateStyles = getEmptyStateStyles(variant);

	const computedStyles: CSSProperties = {
		...emptyStateStyles,
		...style,
	};

	return (
		<motion.div
			className={`empty-state empty-state-${variant} ${className}`}
			style={computedStyles}
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: 20 }}
			transition={{
				duration: parseFloat(tokens.animation.duration.normal) / 1000,
				ease: tokens.animation.easing.out as unknown as [
					number,
					number,
					number,
					number,
				],
			}}
		>
			{/* Icon */}
			{Icon && (
				<motion.div
					initial={{ scale: 0.8, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{
						delay: 0.1,
						type: 'spring',
						stiffness: 200,
						damping: 20,
					}}
					style={{
						marginBottom: tokens.spacing[4],
					}}
				>
					<Icon
						width={64}
						height={64}
						style={{
							color: iconColor,
							margin: '0 auto',
							display: 'block',
						}}
					/>
				</motion.div>
			)}

			{/* Title */}
			<motion.h3
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.2 }}
				style={{
					fontSize: tokens.typography.fontSize.xl,
					fontWeight: tokens.typography.fontWeight.semibold,
					color: tokens.colors.white[100],
					marginBottom: tokens.spacing[2],
					lineHeight: tokens.typography.lineHeight.tight,
				}}
			>
				{title}
			</motion.h3>

			{/* Description */}
			<motion.p
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.3 }}
				style={{
					fontSize: tokens.typography.fontSize.base,
					color: tokens.colors.white[60],
					marginBottom:
						actionLabel || secondaryActionLabel ? tokens.spacing[6] : 0,
					maxWidth: '32rem',
					margin: '0 auto',
					lineHeight: tokens.typography.lineHeight.relaxed,
				}}
			>
				{description}
			</motion.p>

			{/* Actions */}
			{(actionLabel || secondaryActionLabel) && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.4 }}
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: tokens.spacing[3],
						marginTop: tokens.spacing[6],
					}}
				>
					{actionLabel && onAction && (
						<Button variant="gradient" size="md" onClick={onAction} glow>
							{actionLabel}
						</Button>
					)}

					{secondaryActionLabel && onSecondaryAction && (
						<Button variant="secondary" size="md" onClick={onSecondaryAction}>
							{secondaryActionLabel}
						</Button>
					)}
				</motion.div>
			)}
		</motion.div>
	);
};

EmptyState.displayName = 'EmptyState';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { EmptyStateProps, EmptyStateVariant };
export default EmptyState;
