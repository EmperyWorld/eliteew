import { describe, expect, it } from 'vitest';

import { loadWorkflowPreset } from '@/features/ewa/companionWorkflowDagBuilder/presets/loadWorkflowPreset';
import { getDagWorkflowPreset } from '@/features/ewa/companionWorkflowDagBuilder/registry/dagWorkflowPresets';

describe('loadWorkflowPreset', () => {
	it('remaps node ids and rewrites placeholders for doc_summarize', () => {
		const preset = getDagWorkflowPreset('doc_summarize');
		if (!preset) throw new Error('missing preset');
		const loaded = loadWorkflowPreset(preset);
		expect(loaded.nodes).toHaveLength(2);
		expect(loaded.edges).toHaveLength(1);
		const importNode = loaded.nodes[0];
		const summarizeNode = loaded.nodes[1];
		expect(importNode?.type).toBe('document_import');
		expect(summarizeNode?.type).toBe('llm_summarizer');
		expect(importNode?.id).not.toBe('preset-node-import');
		expect(summarizeNode?.inputs?.text).toBe(`{{${importNode?.id}.text}}`);
	});

	it('builds pdf parse summarize chain with linked placeholders', () => {
		const preset = getDagWorkflowPreset('doc_pdf_summarize');
		if (!preset) throw new Error('missing preset');
		const loaded = loadWorkflowPreset(preset);
		expect(loaded.nodes).toHaveLength(3);
		const pdfNode = loaded.nodes.find((node) => node.type === 'pdf_parser');
		const summarizeNode = loaded.nodes.find(
			(node) => node.type === 'llm_summarizer'
		);
		const importNode = loaded.nodes.find(
			(node) => node.type === 'document_import'
		);
		expect(pdfNode?.inputs?.unified_content_id).toBe(
			`{{${importNode?.id}.unified_content_id}}`
		);
		expect(summarizeNode?.inputs?.text).toBe(`{{${pdfNode?.id}.text}}`);
	});

	it('loads prompt_log preset', () => {
		const preset = getDagWorkflowPreset('prompt_log');
		if (!preset) throw new Error('missing preset');
		const loaded = loadWorkflowPreset(preset);
		expect(loaded.nodes.map((node) => node.type)).toEqual([
			'prompt_gen',
			'print_log',
		]);
		expect(loaded.suggestedTriggerPhrase).toBe('промпт в лог');
	});
});
