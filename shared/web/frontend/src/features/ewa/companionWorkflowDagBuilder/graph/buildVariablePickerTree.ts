/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build hierarchical data for the variable picker popover (Turn → Upstream → Fields).
 *
 * Related:
 * - DagVariablePicker.tsx
 */

import { isNodeInsideAnyLoopBody } from '@/features/ewa/companionWorkflowDagBuilder/graph/loopContext';
import { LOOP_PLACEHOLDER_FIELDS } from '@/features/ewa/companionWorkflowDagBuilder/graph/loopContext';
import { collectTransitiveUpstreamFromGraph } from '@/features/ewa/companionWorkflowDagBuilder/graph/upstreamReachability';
import {
	NODE_OUTPUT_PROFILE_BY_TYPE,
	outputFieldsForProfile,
} from '@/features/ewa/companionWorkflowDagBuilder/registry/ioProfiles';
import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
	CompanionWorkflowOutputTypeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

export type VariablePickerLeaf = {
	kind: 'leaf';
	id: string;
	label: string;
	template: string;
	valueType: CompanionWorkflowOutputTypeV2 | 'json' | 'string' | 'number';
};

export type VariablePickerGroup = {
	kind: 'group';
	id: string;
	label: string;
	children: VariablePickerLeaf[];
};

export type VariablePickerTree = {
	groups: VariablePickerGroup[];
};

export const TURN_PLACEHOLDER_LEAVES: VariablePickerLeaf[] = [
	{
		kind: 'leaf',
		id: 'turn.user_line',
		label: 'user_line',
		template: '{{turn.user_line}}',
		valueType: 'text',
	},
	{
		kind: 'leaf',
		id: 'turn.principal_id',
		label: 'principal_id',
		template: '{{turn.principal_id}}',
		valueType: 'string',
	},
];

function nodeDisplayTitle(
	node: CompanionWorkflowNodeV2,
	isRu: boolean
): string {
	const title = isRu
		? node.title_ru || node.title_en
		: node.title_en || node.title_ru;
	return title?.trim() || node.type;
}

function outputFieldsForNode(
	node: CompanionWorkflowNodeV2
): Record<string, CompanionWorkflowOutputTypeV2> {
	const fromNode = node.outputs ?? {};
	if (Object.keys(fromNode).length > 0) {
		return Object.fromEntries(
			Object.entries(fromNode).map(([key, spec]) => [key, spec.type])
		);
	}
	const profile = NODE_OUTPUT_PROFILE_BY_TYPE[node.type] ?? 'text_reply';
	return outputFieldsForProfile(profile);
}

export function buildVariablePickerTree(opts: {
	nodes: CompanionWorkflowNodeV2[];
	edges: CompanionWorkflowEdgeV2[];
	targetNodeId: string;
	isRu: boolean;
}): VariablePickerTree {
	const { nodes, edges, targetNodeId, isRu } = opts;
	const groups: VariablePickerGroup[] = [];

	groups.push({
		kind: 'group',
		id: 'turn',
		label: isRu ? 'Запуск' : 'Turn',
		children: TURN_PLACEHOLDER_LEAVES,
	});

	const upstreamIds = collectTransitiveUpstreamFromGraph(
		nodes,
		edges,
		targetNodeId
	);
	const nodesById = new Map(nodes.map((node) => [node.id, node]));

	for (const upstreamId of upstreamIds) {
		const node = nodesById.get(upstreamId);
		if (!node) continue;
		const outputs = outputFieldsForNode(node);
		const children: VariablePickerLeaf[] = Object.entries(outputs).map(
			([field, valueType]) => ({
				kind: 'leaf',
				id: `${upstreamId}.${field}`,
				label: field,
				template: `{{${upstreamId}.${field}}}`,
				valueType,
			})
		);
		if (children.length === 0) continue;
		groups.push({
			kind: 'group',
			id: `node:${upstreamId}`,
			label: `${nodeDisplayTitle(node, isRu)} (${node.type})`,
			children,
		});
	}

	if (isNodeInsideAnyLoopBody(nodes, edges, targetNodeId)) {
		groups.push({
			kind: 'group',
			id: 'loop',
			label: isRu ? 'Цикл' : 'Loop',
			children: LOOP_PLACEHOLDER_FIELDS.map((field) => ({
				kind: 'leaf',
				id: `loop.${field.key}`,
				label: field.key,
				template: `{{loop.${field.key}}}`,
				valueType: field.type,
			})),
		});
	}

	return { groups };
}

export function formatPlaceholderTemplate(
	nodeId: string,
	field: string
): string {
	return `{{${nodeId}.${field}}}`;
}
