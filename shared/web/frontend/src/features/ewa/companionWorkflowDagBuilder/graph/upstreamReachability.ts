/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Transitive upstream discovery for the variable picker (reverse BFS).
 *
 * Related:
 * - buildVariablePickerTree.ts
 */

import {
	buildWorkflowGraph,
	type WorkflowGraphView,
} from '@/features/ewa/companionWorkflowDagBuilder/graph/buildWorkflowGraph';
import { topologicalSortSubset } from '@/features/ewa/companionWorkflowDagBuilder/graph/topologicalSort';
import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

export function collectTransitiveUpstream(
	graph: WorkflowGraphView,
	targetNodeId: string
): string[] {
	const visited = new Set<string>();
	const queue = [...(graph.upstream.get(targetNodeId) ?? [])];

	while (queue.length) {
		const id = queue.shift();
		if (!id || visited.has(id)) continue;
		visited.add(id);
		queue.push(...(graph.upstream.get(id) ?? []));
	}

	return topologicalSortSubset([...visited], graph);
}

export function collectTransitiveUpstreamFromGraph(
	nodes: CompanionWorkflowNodeV2[],
	edges: CompanionWorkflowEdgeV2[],
	targetNodeId: string
): string[] {
	const graph = buildWorkflowGraph(nodes, edges);
	return collectTransitiveUpstream(graph, targetNodeId);
}
