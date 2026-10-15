import type { MarketingView } from '../constants';
import type { MarketingAiRun } from '../marketingCabinetApi';

/** Куда вести пользователя из центра AI-задач по tool_key записи run. */
export function marketingAiRunTargetView(
	toolKey: string | null | undefined
): MarketingView {
	const k = String(toolKey || '').toLowerCase();
	if (k === 'jtbd_extract') return 'jtbd';
	if (k === 'swot_generate') return 'analysis';
	if (k === 'research_run') return 'evidence';
	if (
		k.startsWith('document_autofill_preview_') ||
		k.startsWith('document_autofill_apply_')
	) {
		return 'evidence';
	}
	if (k === 'context_chat') return 'chat';
	return 'ai_studio';
}

/** Опциональный фокус сущности (data-marketing-entity-id) после перехода. */
export function marketingAiRunFocusEntityId(
	run: MarketingAiRun
): string | null {
	const meta = run.metadata;
	if (!meta || typeof meta !== 'object') return null;
	const m = meta as Record<string, unknown>;
	const tool = String(run.tool_key || '').toLowerCase();
	if (tool === 'research_run' && typeof m.research_id === 'string')
		return m.research_id;
	if (tool === 'swot_generate' && typeof m.analysis_id === 'string')
		return m.analysis_id;
	return null;
}
