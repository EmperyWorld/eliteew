import { describe, expect, it } from 'vitest';

import {
	canvasToDagBody,
	definitionToCanvas,
	parseDefinitionV2,
} from '@/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping';
import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

const n1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const n2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

describe('parseDefinitionV2 field coerce', () => {
	it('maps unknown bag into CompanionWorkflowDefinitionV2 without as-unknown-as', () => {
		const raw: Record<string, unknown> = {
			schema_version: 2,
			workflow_id: ' user_preview ',
			version: 3,
			title_ru: 'RU',
			title_en: 'EN',
			enabled: 1,
			triggers: [
				{ type: 'regex', pattern: 'demo' },
				{ type: '', pattern: 'x' },
			],
			nodes: [
				{
					id: n1,
					type: 'prompt_gen',
					title_ru: 'Prompt',
					title_en: 'Prompt',
				},
			],
			edges: [],
			execution_mode: 'sync',
			env_gate: null,
			tags: ['a', 2, 'b'],
			builder_meta: {
				schema_version: 1,
				node_positions: { [n1]: { x: 1, y: 2 } },
			},
			extra_ignored: true,
		};

		const parsed = parseDefinitionV2(raw);
		expect(parsed).not.toBeNull();
		expect(parsed?.workflow_id).toBe('user_preview');
		expect(parsed?.version).toBe(3);
		expect(parsed?.enabled).toBe(true);
		expect(parsed?.triggers).toEqual([{ type: 'regex', pattern: 'demo' }]);
		expect(parsed?.execution_mode).toBe('sync');
		expect(parsed?.tags).toEqual(['a', 'b']);
		expect(parsed?.nodes).toHaveLength(1);
		expect(parsed?.builder_meta?.node_positions?.[n1]).toEqual({ x: 1, y: 2 });
		expect(Object.hasOwn(parsed as object, 'extra_ignored')).toBe(false);
	});

	it('rejects non-v2 or empty nodes', () => {
		expect(parseDefinitionV2({ schema_version: 1, nodes: [{}] })).toBeNull();
		expect(
			parseDefinitionV2({
				schema_version: 2,
				workflow_id: 'x',
				nodes: [],
			})
		).toBeNull();
	});
});

describe('canvasMapping ui-to-backend flow', () => {
	it('round-trips nodes, edges, and mapping_rules through canvas payload', () => {
		const nodes: CompanionWorkflowNodeV2[] = [
			{
				id: n1,
				type: 'prompt_gen',
				mode: 'stateful',
				inputs: { prompt: '{{turn.user_line}}' },
				outputs: { reply: { type: 'text' } },
				title_ru: 'Prompt',
				title_en: 'Prompt',
			},
			{
				id: n2,
				type: 'print_log',
				mode: 'stateless',
				inputs: { text: '' },
				outputs: { reply: { type: 'text' } },
				title_ru: 'Log',
				title_en: 'Log',
			},
		];
		const edges: CompanionWorkflowEdgeV2[] = [
			{
				source_node_id: n1,
				target_node_id: n2,
				mapping_rules: { text: `{{${n1}.reply}}` },
			},
		];

		const definition = {
			schema_version: 2 as const,
			workflow_id: 'user_preview',
			version: 1,
			title_ru: 'Preview',
			title_en: 'Preview',
			enabled: true,
			triggers: [{ type: 'regex', pattern: 'demo' }],
			nodes,
			edges,
			builder_meta: {
				schema_version: 1 as const,
				node_positions: {
					[n1]: { x: 10, y: 20 },
					[n2]: { x: 240, y: 20 },
				},
			},
		};

		const canvas = definitionToCanvas(definition);
		const dagBody = canvasToDagBody(
			nodes,
			edges,
			canvas.nodes,
			canvas.viewport
		);

		expect(dagBody.nodes).toEqual(nodes);
		expect(dagBody.edges).toEqual(edges);
		expect(dagBody.builder_meta?.node_positions?.[n1]).toEqual({
			x: 10,
			y: 20,
		});
		expect(dagBody.edges[0]?.mapping_rules?.text).toBe(`{{${n1}.reply}}`);
	});
});
