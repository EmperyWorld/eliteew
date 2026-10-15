/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Applies variable-picker insertions to the active field based on picker session anchor.
 *
 * Related:
 * - DagVariablePicker.tsx
 */

import { semanticEdgeFlowId } from '@/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping';
import { DagVariablePicker } from '@/features/ewa/companionWorkflowDagBuilder/panels/DagVariablePicker';
import { useDagBuilderEditor } from '@/features/ewa/companionWorkflowDagBuilder/state/DagBuilderEditorContext';

export function DagPickerController() {
	const { pickerSession, patchNode, patchEdgeMapping, nodes, edges } =
		useDagBuilderEditor();

	const targetNodeId = (() => {
		if (!pickerSession) return '';
		const anchor = pickerSession.anchor;
		if (anchor.kind === 'node_input' || anchor.kind === 'node_config') {
			return anchor.nodeId;
		}
		if (anchor.kind === 'edge_mapping') {
			for (let index = 0; index < edges.length; index += 1) {
				const edge = edges[index];
				if (!edge) continue;
				if (semanticEdgeFlowId(edge, index) === anchor.flowEdgeId) {
					return edge.target_node_id;
				}
			}
		}
		return nodes[0]?.id ?? '';
	})();

	const handleInsert = (template: string) => {
		if (!pickerSession) return;
		const anchor = pickerSession.anchor;
		if (anchor.kind === 'node_input') {
			const node = nodes.find((item) => item.id === anchor.nodeId);
			const current = String(node?.inputs?.[anchor.inputKey] ?? '');
			patchNode(anchor.nodeId, {
				inputs: { [anchor.inputKey]: `${current}${template}` },
			});
			return;
		}
		if (anchor.kind === 'node_config') {
			const node = nodes.find((item) => item.id === anchor.nodeId);
			const current = String(
				(node?.config as Record<string, unknown> | undefined)?.[
					anchor.configKey
				] ?? ''
			);
			patchNode(anchor.nodeId, {
				config: { [anchor.configKey]: `${current}${template}` },
			});
			return;
		}
		if (anchor.kind === 'edge_mapping') {
			for (let index = 0; index < edges.length; index += 1) {
				const edge = edges[index];
				if (!edge) continue;
				if (semanticEdgeFlowId(edge, index) !== anchor.flowEdgeId) continue;
				const current = String(edge.mapping_rules?.[anchor.mappingKey] ?? '');
				patchEdgeMapping(
					anchor.flowEdgeId,
					anchor.mappingKey,
					`${current}${template}`
				);
			}
		}
	};

	if (!pickerSession || !targetNodeId) return null;

	return (
		<DagVariablePicker targetNodeId={targetNodeId} onInsert={handleInsert} />
	);
}
