/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Flow card node for Admin Topology Map (health strip + Factory touch badge).
 *
 * Related:
 * - genEW ecosystem-map/ServiceNode.tsx (harvest pattern)
 * - layoutTopologyGraph.ts
 */

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/utils/cn';
import type { TopologyNodeData } from './layoutTopologyGraph';
import { TopologyHealthBadge } from './TopologyHealthBadge';
import { bandAccent } from './topologyAdminHelpers';

export function TopologyServiceNode({
	data,
	selected,
}: NodeProps): React.ReactElement {
	const { service, dimmed } = data as TopologyNodeData;
	const accent = bandAccent(service.band);
	const features = service.features.slice(0, 3);
	const factoryTouch = Boolean(service.factory_touch);
	const factoryStage = (service.factory_stage || '').toUpperCase();
	const touchCount = service.factory_touches?.length ?? 0;
	const titles =
		service.factory_touches
			?.map((t) => `${t.stage}: ${t.title || t.intention_id}`)
			.join('\n') || undefined;

	return (
		<div
			className={cn(
				'relative min-w-[188px] max-w-[240px] cursor-pointer rounded-[var(--admin-ui-radius-sm)] border bg-[var(--admin-ui-surface-strong)] px-3 py-2.5 text-left shadow-sm transition-[box-shadow,border-color,opacity,transform] motion-reduce:transition-none',
				dimmed && 'opacity-40 saturate-50',
				factoryTouch
					? 'border-[var(--admin-ui-status-info)]/50 ring-1 ring-[var(--admin-ui-status-info)]/35'
					: selected
						? 'border-[var(--admin-ui-accent)] ring-2 ring-[var(--admin-ui-accent)]/25 scale-[1.02]'
						: 'border-[var(--admin-ui-border)] hover:border-[var(--admin-ui-accent)]/40'
			)}
			style={{
				borderLeftWidth: 3,
				borderLeftColor: accent,
			}}
		>
			<Handle
				type="target"
				position={Position.Left}
				className="!h-2 !w-2 !border-0 !bg-[var(--admin-ui-border)]"
			/>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="truncate text-[13px] font-semibold text-[var(--admin-ui-fg)]">
						{service.label}
					</p>
					<p className="mt-0.5 truncate text-[9px] uppercase tracking-wider text-[var(--admin-ui-fg-dim)]">
						{service.band} · {service.role}
					</p>
				</div>
				<TopologyHealthBadge health={service.health} />
			</div>
			{factoryTouch ? (
				<p
					className="mt-1.5 truncate font-mono text-[10px] uppercase tracking-wide text-[var(--admin-ui-status-info)]"
					title={titles}
				>
					factory · {factoryStage || 'active'}
					{touchCount > 1 ? ` · ×${touchCount}` : ''}
				</p>
			) : null}
			{features.length > 0 ? (
				<p className="mt-1 truncate font-mono text-[10px] text-[var(--admin-ui-fg-dim)]">
					{features.join(' · ')}
				</p>
			) : null}
			<Handle
				type="source"
				position={Position.Right}
				className="!h-2 !w-2 !border-0 !bg-[var(--admin-ui-border)]"
			/>
		</div>
	);
}
