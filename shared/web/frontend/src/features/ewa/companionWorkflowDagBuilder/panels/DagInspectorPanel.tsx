/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Right-rail inspector router for node properties vs edge mapping in the DAG builder.
 *
 * Related:
 * - DagNodePropertiesPanel.tsx
 * - DagEdgeMappingPanel.tsx
 */

import { useTranslation } from 'react-i18next';

import { DagEdgeMappingPanel } from '@/features/ewa/companionWorkflowDagBuilder/panels/DagEdgeMappingPanel';
import { DagNodePropertiesPanel } from '@/features/ewa/companionWorkflowDagBuilder/panels/DagNodePropertiesPanel';
import { useDagBuilderEditor } from '@/features/ewa/companionWorkflowDagBuilder/state/DagBuilderEditorContext';
import { COMPANION_DAG_BUILDER_PANEL_CLASS } from '@/features/ewa/companionWorkflowDagBuilder/dagBuilderUi';

export function DagInspectorPanel() {
	const { i18n } = useTranslation();
	const isRu = i18n.language.startsWith('ru');
	const { selection } = useDagBuilderEditor();

	return (
		<aside
			className={`${COMPANION_DAG_BUILDER_PANEL_CLASS} w-full shrink-0 lg:w-80`}
		>
			<div className="text-xs font-semibold uppercase tracking-wide text-(--companion-text-soft)">
				{isRu ? 'Инспектор' : 'Inspector'}
			</div>
			{selection.kind === 'node' ? <DagNodePropertiesPanel /> : null}
			{selection.kind === 'edge' ? <DagEdgeMappingPanel /> : null}
			{selection.kind === 'none' ? (
				<p className="text-xs text-(--companion-text-soft)">
					{isRu
						? 'Выберите узел или связь для настройки.'
						: 'Select a node or edge to configure it.'}
				</p>
			) : null}
		</aside>
	);
}
