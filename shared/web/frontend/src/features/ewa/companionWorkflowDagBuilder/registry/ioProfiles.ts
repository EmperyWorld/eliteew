/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Frontend mirror of ``dag_io_profiles.py`` input/output profile maps for the visual builder.
 *
 * Invariants:
 * - Keep keys/types aligned with backend ``INPUT_PROFILES`` / ``OUTPUT_PROFILES``.
 *
 * Related:
 * - api/ewa_platform/companion/workflows/dag/dag_io_profiles.py
 */

import type { CompanionWorkflowOutputTypeV2 } from '@/features/ewa/companionWorkflowDagBuilder/types/companionWorkflowV2';

export type IoProfileMap = Record<string, CompanionWorkflowOutputTypeV2>;

export const INPUT_PROFILES: Record<string, IoProfileMap> = {
	generic: {},
	prompt_text: { prompt: 'text', text: 'text', user_line: 'text' },
	paperless_import: { paperless_id: 'number' },
	document_source: {
		unified_content_id: 'string',
		document_id: 'string',
		paperless_id: 'number',
		filename: 'string',
		mime_type: 'string',
		file_base64: 'text',
	},
	presentation: {
		topic: 'text',
		title: 'text',
		num_slides: 'number',
		extra_context: 'text',
		prompt: 'text',
		text: 'text',
	},
	telegram_send: {
		message_text: 'text',
		text: 'text',
		reply: 'text',
		body: 'text',
		chat_id: 'string',
	},
	email_dispatch: {
		to: 'string',
		subject: 'text',
		body: 'text',
		text: 'text',
		reply: 'text',
		html: 'text',
	},
	vision_analyze: {
		image_url: 'image_url',
		attachment_id: 'string',
		prompt: 'text',
		question: 'text',
		data_base64: 'text',
		mime_type: 'string',
	},
	long_text: {
		text: 'text',
		body: 'text',
		reply: 'text',
		prompt: 'text',
		instruction: 'text',
	},
	classifier: {
		text: 'text',
		body: 'text',
		reply: 'text',
		categories: 'text',
		labels: 'text',
		rules: 'text',
		contains: 'string',
	},
};

export const OUTPUT_PROFILES: Record<string, IoProfileMap> = {
	text_reply: { reply: 'text', text: 'text' },
	document_catalog: {
		reply: 'text',
		text: 'text',
		unified_content_id: 'string',
		document_id: 'string',
		paperless_id: 'number',
	},
	async_pdf: {
		reply: 'text',
		run_id: 'string',
		task_run_id: 'string',
		task_run_status: 'string',
		url: 'string',
		pdf_url: 'string',
	},
	delivery_status: {
		reply: 'text',
		delivery_status: 'string',
		chat_id: 'string',
		message_id: 'number',
		to: 'string',
		error: 'string',
	},
	vision_analysis: {
		reply: 'text',
		analysis_text: 'text',
		text: 'text',
	},
	llm_summary: {
		reply: 'text',
		summary_text: 'text',
		analysis_text: 'text',
		text: 'text',
	},
	llm_classification: {
		reply: 'text',
		category: 'string',
		matched: 'boolean',
		analysis_text: 'text',
		text: 'text',
	},
	document_extract: {
		reply: 'text',
		text: 'text',
		extracted_text: 'text',
		filename: 'string',
		mime_type: 'string',
		char_count: 'number',
		page_count: 'number',
		error: 'string',
	},
	transform_value: {
		reply: 'text',
		text: 'text',
		value: 'json',
	},
};

/** Maps node type → input profile name (mirrors ``dag_tool_bindings.py``). */
export const NODE_INPUT_PROFILE_BY_TYPE: Record<string, string> = {
	image_gen: 'prompt_text',
	api_call: 'generic',
	document_import: 'paperless_import',
	pdf_generate: 'presentation',
	telegram_sender: 'telegram_send',
	email_dispatcher: 'email_dispatch',
	vision_analyzer: 'vision_analyze',
	llm_summarizer: 'long_text',
	llm_classifier: 'classifier',
	pdf_parser: 'document_source',
	document_extractor: 'document_source',
};

export const NODE_OUTPUT_PROFILE_BY_TYPE: Record<string, string> = {
	image_gen: 'text_reply',
	api_call: 'text_reply',
	document_import: 'document_catalog',
	pdf_generate: 'async_pdf',
	telegram_sender: 'delivery_status',
	email_dispatcher: 'delivery_status',
	vision_analyzer: 'vision_analysis',
	llm_summarizer: 'llm_summary',
	llm_classifier: 'llm_classification',
	pdf_parser: 'document_extract',
	document_extractor: 'document_extract',
	data_transformer: 'transform_value',
	prompt_gen: 'text_reply',
	logic_filter: 'text_reply',
	print_log: 'text_reply',
	delay: 'text_reply',
	confirm_gate: 'text_reply',
	decision: 'text_reply',
	switch: 'text_reply',
	for_each: 'text_reply',
};

export function inputFieldsForProfile(profile: string): IoProfileMap {
	return INPUT_PROFILES[profile] ?? INPUT_PROFILES.generic ?? {};
}

export function outputFieldsForProfile(profile: string): IoProfileMap {
	return OUTPUT_PROFILES[profile] ?? OUTPUT_PROFILES.text_reply ?? {};
}
