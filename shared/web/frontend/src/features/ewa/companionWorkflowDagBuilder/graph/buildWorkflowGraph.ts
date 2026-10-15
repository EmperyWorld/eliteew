/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * In-memory DAG graph view for the companion visual builder (mirrors backend graph.py).
 *
 * Related:
 * - upstreamReachability.ts
 */

import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

export type WorkflowGraphView = {
	nodesById: Map<string, CompanionWorkflowNodeV2>;
	edges: CompanionWorkflowEdgeV2[];
	upstream: Map<string, string[]>;
	downstream: Map<string, string[]>;
	entrypointIds: string[];
};

export function buildWorkflowGraph(
	nodes: CompanionWorkflowNodeV2[],
	edges: CompanionWorkflowEdgeV2[]
): WorkflowGraphView {
	const nodesById = new Map(nodes.map((node) => [node.id, node]));
	const upstream = new Map<string, string[]>();
	const downstream = new Map<string, string[]>();
	const inDegree = new Map<string, number>();

	for (const node of nodes) {
		upstream.set(node.id, []);
		downstream.set(node.id, []);
		inDegree.set(node.id, 0);
	}

	for (const edge of edges) {
		const source = edge.source_node_id;
		const target = edge.target_node_id;
		upstream.set(target, [...(upstream.get(target) ?? []), source]);
		downstream.set(source, [...(downstream.get(source) ?? []), target]);
		inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
	}

	for (const [nodeId, parents] of upstream) {
		upstream.set(nodeId, [...new Set(parents)].sort());
	}
	for (const [nodeId, children] of downstream) {
		downstream.set(nodeId, [...new Set(children)].sort());
	}

	const entrypointIds = [...inDegree.entries()]
		.filter(([, degree]) => degree === 0)
		.map(([nodeId]) => nodeId)
		.sort();

	return { nodesById, edges, upstream, downstream, entrypointIds };
}
