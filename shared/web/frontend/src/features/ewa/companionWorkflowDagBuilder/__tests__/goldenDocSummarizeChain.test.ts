import { describe, expect, it } from 'vitest';

import { canvasToDagBody } from '@/features/ewa/companionWorkflowDagBuilder/mapping/canvasMapping';
import { buildVariablePickerTree } from '@/features/ewa/companionWorkflowDagBuilder/graph/buildVariablePickerTree';
import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

const importId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
const summarizeId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2';

/**
 * Golden UI→backend contract: document_import.text linked to llm_summarizer via picker template.
 * Backend mirror: tests/fixtures/companion_workflow_v2_ai_doc_summarize_chain.json
 */
describe('golden doc import → llm summarizer chain', () => {
	const importNode: CompanionWorkflowNodeV2 = {
		id: importId,
		type: 'document_import',
		mode: 'stateful',
		inputs: { paperless_id: 77 },
		outputs: { reply: { type: 'text' }, text: { type: 'text' } },
		title_ru: 'Import',
		title_en: 'Import',
	};
	const summarizeNode: CompanionWorkflowNodeV2 = {
		id: summarizeId,
		type: 'llm_summarizer',
		mode: 'stateless',
		inputs: { text: '' },
		outputs: {
			reply: { type: 'text' },
			summary_text: { type: 'text' },
			analysis_text: { type: 'text' },
		},
		title_ru: 'Summarize',
		title_en: 'Summarize',
	};
	const nodes = [importNode, summarizeNode];
	const edges: CompanionWorkflowEdgeV2[] = [
		{ source_node_id: importId, target_node_id: summarizeId },
	];

	it('variable picker exposes import.text for summarizer target', () => {
		const tree = buildVariablePickerTree({
			nodes,
			edges,
			targetNodeId: summarizeId,
			isRu: false,
		});
		const importGroup = tree.groups.find(
			(group) => group.id === `node:${importId}`
		);
		expect(
			importGroup?.children.some(
				(leaf) => leaf.template === `{{${importId}.text}}`
			)
		).toBe(true);
	});

	it('picker template round-trips into dag body inputs', () => {
		const linkedSummarize: CompanionWorkflowNodeV2 = {
			...summarizeNode,
			inputs: { text: `{{${importId}.text}}` },
		};
		const dagBody = canvasToDagBody(
			[importNode, linkedSummarize],
			edges,
			[
				{ id: importId, position: { x: 0, y: 0 }, data: {} },
				{ id: summarizeId, position: { x: 280, y: 0 }, data: {} },
			],
			{ x: 0, y: 0, zoom: 1 }
		);
		expect(dagBody.nodes[1]?.inputs?.text).toBe(`{{${importId}.text}}`);
		expect(dagBody.nodes[0]?.type).toBe('document_import');
		expect(dagBody.nodes[1]?.type).toBe('llm_summarizer');
	});
});
