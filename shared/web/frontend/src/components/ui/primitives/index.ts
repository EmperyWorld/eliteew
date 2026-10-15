/**
 * UI Primitives Library - Barrel Exports
 * Centralized exports for all UI primitive components
 *
 * @version 1.0.0
 * @date 2025-10-13
 *
 * Usage:
 * ```tsx
 * import { Button, Card, Badge } from '@/components/ui/primitives';
 * ```
 *
 * Features:
 * - 15+ primitive components
 * - Full design token integration
 * - TypeScript support
 * - Zero hard-coded values
 */

// ============================================================================
// CORE PRIMITIVES
// ============================================================================

export { Box } from './Box';
export type { BoxProps, BoxOwnProps } from './Box';

export { Card } from './Card';
export type { CardProps, CardSubComponentProps } from './Card';

export { Button } from './Button';
export type {
	ButtonProps,
	ButtonOwnProps,
	ButtonVariant,
	ButtonSize,
} from './Button';

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export { Text, Heading, Paragraph } from './Text';
export type { TextProps, TextOwnProps, TextSize, TextWeight } from './Text';

// ============================================================================
// LAYOUT
// ============================================================================

export { VStack, HStack } from './Stack';
export type {
	StackProps,
	StackOwnProps,
	SpacingValue,
	AlignItems,
	JustifyContent,
} from './Stack';

export { Divider } from './Divider';
export type {
	DividerProps,
	DividerOrientation,
	DividerThickness,
	DividerColor,
} from './Divider';

// ============================================================================
// STATUS & FEEDBACK
// ============================================================================

export { Badge } from './Badge';
export type { BadgeProps, BadgeColor, BadgeSize, BadgeVariant } from './Badge';

export { Spinner } from './Spinner';
export type {
	SpinnerProps,
	SpinnerSize,
	SpinnerColor,
	SpinnerType,
} from './Spinner';

export { Progress } from './Progress';
export type { ProgressProps, ProgressColor, ProgressSize } from './Progress';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStateVariant } from './EmptyState';

export { ErrorBoundary } from './ErrorBoundary';
export type { ErrorBoundaryProps, ErrorBoundaryState } from './ErrorBoundary';

// ============================================================================
// DATA DISPLAY
// ============================================================================

export { Avatar } from './Avatar';
export type {
	AvatarProps,
	AvatarSize,
	AvatarColor,
	AvatarStatus,
} from './Avatar';

export { IconContainer } from './IconContainer';
export type {
	IconContainerProps,
	IconColor,
	IconSize,
	IconShape,
} from './IconContainer';

export { Skeleton } from './Skeleton';
export type { SkeletonProps, SkeletonVariant } from './Skeleton';

// ============================================================================
// CONVENIENCE ALIASES
// ============================================================================

/**
 * Spacing alias for easier imports
 * Usage: import { Spacing } from '@/components/ui/primitives'
 */
export type { SpacingValue as Spacing } from './Stack';
