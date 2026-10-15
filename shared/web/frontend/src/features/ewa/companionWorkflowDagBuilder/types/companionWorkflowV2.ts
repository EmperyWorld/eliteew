/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * TypeScript contracts for companion workflow engine v2 (DAG definitions).
 *
 * Invariants:
 * - Mirrors ``CompanionWorkflowDefinitionV2`` pydantic schema on the API.
 *
 * Related:
 * - api/ewa_platform/schemas/pydantic/companion_workflow_v2.py
 * - Prefer aliasing `ewaOpenApi.CompanionWorkflowDefinitionV2` when editing (typescript-contract-usage.mdc)
 */

export type CompanionWorkflowNodeTypeV2 =
	| 'prompt_gen'
	| 'api_call'
	| 'image_gen'
	| 'document_import'
	| 'pdf_parser'
	| 'document_extractor'
	| 'pdf_generate'
	| 'telegram_sender'
	| 'email_dispatcher'
	| 'vision_analyzer'
	| 'llm_summarizer'
	| 'llm_classifier'
	| 'logic_filter'
	| 'confirm_gate'
	| 'delay'
	| 'decision'
	| 'switch'
	| 'print_log'
	| 'for_each'
	| 'data_transformer';

export type CompanionWorkflowOutputTypeV2 =
	| 'string'
	| 'text'
	| 'json'
	| 'boolean'
	| 'number'
	| 'image_url';

export type CompanionWorkflowNodeModeV2 = 'stateless' | 'stateful';

export type CompanionWorkflowOnErrorStrategyV2 =
	| 'stop'
	| 'retry'
	| 'fallback_value';

export type CompanionWorkflowNodeConfigV2 = {
	temperature?: number;
	max_tokens?: number;
	top_p?: number;
	tool_name?: string | null;
	delay_sec?: number;
	confirm_message_ru?: string;
	confirm_message_en?: string;
	condition?: string | null;
	condition_op?: string | null;
	condition_field?: string;
	condition_value?: unknown;
	condition_expression?: string | null;
	items_field?: string;
	switch_source?: string;
	switch_cases?: Array<{
		branch: string;
		op?: string;
		value?: unknown;
		source?: string;
		expression?: string | null;
	}>;
	transform_op?: string | null;
	transform_args?: Record<string, unknown>;
	max_iterations?: number;
};

export type CompanionWorkflowOutputSpecV2 = {
	type: CompanionWorkflowOutputTypeV2;
};

export type CompanionWorkflowOnErrorV2 = {
	strategy?: CompanionWorkflowOnErrorStrategyV2;
	max_attempts?: number;
	fallback_outputs?: Record<string, unknown>;
};

export type CompanionWorkflowNodeV2 = {
	id: string;
	type: CompanionWorkflowNodeTypeV2;
	mode?: CompanionWorkflowNodeModeV2;
	config?: CompanionWorkflowNodeConfigV2;
	inputs?: Record<string, unknown>;
	input_specs?: Record<
		string,
		{ type: CompanionWorkflowOutputTypeV2; required?: boolean }
	>;
	outputs?: Record<string, CompanionWorkflowOutputSpecV2>;
	on_error?: CompanionWorkflowOnErrorV2;
	title_ru?: string;
	title_en?: string;
};

export type CompanionWorkflowEdgeV2 = {
	source_node_id: string;
	target_node_id: string;
	branch?: string | null;
	mapping_rules?: Record<string, unknown>;
};

export type CompanionWorkflowBuilderMetaNodePositionV2 = {
	x: number;
	y: number;
};

export type CompanionWorkflowBuilderMetaV2 = {
	schema_version?: 1;
	node_positions?: Record<string, CompanionWorkflowBuilderMetaNodePositionV2>;
	viewport?: { x: number; y: number; zoom: number };
};

export type CompanionWorkflowDefinitionV2 = {
	schema_version: 2;
	workflow_id: string;
	version: number;
	title_ru: string;
	title_en: string;
	description_ru?: string;
	description_en?: string;
	enabled: boolean;
	triggers: Array<{ type: string; pattern: string }>;
	nodes: CompanionWorkflowNodeV2[];
	edges: CompanionWorkflowEdgeV2[];
	execution_mode?: 'sync' | 'async';
	env_gate?: string | null;
	tags?: string[];
	builder_meta?: CompanionWorkflowBuilderMetaV2 | null;
};

export type CompanionUserWorkflowDagBodyV2 = {
	nodes: CompanionWorkflowNodeV2[];
	edges: CompanionWorkflowEdgeV2[];
	builder_meta?: CompanionWorkflowBuilderMetaV2 | null;
	execution_mode?: 'sync' | 'async';
};

export type CompanionWorkflowValidateV2Response = {
	ok: boolean;
	workflow_id: string;
	version: number;
	node_count: number;
	edge_count: number;
	max_nodes_allowed: number;
	ordered_node_ids: string[];
	entrypoint_node_ids: string[];
	errors: string[];
	warnings: string[];
};
