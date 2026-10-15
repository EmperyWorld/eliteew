/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable topological ordering for small companion DAG graphs.
 *
 * Related:
 * - buildWorkflowGraph.ts
 */

import type { WorkflowGraphView } from '@/features/ewa/companionWorkflowDagBuilder/graph/buildWorkflowGraph';

export function topologicalSortNodeIds(graph: WorkflowGraphView): string[] {
	const inDegree = new Map<string, number>();
	for (const nodeId of graph.nodesById.keys()) {
		inDegree.set(nodeId, graph.upstream.get(nodeId)?.length ?? 0);
	}

	const ready = [...graph.entrypointIds];
	const ordered: string[] = [];

	while (ready.length > 0) {
		ready.sort();
		const nodeId = ready.shift();
		if (!nodeId) break;
		ordered.push(nodeId);
		for (const child of graph.downstream.get(nodeId) ?? []) {
			const next = (inDegree.get(child) ?? 0) - 1;
			inDegree.set(child, next);
			if (next === 0) ready.push(child);
		}
	}

	if (ordered.length !== graph.nodesById.size) {
		return [...graph.nodesById.keys()].sort();
	}
	return ordered;
}

export function topologicalSortSubset(
	nodeIds: string[],
	graph: WorkflowGraphView
): string[] {
	const allowed = new Set(nodeIds);
	const full = topologicalSortNodeIds(graph);
	return full.filter((id) => allowed.has(id));
}
