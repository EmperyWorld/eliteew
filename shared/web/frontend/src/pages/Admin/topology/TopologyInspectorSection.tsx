/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collapsible section for Topology node inspector drawer.
 *
 * Related:
 * - TopologyNodeInspector.tsx
 */

import type { ReactNode } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

export type TopologyInspectorSectionProps = {
	title: string;
	children: ReactNode;
	defaultOpen?: boolean;
	badge?: ReactNode;
	className?: string;
};

export function TopologyInspectorSection({
	title,
	children,
	defaultOpen = true,
	badge,
	className,
}: TopologyInspectorSectionProps): React.ReactElement {
	return (
		<details
			open={defaultOpen}
			className={cn(
				'group rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)]',
				'bg-[var(--admin-ui-surface)]',
				className
			)}
		>
			<summary
				className={cn(
					'flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2',
					'text-sm font-medium text-[var(--admin-ui-fg)]',
					'[&::-webkit-details-marker]:hidden'
				)}
			>
				<span className="flex min-w-0 items-center gap-2">
					<ChevronDownIcon
						className="h-4 w-4 shrink-0 text-[var(--admin-ui-fg-muted)] transition-transform group-open:rotate-180"
						aria-hidden
					/>
					<span className="truncate">{title}</span>
				</span>
				{badge ? <span className="shrink-0">{badge}</span> : null}
			</summary>
			<div className="border-t border-[var(--admin-ui-border)]/60 px-3 py-3">
				{children}
			</div>
		</details>
	);
}
