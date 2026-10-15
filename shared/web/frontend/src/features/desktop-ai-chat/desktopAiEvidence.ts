/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalize Desktop AI evidence metadata into safe, deduplicated user-facing sources and self-contained exports.
 * Also humanize Checks-tab required_context keys and quality violation codes for operators.
 *
 * Invariants:
 * - Only public citation records and credential-free HTTP(S) URLs leave this boundary.
 * - Derived AI artifacts remain explicitly distinct from independent project or web evidence.
 *
 * Related:
 * - api/services/desktop_chat/context_evidence.py
 * - src/features/desktop-ai-chat/components/DesktopAiEvidenceLedger.tsx
 */
import type { TFunction } from 'i18next';

import type {
	DesktopAiArtifactQualityStatus,
	DesktopAiContextSource,
	DesktopAiContextSourceKind,
	DesktopAiMessageMetadata,
} from './api/desktopChatClient';
import {
	normalizeWebSearchSources,
	type DesktopAiWebSearchSource,
} from './desktopWebSearchSources';

const CITATION_ID_RE = /^[CPDW]\d{1,4}$/;
const SOURCE_KINDS = new Set<DesktopAiContextSourceKind>([
	'chat_attachment',
	'project_document',
	'derived_ai_artifact',
	'web',
]);
const SOURCE_AUTHORITIES = new Set<DesktopAiContextSource['authority']>([
	'user_material',
	'project_material',
	'derived',
	'external',
]);
const FINALIZATION_STATES = new Set([
	'verified',
	'repaired',
	'needs_review',
	'draft',
]);
const GROUNDING_STATES = new Set([
	'grounded',
	'derived_context',
	'hypothesis_only',
	'light_context',
]);

export type DesktopAiResolvedArtifactQuality = {
	finalization: 'verified' | 'repaired' | 'needs_review' | 'draft' | 'unknown';
	grounding:
		| 'grounded'
		| 'derived_context'
		| 'hypothesis_only'
		| 'light_context'
		| 'unknown';
	repairAttempted: boolean;
	repairApplied: boolean;
	violations: string[];
};

const REQUIRED_CONTEXT_LABELS: Record<string, string> = {
	business_goal: 'Цель бизнеса',
	market_or_segment: 'Рынок / сегмент',
	offer: 'Предложение / продукт',
	monetization_or_constraints: 'Монетизация / ограничения',
	audience: 'Аудитория',
	jtbd: 'JTBD / задачи клиента',
	positioning: 'Позиционирование',
	channels: 'Каналы',
	budget: 'Бюджет',
	kpi: 'KPI',
	competitors: 'Конкуренты',
	timeline: 'Сроки',
	sample: 'Выборка',
	hypotheses: 'Гипотезы',
	research_questions: 'Исследовательские вопросы',
	target_surface_or_module: 'Целевая поверхность / модуль',
	decision_question: 'Вопрос решения',
	existing_code_or_canon_signals: 'Сигналы существующего кода / канона',
	constraints: 'Ограничения',
};

/** Human-readable required-context keys for Checks tab. */
export function formatDesktopAiRequiredContextLabel(raw: string): string {
	const key = String(raw || '').trim();
	if (!key) return '';
	const normalized = key.toLowerCase();
	return (
		REQUIRED_CONTEXT_LABELS[key] || REQUIRED_CONTEXT_LABELS[normalized] || key
	);
}

/** Human-readable finalizer violation codes. */
export function formatDesktopAiQualityViolation(raw: string): string {
	const value = String(raw || '').trim();
	if (!value) return '';
	const [code, detail = ''] = value.split(':', 2);
	switch (code) {
		case 'invented_brand':
			return detail
				? `Выдуманный бренд «${detail}» — нужен [Brand TBD] или имя из ваших материалов`
				: 'Выдуманный бренд без опоры во входе';
		case 'ice_arithmetic_mismatch':
			return detail
				? `Ошибка арифметики ICE: ${detail}`
				: 'Ошибка арифметики ICE (I×C×E ≠ score)';
		case 'ice_incomplete':
			return detail
				? `ICE ${detail} без формулы I×C×E — укажите компоненты`
				: 'ICE без формулы I×C×E';
		case 'ice_calculation_missing':
			return 'Нет численного расчёта ICE';
		case 'placeholder_marker':
			return detail
				? `Служебный плейсхолдер в тексте: ${detail}`
				: 'Служебный плейсхолдер в тексте документа';
		case 'source_citation_missing':
			return 'Есть источники, но в тексте нет ссылок 【P1】/【D1】/【W1】';
		case 'fact_hypothesis_boundary_missing':
			return 'Не разделено: факты vs гипотезы / что добрать';
		case 'missing_section':
			return detail ? `Нет раздела: ${detail}` : 'Нет обязательного раздела';
		case 'duplicate_sections':
			return detail
				? `Повторяющиеся разделы: ${detail}`
				: 'Повторяющиеся разделы';
		case 'unknown_citation':
			return detail
				? `Неизвестная ссылка: ${detail}`
				: 'Неизвестная ссылка на источник';
		case 'inventory_status_missing':
			return 'Нет инвентаря EXISTS / PARTIAL / MISSING перед предложениями «создать»';
		case 'domain_surface_lock_missing':
			return 'Нет domain / surface lock (какая поверхность исполнения в scope)';
		case 'keep_change_kill_missing':
			return 'Нет триады Keep / Change / Kill по инвентарю';
		case 'reinvents_existing':
			return 'План предлагает строить с нуля то, что уже отмечено как EXISTS';
		default:
			return value;
	}
}

function oneLine(value: unknown, maxLength = 180): string {
	return Array.from(String(value ?? ''), (char) => {
		const code = char.charCodeAt(0);
		return code <= 0x1f || code === 0x7f ? ' ' : char;
	})
		.join('')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, maxLength);
}

function safeHttpUrl(value: unknown): string | undefined {
	const raw = oneLine(value, 2048);
	if (!raw) return undefined;
	try {
		const parsed = new URL(raw);
		if (
			(parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
			!parsed.hostname ||
			parsed.username ||
			parsed.password
		) {
			return undefined;
		}
		return parsed.toString();
	} catch {
		return undefined;
	}
}

function defaultAuthority(
	kind: DesktopAiContextSourceKind
): DesktopAiContextSource['authority'] {
	if (kind === 'chat_attachment') return 'user_material';
	if (kind === 'project_document') return 'project_material';
	if (kind === 'derived_ai_artifact') return 'derived';
	return 'external';
}

const CITATION_MARKER_RE = /【([CPDW]\d{1,4})】/gi;

const CITATION_KIND_INLINE_RU: Record<DesktopAiContextSourceKind, string> = {
	chat_attachment: 'вложение',
	project_document: 'документ проекта',
	derived_ai_artifact: 'AI-материал',
	web: 'веб-источник',
};

/** Short inline label for 【P1】/【D2】 markers (Document body). */
export function formatDesktopAiCitationInlineLabel(
	source: DesktopAiContextSource
): string {
	const title = source.title?.trim() || source.citation_id;
	const kindLabel = CITATION_KIND_INLINE_RU[source.kind] ?? 'источник';
	return `${kindLabel}: ${title}`;
}

/** Replace model citation IDs with readable «kind: title» when sources are known. */
export function humanizeDesktopAiCitationMarkers(
	markdown: string,
	sources: DesktopAiContextSource[]
): string {
	if (!markdown.trim() || sources.length === 0) {
		return markdown;
	}
	const byId = new Map(
		sources.map((source) => [source.citation_id.toUpperCase(), source])
	);
	return markdown.replace(CITATION_MARKER_RE, (full, id: string) => {
		const source = byId.get(String(id).toUpperCase());
		if (!source) {
			return full;
		}
		return `«${formatDesktopAiCitationInlineLabel(source)}»`;
	});
}

export function normalizeDesktopAiContextSources(
	value: unknown
): DesktopAiContextSource[] {
	if (!Array.isArray(value)) return [];
	const out: DesktopAiContextSource[] = [];
	const seenCitationIds = new Set<string>();
	const seenUrls = new Set<string>();
	for (const row of value) {
		if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
		const record = row as Record<string, unknown>;
		const citationId = oneLine(record.citation_id, 8).toUpperCase();
		const kind = oneLine(record.kind, 32) as DesktopAiContextSourceKind;
		const title = oneLine(record.title);
		if (
			!CITATION_ID_RE.test(citationId) ||
			!SOURCE_KINDS.has(kind) ||
			!title ||
			seenCitationIds.has(citationId)
		) {
			continue;
		}
		const authorityValue = oneLine(record.authority, 32) as
			| DesktopAiContextSource['authority']
			| '';
		const authority = SOURCE_AUTHORITIES.has(
			authorityValue as DesktopAiContextSource['authority']
		)
			? (authorityValue as DesktopAiContextSource['authority'])
			: defaultAuthority(kind);
		const url = safeHttpUrl(record.url);
		if (kind === 'web' && !url) continue;
		if (url && seenUrls.has(url)) continue;
		seenCitationIds.add(citationId);
		if (url) seenUrls.add(url);
		out.push({
			citation_id: citationId,
			kind,
			authority,
			title,
			...(url ? { url } : {}),
		});
	}
	return out;
}

function nextWebCitationId(used: Set<string>): string {
	let index = 1;
	while (used.has(`W${index}`)) index += 1;
	return `W${index}`;
}

export function mergeDesktopAiEvidenceSources(
	contextSources: unknown,
	webSources: DesktopAiWebSearchSource[] = []
): DesktopAiContextSource[] {
	const out = normalizeDesktopAiContextSources(contextSources);
	const usedCitationIds = new Set(out.map((source) => source.citation_id));
	const usedUrls = new Set(
		out.flatMap((source) => (source.url ? [source.url] : []))
	);
	for (const source of normalizeWebSearchSources(webSources)) {
		const url = safeHttpUrl(source.url);
		if (!url || usedUrls.has(url)) continue;
		const citationId = nextWebCitationId(usedCitationIds);
		usedCitationIds.add(citationId);
		usedUrls.add(url);
		out.push({
			citation_id: citationId,
			kind: 'web',
			authority: 'external',
			title: oneLine(source.title) || new URL(url).hostname,
			url,
		});
	}
	return out;
}

export function resolveDesktopAiMessageEvidenceSources(
	metadata: DesktopAiMessageMetadata | null | undefined,
	liveWebSources: DesktopAiWebSearchSource[] = []
): DesktopAiContextSource[] {
	const summarySources = metadata?.context_summary?.context_sources ?? [];
	const directSources = metadata?.context_sources ?? [];
	const persistedWebSources = metadata?.desktop_web_search_sources ?? [];
	return mergeDesktopAiEvidenceSources(
		[...directSources, ...summarySources],
		[...liveWebSources, ...persistedWebSources]
	);
}

export function resolveDesktopAiArtifactQuality(
	value: DesktopAiArtifactQualityStatus | null | undefined
): DesktopAiResolvedArtifactQuality {
	const rawStatus = oneLine(value?.status, 32);
	const rawGrounding = oneLine(value?.grounding_status, 32);
	const legacyGrounding = GROUNDING_STATES.has(rawStatus) ? rawStatus : '';
	const finalization = FINALIZATION_STATES.has(rawStatus)
		? (rawStatus as DesktopAiResolvedArtifactQuality['finalization'])
		: 'unknown';
	const groundingValue = rawGrounding || legacyGrounding;
	const grounding = GROUNDING_STATES.has(groundingValue)
		? (groundingValue as DesktopAiResolvedArtifactQuality['grounding'])
		: 'unknown';
	return {
		finalization,
		grounding,
		repairAttempted: value?.repair_attempted === true,
		repairApplied: value?.repair_applied === true,
		violations: Array.isArray(value?.violations)
			? value.violations
					.filter((item): item is string => typeof item === 'string')
					.map((item) => oneLine(item, 160))
					.filter(Boolean)
			: [],
	};
}

function escapeMarkdownCell(value: string): string {
	return value.replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

export function appendDesktopAiEvidenceAppendix(
	markdown: string,
	sources: DesktopAiContextSource[],
	t: TFunction<'desktopAiChat'>,
	options: { includeEmpty?: boolean } = {}
): string {
	const body = markdown.trim();
	const normalized = normalizeDesktopAiContextSources(sources);
	if (normalized.length === 0 && options.includeEmpty !== true) return body;
	const lines = [body, '', '---', '', `## ${t('evidenceExportHeading')}`, ''];
	if (normalized.length === 0) {
		lines.push(t('evidenceExportEmpty'));
		return lines.join('\n');
	}
	lines.push(
		t('evidenceExportIntro'),
		'',
		`| ${t('evidenceExportCitationColumn')} | ${t('evidenceExportMaterialColumn')} | ${t('evidenceExportTypeColumn')} |`,
		'| --- | --- | --- |'
	);
	for (const source of normalized) {
		const title = escapeMarkdownCell(source.title);
		const material = source.url ? `[${title}](${source.url})` : title;
		lines.push(
			`| 【${source.citation_id}】 | ${material} | ${escapeMarkdownCell(
				t(`evidenceKind.${source.kind}`)
			)} |`
		);
	}
	return lines.join('\n');
}
