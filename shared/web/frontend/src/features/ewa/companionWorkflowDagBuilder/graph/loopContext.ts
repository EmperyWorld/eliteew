/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Detect ``for_each`` loop-body membership for loop placeholder buckets in the picker.
 *
 * Related:
 * - api/ewa_platform/companion/workflows/dag/dag_loop.py
 */

import { buildWorkflowGraph } from '@/features/ewa/companionWorkflowDagBuilder/graph/buildWorkflowGraph';
import type { WorkflowGraphView } from '@/features/ewa/companionWorkflowDagBuilder/graph/buildWorkflowGraph';
import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

export const LOOP_BODY_BRANCH = 'body';
export const LOOP_NEXT_BRANCH = 'next';

export const LOOP_PLACEHOLDER_FIELDS = [
	{ key: 'item', type: 'json' as const },
	{ key: 'index', type: 'number' as const },
	{ key: 'total', type: 'number' as const },
	{ key: 'id', type: 'string' as const },
];

function normalizeBranch(branch: string | null | undefined): string {
	return String(branch ?? '')
		.trim()
		.toLowerCase();
}

function outgoingBranchTargets(
	edges: CompanionWorkflowEdgeV2[],
	nodeId: string,
	branch: string
): string[] {
	const targetBranch = normalizeBranch(branch);
	return edges
		.filter(
			(edge) =>
				edge.source_node_id === nodeId &&
				normalizeBranch(edge.branch) === targetBranch
		)
		.map((edge) => edge.target_node_id);
}

function collectTransitiveDownstream(
	graph: WorkflowGraphView,
	nodeId: string
): Set<string> {
	const visited = new Set<string>();
	const queue = [...(graph.downstream.get(nodeId) ?? [])];
	while (queue.length) {
		const id = queue.shift();
		if (!id || visited.has(id)) continue;
		visited.add(id);
		queue.push(...(graph.downstream.get(id) ?? []));
	}
	return visited;
}

export function collectLoopBodyNodeIds(
	graph: WorkflowGraphView,
	edges: CompanionWorkflowEdgeV2[],
	forEachNodeId: string
): Set<string> {
	const bodyEntries = outgoingBranchTargets(
		edges,
		forEachNodeId,
		LOOP_BODY_BRANCH
	);
	if (bodyEntries.length === 0) return new Set();

	const nextEntries = new Set(
		outgoingBranchTargets(edges, forEachNodeId, LOOP_NEXT_BRANCH)
	);
	const bodyNodes = new Set<string>();

	for (const entry of bodyEntries) {
		bodyNodes.add(entry);
		for (const downstream of collectTransitiveDownstream(graph, entry)) {
			bodyNodes.add(downstream);
		}
	}

	if (nextEntries.size > 0) {
		const afterNodes = new Set<string>();
		for (const nextEntry of nextEntries) {
			afterNodes.add(nextEntry);
			for (const downstream of collectTransitiveDownstream(graph, nextEntry)) {
				afterNodes.add(downstream);
			}
		}
		for (const id of afterNodes) {
			bodyNodes.delete(id);
		}
	}

	return bodyNodes;
}

export function isNodeInsideAnyLoopBody(
	nodes: CompanionWorkflowNodeV2[],
	edges: CompanionWorkflowEdgeV2[],
	targetNodeId: string
): boolean {
	const graph = buildWorkflowGraph(nodes, edges);
	for (const node of nodes) {
		if (node.type !== 'for_each') continue;
		const body = collectLoopBodyNodeIds(graph, edges, node.id);
		if (body.has(targetNodeId)) return true;
	}
	return false;
}
