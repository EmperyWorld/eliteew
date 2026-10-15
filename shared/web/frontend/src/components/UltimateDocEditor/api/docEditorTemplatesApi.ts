import { API_PATHS } from '../../../services/api/config';
import { api } from '../../../services/api/client';
import type { DocumentTemplate } from '../types/editor.types';

const BASE = API_PATHS.DOC_EDITOR;

export async function fetchDocEditorTemplates(): Promise<{
	templates: DocumentTemplate[];
	source: 'db' | 'fallback';
	degradedReason: string | null;
}> {
	const out = await api.get<{
		templates?: DocumentTemplate[];
		source?: 'db' | 'fallback';
		degradedReason?: string | null;
	}>(`${BASE}/templates`);
	return {
		templates: out.templates ?? [],
		source: out.source ?? 'db',
		degradedReason: out.degradedReason ?? null,
	};
}

export async function preflightDocEditorTemplateApply(
	content: string,
	mode: 'replace' | 'insert' | 'append'
): Promise<{
	status: 'ok';
	mode: string;
	warnings: string[];
	safeToApply: boolean;
}> {
	return api.post(`${BASE}/templates/preflight`, { content, mode });
}
