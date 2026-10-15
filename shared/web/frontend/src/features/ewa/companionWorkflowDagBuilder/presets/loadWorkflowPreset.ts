/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Load a DAG workflow preset with fresh node ids and rewritten placeholders.
 *
 * Invariants:
 * - Every template node id is replaced; ``{{oldId.field}}`` templates follow remap.
 *
 * Related:
 * - registry/dagWorkflowPresets.ts
 */

import { defaultNodePosition } from '@/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping';
import type { DagWorkflowPreset } from '@/features/ewa/companionWorkflowDagBuilder/registry/dagWorkflowPresets';
import { newClientNodeId } from '@/features/ewa/companionWorkflowDagBuilder/registry/nodeCatalog';
import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';
import type { CompanionDagNodeData } from '@/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping';

const PLACEHOLDER_RE =
	/\{\{([0-9a-fA-F-]{36}|[a-z0-9-]+)\.([a-zA-Z0-9_]+)\}\}/g;

function rewritePlaceholders(
	value: unknown,
	idMap: Map<string, string>
): unknown {
	if (typeof value === 'string') {
		return value.replace(
			PLACEHOLDER_RE,
			(_match, nodeId: string, field: string) => {
				const mapped = idMap.get(nodeId);
				return mapped ? `{{${mapped}.${field}}}` : `{{${nodeId}.${field}}}`;
			}
		);
	}
	if (Array.isArray(value)) {
		return value.map((item) => rewritePlaceholders(item, idMap));
	}
	if (value && typeof value === 'object') {
		const next: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(value)) {
			next[key] = rewritePlaceholders(nested, idMap);
		}
		return next;
	}
	return value;
}

export type LoadedWorkflowPreset = {
	nodes: CompanionWorkflowNodeV2[];
	edges: CompanionWorkflowEdgeV2[];
	flowNodes: Array<{
		id: string;
		position: { x: number; y: number };
		data: CompanionDagNodeData;
	}>;
	suggestedNameRu: string;
	suggestedTriggerPhrase: string;
};

export function loadWorkflowPreset(
	preset: DagWorkflowPreset
): LoadedWorkflowPreset {
	const idMap = new Map<string, string>();
	for (const templateNode of preset.nodes) {
		idMap.set(templateNode.id, newClientNodeId());
	}

	const nodes: CompanionWorkflowNodeV2[] = preset.nodes.map((templateNode) => {
		const newId = idMap.get(templateNode.id) ?? newClientNodeId();
		return {
			...templateNode,
			id: newId,
			inputs: rewritePlaceholders(templateNode.inputs ?? {}, idMap) as Record<
				string,
				unknown
			>,
			config: rewritePlaceholders(templateNode.config ?? {}, idMap) as
				| CompanionWorkflowNodeV2['config']
				| undefined,
		};
	});

	const edges: CompanionWorkflowEdgeV2[] = preset.edges.map((edge) => ({
		source_node_id: idMap.get(edge.source_node_id) ?? edge.source_node_id,
		target_node_id: idMap.get(edge.target_node_id) ?? edge.target_node_id,
		branch: edge.branch ?? null,
		mapping_rules: edge.mapping_rules
			? (rewritePlaceholders(edge.mapping_rules, idMap) as Record<
					string,
					unknown
				>)
			: undefined,
	}));

	const flowNodes = nodes.map((node, index) => ({
		id: node.id,
		position: defaultNodePosition(index),
		data: {
			nodeType: node.type,
			title: node.title_ru || node.type,
		},
	}));

	return {
		nodes,
		edges,
		flowNodes,
		suggestedNameRu: preset.suggestedNameRu,
		suggestedTriggerPhrase: preset.suggestedTriggerPhrase,
	};
}
