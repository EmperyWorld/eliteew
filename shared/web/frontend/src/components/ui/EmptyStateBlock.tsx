/**
 * EmptyStateBlock - Simple empty state (icon + title + description + optional CTA node).
 * Use for empty lists, search results, and filtered views when you don't need the
 * full EmptyState (primitives) API with actionLabel/onAction.
 */

import * as React from 'react';
import { cn } from '../../utils/cn';

export interface EmptyStateBlockProps {
	/** Icon element (e.g. Lucide icon in a container) */
	icon: React.ReactNode;
	/** Main heading */
	title: string;
	/** Short description below title */
	description?: string;
	/** Optional CTA (button or link) */
	action?: React.ReactNode;
	className?: string;
	/** Optional aria-label for the block */
	'aria-label'?: string;
}

export const EmptyStateBlock: React.FC<EmptyStateBlockProps> = ({
	icon,
	title,
	description,
	action,
	className,
	'aria-label': ariaLabel,
}) => (
	<div
		className={cn(
			'flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl',
			className
		)}
		style={{
			borderWidth: '1px',
			borderStyle: 'solid',
			borderColor: 'var(--glass-border)',
			backgroundColor: 'var(--glass-bg-light)',
		}}
		role="status"
		aria-label={ariaLabel ?? title}
	>
		<div
			className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
			style={{
				backgroundColor: 'var(--color-slate-800)',
				borderWidth: '1px',
				borderStyle: 'solid',
				borderColor: 'var(--glass-border)',
			}}
		>
			{icon}
		</div>
		<p
			className="font-medium text-lg mt-0 mb-0"
			style={{ color: 'var(--color-slate-300)' }}
		>
			{title}
		</p>
		{description && (
			<p
				className="text-sm mt-2 max-w-sm"
				style={{ color: 'var(--color-slate-500)' }}
			>
				{description}
			</p>
		)}
		{action && <div className="mt-4">{action}</div>}
	</div>
);

EmptyStateBlock.displayName = 'EmptyStateBlock';
