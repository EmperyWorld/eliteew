import { describe, expect, it } from 'vitest';

import { buildVariablePickerTree } from '@/features/ewa/companionWorkflowDagBuilder/graph/buildVariablePickerTree';
import { collectTransitiveUpstreamFromGraph } from '@/features/ewa/companionWorkflowDagBuilder/graph/upstreamReachability';
import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

const n1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const n2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const n3 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

function node(
	id: string,
	type: CompanionWorkflowNodeV2['type']
): CompanionWorkflowNodeV2 {
	return {
		id,
		type,
		mode: 'stateful',
		inputs: {},
		outputs: { reply: { type: 'text' } },
		title_ru: id.slice(0, 8),
		title_en: id.slice(0, 8),
	};
}

describe('upstreamReachability', () => {
	it('collects transitive upstream for diamond graph', () => {
		const nodes = [
			node(n1, 'prompt_gen'),
			node(n2, 'print_log'),
			node(n3, 'image_gen'),
		];
		const edges: CompanionWorkflowEdgeV2[] = [
			{ source_node_id: n1, target_node_id: n2 },
			{ source_node_id: n1, target_node_id: n3 },
			{ source_node_id: n2, target_node_id: n3 },
		];
		const upstream = collectTransitiveUpstreamFromGraph(nodes, edges, n3);
		expect(upstream.sort()).toEqual([n1, n2].sort());
	});

	it('excludes target node and downstream nodes', () => {
		const nodes = [node(n1, 'prompt_gen'), node(n2, 'print_log')];
		const edges: CompanionWorkflowEdgeV2[] = [
			{ source_node_id: n1, target_node_id: n2 },
		];
		const upstream = collectTransitiveUpstreamFromGraph(nodes, edges, n1);
		expect(upstream).toEqual([]);
	});
});

describe('buildVariablePickerTree', () => {
	it('includes turn group and upstream output leaves', () => {
		const nodes = [node(n1, 'prompt_gen'), node(n2, 'print_log')];
		const edges: CompanionWorkflowEdgeV2[] = [
			{ source_node_id: n1, target_node_id: n2 },
		];
		const tree = buildVariablePickerTree({
			nodes,
			edges,
			targetNodeId: n2,
			isRu: false,
		});
		expect(tree.groups.some((group) => group.id === 'turn')).toBe(true);
		const upstreamGroup = tree.groups.find(
			(group) => group.id === `node:${n1}`
		);
		expect(
			upstreamGroup?.children.some(
				(leaf) => leaf.template === `{{${n1}.reply}}`
			)
		).toBe(true);
	});
});
