/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure utilities, date formatting, and preset templates for Kursorina.
 *
 * Invariants:
 * - Deterministic helpers without network or side-effects.
 *
 * Related:
 * - shared/web/frontend/src/pages/Desktop/apps/kursorina/types.ts
 * - documentation/product/desktop/KURSORINA.md
 */

import type {
	InvestigationPreset,
	MissionPublicView,
	MissionStatus,
} from './types';

const ACTIVE_STATUSES: ReadonlySet<MissionStatus> = new Set([
	'queued',
	'running',
]);
const TERMINAL_STATUSES: ReadonlySet<MissionStatus> = new Set([
	'completed',
	'blocked',
	'cancelled',
]);

export function parseTimestampMs(ts?: string): number {
	if (!ts) return 0;
	const normalized = ts.includes('T') ? ts : ts.replace(' ', 'T');
	const ms = Date.parse(normalized);
	return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Prefer the richer / newer mission snapshot when merging poll vs list.
 * Never roll a terminal view back to queued/running.
 */
export function preferFresher(
	prev: MissionPublicView | null,
	next: MissionPublicView
): MissionPublicView {
	if (!prev) return next;
	if (TERMINAL_STATUSES.has(prev.status) && ACTIVE_STATUSES.has(next.status)) {
		return prev;
	}
	if (TERMINAL_STATUSES.has(next.status) && ACTIVE_STATUSES.has(prev.status)) {
		return next;
	}
	if (next.answer && !prev.answer) {
		return next;
	}
	if (next.results.length > prev.results.length) {
		return next;
	}
	const prevMs = parseTimestampMs(prev.updated_at);
	const nextMs = parseTimestampMs(next.updated_at);
	if (prevMs > 0 && nextMs > 0 && nextMs < prevMs) {
		return prev;
	}
	return next;
}

/**
 * Merge server list with local state so a late/stale empty list cannot wipe
 * a just-created mission, and poll-fresher rows are not overwritten by older list rows.
 */
export function mergeServerMissions(
	server: MissionPublicView[],
	prev: MissionPublicView[]
): MissionPublicView[] {
	const serverIds = new Set(server.map((m) => m.id));
	const mergedById = new Map<string, MissionPublicView>();

	for (const remote of server) {
		const local = prev.find((m) => m.id === remote.id) ?? null;
		mergedById.set(remote.id, preferFresher(local, remote));
	}

	// Keep local-only rows (create raced ahead of list) at the front.
	const orphans = prev.filter((m) => !serverIds.has(m.id));

	return [...orphans, ...server.map((m) => mergedById.get(m.id) ?? m)];
}

export function formatRelativeDate(ts?: string): string {
	const ms = parseTimestampMs(ts);
	if (!ms) return '';
	const now = Date.now();
	const diffSec = Math.floor((now - ms) / 1000);

	if (diffSec < 60) {
		return 'Только что';
	}
	if (diffSec < 3600) {
		const mins = Math.floor(diffSec / 60);
		return `${mins} мин назад`;
	}

	const date = new Date(ms);
	const nowDate = new Date(now);
	const isToday =
		date.getDate() === nowDate.getDate() &&
		date.getMonth() === nowDate.getMonth() &&
		date.getFullYear() === nowDate.getFullYear();

	const timeStr = date.toLocaleTimeString('ru-RU', {
		hour: '2-digit',
		minute: '2-digit',
	});

	if (isToday) {
		return `Сегодня, ${timeStr}`;
	}

	const yesterday = new Date(now - 86400000);
	const isYesterday =
		date.getDate() === yesterday.getDate() &&
		date.getMonth() === yesterday.getMonth() &&
		date.getFullYear() === yesterday.getFullYear();

	if (isYesterday) {
		return `Вчера, ${timeStr}`;
	}

	return date.toLocaleDateString('ru-RU', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	});
}

export function formatFullDate(ts?: string): string {
	const ms = parseTimestampMs(ts);
	if (!ms) return '';
	return new Date(ms).toLocaleString('ru-RU', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function extractTopicFromGoal(goal: string, maxLength = 65): string {
	if (!goal) return 'Без названия';
	let cleaned = goal
		.replace(/^(?:конекст|контекст)\s*(?:ситуации)?[:\s-]*/i, '')
		.replace(/^(?:цель|задача|исследуй|изучи|найти|найди)[:\s-]*/i, '')
		.replace(/\s+/g, ' ')
		.trim();

	const firstSentence = cleaned.split(/[.\n!?]/)[0]?.trim();
	if (firstSentence && firstSentence.length >= 10) {
		cleaned = firstSentence;
	}

	if (cleaned.length <= maxLength) {
		return cleaned;
	}
	return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

export function statusLabel(status: MissionStatus): string {
	switch (status) {
		case 'queued':
			return 'В очереди';
		case 'running':
			return 'В работе';
		case 'completed':
			return 'Готово';
		case 'blocked':
			return 'Остановка';
		case 'cancelled':
			return 'Отменено';
		default:
			return status;
	}
}

export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.style.position = 'fixed';
		textarea.style.opacity = '0';
		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();
		try {
			const success = document.execCommand('copy');
			document.body.removeChild(textarea);
			return success;
		} catch {
			document.body.removeChild(textarea);
			return false;
		}
	}
}

export function downloadMarkdownFile(
	filename: string,
	content: string
): boolean {
	try {
		const safeName = filename.replace(/[/\\?%*:|"<>]/g, '_');
		const blob = new Blob([content], {
			type: 'text/markdown;charset=utf-8',
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = safeName.endsWith('.md') ? safeName : `${safeName}.md`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		return true;
	} catch {
		return false;
	}
}

export const PRESET_TEMPLATES: InvestigationPreset[] = [
	{
		id: 'market-analysis',
		title: 'Рынок и конкурентный ландшафт',
		category: 'Стратегия',
		badge: 'B2B / B2C',
		prompt:
			'Исследуй рынок корпоративного ПО и платформ с искусственным интеллектом в России. Найди ключевых производителей и поставщиков, сравни линейки продуктов, ценообразование и целевые сегменты. Составь сводную таблицу с бенчмарками и выдели рыночные тренды.',
	},
	{
		id: 'import-subst',
		title: 'Импортозамещение и реестры ПО',
		category: 'Нормативы',
		badge: 'Реестр Минцифры',
		prompt:
			'Проанализируй статус перехода на российское системное и офисное ПО. Найди отечественные операционные системы и платформы из реестра Минцифры, оцени уровень зрелости, ключевых вендоров, совместимость и реальные кейсы внедрения в госсекторе и enterprise.',
	},
	{
		id: 'unit-economics',
		title: 'Юнит-экономика и финмодель',
		category: 'Финансы',
		badge: 'Python-модель',
		prompt:
			'Построй юнит-экономику для сервиса с подписочной моделью. Проведи расчет CAC, LTV, Churn rate, ARPU и срока окупаемости. Рассчитай финансовую модель в Python, выведи ключевые метрики и представь результаты в виде структурированной таблицы с выводами.',
	},
	{
		id: 'library-research',
		title: 'Анализ корпоративной библиотеки',
		category: 'База знаний',
		badge: 'Внутренние данные',
		prompt:
			'Исследуй корпоративную библиотеку и документы компании. Найди материалы по архитектуре, регламентам, описанию продуктов и текущим проектам. Составь структурированную аналитическую записку с перечнем ключевых источников и рекомендациями.',
	},
	{
		id: 'architecture-diagram',
		title: 'Архитектура и Mermaid-схема',
		category: 'Инженерия',
		badge: 'Схема / Диаграмма',
		prompt:
			'Исследуй архитектуру микросервисов и пайплайн обработки данных платформы. Построй подробную Mermaid блок-схему (flowchart/sequence), опиши связи между сервисами, очередями и хранилищами, и выгрузи схему архитектуры.',
	},
	{
		id: 'standards-kbsew',
		title: 'Регламенты и стандарты (KBSEW)',
		category: 'Нормативы',
		badge: 'База знаний KBSEW',
		prompt:
			'Найди в корпоративной базе знаний стандарты разработки, регламенты информационной безопасности и требования ГОСТ. Составь перечень ключевых требований и матрицу соответствия в виде сводной таблицы.',
	},
	{
		id: 'swot-strategic',
		title: 'SWOT-анализ и стратегия продукта',
		category: 'Стратегия',
		badge: 'SWOT-матрица',
		prompt:
			'Проведи комплексный стратегический SWOT-анализ нашего продукта и ключевых конкурентов на рынке. Сформируй 4-квадрантную матрицу (Strengths, Weaknesses, Opportunities, Threats) и перекрестные инициативы (SO, WO, ST, WT стратегии).',
	},
	{
		id: 'executive-dossier',
		title: 'Представительское HTML-досье',
		category: 'Отчетность',
		badge: 'HTML-досье',
		prompt:
			'Подготовь комплексное аналитическое досье по рынку и продуктовой стратегии. Выдели ключевые сущности, проведи расчет финансовых показателей и сверстай автономный представительский HTML-отчет с карточками и сводными таблицами.',
	},
	{
		id: 'risk-and-compliance',
		title: 'Матрица рисков и комплаенс (152-ФЗ / ГОСТ)',
		category: 'Безопасность',
		badge: 'Риски & ГОСТ',
		prompt:
			'Проведи комплексную оценку рисков внедрения и аудит соответствия стандартам (152-ФЗ, ГОСТ Р 57580.1, требования ФСТЭК). Построй матрицу рисков с расчетом индекса критичности (P×I) и стратегиями митигации, а также чеклист регуляторной готовности.',
	},
	{
		id: 'competitor-roadmap',
		title: 'Бенчмарк конкурентов и дорожная карта',
		category: 'Продукт',
		badge: 'Бенчмарк & Roadmap',
		prompt:
			'Проведи детальный взвешенный конкурентный бенчмаркинг по ключевым игрокам на рынке (функциональность, стоимость, безопасность, поддержка). Сформируй поэтапную дорожную карту внедрения с вехами и диаграммой Ганта (Gantt).',
	},
];
