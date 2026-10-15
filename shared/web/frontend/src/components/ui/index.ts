/**
 * 🎨 UI KIT - EXPORT (V2)
 * Centralized export for all UI components.
 * Canonical vs legacy: see documentation/product/UI-COMPONENTS.md.
 * New modals: use ModalAdvanced; Modal/ModalV2 are legacy.
 */

// Core components (V2)
export { default as Button, ButtonV2, Button as ButtonV2Alias } from './Button';
export { default as Card, CardV2 } from './Card';
export { default as Input, InputV2 } from './Input';
export { default as Modal, ModalV2 } from './Modal'; // legacy — prefer ModalAdvanced for new modals
export { ModalAdvanced } from './ModalAdvanced';
export type { ModalAdvancedProps, AnimationType } from './ModalAdvanced';

// Additional components
export { default as Badge } from './Badge';
export { RetryBlock } from './RetryBlock';
export type { RetryBlockProps } from './RetryBlock';
export { EmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStateVariant } from './EmptyState';
export { EmptyStateBlock } from './EmptyStateBlock';
export type { EmptyStateBlockProps } from './EmptyStateBlock';

// New V2 components
export { SelectV2 } from './SelectV2';
export { TooltipV2 } from './TooltipV2';

// Re-export utilities
export { cn } from '../../utils/cn';

// Re-export types (V2)
export type { ButtonProps, ButtonVariantsType } from './Button';
export type { CardVariantsType } from './Card';
export type { InputVariantsType } from './Input';
export type { ModalVariantsType } from './Modal';

// Legacy type aliases for backward compatibility
export type { BadgeVariant, BadgeSize } from './Badge';
