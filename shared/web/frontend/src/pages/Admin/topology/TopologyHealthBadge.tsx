/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Health status chip for Admin Topology Map nodes and inspector.
 *
 * Related:
 * - topologyAdminHelpers.ts
 * - TopologyServiceNode.tsx
 */

import { cn } from '@/utils/cn';
import type { TopologyHealth } from './topologyApi';
import { healthTone } from './topologyAdminHelpers';

export interface TopologyHealthBadgeProps {
	health: TopologyHealth;
	size?: 'sm' | 'md';
	className?: string;
	title?: string;
}

export function TopologyHealthBadge({
	health,
	size = 'sm',
	className,
	title,
}: TopologyHealthBadgeProps): React.ReactElement {
	const tone = healthTone(health);
	return (
		<span
			className={cn(
				'inline-flex shrink-0 items-center rounded-[var(--admin-ui-radius-sm)] border font-mono uppercase tracking-wide',
				size === 'md' ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-0.5 text-[9px]',
				className
			)}
			style={{
				color: tone.color,
				borderColor: `${tone.border}55`,
				backgroundColor: tone.bg,
			}}
			title={title ?? health}
		>
			{health}
		</span>
	);
}
