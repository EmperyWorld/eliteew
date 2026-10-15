/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Simulates palette → semantic graph → save payload interaction without React Flow DOM.
 *
 * Related:
 * - mapping/canvasMapping.ts
 * - registry/nodeCatalog.ts
 */

import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import {
	COMPANION_DAG_NODE_TYPE,
	canvasToDagBody,
	connectEdge,
	disconnectFlowEdge,
} from '@/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping';
import { createDefaultDagNode } from '@/features/ewa/companionWorkflowDagBuilder/registry/nodeCatalog';
import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

function flowNode(
	node: CompanionWorkflowNodeV2,
	position: { x: number; y: number }
): Node {
	return {
		id: node.id,
		type: COMPANION_DAG_NODE_TYPE,
		position,
		data: { nodeType: node.type, title: node.title_en },
	};
}

describe('dagInteractionLoop', () => {
	it('builds save payload after simulated drop positions and edge connect', () => {
		const prompt = createDefaultDagNode('prompt_gen');
		const log = createDefaultDagNode('print_log');
		expect(prompt.id).not.toBe(log.id);

		const dropPrompt = { x: 100, y: 50 };
		const dropLog = { x: 400, y: 50 };
		const flowNodes = [flowNode(prompt, dropPrompt), flowNode(log, dropLog)];

		let semanticEdges: CompanionWorkflowEdgeV2[] = [];
		semanticEdges = connectEdge(semanticEdges, prompt.id, log.id);
		expect(semanticEdges).toHaveLength(1);
		expect(semanticEdges[0]?.source_node_id).toBe(prompt.id);
		expect(semanticEdges[0]?.target_node_id).toBe(log.id);

		const dag = canvasToDagBody([prompt, log], semanticEdges, flowNodes, {
			x: 0,
			y: 0,
			zoom: 1,
		});

		expect(dag.nodes).toHaveLength(2);
		expect(dag.edges).toHaveLength(1);
		expect(dag.builder_meta?.node_positions?.[prompt.id]).toEqual(dropPrompt);
		expect(dag.builder_meta?.node_positions?.[log.id]).toEqual(dropLog);
	});

	it('removes semantic edge when flow edge is deleted', () => {
		const prompt = createDefaultDagNode('prompt_gen');
		const log = createDefaultDagNode('print_log');
		const semanticEdges = connectEdge([], prompt.id, log.id);
		const flowEdge: Edge = {
			id: `e:${prompt.id}:${log.id}::0`,
			source: prompt.id,
			target: log.id,
		};

		const nextEdges = disconnectFlowEdge(semanticEdges, flowEdge);
		expect(nextEdges).toHaveLength(0);
	});

	it('ignores duplicate parallel edges', () => {
		const n1 = createDefaultDagNode('prompt_gen');
		const n2 = createDefaultDagNode('print_log');
		const once = connectEdge([], n1.id, n2.id);
		const twice = connectEdge(once, n1.id, n2.id);
		expect(twice).toHaveLength(1);
	});
});
