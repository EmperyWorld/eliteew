/**
 * Re-export EmptyState from primitives for UGSHub and other consumers
 * that use the API: icon (LucideIcon), title, description, actionLabel, onAction.
 * For a simpler API (icon as ReactNode, action as ReactNode) use EmptyStateBlock.
 */

export {
	EmptyState,
	type EmptyStateProps,
	type EmptyStateVariant,
} from './primitives/EmptyState';
export { default } from './primitives/EmptyState';
