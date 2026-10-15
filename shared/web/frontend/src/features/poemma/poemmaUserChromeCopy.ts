/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing Russian copy for POEMMA app chrome (top bar, sync banners, load states).
 *
 * Invariants:
 * - No operator/server jargon in default labels; technical detail only in title tooltips.
 * - Aligns with desktop shell tone from DesktopAppChrome / workspace settings.
 *
 * Related:
 * - src/features/poemma/ui/PoemmaTopBar.tsx
 * - src/features/poemma/PoemmaApp.tsx
 */

import type { PoemmaPeriod } from './poemmaDomain';
import type { PoemmaSyncStatus } from './poemmaRepository';

export const POEMMA_APP_TITLE = 'Карта бизнеса';

export type PoemmaUserSyncBadge = {
	label: string;
	detail: string | null;
	tone: 'neutral' | 'accent' | 'success' | 'info' | 'warning' | 'danger';
};

const PERIOD_STATUS_LABEL: Record<
	NonNullable<PoemmaPeriod['status']>,
	string
> = {
	draft: 'черновик',
	active: 'идёт',
	closed: 'закрыт',
};

function formatPoemmaPeriodDate(date: string): string {
	return new Intl.DateTimeFormat('ru-RU', {
		day: 'numeric',
		month: 'long',
	}).format(new Date(date));
}

/** Period chip for top bar — readable for business owners, not ops dashboards. */
export function poemmaUserPeriodLabel(period: PoemmaPeriod | null): string {
	if (!period) {
		return '90 дней · с сегодня';
	}
	const start = formatPoemmaPeriodDate(period.startDate);
	const status = PERIOD_STATUS_LABEL[period.status] ?? period.status;
	return `90 дней · ${status} · с ${start}`;
}

/** Readable period range for home meta and headers. */
export function formatPoemmaUserPeriodRange(
	period: PoemmaPeriod | null
): string {
	if (!period) {
		return 'Черновик периода';
	}
	const start = formatPoemmaPeriodDate(period.startDate);
	const end = formatPoemmaPeriodDate(period.endDate);
	return `${start} — ${end}`;
}

/**
 * Sync badge for top bar. Returns null when everything is fine — no «Сервер онлайн» noise.
 */
export function resolvePoemmaUserSyncBadge(
	status: PoemmaSyncStatus
): PoemmaUserSyncBadge | null {
	switch (status.stage) {
		case 'online':
		case 'local-only':
			return null;
		case 'syncing':
			return {
				label: 'Сохраняем',
				detail: status.message,
				tone: 'info',
			};
		case 'bootstrapping':
			return {
				label: 'Загружаем данные',
				detail: status.message,
				tone: 'warning',
			};
		case 'fallback-local':
			return {
				label: 'Без связи',
				detail:
					status.message ??
					'Изменения на этом устройстве. Подключение восстановится автоматически.',
				tone: 'warning',
			};
		case 'degraded':
			return {
				label: 'Проверьте сохранение',
				detail:
					status.message ??
					'Последние изменения могли не дойти до облака. Нажмите «Обновить» в уведомлении ниже.',
				tone: 'danger',
			};
	}
}

export function poemmaUserSyncBannerCopy(status: PoemmaSyncStatus): {
	tone: 'warning' | 'danger';
	title: string;
	description: string;
	actionLabel: string;
} {
	if (status.stage === 'degraded') {
		return {
			tone: 'danger',
			title: 'Не всё удалось сохранить',
			description:
				status.message ??
				'Проверьте интернет и нажмите «Обновить». Ваши записи на устройстве не пропадут.',
			actionLabel: 'Обновить',
		};
	}
	return {
		tone: 'warning',
		title: 'Сейчас без связи с облаком',
		description:
			status.message ??
			'Можно продолжать работу — данные остаются на этом устройстве. Когда связь вернётся, карта обновится.',
		actionLabel: 'Обновить',
	};
}

export const POEMMA_USER_LOAD_COPY = {
	loadingTitle: 'Загружаем карту',
	loadingDescription: 'Собираем период, цели и ваши записи.',
	errorTitle: 'Не удалось открыть карту',
	retryLoad: 'Попробовать снова',
} as const;

/** Section eyebrows — human labels, not product codename. */
export const POEMMA_SECTION_EYEBROW = {
	home: 'Ваш период · 90 дней',
	onboarding: 'Старт · 6 шагов',
	strategy: 'Смысл и продукт',
	goal: 'Цель · 90 дней',
	finance: 'Цифры',
	segments: 'Кто покупает',
	happiness: 'Опыт',
	customerPath: 'Путь клиента',
	ideas: 'Идеи',
	ideaDetail: 'Идея',
	promoChannels: 'Каналы',
	promoAction: 'Акция',
	promoLinks: 'Ссылки',
	periodClose: 'Итоги периода',
	guide: 'Навигатор',
	team: 'Задачи',
	settings: 'Настройки',
} as const;

export const POEMMA_PAGE_DESCRIPTION = {
	goal: 'Сколько прибыли планируете за текущие 90 дней.',
	segments: 'Четыре сегмента с долями — сумма должна быть 100%.',
} as const;

export const POEMMA_HOME_COPY = {
	profitEmptyTitle: 'Укажите прибыль',
	profitEmptyAction: 'Ввести цифры',
} as const;

export const POEMMA_FINANCE_COPY = {
	sync1cAction: 'Загрузить из 1С',
	sync1cProgress: 'Загружаем…',
} as const;

export const POEMMA_SETTINGS_COPY = {
	periodFixed: '90 дней — рабочий цикл карты',
	integration1cStatus: 'Пока не подключено',
	integration1cAction: 'Загрузить из 1С',
	backupIntro:
		'Скачайте копию, чтобы не потерять карту при смене браузера. Восстановление — только для вашего аккаунта.',
	backupDownload: 'Скачать копию',
	backupDownloading: 'Скачиваем…',
	backupImport: 'Восстановить из файла',
	backupImporting: 'Восстанавливаем…',
	backupDownloaded: 'Копия сохранена',
	backupDownloadFailed: 'Не удалось скачать копию',
	backupRestored: 'Данные восстановлены',
	teamReadOnlyHint:
		'Здесь можно посмотреть настройки и скачать резервную копию.',
} as const;

export const POEMMA_EXPORT_SOON = {
	description:
		'Материалы для печати и презентаций появятся в следующем обновлении.',
} as const;

export const POEMMA_BOOTSTRAP_COPY = {
	eyebrow: 'Первый вход',
	title: 'Честная карта бизнеса',
	description:
		'Без обещаний «из воздуха». Создадим основу и период 90 дней — затем короткий мастер из 6 шагов.',
	action: 'Начать',
} as const;

export const POEMMA_ACCESS_DENIED = {
	ownerTitle: 'Только для собственника',
	ownerDescription:
		'Этот раздел видит собственник бизнеса. Команда работает с задачами, опытом и идеями на главной.',
	financeDescription:
		'Прибыль и выручку видит собственник. Вам доступны задачи, опыт и идеи на карте.',
} as const;
