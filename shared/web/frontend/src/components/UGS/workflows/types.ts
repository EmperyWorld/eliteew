/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UI-facing workflow DTOs for UGS workflow cards, quick execute, and execution history.
 *
 * Invariants:
 * - Values entering UI should pass through `workflows/utils.ts` normalizers.
 * - Generated OpenAPI aliases stay at service boundary; card components consume this stable UI shape.
 *
 * Related:
 * - components/UGS/workflows/utils.ts
 * - services/api/ugs/schemas.ts
 */

export interface WorkflowRecord {
	id: string;
	workflow_name: string;
	description?: string;
	created_at: string;
	updated_at?: string;
	is_public: boolean;
	project_id?: string;
	company_id?: string;
	workflow_data?: {
		nodes?: Array<Record<string, unknown>>;
		edges?: Array<Record<string, unknown>>;
	};
	node_count?: number;
	connection_count?: number;
	execution_count?: number;
	last_execution_at?: string;
	last_executed_at?: string;
	average_execution_time?: number;
	success_rate?: number;
	workflow_source?: 'legacy' | 'comfyui_catalog';
	workflow_slug?: string | null;
	category?: string | null;
	estimated_time?: number | null;
	version?: number;
	supports_execute?: boolean;
	supports_builder?: boolean;
	supports_duplicate?: boolean;
	supports_delete?: boolean;
	supports_export?: boolean;
	supports_history?: boolean;
	source_label?: string;
	execution_mode?:
		| 'quick_prompt'
		| 'requires_image_input'
		| 'requires_audio_input'
		| 'requires_specialized_form'
		| 'unsupported';
	execution_hint?: string;
	quick_execute_type_key?: string | null;
}

export interface WorkflowExecutionRecord {
	id: string;
	execution_id?: string;
	workflow_id: string;
	execution_name?: string;
	status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
	started_at?: string;
	completed_at?: string;
	total_duration_ms?: number;
	success_count?: number;
	error_count?: number;
	credits_used?: number;
	error_message?: string;
	created_at: string;
}

export interface UGSWorkflowsTabToast {
	success: (title: string, message?: string) => void;
	error: (title: string, message?: string) => void;
	action: (
		message: string,
		action: { label: string; onClick: () => void },
		description?: string
	) => void;
}

export interface ProviderRuntimeStatus {
	name: string;
	available: boolean;
	response_time?: number | null;
	last_checked?: string;
	error?: string | null;
}

export type WorkflowsPayload =
	| WorkflowRecord[]
	| { workflows?: WorkflowRecord[] };
export type ExecutionsPayload =
	| WorkflowExecutionRecord[]
	| { executions?: WorkflowExecutionRecord[]; total?: number };
/** GET /workflows/:id — плоский объект воркфлоу или обёртка с полями API */
export type WorkflowDetailsPayload =
	| WorkflowRecord
	| {
			workflow?: WorkflowRecord;
			workflow_name?: string;
			description?: string;
			workflow_data?: WorkflowRecord['workflow_data'];
	  };

export interface ErrorResponse {
	response?: { data?: { detail?: string } | string };
	message?: string;
}

export interface ExecuteResponse {
	execution_id?: string;
	id?: string;
	request_id?: string;
	status?: string;
}

export interface ExecuteWorkflowResult {
	success: boolean;
	errorMessage?: string;
}

export interface QuickExecuteFormState {
	prompt: string;
	negative_prompt: string;
	width: string;
	height: string;
	seed: string;
}
