/** DTO for IMC (marketing cabinet AI research) — mirror `api/schemas/imc.py`. */

export type ImcResearchStatus =
	| 'pending'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled'
	| 'partial';

export interface ImcResearchType {
	type_key: string;
	display_name: string;
	description?: string | null;
	estimated_time_seconds: number;
	is_composite: boolean;
	complexity: string;
	/** PG+RAG по проекту; запуск без файла/URL/брифа допустим */
	rag_project_only?: boolean;
}

export interface ImcResearchTypesResponse {
	types: ImcResearchType[];
}

/** Префлайт RAG/vault для ИМК (`GET .../imc/project/{id}/rag-hints`). */
export interface ImcRagHintsPayload {
	project_id: string;
	qdrant_points_count: number;
	vault_documents_with_text: number;
	weak_coverage: boolean;
}

export interface ImcRunResearchBody {
	type_key: string;
	company_id: string;
	project_id: string;
	input_file_ids: string[];
	source_url?: string;
	/** optional: brief, document_text, focus: global | rf | mixed */
	context?: Record<string, unknown>;
	/** Результаты ИМК только на русском; поле оставлено для совместимости API */
	language: 'russian';
	idempotency_key?: string;
	priority?: number;
	workflow_key?: string | null;
	web_search_quality?: 'off' | 'light' | 'standard' | 'deep';
	use_web_search?: boolean;
}

export interface ImcRunResearchResponse {
	id: string;
	status: ImcResearchStatus;
	ugs_request_id: string;
	estimated_completion?: string | null;
	message: string;
}

export interface ImcResearchRunSummary {
	id: string;
	type_key: string;
	display_name: string;
	status: ImcResearchStatus;
	company_id: string;
	project_id: string;
	/** Инициатор запуска (PG users), для отображения в истории. */
	started_by_user_id?: string | null;
	started_by_label?: string | null;
	created_at: string;
	/** Present on dashboard bundle rows (server sort / CSV). */
	updated_at?: string | null;
	started_at: string | null;
	completed_at: string | null;
	duration_seconds?: number | null;
	result_preview?: string | null;
	/** Полный result_text: символы и строки (список не отдаёт весь текст) */
	result_char_count?: number | null;
	result_line_count?: number | null;
	parsed_data?: Record<string, unknown> | null;
	ugs_request_id: string;
	workflow_id?: string | null;
}

export interface ImcStepStatus {
	step_key: string;
	type_key: string;
	ugs_request_id: string;
	status: ImcResearchStatus;
	return_to_user: boolean;
	result_preview?: string | null;
	error?: string | null;
}

export interface ImcWorkflowError {
	step_key: string;
	message: string;
	skipped_steps: string[];
}

export interface ImcResearchRunDetail extends ImcResearchRunSummary {
	result_text?: string | null;
	result_structured?: Record<string, unknown> | null;
	input_payload?: Record<string, unknown> | null;
	steps: ImcStepStatus[];
	errors: ImcWorkflowError[];
}

export interface ImcResearchStatusPayload {
	id: string;
	status: ImcResearchStatus;
	progress: number;
	progress_message?: string | null;
	ugs_request_id: string;
}

export interface ImcResearchListResponse {
	company_id?: string | null;
	project_id?: string | null;
	total: number;
	items: ImcResearchRunSummary[];
}

export interface ImcResearchDeleteResponse {
	deleted: boolean;
	id: string;
}
