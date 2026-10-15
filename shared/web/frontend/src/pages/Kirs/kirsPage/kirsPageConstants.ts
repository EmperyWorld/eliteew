/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KIRS curation page constants, template catalog, and Russian count/format helpers.
 *
 * Invariants:
 * - KIRS_KEY query prefix unchanged for React Query cache invalidation.
 * - Template keys match backend project_site_instances.template_key enum.
 *
 * Related:
 * - useKirsPage.ts
 * - ../KirsPage.tsx (facade)
 * - documentation/product/KIRS-SITE-CURATION.md
 */

import type { SiteStudioDomainBinding } from '@/features/site-studio/desktop/api';

export const KIRS_KEY = ['kirs'] as const;

export type KirsTemplateOption = {
	key: 'olenti' | 'allenti' | 'aurelia';
	title: string;
	subtitle: string;
	description: string;
	capabilities: string[];
};

export const KIRS_TEMPLATE_OPTIONS: readonly KirsTemplateOption[] = [
	{
		key: 'olenti',
		title: 'Olenti',
		subtitle: 'Универсальная витрина',
		description:
			'Лучший старт по умолчанию: подойдёт для большинства проектов и быстро запускается.',
		capabilities: [
			'Готовая структура главной, каталога и контента',
			'Сбалансированный стиль для презентации услуг и товаров',
			'Рекомендуется для первого запуска и быстрой проверки идеи',
		],
	},
	{
		key: 'allenti',
		title: 'Allenti',
		subtitle: 'Гибкая версия под кастомизацию',
		description:
			'Подходит, если заранее планируете более индивидуальную подачу и точечную донастройку.',
		capabilities: [
			'Удобен для проектов с ручной правкой блоков',
			'Поддерживает тот же рабочий поток витрины и админки',
			'Хороший выбор для кураторских сценариев с итерациями',
		],
	},
	{
		key: 'aurelia',
		title: 'Aurelia',
		subtitle: 'Премиальный шаблон с усиленным narrative',
		description:
			'Готовый сценарий для экспертных и сервисных проектов: сильный first-screen, доверительный блок "о бренде" и конверсионные CTA.',
		capabilities: [
			'Автоприменение стартового контента и темы при первом запуске',
			'Структура под витрину, услуги, консультации и контентный прогрев',
			'Подходит, когда нужен качественный результат без долгой ручной сборки',
		],
	},
];

export function getKirsTemplateOption(key: string): KirsTemplateOption {
	return (
		KIRS_TEMPLATE_OPTIONS.find((option) => option.key === key) ??
		KIRS_TEMPLATE_OPTIONS[0]
	);
}

export function formatRuCountWord(
	count: number,
	singular: string,
	few: string,
	many: string
): string {
	const absCount = Math.abs(count) % 100;
	const lastDigit = absCount % 10;
	if (absCount > 10 && absCount < 20) {
		return many;
	}
	if (lastDigit === 1) {
		return singular;
	}
	if (lastDigit >= 2 && lastDigit <= 4) {
		return few;
	}
	return many;
}

export function formatKirsToggleAnnouncement(
	isExpanded: boolean,
	count: number
): string {
	const rowsWord = formatRuCountWord(count, 'строка', 'строки', 'строк');
	const stateLabel = isExpanded
		? 'Подробный список раскрыт'
		: 'Подробный список свернут';
	return `${stateLabel} (${count} ${rowsWord})`;
}

export function formatKirsGroupedCountSr(count: number): string {
	const reasonWord = formatRuCountWord(
		count,
		'сгруппированная причина',
		'сгруппированные причины',
		'сгруппированных причин'
	);
	return `${count} ${reasonWord}`;
}

export function formatKirsHiddenCountSr(count: number): string {
	const hiddenWord = formatRuCountWord(
		count,
		'скрытая подробность',
		'скрытые подробности',
		'скрытых подробностей'
	);
	return `${count} ${hiddenWord}`;
}

export function formatKirsLifecycleJob(
	job: {
		task_type: string;
		status: string;
		stage: string | null;
	} | null
): string {
	if (!job) return '';
	const task = job.task_type.replace(/^site_studio_/, '');
	const stage = job.stage || job.status;
	return `${task} · ${job.status}${stage ? ` · ${stage}` : ''}`;
}

export function getKirsDomainToken(binding: SiteStudioDomainBinding): string {
	const value = binding.metadata_json.dns_txt_value;
	return typeof value === 'string' ? value : binding.verification_token_preview;
}
