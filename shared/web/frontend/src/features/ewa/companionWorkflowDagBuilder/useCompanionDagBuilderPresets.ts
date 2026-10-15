/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Own preset replacement behavior for the visual workflow builder.
 *
 * Invariants:
 * - Loading a preset replaces the full semantic and canvas graph only after confirmation.
 *
 * Related:
 * - CompanionWorkflowDagBuilderMode.tsx
 * - presets/loadWorkflowPreset.ts
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Edge, Viewport } from '@xyflow/react';
import type { TFunction } from 'i18next';

import {
	definitionToCanvas,
	type CompanionDagFlowNode,
} from '@/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping';
import { loadWorkflowPreset } from '@/features/ewa/companionWorkflowDagBuilder/presets/loadWorkflowPreset';
import {
	getDagWorkflowPreset,
	type DagWorkflowPresetId,
} from '@/features/ewa/companionWorkflowDagBuilder/registry/dagWorkflowPresets';
import type { DagSelection } from '@/features/ewa/companionWorkflowDagBuilder/state/dagBuilderSelection';
import {
	createDagBuilderDirtySnapshot,
	type DagBuilderDirtySnapshot,
} from '@/features/ewa/companionWorkflowDagBuilder/state/dagBuilderDirtyState';
import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';
import type { useNotifications } from '@/notifications';

type Params = {
	name: string;
	triggerPhrase: string;
	semanticNodes: CompanionWorkflowNodeV2[];
	semanticEdges: CompanionWorkflowEdgeV2[];
	maxNodesAllowed: number;
	isRu: boolean;
	t: TFunction<'marketing'>;
	notify: ReturnType<typeof useNotifications>['notify'];
	setName: (value: string) => void;
	setTriggerPhrase: (value: string) => void;
	setSemanticNodes: Dispatch<SetStateAction<CompanionWorkflowNodeV2[]>>;
	setSemanticEdges: Dispatch<SetStateAction<CompanionWorkflowEdgeV2[]>>;
	setFlowNodes: Dispatch<SetStateAction<CompanionDagFlowNode[]>>;
	setFlowEdges: Dispatch<SetStateAction<Edge[]>>;
	setViewport: (value: Viewport | undefined) => void;
	setValidationErrors: (value: string[]) => void;
	setSelection: (selection: DagSelection) => void;
	closePicker: () => void;
	setDirtyBaseline: (snapshot: DagBuilderDirtySnapshot) => void;
};

export function useCompanionDagBuilderPresets({
	name,
	triggerPhrase,
	semanticNodes,
	semanticEdges,
	maxNodesAllowed,
	isRu,
	t,
	notify,
	setName,
	setTriggerPhrase,
	setSemanticNodes,
	setSemanticEdges,
	setFlowNodes,
	setFlowEdges,
	setViewport,
	setValidationErrors,
	setSelection,
	closePicker,
	setDirtyBaseline,
}: Params) {
	return useCallback(
		(presetId: DagWorkflowPresetId) => {
			const preset = getDagWorkflowPreset(presetId);
			if (!preset) return;
			const hasGraph =
				semanticNodes.length > 0 ||
				semanticEdges.length > 0 ||
				name.trim() ||
				triggerPhrase.trim();
			if (
				hasGraph &&
				!window.confirm(t('ewaCompanion.workflowDag.presetReplaceConfirm'))
			) {
				return;
			}
			if (preset.nodes.length > maxNodesAllowed) {
				notify.warning(
					t('ewaCompanion.workflowDag.nodeLimitTitle'),
					t('ewaCompanion.workflowDag.presetLimitBody', {
						presetCount: preset.nodes.length,
						count: maxNodesAllowed,
					})
				);
				return;
			}
			const loaded = loadWorkflowPreset(preset);
			setName(loaded.suggestedNameRu);
			setTriggerPhrase(loaded.suggestedTriggerPhrase);
			setSemanticNodes(loaded.nodes);
			setSemanticEdges(loaded.edges);
			setValidationErrors([]);
			closePicker();
			setSelection({ kind: 'none' });
			const canvas = definitionToCanvas({
				schema_version: 2,
				workflow_id: 'preset_preview',
				version: 1,
				title_ru: loaded.suggestedNameRu,
				title_en: loaded.suggestedNameRu,
				enabled: false,
				triggers: [{ type: 'regex', pattern: loaded.suggestedTriggerPhrase }],
				nodes: loaded.nodes,
				edges: loaded.edges,
			});
			setFlowNodes(canvas.nodes);
			setFlowEdges(canvas.edges);
			if (canvas.viewport) setViewport(canvas.viewport);
			setDirtyBaseline(
				createDagBuilderDirtySnapshot({
					name: loaded.suggestedNameRu,
					triggerPhrase: loaded.suggestedTriggerPhrase,
					nodes: loaded.nodes,
					edges: loaded.edges,
				})
			);
			notify.success(
				t('ewaCompanion.workflowDag.presetLoadedTitle'),
				isRu ? preset.titleRu : preset.titleEn
			);
		},
		[
			closePicker,
			isRu,
			maxNodesAllowed,
			name,
			notify,
			semanticEdges.length,
			semanticNodes.length,
			setDirtyBaseline,
			setFlowEdges,
			setFlowNodes,
			setName,
			setSelection,
			setSemanticEdges,
			setSemanticNodes,
			setTriggerPhrase,
			setValidationErrors,
			setViewport,
			t,
			triggerPhrase,
		]
	);
}
