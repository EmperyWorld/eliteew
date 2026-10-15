/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Edit ``mapping_rules`` for a selected DAG edge.
 *
 * Related:
 * - DagInspectorPanel.tsx
 */

import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PlaceholderInputField } from '@/features/ewa/companionWorkflowDagBuilder/panels/PlaceholderInputField';
import { fieldsBySection } from '@/features/ewa/companionWorkflowDagBuilder/registry/fieldSchemas';
import {
	useDagBuilderEditor,
	useSelectedSemanticEdge,
} from '@/features/ewa/companionWorkflowDagBuilder/state/DagBuilderEditorContext';
import { COMPANION_DAG_BUILDER_NESTED_SECTION_CLASS } from '@/features/ewa/companionWorkflowDagBuilder/dagBuilderUi';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

export function DagEdgeMappingPanel() {
	const { i18n } = useTranslation();
	const isRu = i18n.language.startsWith('ru');
	const selected = useSelectedSemanticEdge();
	const { nodes, patchEdgeMapping, addEdgeMappingRow, removeEdgeMappingRow } =
		useDagBuilderEditor();
	const [newKey, setNewKey] = useState('');

	const targetNode = useMemo(() => {
		if (!selected) return null;
		return (
			nodes.find((node) => node.id === selected.edge.target_node_id) ?? null
		);
	}, [nodes, selected]);

	const inputKeyOptions = useMemo(() => {
		if (!targetNode) return [];
		return fieldsBySection(targetNode.type).inputs.map((field) => field.key);
	}, [targetNode]);

	if (!selected || !targetNode) {
		return (
			<p className="text-xs text-(--companion-text-soft)">
				{isRu ? 'Выберите связь на холсте.' : 'Select an edge on the canvas.'}
			</p>
		);
	}

	const mapping = selected.edge.mapping_rules ?? {};
	const mappingEntries = Object.entries(mapping);
	const conflictKeys = mappingEntries
		.map(([key]) => key)
		.filter(
			(key) =>
				targetNode.inputs?.[key] !== undefined &&
				targetNode.inputs?.[key] !== ''
		);

	return (
		<div className="flex flex-col gap-3">
			<div>
				<div className="text-sm font-semibold text-(--companion-text-primary)">
					{isRu ? 'Связь' : 'Edge mapping'}
				</div>
				<div className="text-[11px] text-(--companion-text-soft)">
					{selected.edge.source_node_id.slice(0, 8)} →{' '}
					{selected.edge.target_node_id.slice(0, 8)}
					{selected.edge.branch ? ` · ${selected.edge.branch}` : ''}
				</div>
			</div>

			{conflictKeys.length > 0 ? (
				<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-100/90">
					{isRu
						? `node.inputs перекрывает mapping_rules для: ${conflictKeys.join(', ')}`
						: `node.inputs wins over mapping_rules for: ${conflictKeys.join(', ')}`}
				</div>
			) : null}

			<div className={COMPANION_DAG_BUILDER_NESTED_SECTION_CLASS}>
				<div className="text-[10px] font-semibold uppercase tracking-wide text-(--companion-aura)/90">
					mapping_rules
				</div>
				{mappingEntries.length === 0 ? (
					<p className="text-xs text-(--companion-text-soft)">
						{isRu ? 'Правил пока нет.' : 'No mapping rules yet.'}
					</p>
				) : (
					<div className="flex flex-col gap-2">
						{mappingEntries.map(([key, rawValue]) => (
							<div key={key} className="flex items-start gap-2">
								<div className="min-w-0 flex-1">
									<PlaceholderInputField
										label={key}
										value={String(rawValue ?? '')}
										multiline
										onChange={(next) =>
											patchEdgeMapping(selected.flowEdgeId, key, next)
										}
										pickerAnchor={{
											kind: 'edge_mapping',
											flowEdgeId: selected.flowEdgeId,
											mappingKey: key,
										}}
									/>
								</div>
								<button
									type="button"
									className="mt-6 rounded-md p-1 text-(--companion-text-soft) hover:bg-red-500/10 hover:text-red-300"
									aria-label={isRu ? 'Удалить правило' : 'Remove rule'}
									onClick={() => removeEdgeMappingRow(selected.flowEdgeId, key)}
								>
									<TrashIcon className="h-4 w-4" />
								</button>
							</div>
						))}
					</div>
				)}

				<div className="mt-2 flex flex-wrap items-end gap-2">
					<label className="flex min-w-[120px] flex-1 flex-col gap-1">
						<span className="text-xs text-(--companion-text-soft)">
							{isRu ? 'Ключ' : 'Key'}
						</span>
						<input
							list="dag-edge-mapping-keys"
							className="rounded-lg border border-(--companion-border-subtle) bg-(--companion-surface-soft)/40 px-2 py-1.5 text-sm"
							value={newKey}
							onChange={(event) => setNewKey(event.target.value)}
						/>
						<datalist id="dag-edge-mapping-keys">
							{inputKeyOptions.map((key) => (
								<option key={key} value={key} />
							))}
						</datalist>
					</label>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="neutral"
						onClick={() => {
							const key = newKey.trim();
							if (!key) return;
							addEdgeMappingRow(selected.flowEdgeId, key);
							setNewKey('');
						}}
					>
						<PlusIcon className="mr-1 h-4 w-4" aria-hidden />
						{isRu ? 'Добавить' : 'Add'}
					</DesktopAppButton>
				</div>
			</div>
		</div>
	);
}
