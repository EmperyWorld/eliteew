export interface MarketingChatResponse {
	conversation_id: string;
	message: {
		id: string;
		role: 'assistant';
		content: string;
	};
}

export interface MarketingChatPayload {
	message: string;
	company_id?: string | null;
	project_id?: string | null;
	conversation_id?: string | null;
	idempotency_key?: string;
	web_search_quality?: 'off' | 'light' | 'standard' | 'deep';
	use_web_search?: boolean;
}

export interface MarketingAiAssistPayload {
	prompt: string;
	tool_key: string;
	project_id?: string | null;
	company_id?: string | null;
	content_id?: string | null;
	temperature?: number;
	max_tokens?: number;
	model?: string | null;
	idempotency_key?: string;
	web_search_quality?: 'off' | 'light' | 'standard' | 'deep';
	use_web_search?: boolean;
}

export interface MarketingAiStreamEvent {
	event: string;
	data: Record<string, unknown>;
}
