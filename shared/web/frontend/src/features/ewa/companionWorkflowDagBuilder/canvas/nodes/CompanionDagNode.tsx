/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Flow node card for companion DAG builder nodes.
 *
 * Invariants:
 * - One target (top) and one source (bottom) handle for MVP linear graphs.
 * - User-facing title only; raw nodeType slug is not shown on the card.
 *
 * Related:
 * - CompanionDagCanvas.tsx
 * - registry/nodeCatalog.ts
 */

import { Handle, Position, type NodeProps } from '@xyflow/react';

import type { CompanionDagFlowNode } from '@/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping';
import { getDagNodeCatalogEntry } from '@/features/ewa/companionWorkflowDagBuilder/registry/nodeCatalog';
import type { CompanionWorkflowNodeTypeV2 } from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';
import { EWA_COMPANION_TYPOGRAPHY } from '@/features/ewa/ewaShellTypography';
import { cn } from '@/utils/cn';

export function CompanionDagNode({
	data,
	selected,
}: NodeProps<CompanionDagFlowNode>) {
	const catalog = getDagNodeCatalogEntry(
		data.nodeType as CompanionWorkflowNodeTypeV2
	);
	const title =
		data.title?.trim() || catalog?.labelEn || catalog?.labelRu || 'Step';

	return (
		<div
			className={cn(
				'min-w-[160px] rounded-xl border px-3 py-2 shadow-sm',
				'border-(--companion-border-subtle) bg-(--companion-surface-panel)/95',
				selected && 'ring-2 ring-(--companion-aura)/60'
			)}
			data-testid="ewa-dag-node-card"
			data-node-type={data.nodeType}
		>
			<Handle
				type="target"
				position={Position.Top}
				className="h-2.5! w-2.5! border-(--companion-border-subtle)! bg-(--companion-aura)!"
			/>
			<div
				className={cn(
					EWA_COMPANION_TYPOGRAPHY.label,
					'mt-0.5 leading-snug text-(--companion-text-primary)'
				)}
			>
				{title}
			</div>
			<Handle
				type="source"
				position={Position.Bottom}
				className="h-2.5! w-2.5! border-(--companion-border-subtle)! bg-(--companion-aura)!"
			/>
		</div>
	);
}
