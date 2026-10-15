/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Declarative catalog of DAG node types for the companion visual builder palette.
 *
 * Invariants:
 * - Every ``CompanionWorkflowNodeTypeV2`` exposed to users must appear here.
 *
 * Related:
 * - api/ewa_platform/companion/workflows/dag/dag_tool_bindings.py
 */

import type {
	CompanionWorkflowNodeTypeV2,
	CompanionWorkflowNodeV2,
	CompanionWorkflowOutputSpecV2,
} from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

export type DagNodeCatalogEntry = {
	type: CompanionWorkflowNodeTypeV2;
	labelRu: string;
	labelEn: string;
	category:
		| 'generate'
		| 'integrate'
		| 'outbound'
		| 'ai'
		| 'control'
		| 'branch'
		| 'loop';
	defaultMode: 'stateless' | 'stateful';
	defaultOutputs: Record<string, CompanionWorkflowOutputSpecV2>;
	defaultInputs?: Record<string, unknown>;
};

const textReplyOutput: Record<string, CompanionWorkflowOutputSpecV2> = {
	reply: { type: 'text' },
};

const imageOutput: Record<string, CompanionWorkflowOutputSpecV2> = {
	image_url: { type: 'image_url' },
	reply: { type: 'text' },
};

export const COMPANION_DAG_NODE_CATALOG: DagNodeCatalogEntry[] = [
	{
		type: 'prompt_gen',
		labelRu: 'Промпт',
		labelEn: 'Prompt',
		category: 'generate',
		defaultMode: 'stateful',
		defaultOutputs: textReplyOutput,
		defaultInputs: { prompt: '{{turn.user_line}}' },
	},
	{
		type: 'image_gen',
		labelRu: 'Изображение',
		labelEn: 'Image',
		category: 'generate',
		defaultMode: 'stateful',
		defaultOutputs: imageOutput,
		defaultInputs: { prompt: '' },
	},
	{
		type: 'logic_filter',
		labelRu: 'Фильтр',
		labelEn: 'Filter',
		category: 'control',
		defaultMode: 'stateless',
		defaultOutputs: { matched: { type: 'boolean' } },
		defaultInputs: { text: '', contains: '' },
	},
	{
		type: 'delay',
		labelRu: 'Пауза',
		labelEn: 'Delay',
		category: 'control',
		defaultMode: 'stateless',
		defaultOutputs: textReplyOutput,
	},
	{
		type: 'confirm_gate',
		labelRu: 'Подтверждение',
		labelEn: 'Confirm',
		category: 'control',
		defaultMode: 'stateless',
		defaultOutputs: textReplyOutput,
	},
	{
		type: 'print_log',
		labelRu: 'Лог',
		labelEn: 'Log',
		category: 'control',
		defaultMode: 'stateless',
		defaultOutputs: textReplyOutput,
		defaultInputs: { text: '' },
	},
	{
		type: 'decision',
		labelRu: 'Условие',
		labelEn: 'Decision',
		category: 'branch',
		defaultMode: 'stateless',
		defaultOutputs: { matched: { type: 'boolean' } },
	},
	{
		type: 'switch',
		labelRu: 'Переключатель',
		labelEn: 'Switch',
		category: 'branch',
		defaultMode: 'stateless',
		defaultOutputs: { matched: { type: 'boolean' } },
	},
	{
		type: 'for_each',
		labelRu: 'Цикл',
		labelEn: 'For each',
		category: 'loop',
		defaultMode: 'stateless',
		defaultOutputs: textReplyOutput,
	},
	{
		type: 'api_call',
		labelRu: 'Вызов API / инструмента',
		labelEn: 'API call',
		category: 'integrate',
		defaultMode: 'stateless',
		defaultOutputs: textReplyOutput,
	},
	{
		type: 'document_import',
		labelRu: 'Импорт документа',
		labelEn: 'Document import',
		category: 'integrate',
		defaultMode: 'stateful',
		defaultOutputs: {
			reply: { type: 'text' },
			text: { type: 'text' },
			unified_content_id: { type: 'string' },
			document_id: { type: 'string' },
			paperless_id: { type: 'number' },
		},
		defaultInputs: { paperless_id: 0 },
	},
	{
		type: 'pdf_parser',
		labelRu: 'Разбор PDF',
		labelEn: 'PDF parser',
		category: 'integrate',
		defaultMode: 'stateless',
		defaultOutputs: {
			reply: { type: 'text' },
			text: { type: 'text' },
			extracted_text: { type: 'text' },
			filename: { type: 'string' },
			mime_type: { type: 'string' },
			char_count: { type: 'number' },
			page_count: { type: 'number' },
			error: { type: 'string' },
		},
		defaultInputs: { unified_content_id: '' },
	},
	{
		type: 'document_extractor',
		labelRu: 'Извлечение текста',
		labelEn: 'Document extractor',
		category: 'integrate',
		defaultMode: 'stateless',
		defaultOutputs: {
			reply: { type: 'text' },
			text: { type: 'text' },
			extracted_text: { type: 'text' },
			filename: { type: 'string' },
			mime_type: { type: 'string' },
			char_count: { type: 'number' },
			page_count: { type: 'number' },
			error: { type: 'string' },
		},
		defaultInputs: { unified_content_id: '' },
	},
	{
		type: 'data_transformer',
		labelRu: 'Преобразование данных',
		labelEn: 'Data transformer',
		category: 'control',
		defaultMode: 'stateless',
		defaultOutputs: {
			reply: { type: 'text' },
			text: { type: 'text' },
			value: { type: 'json' },
		},
		defaultInputs: { value: '', text: '' },
	},
	{
		type: 'pdf_generate',
		labelRu: 'PDF',
		labelEn: 'PDF',
		category: 'integrate',
		defaultMode: 'stateful',
		defaultOutputs: {
			reply: { type: 'text' },
			pdf_url: { type: 'string' },
		},
	},
	{
		type: 'telegram_sender',
		labelRu: 'Telegram',
		labelEn: 'Telegram',
		category: 'outbound',
		defaultMode: 'stateful',
		defaultOutputs: {
			reply: { type: 'text' },
			delivery_status: { type: 'string' },
		},
	},
	{
		type: 'email_dispatcher',
		labelRu: 'Email',
		labelEn: 'Email',
		category: 'outbound',
		defaultMode: 'stateful',
		defaultOutputs: {
			reply: { type: 'text' },
			delivery_status: { type: 'string' },
		},
	},
	{
		type: 'vision_analyzer',
		labelRu: 'Анализ изображения',
		labelEn: 'Vision',
		category: 'ai',
		defaultMode: 'stateful',
		defaultOutputs: {
			reply: { type: 'text' },
			analysis_text: { type: 'text' },
		},
	},
	{
		type: 'llm_summarizer',
		labelRu: 'Суммаризация',
		labelEn: 'Summarize',
		category: 'ai',
		defaultMode: 'stateful',
		defaultOutputs: {
			reply: { type: 'text' },
			summary_text: { type: 'text' },
		},
	},
	{
		type: 'llm_classifier',
		labelRu: 'Классификатор',
		labelEn: 'Classifier',
		category: 'ai',
		defaultMode: 'stateful',
		defaultOutputs: {
			reply: { type: 'text' },
			category: { type: 'string' },
			matched: { type: 'boolean' },
		},
	},
];

const catalogByType = new Map(
	COMPANION_DAG_NODE_CATALOG.map((entry) => [entry.type, entry])
);

export function getDagNodeCatalogEntry(
	type: CompanionWorkflowNodeTypeV2
): DagNodeCatalogEntry | undefined {
	return catalogByType.get(type);
}

export function newClientNodeId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0')}`;
}

export function createDefaultDagNode(
	type: CompanionWorkflowNodeTypeV2,
	opts?: { titleRu?: string; titleEn?: string }
): CompanionWorkflowNodeV2 {
	const entry = getDagNodeCatalogEntry(type);
	if (!entry) {
		throw new Error(`unknown_dag_node_type:${type}`);
	}
	return {
		id: newClientNodeId(),
		type,
		mode: entry.defaultMode,
		config:
			type === 'delay'
				? { delay_sec: 1 }
				: type === 'data_transformer'
					? { transform_op: 'identity', transform_args: {} }
					: {},
		inputs: { ...(entry.defaultInputs ?? {}) },
		outputs: { ...entry.defaultOutputs },
		title_ru: opts?.titleRu ?? entry.labelRu,
		title_en: opts?.titleEn ?? entry.labelEn,
		on_error: { strategy: 'stop', max_attempts: 3, fallback_outputs: {} },
	};
}
