/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local Discussion preset catalog (ids must match backend registry).
 *
 * Invariants:
 * - Fallback only when presets API is unavailable; ids stay byte-stable.
 *
 * Related:
 * - api/services/desktop_chat_ensemble/discussion/presets/
 */
import type { DiscussionPreset } from './types';

export const DISCUSSION_FALLBACK_PRESETS: DiscussionPreset[] = [
	{
		id: 'brainstorm',
		title_ru: 'Мозговой штурм',
		title_en: 'Brainstorm',
		description_ru: 'Варианты, возражения и отбор сильных идей.',
		description_en: 'Options, challenges, and strong ideas.',
		default_intensity: 'professional_confrontational',
		checkpoint_interval: 5,
		min_roster: 2,
		max_roster: 8,
	},
	{
		id: 'product_review',
		title_ru: 'Разбор продукта',
		title_en: 'Product review',
		description_ru: 'Границы поставки, риски и критерии приёмки.',
		description_en: 'Delivery boundaries, risks, and acceptance.',
		default_intensity: 'professional_confrontational',
		checkpoint_interval: 5,
		min_roster: 2,
		max_roster: 8,
	},
	{
		id: 'marketing_strategy',
		title_ru: 'Маркетинговая стратегия',
		title_en: 'Marketing strategy',
		description_ru: 'Сегмент, оффер и канальный rationale.',
		description_en: 'Segment, offer, channel rationale.',
		default_intensity: 'professional_confrontational',
		checkpoint_interval: 5,
		min_roster: 2,
		max_roster: 8,
	},
	{
		id: 'responsibility_assignment',
		title_ru: 'Распределение ответственностей',
		title_en: 'Responsibility assignment',
		description_ru: 'Owners, handoff и критерии готовности.',
		description_en: 'Owners, handoffs, and done criteria.',
		default_intensity: 'professional_confrontational',
		checkpoint_interval: 5,
		min_roster: 2,
		max_roster: 8,
	},
	{
		id: 'interview',
		title_ru: 'Интервью',
		title_en: 'Interview',
		description_ru: 'Вопросы к вам: уточнения и короткая оценка ответов.',
		description_en:
			'They interview you: questions, probes, and a short read of your answers.',
		default_intensity: 'calm',
		checkpoint_interval: 5,
		min_roster: 1,
		max_roster: 4,
	},
	{
		id: 'decision',
		title_ru: 'Принятие решения',
		title_en: 'Decision',
		description_ru:
			'Сравнить варианты и выбрать следующий шаг с явными рисками.',
		description_en:
			'Compare options and pick the next step, with risks in the open.',
		default_intensity: 'professional_confrontational',
		checkpoint_interval: 5,
		min_roster: 2,
		max_roster: 8,
	},
	{
		id: 'negotiation',
		title_ru: 'Переговоры',
		title_en: 'Negotiation',
		description_ru: 'Позиции, уступки и красные линии — без личных атак.',
		description_en:
			'Positions, concessions, and red lines — without personal attacks.',
		default_intensity: 'professional_confrontational',
		checkpoint_interval: 5,
		min_roster: 2,
		max_roster: 8,
	},
];

export const DISCUSSION_PRESET_IDS = DISCUSSION_FALLBACK_PRESETS.map(
	(p) => p.id
);
