/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Grand integration: dropped node schemas + variable picker upstream after connect.
 *
 * Related:
 * - CompanionWorkflowDagBuilderMode.tsx
 * - DagNodePropertiesPanel.tsx
 * - DagVariablePicker.tsx
 */

import { describe, expect, it } from 'vitest';

import { buildVariablePickerTree } from '@/features/ewa/companionWorkflowDagBuilder/graph/buildVariablePickerTree';
import { connectEdge } from '@/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping';
import { fieldsForNodeType } from '@/features/ewa/companionWorkflowDagBuilder/registry/fieldSchemas';
import { createDefaultDagNode } from '@/features/ewa/companionWorkflowDagBuilder/registry/nodeCatalog';
import type { CompanionWorkflowEdgeV2 } from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

describe('grandIntegrationLoop', () => {
	it('loads field schemas immediately for a newly created dropped node type', () => {
		const dropped = createDefaultDagNode('prompt_gen');
		const fields = fieldsForNodeType(dropped.type);
		expect(fields.length).toBeGreaterThan(0);
		expect(fields.some((field) => field.key === 'prompt')).toBe(true);
		expect(fields.some((field) => field.key === 'temperature')).toBe(true);
	});

	it('exposes upstream output fields on target node B right after A→B connect', () => {
		const nodeA = createDefaultDagNode('prompt_gen');
		const nodeB = createDefaultDagNode('print_log');
		let edges: CompanionWorkflowEdgeV2[] = [];
		edges = connectEdge(edges, nodeA.id, nodeB.id);

		const tree = buildVariablePickerTree({
			nodes: [nodeA, nodeB],
			edges,
			targetNodeId: nodeB.id,
			isRu: false,
		});

		const upstreamGroup = tree.groups.find(
			(group) => group.id === `node:${nodeA.id}`
		);
		expect(upstreamGroup).toBeDefined();
		expect(
			upstreamGroup?.children.some(
				(leaf) => leaf.template === `{{${nodeA.id}.reply}}`
			)
		).toBe(true);
	});

	it('supports configuring print_log inputs after chain connect', () => {
		const nodeA = createDefaultDagNode('prompt_gen');
		const nodeB = createDefaultDagNode('print_log');
		const edges = connectEdge([], nodeA.id, nodeB.id);
		const printLogFields = fieldsForNodeType('print_log');
		expect(
			printLogFields.some(
				(field) => field.section === 'inputs' && field.key === 'text'
			)
		).toBe(true);

		const tree = buildVariablePickerTree({
			nodes: [nodeA, nodeB],
			edges,
			targetNodeId: nodeB.id,
			isRu: false,
		});
		expect(tree.groups.length).toBeGreaterThan(1);
	});
});
