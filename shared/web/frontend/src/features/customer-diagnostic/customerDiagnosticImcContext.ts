import type { CustomerDiagnosticSession } from '@/pages/MarketingCabinet/marketingCabinetApi';

import type { DiagnosticComputedResults } from './diagnosticScoring';
import type { CustomerDiagnosticSessionState } from './diagnosticTypes';

/** Тип generation_types в БД; совпадает с миграцией `imc_rag_customer_diagnostic`. */
export const IMC_CUSTOMER_DIAGNOSTIC_TYPE_KEY =
	'imc_rag_customer_diagnostic' as const;

/** Отдельный тип ИМК: разбор формулировок ответов без материалов проекта (см. миграцию imc_rag_customer_diagnostic_answers). */
export const IMC_CUSTOMER_DIAGNOSTIC_ANSWERS_TYPE_KEY =
	'imc_rag_customer_diagnostic_answers' as const;

export type CustomerDiagnosticImcBriefVariant = 'strategy' | 'operations';

function briefKeywordsFromResults(results: DiagnosticComputedResults): string {
	const parts: string[] = [];
	const arch = results.archetype;
	if (arch) {
		parts.push(arch.dominant.name, arch.secondary.name);
	}
	if (results.values?.percentages) {
		const top = Object.entries(results.values.percentages)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([k]) => k);
		parts.push(...top);
	}
	if (results.service) {
		parts.push('сервис', 'качество', 'ожидания');
	}
	if (results.emotions) {
		parts.push('эмоции', 'касания', 'journey');
	}
	return Array.from(new Set(parts.filter(Boolean))).join(', ');
}

/**
 * Текст для векторного поиска RAG + формулировка задачи (идёт в `context.brief` → research_query).
 */
export function buildCustomerDiagnosticImcBrief(
	variant: CustomerDiagnosticImcBriefVariant,
	results: DiagnosticComputedResults
): string {
	const kw = briefKeywordsFromResults(results);
	/** Явная формулировка для RAG: это не «общее исследование рынка», а разбор именно результатов диагностики в контексте проекта. */
	const base =
		'Задача: подготовить отчёт по результатам клиентской диагностики представителя заказчика с учётом материалов маркетингового проекта. ' +
		'Опираться на блок «Данные клиентской диагностики» в запросе и на релевантные фрагменты документов проекта из семантического поиска. ';
	if (variant === 'strategy') {
		return (
			base +
			'Стратегический акцент: сегмент, ценности, позиционирование, согласованность выводов с материалами проекта. ' +
			(kw ? `Маркеры профиля по данным диагностики: ${kw}.` : '')
		);
	}
	return (
		base +
		'Операционные рекомендации: сервис, эмоциональный контур, точки касания, следующие шаги команды; всё с привязкой к данным диагностики и к проекту. ' +
		(kw ? `Контекст профиля: ${kw}.` : '')
	);
}

/**
 * Бриф для типа «только ответы диагностики»: акцент на смысле формулировок, без запроса материалов проекта.
 */
export function buildCustomerDiagnosticImcAnswersBrief(
	results: DiagnosticComputedResults
): string {
	const kw = briefKeywordsFromResults(results);
	return (
		'Задача: качественно разобрать ответы представителя заказчика в клиентской диагностике — что сказано словами и выборами в анкете, ' +
		'где есть неясности, противоречия или пробелы. Опираться только на блок «Данные клиентской диагностики» в запросе; ' +
		'не подменять ответы и не строить выводы из внешних знаний о рынке или бренде. ' +
		(kw
			? `Ориентиры по уже посчитанным осям диагностики (для связки текста): ${kw}.`
			: '')
	);
}

/**
 * Большой текст для модели: снимок сессии + ответы + метрики (в `context.document_text`).
 */
export function buildCustomerDiagnosticDocumentText(input: {
	session: CustomerDiagnosticSession;
	state: CustomerDiagnosticSessionState;
	computedResults: DiagnosticComputedResults;
	completedModules: string[];
}): string {
	const { session, state, computedResults, completedModules } = input;
	const header = [
		'# Данные клиентской диагностики',
		'',
		'Этот блок — единственный источник ответов представителя и агрегированных метрик диагностики.',
		'',
	].join('\n');

	const meta = {
		session_id: session.id,
		project_id: session.project_id,
		progress_percent: session.progress_percent,
		updated_at: session.updated_at,
		completed_at: session.completed_at,
		completed_modules: completedModules,
		module_retake_status: session.module_retake_status ?? {},
	};

	const body = [
		'## Мета',
		JSON.stringify(meta, null, 2),
		'',
		'## Расчётные результаты (клиент, как в отчёте руководителю)',
		JSON.stringify(computedResults, null, 2),
		'',
		'## Серверные computed_results (если есть)',
		JSON.stringify(session.computed_results ?? {}, null, 2),
		'',
		'## Состояние сессии (включая ответы по модулям)',
		JSON.stringify(state, null, 2),
		'',
	].join('\n');

	return `${header}${body}`;
}
