/**
 * Avatar - User Avatar Component
 * Display user avatars with fallback to initials
 *
 * @version 1.0.0
 * @date 2025-10-13
 *
 * Features:
 * - Image with fallback to initials
 * - Size variants using design tokens
 * - Color variants
 * - Status indicator
 * - Accessibility support
 *
 * Usage:
 * ```tsx
 * <Avatar src="/avatar.jpg" name="John Doe" size="md" />
 * <Avatar name="Jane Smith" size="lg" color="purple" />
 * <Avatar name="Bob" size="sm" status="online" />
 * ```
 */

import * as React from 'react';
import { useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '@/styles/tokens';
import { colorWithOpacity } from '@/utils/designHelpers';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type AvatarColor = 'pink' | 'purple' | 'blue' | 'green' | 'amber' | 'cyan';
type AvatarStatus = 'online' | 'offline' | 'away' | 'busy';

interface AvatarProps {
	src?: string;
	name: string;
	size?: AvatarSize;
	color?: AvatarColor;
	status?: AvatarStatus;
	className?: string;
	style?: CSSProperties;
}

// ============================================================================
// SIZE & STATUS MAPS
// ============================================================================

const sizeMap: Record<AvatarSize, { container: string; fontSize: string }> = {
	xs: { container: '1.5rem', fontSize: tokens.typography.fontSize.xs },
	sm: { container: '2rem', fontSize: tokens.typography.fontSize.sm },
	md: { container: '2.5rem', fontSize: tokens.typography.fontSize.base },
	lg: { container: '3rem', fontSize: tokens.typography.fontSize.lg },
	xl: { container: '4rem', fontSize: tokens.typography.fontSize.xl },
	'2xl': { container: '5rem', fontSize: tokens.typography.fontSize['2xl'] },
};

const statusColorMap: Record<AvatarStatus, string> = {
	online: tokens.colors.semantic.success,
	offline: tokens.colors.slate[500],
	away: tokens.colors.semantic.warning,
	busy: tokens.colors.semantic.error,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get initials from name
 */
function getInitials(name: string): string {
	const parts = name.trim().split(' ');
	if (parts.length >= 2) {
		return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
	}
	return name.slice(0, 2).toUpperCase();
}

// ============================================================================
// AVATAR COMPONENT
// ============================================================================

/**
 * Avatar component with design token integration
 */
export const Avatar: React.FC<AvatarProps> = ({
	src,
	name,
	size = 'md',
	color = 'purple',
	status,
	className = '',
	style,
}) => {
	const [imageError, setImageError] = useState(false);
	const showImage = src && !imageError;
	const initials = getInitials(name);

	const { container, fontSize } = sizeMap[size];
	const colorValue = tokens.colors.marketing[color][500];

	const containerStyles: CSSProperties = {
		width: container,
		height: container,
		borderRadius: tokens.radius.full,
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize,
		fontWeight: tokens.typography.fontWeight.semibold,
		position: 'relative',
		overflow: 'hidden',
		flexShrink: 0,
		...style,
	};

	// Fallback (initials) styles
	const fallbackStyles: CSSProperties = {
		...containerStyles,
		background: colorWithOpacity(colorValue, 0.2),
		color: colorValue,
		border: `1px solid ${colorWithOpacity(colorValue, 0.3)}`,
	};

	// Image styles
	const imageStyles: CSSProperties = {
		width: '100%',
		height: '100%',
		objectFit: 'cover',
	};

	// Status indicator size
	const statusSize = size === 'xs' ? '8px' : size === 'sm' ? '10px' : '12px';

	return (
		<motion.div
			className={`avatar avatar-${size} ${className}`}
			style={showImage ? containerStyles : fallbackStyles}
			initial={{ opacity: 0, scale: 0.8 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{
				duration: parseFloat(tokens.animation.duration.fast) / 1000,
				ease: [0, 0, 0.2, 1],
			}}
			title={name}
		>
			{showImage ? (
				<img
					src={src}
					alt={name}
					style={imageStyles}
					onError={() => setImageError(true)}
					loading="lazy"
				/>
			) : (
				<span>{initials}</span>
			)}

			{/* Status Indicator */}
			{status && (
				<span
					role="img"
					style={{
						position: 'absolute',
						bottom: 0,
						right: 0,
						width: statusSize,
						height: statusSize,
						borderRadius: tokens.radius.full,
						background: statusColorMap[status],
						border: `2px solid ${tokens.colors.slate[900]}`,
					}}
					aria-label={`Status: ${status}`}
				/>
			)}
		</motion.div>
	);
};

Avatar.displayName = 'Avatar';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { AvatarProps, AvatarSize, AvatarColor, AvatarStatus };
export default Avatar;
