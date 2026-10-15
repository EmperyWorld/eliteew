/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Humanized agentic observability copy — no raw think/tool error markers in UI.
 *
 * Related:
 * - src/features/ewa/agentic/agenticObservabilityUi.ts
 */

import { describe, expect, it } from 'vitest';

import {
	agenticCheckpointSummaryLooksLikeMarkdown,
	compactAgenticPlanSummaryDisplay,
	filterAgenticTraceRows,
	formatAgenticGateTitle,
	formatAgenticNodeStatus,
	humanizeAgenticCheckpointSummary,
	humanizeAgenticPlanSummary,
	isNoisyAgenticTraceRow,
	isTechnicalAgenticSummary,
	looksLikeAgenticResearchScaffold,
	pickAgenticCardTitle,
} from '@/features/ewa/agentic/agenticObservabilityUi';

const t = ((
	key: string,
	opts?: string | { detail?: string; name?: string; tool?: string }
) => {
	const optFields =
		typeof opts === 'object' && opts !== null ? opts : undefined;
	const ru: Record<string, string> = {
		'ewaCompanion.agenticErrorThinkSchema':
			'Не удалось разобрать план модели — перестраиваю шаги.',
		'ewaCompanion.agenticErrorPlanNodeWithoutTool':
			'Пропущен шаг плана без исполняемого инструмента.',
		'ewaCompanion.agenticErrorDocumentExtractorNeedsCatalog':
			'Сначала откройте каталог и выберите файл.',
		'ewaCompanion.agenticErrorInvalidContentId': `Нужен id файла: ${optFields?.name ?? ''}`,
		'ewaCompanion.agenticErrorDocumentExtractorDisabled':
			'Чтение документов сейчас недоступно на сервере.',
		'ewaCompanion.agenticErrorToolFailed': `Шаг не выполнен: ${optFields?.detail ?? ''}`,
		'ewaCompanion.agenticErrorToolReturnedNone': `Инструмент «${optFields?.tool ?? ''}» не вернул результат`,
		'ewaCompanion.agenticGateDecisionRequired': 'Нужно ваше решение',
		'ewaCompanion.agenticErrorCatalogFileNone':
			'не удалось получить список файлов',
		'ewaCompanion.agenticErrorCatalogFileTools':
			'просмотр каталога и открытие файла',
		'ewaCompanion.operationIntentAgenticSession': 'Агентная сессия',
		'ewaCompanion.agenticNodeStatusFailed': 'ошибка',
		'ewaCompanion.agenticExpertResearchDoneLaconic':
			'Экспертное исследование завершено',
	};
	if (typeof opts === 'string') {
		return ru[key] ?? opts;
	}
	return ru[key] ?? key;
}) as never;

describe('agenticObservabilityUi', () => {
	it('detects technical plan summaries', () => {
		expect(
			isTechnicalAgenticSummary(
				'Mission text\n[think_error] schema_validation_failed:missing'
			)
		).toBe(true);
	});

	it('humanizes think and tool errors in Russian', () => {
		const out = humanizeAgenticPlanSummary(
			'Phase plan\n[think_error] schema_validation_failed:missing\n[tool_error] tool_act_error:Document extractor is disabled (EWA_COMPANION_WF_DOCUMENT_EXTRACTOR_ENABLED).',
			t
		);
		expect(out).toContain('Не удалось разобрать план модели');
		expect(out).toContain('Чтение документов');
		expect(out).not.toContain('[think_error]');
		expect(out).not.toContain('EWA_COMPANION');
	});

	it('prefers goal text as card title when plan summary is technical', () => {
		expect(
			pickAgenticCardTitle(
				'[tool_error] tool_act_error:Document extractor is disabled',
				'Подготовь стратегию для ДВФУ',
				t
			)
		).toBe('Подготовь стратегию для ДВФУ');
	});

	it('translates node status labels', () => {
		expect(formatAgenticNodeStatus('failed', t)).toBe('ошибка');
	});

	it('humanizes tool returned None and gate title', () => {
		expect(
			humanizeAgenticPlanSummary("Tool 'file_open' returned None", t)
		).toContain('file_open');
		expect(formatAgenticGateTitle('Decision required', t)).toBe(
			'Нужно ваше решение'
		);
	});

	it('humanizes invalid unified_content_id filename', () => {
		const out = humanizeAgenticPlanSummary(
			"[tool_error] tool_act_error:invalid unified_content_id: 'ДВФУ_цифроваястратегия.txt'",
			t
		);
		expect(out).toContain('ДВФУ_цифроваястратегия.txt');
		expect(out).not.toContain('[tool_error]');
		expect(out).not.toContain('tool_act_error');
	});

	it('compact display dedupes repeated replan sentences', () => {
		const raw =
			'[think_error] schema_validation_failed:missing '.repeat(3) +
			"[tool_error] tool_act_error:invalid unified_content_id: 'doc.txt'";
		const out = compactAgenticPlanSummaryDisplay(raw, t);
		expect(out).not.toContain('[think_error]');
		expect(
			(out.match(/Не удалось разобрать план модели/g) ?? []).length
		).toBeLessThanOrEqual(1);
		expect(out).toContain('doc.txt');
	});

	it('humanizes and dedupes step_missing_tool_name tokens', () => {
		const raw =
			'step_missing_tool_name step_missing_tool_name plan_tool_args_invalid:document_extractor:requires id';
		const out = compactAgenticPlanSummaryDisplay(raw, t);
		expect(out).toContain('каталог');
		expect(out).not.toContain('step_missing_tool_name');
		expect(out).not.toContain('plan_tool_args_invalid');
	});

	it('detects markdown-like checkpoint summaries for rich render', () => {
		expect(
			agenticCheckpointSummaryLooksLikeMarkdown(
				'## Итоги\n\n- пункт один\n- пункт два'
			)
		).toBe(true);
		expect(
			agenticCheckpointSummaryLooksLikeMarkdown(
				'Готова: создала документ «файл.md»'
			)
		).toBe(false);
		// research_plan scaffolds stay plain laconic — not markdown panels
		expect(
			agenticCheckpointSummaryLooksLikeMarkdown(
				'## Фокус\n\n**Контекст решения**\n\n- пункт'
			)
		).toBe(false);
	});

	it('collapses research_plan methodology dumps to a laconic journal line', () => {
		const raw =
			'## Результат\n\n### План анализа\n\n**Методика обработки данных**\n* Кодирование…';
		expect(looksLikeAgenticResearchScaffold(raw)).toBe(true);
		const out = humanizeAgenticCheckpointSummary(raw, t, { maxChars: 220 });
		expect(out.toLowerCase()).toContain('завершено');
		expect(out).not.toContain('Методика');
		expect(agenticCheckpointSummaryLooksLikeMarkdown(out)).toBe(false);
	});

	it('allows longer non-technical checkpoint summaries for markdown panels', () => {
		const long = `${'абзац исследования '.repeat(80)}конец`;
		expect(long.length).toBeGreaterThan(220);
		const out = humanizeAgenticCheckpointSummary(long, t, { maxChars: 220 });
		expect(out.length).toBeLessThanOrEqual(220);
		expect(out.endsWith('…')).toBe(true);
	});

	it('soft-filters observe ticks, empty state transitions, and compose-continue', () => {
		expect(
			isNoisyAgenticTraceRow({
				kind: 'observe',
				payload_json: { summary: 'tick iter=1' },
			})
		).toBe(true);
		expect(
			isNoisyAgenticTraceRow({
				kind: 'act',
				payload_json: { summary: 'tick iter=2' },
			})
		).toBe(true);
		expect(
			isNoisyAgenticTraceRow({
				kind: 'state_transition',
				payload_json: { summary: '' },
			})
		).toBe(true);
		expect(
			isNoisyAgenticTraceRow({
				kind: 'act',
				payload_json: { summary: 'compose_continue draft' },
			})
		).toBe(true);
		expect(
			isNoisyAgenticTraceRow({
				kind: 'act',
				payload_json: {
					summary: 'Готова: создала документ «списка_топ_промтов.md»',
				},
			})
		).toBe(false);

		const filtered = filterAgenticTraceRows([
			{
				kind: 'observe',
				payload_json: { summary: 'tick iter=1' },
			},
			{
				kind: 'state_transition',
				payload_json: { summary: '' },
			},
			{
				kind: 'act',
				payload_json: {
					summary: 'Готова: создала документ «файл.md»',
				},
			},
			{
				kind: 'act',
				payload_json: {
					summary: '## Фокус\n\n**Контекст**',
				},
			},
		]);
		expect(filtered).toHaveLength(2);
		expect(filtered[0]?.payload_json?.summary).toContain('файл.md');
		expect(filtered[1]?.payload_json?.summary).toContain('## Фокус');
	});

	it('humanizes bare schema_validation_failed codes', () => {
		expect(
			humanizeAgenticPlanSummary(
				'schema_validation_failed:literal_error:payload.mutate.plan_nodes.2.node_kind',
				t
			)
		).toBe('Не удалось разобрать план модели — перестраиваю шаги.');
	});

	it('strips channel leakage from checkpoint summaries', () => {
		const out = humanizeAgenticCheckpointSummary(
			'<|channel>thought\nInternal\n<channel|>\nГотово: стих сохранён.',
			t
		);
		expect(out).not.toMatch(/channel/i);
		expect(out).toContain('Готово: стих сохранён.');
	});

	it('humanizes bare schema_validation codes in checkpoint summaries', () => {
		expect(
			humanizeAgenticCheckpointSummary(
				'schema_validation_failed:literal_error:payload.mutate.plan_nodes.2.node_kind',
				t
			)
		).toBe('Не удалось разобрать план модели — перестраиваю шаги.');
	});
});
