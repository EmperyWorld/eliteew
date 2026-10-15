/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing copy for agentic Operations observability — humanize internal errors and i18n node status.
 *
 * Invariants:
 * - Never surface raw [think_error]/[tool_error] markers or env keys to end users.
 * - Progress-journal soft-filter drops observe ticks, empty state_transition, and compose-continue noise.
 * - Journal summaries stay laconic: research_plan methodology dumps collapse to a short status line.
 *
 * Related:
 * - src/features/ewa/agentic/AgenticTaskTreePanel.tsx
 * - src/features/ewa/agentic/AgenticExecutionTrace.tsx
 * - src/features/ewa/companionOperations/companionOperationsUi.ts
 */

import type { TFunction } from 'i18next';

const TECHNICAL_SUMMARY_RE = /\[(think_error|tool_error|terminate)\]/i;
const TECHNICAL_SUMMARY_INLINE_RE =
	/\b(tool_act_error|schema_validation_failed|invalid unified_content_id|step_missing_tool_name|plan_tool_args_invalid)\b/i;

export function isTechnicalAgenticSummary(raw: string): boolean {
	const text = (raw || '').trim();
	if (!text) return false;
	return (
		TECHNICAL_SUMMARY_RE.test(text) || TECHNICAL_SUMMARY_INLINE_RE.test(text)
	);
}

export function humanizeAgenticPlanSummary(
	raw: string,
	t: TFunction<'marketing'>
): string {
	let text = sanitizeAgenticChannelLeakage((raw || '').trim());
	if (!text) return '';

	text = text.replace(
		/(?:\[think_error\]\s*)?schema_validation_failed(?::[^\s\n]+)?/gi,
		t('ewaCompanion.agenticErrorThinkSchema')
	);
	text = text.replace(
		/plan_tool_args_invalid:document_extractor:[^[\n]*/gi,
		t('ewaCompanion.agenticErrorDocumentExtractorNeedsCatalog')
	);
	text = text.replace(
		/\bstep_missing_tool_name\b/gi,
		t('ewaCompanion.agenticErrorPlanNodeWithoutTool')
	);
	text = text.replace(
		/\bplan_tool_args_invalid:[^[\s\n]+(?::[^[\n]*)?/gi,
		t('ewaCompanion.agenticErrorPlanToolArgsInvalid')
	);
	text = text.replace(
		/\[tool_error\]\s*tool_act_error:Document extractor is disabled[^[\n]*/gi,
		t('ewaCompanion.agenticErrorDocumentExtractorDisabled')
	);
	text = text.replace(
		/tool_act_error:invalid unified_content_id:\s*['"]([^'"]+)['"]/gi,
		(_match, name: string) =>
			t('ewaCompanion.agenticErrorInvalidContentId', {
				name: name.trim().slice(0, 80),
			})
	);
	text = text.replace(
		/invalid unified_content_id:\s*['"]([^'"]+)['"]/gi,
		(_match, name: string) =>
			t('ewaCompanion.agenticErrorInvalidContentId', {
				name: name.trim().slice(0, 80),
			})
	);
	text = text.replace(
		/\[tool_error\]\s*tool_act_error:([^[\n]+)/gi,
		(_match, detail: string) =>
			t('ewaCompanion.agenticErrorToolFailed', {
				detail: detail.trim().slice(0, 120),
			})
	);
	text = text.replace(
		/Tool '([^']+)' returned None/gi,
		(_match, tool: string) =>
			t('ewaCompanion.agenticErrorToolReturnedNone', { tool: tool.trim() })
	);
	text = text.replace(
		/Decision required/gi,
		t('ewaCompanion.agenticGateDecisionRequired')
	);
	text = text.replace(/\[terminate\]\s*/gi, '');
	text = text.replace(/\[think_error\]\s*/gi, '');
	text = text.replace(/\[tool_error\]\s*/gi, '');

	return text.replace(/\s{2,}/g, ' ').trim();
}

/** One user-facing line from a noisy replan chain — dedupe repeated sentences, keep the latest. */
export function compactAgenticPlanSummaryDisplay(
	raw: string,
	t: TFunction<'marketing'>,
	opts?: { maxChars?: number }
): string {
	const human = humanizeAgenticPlanSummary(raw, t);
	if (!human) return '';
	const maxChars = opts?.maxChars ?? 160;
	const sentences = human
		.split(/(?<=[.!?…])\s+/)
		.map((part) => part.trim())
		.filter(Boolean);
	const seen = new Set<string>();
	const unique: string[] = [];
	for (const sentence of sentences) {
		const key = sentence.toLowerCase().replace(/\s+/g, ' ');
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(sentence);
	}
	// Space-separated technical tokens (no sentence punctuation) — dedupe repeated codes.
	if (
		unique.length <= 1 &&
		/\b(step_missing_tool_name|plan_tool_args_invalid)\b/i.test(human)
	) {
		const tokens = human.split(/\s+/).filter(Boolean);
		const tokenSeen = new Set<string>();
		const deduped: string[] = [];
		for (const token of tokens) {
			const key = token.toLowerCase();
			if (tokenSeen.has(key)) continue;
			tokenSeen.add(key);
			deduped.push(token);
		}
		const joined = deduped.join(' ');
		return joined.length > maxChars
			? `${joined.slice(0, maxChars - 1)}…`
			: joined;
	}
	const last = unique[unique.length - 1] || human;
	return last.length > maxChars ? `${last.slice(0, maxChars - 1)}…` : last;
}

export function pickAgenticCardTitle(
	planSummary: string,
	goalText: string,
	t: TFunction<'marketing'>
): string {
	const goal = goalText.trim();
	const humanSummary = humanizeAgenticPlanSummary(planSummary, t);
	if (goal && (!planSummary.trim() || isTechnicalAgenticSummary(planSummary))) {
		return goal.length > 120 ? `${goal.slice(0, 117)}…` : goal;
	}
	if (humanSummary) {
		const firstLine = humanSummary.split('\n')[0]?.trim() || humanSummary;
		return firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine;
	}
	return goal || t('ewaCompanion.operationIntentAgenticSession');
}

export function formatAgenticNodeStatus(
	status: string,
	t: TFunction<'marketing'>
): string {
	const st = (status || '').trim().toLowerCase();
	if (st === 'running') return t('ewaCompanion.agenticNodeStatusRunning');
	if (st === 'replanning') return t('ewaCompanion.agenticNodeStatusReplanning');
	if (st === 'completed') return t('ewaCompanion.agenticNodeStatusCompleted');
	if (st === 'failed') return t('ewaCompanion.agenticNodeStatusFailed');
	if (st === 'pending') return t('ewaCompanion.agenticNodeStatusPending');
	if (st === 'awaiting_human')
		return t('ewaCompanion.agenticNodeStatusAwaitingHuman');
	if (st === 'cancelled') return t('ewaCompanion.agenticNodeStatusCancelled');
	return status;
}

export function formatAgenticCheckpointKind(
	kind: string,
	t: TFunction<'marketing'>
): string {
	const key = (kind || '').trim().toLowerCase();
	const map: Record<string, string> = {
		think: 'ewaCompanion.agenticCheckpointThink',
		act: 'ewaCompanion.agenticCheckpointAct',
		state_transition: 'ewaCompanion.agenticCheckpointState',
		gate: 'ewaCompanion.agenticCheckpointGate',
		error: 'ewaCompanion.agenticCheckpointError',
	};
	const i18nKey = map[key];
	return i18nKey ? t(i18nKey) : kind;
}

export function formatAgenticGateTitle(
	title: string,
	t: TFunction<'marketing'>
): string {
	const raw = (title || '').trim();
	if (!raw || raw === 'Decision required') {
		return t('ewaCompanion.agenticGateDecisionRequired');
	}
	return raw;
}

export function formatAgenticGatePrompt(
	prompt: string,
	t: TFunction<'marketing'>,
	pendingTool?: string | null
): string {
	let text = (prompt || '').trim();
	if (
		!text ||
		text.toLowerCase() === 'нужен ответ' ||
		text.toLowerCase() === 'needs response'
	) {
		const tool = (pendingTool || '').trim().toLowerCase();
		if (tool === 'file_create' || tool === 'file_save_text') {
			return t(
				'ewaCompanion.agenticGateFileCreateConfirm',
				'Подтвердите создание или сохранение документа по текущему шагу миссии.'
			);
		}
	}
	if (!text) return text;
	text = text.replace(
		/catalog_list` and `file_open` return empty \(None\)/gi,
		t('ewaCompanion.agenticErrorCatalogFileNone')
	);
	text = text.replace(
		/`catalog_list` and `file_open`/gi,
		t('ewaCompanion.agenticErrorCatalogFileTools')
	);
	return humanizeAgenticPlanSummary(text, t);
}

export function humanizeAgenticCheckpointSummary(
	summary: string,
	t: TFunction<'marketing'>,
	opts?: { maxChars?: number }
): string {
	const raw = sanitizeAgenticChannelLeakage((summary || '').trim());
	if (!raw) return '';
	if (looksLikeAgenticResearchScaffold(raw)) {
		return t(
			'ewaCompanion.agenticExpertResearchDoneLaconic',
			'Экспертное исследование завершено'
		);
	}
	if (isTechnicalAgenticSummary(raw) || raw.includes('tool_act_error')) {
		return humanizeAgenticPlanSummary(raw, t);
	}
	const maxChars = opts?.maxChars ?? 220;
	// Prefer first non-heading prose line; if channel leftovers left a short first
	// line, prefer a longer later status line (e.g. «Готово: …»).
	const proseLines = raw
		.split(/\n+/)
		.map((line) => line.trim())
		.filter((line) => line && !/^#{1,6}\s/.test(line));
	let chosen = proseLines[0] ?? raw;
	if (proseLines.length > 1) {
		const last = proseLines[proseLines.length - 1] ?? chosen;
		if (chosen.length < 40 && last.length >= chosen.length) {
			chosen = last;
		}
	}
	const plain = chosen.replace(/[*_`]+/g, '').trim() || raw;
	return plain.length > maxChars ? `${plain.slice(0, maxChars - 1)}…` : plain;
}

/** Strip model channel/thought control tags from journal/act text (FE defense in depth). */
export function sanitizeAgenticChannelLeakage(raw: string): string {
	let text = (raw || '').trim();
	if (!text) return '';
	text = text.replace(/<\|\/?\s*channel[^|>]*\|?>/gi, ' ');
	text = text.replace(/<\/?channel\|?>/gi, ' ');
	text = text.replace(/<channel\|?>/gi, ' ');
	text = text.replace(/^\s*thought\s*$/gim, '');
	text = text
		.replace(/[ \t]{2,}/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return text;
}

const RESEARCH_METHODOLOGY_RE =
	/план анализа|методик|методолог|матрица доказательств|evidence table|insight brief|частотный анализ|frequency analysis/i;

/** True when checkpoint text is a research_plan methodology dump, not a laconic act line. */
export function looksLikeAgenticResearchScaffold(summary: string): boolean {
	const text = sanitizeAgenticChannelLeakage(summary);
	if (!text) return false;
	const head = text.slice(0, 900).toLowerCase();
	if (
		/^#{1,6}\s*фокус\b/m.test(head) ||
		head.includes('контекст решения') ||
		head.includes('research questions') ||
		head.includes('исследовательские вопросы')
	) {
		return true;
	}
	if (RESEARCH_METHODOLOGY_RE.test(head)) return true;
	if (
		/^#{1,6}\s*результат/m.test(head) &&
		/(анализ|метод|гипотез|hypothesis)/i.test(head)
	) {
		return true;
	}
	return false;
}

/** True when a checkpoint summary benefits from Markdown rendering (not a one-line status). */
export function agenticCheckpointSummaryLooksLikeMarkdown(
	summary: string
): boolean {
	const text = (summary || '').trim();
	if (!text) return false;
	if (looksLikeAgenticResearchScaffold(text)) return false;
	// Laconic one-liners stay plain text even if they contain bold markers.
	if (!text.includes('\n') && text.length <= 280) return false;
	return (
		/^#{1,6}\s/m.test(text) ||
		/\*\*[^*\n]+\*\*/.test(text) ||
		/^>\s/m.test(text) ||
		/^[-*]\s/m.test(text) ||
		/^\d+\.\s/m.test(text) ||
		/```/.test(text) ||
		text.includes('\n')
	);
}

const COMPOSE_CONTINUE_RE = /compose[_\s-]?continue/i;
/** Matches FE labels and backend observe payloads (`tick iter=N`). */
const OBSERVE_TICK_RE = /^(?:observe\s+tick\b|tick\s+iter\b)/i;

export type AgenticTraceFilterRow = {
	kind?: string | null;
	payload_json?: Record<string, unknown> | null;
};

export function isNoisyAgenticTraceRow(row: AgenticTraceFilterRow): boolean {
	const kind = (row.kind || '').trim().toLowerCase();
	const payload = row.payload_json;
	const summary =
		payload &&
		typeof payload === 'object' &&
		typeof payload.summary === 'string'
			? payload.summary.trim()
			: '';
	const tool =
		payload && typeof payload === 'object'
			? String(payload.tool || payload.tool_name || '').trim()
			: '';
	if (COMPOSE_CONTINUE_RE.test(summary) || COMPOSE_CONTINUE_RE.test(tool)) {
		return true;
	}
	if (OBSERVE_TICK_RE.test(summary)) {
		return true;
	}
	if (kind === 'observe' || kind === 'tick') {
		return true;
	}
	if (kind === 'think' && !summary) {
		return true;
	}
	if (kind === 'state_transition' && !summary) {
		return true;
	}
	return false;
}

/** Soft-filter noisy checkpoints and consecutive duplicate summaries for the progress journal. */
export function filterAgenticTraceRows<T extends AgenticTraceFilterRow>(
	rows: T[]
): T[] {
	const out: T[] = [];
	let lastKey = '';
	for (const row of rows) {
		if (isNoisyAgenticTraceRow(row)) continue;
		const payload = row.payload_json;
		const summary =
			payload &&
			typeof payload === 'object' &&
			typeof payload.summary === 'string'
				? payload.summary.trim().toLowerCase().replace(/\s+/g, ' ')
				: '';
		const key = `${(row.kind || '').trim().toLowerCase()}|${summary.slice(0, 160)}`;
		if (key === lastKey) continue;
		lastKey = key;
		out.push(row);
	}
	return out;
}
