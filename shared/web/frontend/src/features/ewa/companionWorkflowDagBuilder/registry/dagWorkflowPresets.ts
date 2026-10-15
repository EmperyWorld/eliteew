/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Built-in workflow chain presets for the companion DAG visual builder.
 *
 * Invariants:
 * - Template node ids are remapped on load; placeholders rewritten to new ids.
 *
 * Related:
 * - presets/loadWorkflowPreset.ts
 * - api/tests/fixtures/companion_workflow_v2_*.json
 */

import type {
	CompanionWorkflowEdgeV2,
	CompanionWorkflowNodeV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

export type DagWorkflowPresetId =
	| 'doc_summarize'
	| 'doc_pdf_summarize'
	| 'doc_summary_email'
	| 'prompt_log';

export type DagWorkflowPreset = {
	id: DagWorkflowPresetId;
	titleRu: string;
	titleEn: string;
	descriptionRu: string;
	descriptionEn: string;
	suggestedNameRu: string;
	suggestedTriggerPhrase: string;
	nodes: CompanionWorkflowNodeV2[];
	edges: CompanionWorkflowEdgeV2[];
};

const PRESET_IMPORT = 'preset-node-import';
const PRESET_PDF = 'preset-node-pdf';
const PRESET_SUMMARIZE = 'preset-node-summarize';
const PRESET_EMAIL = 'preset-node-email';
const PRESET_PROMPT = 'preset-node-prompt';
const PRESET_LOG = 'preset-node-log';

export const COMPANION_DAG_WORKFLOW_PRESETS: DagWorkflowPreset[] = [
	{
		id: 'doc_summarize',
		titleRu: 'Суммаризация документа',
		titleEn: 'Document summarization',
		descriptionRu:
			'Импорт из Paperless → краткое резюме через LLM. Подходит для быстрого обзора документа.',
		descriptionEn:
			'Import from Paperless → short LLM summary. Good for a quick document overview.',
		suggestedNameRu: 'Суммаризация документа',
		suggestedTriggerPhrase: 'суммаризация документа',
		nodes: [
			{
				id: PRESET_IMPORT,
				type: 'document_import',
				mode: 'stateful',
				inputs: { paperless_id: 0 },
				outputs: {
					reply: { type: 'text' },
					text: { type: 'text' },
					unified_content_id: { type: 'string' },
					document_id: { type: 'string' },
					paperless_id: { type: 'number' },
				},
				title_ru: 'Импорт документа',
				title_en: 'Document import',
			},
			{
				id: PRESET_SUMMARIZE,
				type: 'llm_summarizer',
				mode: 'stateless',
				inputs: { text: `{{${PRESET_IMPORT}.text}}` },
				outputs: {
					reply: { type: 'text' },
					summary_text: { type: 'text' },
					analysis_text: { type: 'text' },
				},
				title_ru: 'Суммаризация',
				title_en: 'Summarize',
			},
		],
		edges: [
			{
				source_node_id: PRESET_IMPORT,
				target_node_id: PRESET_SUMMARIZE,
			},
		],
	},
	{
		id: 'doc_pdf_summarize',
		titleRu: 'PDF → суммаризация',
		titleEn: 'PDF → summarization',
		descriptionRu:
			'Импорт PDF, разбор текста и краткое резюме. Цепочка для документов в формате PDF.',
		descriptionEn:
			'Import a PDF, extract text, then summarize. Chain for PDF documents.',
		suggestedNameRu: 'PDF и суммаризация',
		suggestedTriggerPhrase: 'pdf суммаризация',
		nodes: [
			{
				id: PRESET_IMPORT,
				type: 'document_import',
				mode: 'stateful',
				inputs: { paperless_id: 0 },
				outputs: {
					reply: { type: 'text' },
					text: { type: 'text' },
					unified_content_id: { type: 'string' },
					document_id: { type: 'string' },
					paperless_id: { type: 'number' },
				},
				title_ru: 'Импорт документа',
				title_en: 'Document import',
			},
			{
				id: PRESET_PDF,
				type: 'pdf_parser',
				mode: 'stateless',
				inputs: {
					unified_content_id: `{{${PRESET_IMPORT}.unified_content_id}}`,
					paperless_id: `{{${PRESET_IMPORT}.paperless_id}}`,
				},
				outputs: {
					reply: { type: 'text' },
					text: { type: 'text' },
					extracted_text: { type: 'text' },
					filename: { type: 'string' },
					mime_type: { type: 'string' },
					char_count: { type: 'number' },
				},
				title_ru: 'Разбор PDF',
				title_en: 'PDF parser',
			},
			{
				id: PRESET_SUMMARIZE,
				type: 'llm_summarizer',
				mode: 'stateless',
				inputs: { text: `{{${PRESET_PDF}.text}}` },
				outputs: {
					reply: { type: 'text' },
					summary_text: { type: 'text' },
					analysis_text: { type: 'text' },
				},
				title_ru: 'Суммаризация',
				title_en: 'Summarize',
			},
		],
		edges: [
			{
				source_node_id: PRESET_IMPORT,
				target_node_id: PRESET_PDF,
			},
			{
				source_node_id: PRESET_PDF,
				target_node_id: PRESET_SUMMARIZE,
			},
		],
	},
	{
		id: 'doc_summary_email',
		titleRu: 'PDF → email с резюме',
		titleEn: 'PDF → email summary',
		descriptionRu:
			'Импорт, разбор PDF, суммаризация и отправка результата на email.',
		descriptionEn:
			'Import, parse PDF, summarize, and send the result by email.',
		suggestedNameRu: 'Резюме документа на email',
		suggestedTriggerPhrase: 'резюме на email',
		nodes: [
			{
				id: PRESET_IMPORT,
				type: 'document_import',
				mode: 'stateful',
				inputs: { paperless_id: 0 },
				outputs: {
					reply: { type: 'text' },
					text: { type: 'text' },
					unified_content_id: { type: 'string' },
					document_id: { type: 'string' },
					paperless_id: { type: 'number' },
				},
				title_ru: 'Импорт документа',
				title_en: 'Document import',
			},
			{
				id: PRESET_PDF,
				type: 'pdf_parser',
				mode: 'stateless',
				inputs: {
					unified_content_id: `{{${PRESET_IMPORT}.unified_content_id}}`,
					paperless_id: `{{${PRESET_IMPORT}.paperless_id}}`,
				},
				outputs: {
					reply: { type: 'text' },
					text: { type: 'text' },
					extracted_text: { type: 'text' },
					filename: { type: 'string' },
					mime_type: { type: 'string' },
					char_count: { type: 'number' },
				},
				title_ru: 'Разбор PDF',
				title_en: 'PDF parser',
			},
			{
				id: PRESET_SUMMARIZE,
				type: 'llm_summarizer',
				mode: 'stateless',
				inputs: { text: `{{${PRESET_PDF}.text}}` },
				outputs: {
					reply: { type: 'text' },
					summary_text: { type: 'text' },
					analysis_text: { type: 'text' },
				},
				title_ru: 'Суммаризация',
				title_en: 'Summarize',
			},
			{
				id: PRESET_EMAIL,
				type: 'email_dispatcher',
				mode: 'stateless',
				inputs: {
					to: 'operator@example.com',
					subject: 'Резюме документа',
					body: `{{${PRESET_SUMMARIZE}.summary_text}}`,
				},
				outputs: {
					reply: { type: 'text' },
					delivery_status: { type: 'string' },
					to: { type: 'string' },
				},
				title_ru: 'Email',
				title_en: 'Email',
			},
		],
		edges: [
			{
				source_node_id: PRESET_IMPORT,
				target_node_id: PRESET_PDF,
			},
			{
				source_node_id: PRESET_PDF,
				target_node_id: PRESET_SUMMARIZE,
			},
			{
				source_node_id: PRESET_SUMMARIZE,
				target_node_id: PRESET_EMAIL,
			},
		],
	},
	{
		id: 'prompt_log',
		titleRu: 'Промпт → лог',
		titleEn: 'Prompt → log',
		descriptionRu:
			'Генерация промпта и вывод результата в лог. Простая цепочка для отладки.',
		descriptionEn:
			'Generate a prompt and write the result to the log. Simple chain for debugging.',
		suggestedNameRu: 'Промпт в лог',
		suggestedTriggerPhrase: 'промпт в лог',
		nodes: [
			{
				id: PRESET_PROMPT,
				type: 'prompt_gen',
				mode: 'stateful',
				inputs: { prompt: '{{turn.user_line}}' },
				outputs: { reply: { type: 'text' } },
				title_ru: 'Промпт',
				title_en: 'Prompt',
			},
			{
				id: PRESET_LOG,
				type: 'print_log',
				mode: 'stateless',
				inputs: { text: `{{${PRESET_PROMPT}.reply}}` },
				outputs: { reply: { type: 'text' } },
				title_ru: 'Лог',
				title_en: 'Log',
			},
		],
		edges: [
			{
				source_node_id: PRESET_PROMPT,
				target_node_id: PRESET_LOG,
			},
		],
	},
];

const presetById = new Map(
	COMPANION_DAG_WORKFLOW_PRESETS.map((preset) => [preset.id, preset])
);

export function getDagWorkflowPreset(
	id: DagWorkflowPresetId
): DagWorkflowPreset | undefined {
	return presetById.get(id);
}
