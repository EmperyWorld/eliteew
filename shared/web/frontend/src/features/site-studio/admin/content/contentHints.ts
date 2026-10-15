/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Operator hints for embedded Site Studio admin — where each CMS section appears on the storefront.
 *
 * Invariants:
 * - Keys match content structure page/section ids from `/content/structure`.
 * - Mirror of `site-templates/olenti/src/pages/admin/content/contentHints.ts`.
 *
 * Related:
 * - features/site-studio/admin/content/ContentPage.tsx
 */

/** Section id → human-readable placement hint for operators. */
export const SECTION_WHERE_ON_SITE: Record<string, Record<string, string>> = {
	home: {
		hero: 'Верхний баннер главной: заголовок, подзаголовок, кнопки и карточка справа',
		about_preview: 'Блок о проекте или основателе с фото и приветствием',
		why_choose: 'Секция с преимуществами проекта — 4 карточки',
		ways_to_work: 'Блок «Форматы работы» — 4 формата с описаниями',
		value_block: 'Блок «Как мы работаем» — три пункта и кнопка',
		products_section: 'Заголовок и подзаголовок блока «Рекомендуемые товары»',
	},
	about: {
		hero: 'Верхний блок страницы «О нас»: бейдж, заголовок, описание, статистика, фото ателье',
		philosophy: 'Секция «Что определяет философию» и 3 карточки ценностей',
		process: 'Блок «Ремесло»: заголовок, описание, архив, 4 этапа',
		timeline: 'Блок истории проекта — таймлайн из 4 событий',
		founder: 'Карточка основателя: имя, должность, биография, тезисы, кнопка',
		stats: 'Три цифры (500+, 120+, 15+) в hero-блоке',
		cta_section: 'Нижний призыв к действию и две кнопки',
	},
	shop: {
		hero: 'Заголовок и описание вверху страницы магазина',
	},
	consultations: {
		hero: 'Заголовок и описание вверху страницы консультаций',
	},
	masterclasses: {
		hero: 'Заголовок и описание вверху страницы мастер-классов',
	},
};

export function getWhereOnSite(
	pageId: string,
	sectionId: string
): string | undefined {
	return SECTION_WHERE_ON_SITE[pageId]?.[sectionId];
}
