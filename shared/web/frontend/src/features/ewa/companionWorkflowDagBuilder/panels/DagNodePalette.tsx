/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Node palette for the companion DAG visual builder.
 *
 * Related:
 * - registry/nodeCatalog.ts
 */

import { useTranslation } from 'react-i18next';
import type { DragEvent } from 'react';

import {
	COMPANION_DAG_NODE_CATALOG,
	type DagNodeCatalogEntry,
} from '@/features/ewa/companionWorkflowDagBuilder/registry/nodeCatalog';
import {
	COMPANION_DAG_BUILDER_PANEL_CLASS,
	COMPANION_DAG_CATEGORY_LABELS_RU,
} from '@/features/ewa/companionWorkflowDagBuilder/dagBuilderUi';
import type { CompanionWorkflowNodeTypeV2 } from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

type Props = {
	disabled?: boolean;
	disabledReason?: string;
	onAddNode: (type: CompanionWorkflowNodeTypeV2) => void;
	onDragNodeType?: (
		event: DragEvent<HTMLButtonElement>,
		type: CompanionWorkflowNodeTypeV2
	) => void;
};

const CATEGORY_ORDER: DagNodeCatalogEntry['category'][] = [
	'generate',
	'control',
	'branch',
	'loop',
	'integrate',
	'outbound',
	'ai',
];

export function DagNodePalette({
	disabled = false,
	disabledReason,
	onAddNode,
	onDragNodeType,
}: Props) {
	const { i18n } = useTranslation('marketing');
	const isRu = i18n.language.startsWith('ru');

	return (
		<aside
			className={cn(
				COMPANION_DAG_BUILDER_PANEL_CLASS,
				'flex w-full shrink-0 flex-col gap-3 lg:w-56'
			)}
		>
			<div className="text-xs font-semibold uppercase tracking-wide text-(--companion-text-soft)">
				{isRu ? 'Узлы' : 'Nodes'}
			</div>
			{disabledReason ? (
				<p className="text-[11px] leading-snug text-amber-100" role="status">
					{disabledReason}
				</p>
			) : null}
			{CATEGORY_ORDER.map((category) => {
				const items = COMPANION_DAG_NODE_CATALOG.filter(
					(entry) => entry.category === category
				);
				if (items.length === 0) return null;
				const categoryLabel = isRu
					? (COMPANION_DAG_CATEGORY_LABELS_RU[category] ?? category)
					: category;
				return (
					<div key={category} className="flex flex-col gap-1.5">
						<div className="text-[10px] font-medium uppercase tracking-wide text-(--companion-text-soft)">
							{categoryLabel}
						</div>
						{items.map((entry) => (
							<DesktopAppButton
								key={entry.type}
								type="button"
								variant="neutral"
								size="sm"
								disabled={disabled}
								draggable={!disabled}
								className="justify-start text-left"
								onClick={() => onAddNode(entry.type)}
								onDragStart={(event) => onDragNodeType?.(event, entry.type)}
							>
								{isRu ? entry.labelRu : entry.labelEn}
							</DesktopAppButton>
						))}
					</div>
				);
			})}
		</aside>
	);
}
