/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for built-in Desktop app user-facing labels and legacy snapshot normalization.
 *
 * Invariants:
 * - Built-in app names/descriptions avoid raw AI labels in user-facing desktop chrome.
 * - Normalization replaces only exact legacy default copy and preserves custom labels.
 *
 * Related:
 * - src/pages/Desktop/constants/index.ts
 * - src/pages/Desktop/utils/desktopDefaultAppUserFacingCopy.ts
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_APPS } from '../../constants';
import type { DesktopItem } from '../../types/desktop.types';
import {
	normalizeDefaultDesktopAppUserFacingCopy,
	normalizeDefaultDesktopStoreAppUserFacingCopy,
	normalizeDefaultDesktopWindowTitleUserFacingCopy,
} from '../desktopDefaultAppUserFacingCopy';

const rawStoreChromePattern =
	/\bAI\b|(^|[^А-Яа-яЁё])ИИ([^А-Яа-яЁё]|$)|CRM-lite|AI-инструменты|^EWA$|Marketing Cabinet|Site Studio|Site Manager Ops|Менеджер Сайтов|worker|jobs|DNS\/TLS|reconcile|audit|runtime/iu;

describe('desktop default app user-facing copy', () => {
	it('keeps built-in app names and descriptions free of raw store chrome labels', () => {
		for (const app of DEFAULT_APPS) {
			expect(app.name).not.toMatch(rawStoreChromePattern);
			if (app.description) {
				expect(app.description).not.toMatch(rawStoreChromePattern);
			}
		}
	});

	it('normalizes exact legacy app labels from persisted snapshots', () => {
		const legacyItem = {
			id: 'app-desktop-ai-chat',
			type: 'app',
			name: 'AI Чат',
			description:
				'Чат с ИИ: вложения и память по чату, опционально хранилище проекта, умные действия и голос',
			appComponent: 'DesktopAiChatApp',
		} as DesktopItem;

		expect(normalizeDefaultDesktopAppUserFacingCopy(legacyItem)).toMatchObject({
			id: 'app-desktop-ai-chat',
			appComponent: 'DesktopAiChatApp',
			name: 'Эксперты',
			description:
				'Диалог с экспертом, который помнит контекст переписки и вложения. При желании выделите проект отдельным хранилищем, подключите инструменты и голос — ведите разговор без распыления внимания по десяти вкладкам.',
		});
	});

	it('normalizes polished catalog description that still says ассистент', () => {
		const fromDb = {
			id: 'app-desktop-ai-chat',
			type: 'app',
			name: 'Эксперты',
			description:
				'Диалог с ассистентом, который помнит контекст переписки и вложения. При желании выделите проект отдельным хранилищем, подключите инструменты и голос — ведите разговор без распыления внимания по десяти вкладкам.',
			appComponent: 'DesktopAiChatApp',
		} as DesktopItem;

		expect(normalizeDefaultDesktopAppUserFacingCopy(fromDb).description).toBe(
			'Диалог с экспертом, который помнит контекст переписки и вложения. При желании выделите проект отдельным хранилищем, подключите инструменты и голос — ведите разговор без распыления внимания по десяти вкладкам.'
		);
	});

	it('preserves custom labels instead of overwriting user copy', () => {
		const customItem = {
			id: 'app-desktop-ai-chat',
			type: 'app',
			name: 'Мой кабинет вопросов',
			description: 'Моя подпись',
			appComponent: 'DesktopAiChatApp',
		} as DesktopItem;

		expect(normalizeDefaultDesktopAppUserFacingCopy(customItem)).toBe(
			customItem
		);
	});

	it('normalizes exact legacy copy from App Store catalog rows', () => {
		const storeRow = {
			app_id: 'app-desktop-ai-chat',
			app_component: 'DesktopAiChatApp',
			name: 'AI Чат',
			description:
				'Чат с ИИ: вложения и память по чату, опционально хранилище проекта, умные действия и голос',
			installed: true,
			category: 'productivity',
		};

		expect(
			normalizeDefaultDesktopStoreAppUserFacingCopy(storeRow)
		).toMatchObject({
			app_id: 'app-desktop-ai-chat',
			app_component: 'DesktopAiChatApp',
			name: 'Эксперты',
			description:
				'Диалог с экспертом, который помнит контекст переписки и вложения. При желании выделите проект отдельным хранилищем, подключите инструменты и голос — ведите разговор без распыления внимания по десяти вкладкам.',
		});
	});

	it('normalizes legacy raw AI descriptions for default store rows', () => {
		expect(
			normalizeDefaultDesktopStoreAppUserFacingCopy({
				app_id: 'app-marketing-cabinet',
				name: 'Маркетинговый кабинет',
				description:
					'Связанный маркетинговый кабинет: компания → проект → стратегия → доказательства → AI',
			}).description
		).toBe('Дом → проект → позиционирование → свидетельства → оракулы');
	});

	it('normalizes live legacy App Store rows that still carry generic chrome copy', () => {
		const liveLegacyRows = [
			{
				app_id: 'app-ewa',
				name: 'EWA',
				description:
					'Отдельное окно EWA: платформенная оркестрация рабочего стола',
			},
			{
				app_id: 'app-professional-worlds',
				name: 'Professional Worlds',
				description:
					'Профессиональные рабочие среды: профиль, обучение, CRM-lite и AI-инструменты для специалистов.',
			},
			{
				app_id: 'app-marketing-cabinet',
				name: 'Marketing Cabinet',
				description:
					'Маркетинговый контур: компания, проекты, исследования и отчёты в одной цепочке. Сверьте гипотезы с ассистентом и оформите выводы так, чтобы команде было с чем идти в планирование — без разрозненных таблиц и потерянных заметок.',
			},
			{
				app_id: 'app-site-studio',
				name: 'Менеджер Сайтов',
				description:
					'Опубликуйте свой сайт, настройте админку и откройте гостям отдельный режим просмотра: они видят витрину и контент, не заходя в ваш личный рабочий стол и приватные приложения.',
			},
			{
				app_id: 'app-site-manager-ops',
				name: 'Site Manager Ops',
				description:
					'Операторская консоль сайтов: worker, jobs, DNS/TLS, reconcile и audit',
			},
			{
				app_id: 'app-kirs',
				name: 'КИРС',
				description:
					'Курирование сайта по проекту: шаблон, runtime, доступ клиенту',
			},
		];

		for (const row of liveLegacyRows) {
			const normalized = normalizeDefaultDesktopStoreAppUserFacingCopy(row);

			expect(normalized.name).not.toMatch(rawStoreChromePattern);
			expect(normalized.description ?? '').not.toMatch(rawStoreChromePattern);
		}
	});

	it('normalizes site app labels without changing technical ids or components', () => {
		expect(
			normalizeDefaultDesktopStoreAppUserFacingCopy({
				app_id: 'app-site-studio',
				app_component: 'UserSiteStudio',
				name: 'Site Studio',
				description:
					'Личный локальный сайт с нативной админкой и отдельным runtime',
			})
		).toMatchObject({
			app_id: 'app-site-studio',
			app_component: 'UserSiteStudio',
			name: 'Студия сайтов',
			description:
				'Соберите и опубликуйте личный сайт: контент, витрина, админка и безопасный гостевой просмотр',
		});

		expect(
			normalizeDefaultDesktopAppUserFacingCopy({
				id: 'app-site-manager-ops',
				type: 'app',
				name: 'Site Manager Ops',
				description:
					'Операторская консоль сайтов: worker, jobs, DNS/TLS, reconcile и audit',
				appComponent: 'SiteManagerOps',
			} as DesktopItem)
		).toMatchObject({
			id: 'app-site-manager-ops',
			appComponent: 'SiteManagerOps',
			name: 'Контроль сайтов',
			description:
				'Операторская панель сайтов: готовность сервиса, задачи, домены, проверки публикации и журнал событий',
		});

		expect(
			normalizeDefaultDesktopAppUserFacingCopy({
				id: 'app-kirs',
				type: 'app',
				name: 'КИРС',
				description:
					'Курирование сайта по проекту: шаблон, runtime, доступ клиенту',
				appComponent: 'KirsCuration',
			} as DesktopItem)
		).toMatchObject({
			id: 'app-kirs',
			appComponent: 'KirsCuration',
			name: 'КИРС',
			description:
				'Курирование сайта по проекту: шаблон, публикация и доступ клиенту',
		});

		expect(
			normalizeDefaultDesktopAppUserFacingCopy({
				id: 'app-social-hub',
				type: 'app',
				name: 'Social hub',
				description: 'Друзья и профиль: заявки, круги, карточка и приватность',
				appComponent: 'SocialHubApp',
			} as DesktopItem)
		).toMatchObject({
			id: 'app-social-hub',
			appComponent: 'SocialHubApp',
			name: 'Связи',
			description:
				'Заявки, контакты, списки, приватность и приложение на телефоне',
		});
	});

	it('normalizes exact legacy titles for desktop window chrome', () => {
		expect(
			normalizeDefaultDesktopWindowTitleUserFacingCopy({
				appId: 'app-site-manager-ops',
				appComponent: 'SiteManagerOps',
				title: 'Site Manager Ops',
			})
		).toBe('Контроль сайтов');

		expect(
			normalizeDefaultDesktopWindowTitleUserFacingCopy({
				appComponent: 'UserSiteStudio',
				title: 'Site Studio',
			})
		).toBe('Студия сайтов');

		expect(
			normalizeDefaultDesktopWindowTitleUserFacingCopy({
				appComponent: 'UserSiteStudio',
				title: 'Моя студия',
			})
		).toBe('Моя студия');

		expect(
			normalizeDefaultDesktopWindowTitleUserFacingCopy({
				appComponent: 'SocialHubApp',
				title: 'Social hub',
			})
		).toBe('Связи');

		expect(
			normalizeDefaultDesktopWindowTitleUserFacingCopy({
				appComponent: 'SocialHubApp',
				title: 'Друзья',
			})
		).toBe('Связи');

		expect(
			normalizeDefaultDesktopWindowTitleUserFacingCopy({
				appId: 'app-desktop-ai-chat',
				appComponent: 'DesktopAiChatApp',
				title: 'Чат Экспертов',
			})
		).toBe('Эксперты');

		expect(
			normalizeDefaultDesktopWindowTitleUserFacingCopy({
				appComponent: 'DesktopAiChatApp',
				title: 'AI Чат (Ollama)',
			})
		).toBe('Эксперты');
	});

	it('normalizes legacy Справочник catalog row to Справочная Навигация', () => {
		expect(
			normalizeDefaultDesktopStoreAppUserFacingCopy({
				app_id: 'app-assistant',
				app_component: 'AssistantApp',
				name: 'Справочник',
				description: 'Помощник по приложению',
				installed: true,
				category: 'productivity',
			})
		).toMatchObject({
			name: 'Справочная Навигация',
			description:
				'Навигация по продукту: готовые ответы (FAQ) и чат по интерфейсу EliteEW.',
		});

		expect(
			normalizeDefaultDesktopWindowTitleUserFacingCopy({
				appComponent: 'AssistantApp',
				title: 'Справочник',
			})
		).toBe('Справочная Навигация');

		expect(
			normalizeDefaultDesktopWindowTitleUserFacingCopy({
				appComponent: 'AssistantApp',
				title: 'Ассистент',
			})
		).toBe('Справочная Навигация');
	});

	it('normalizes Empery Nexus window and catalog labels to Хроника', () => {
		expect(
			normalizeDefaultDesktopWindowTitleUserFacingCopy({
				appComponent: 'EmperyNexusChronicleApp',
				title: 'Empery Nexus',
			})
		).toBe('Хроника');
	});

	it('normalizes legacy Doc Editor labels to Редактор документов', () => {
		expect(
			normalizeDefaultDesktopWindowTitleUserFacingCopy({
				appComponent: 'DocEditor',
				title: 'Doc Editor',
			})
		).toBe('Редактор документов');
		expect(
			normalizeDefaultDesktopStoreAppUserFacingCopy({
				app_id: 'app-docs',
				name: 'Редактор Документов',
			}).name
		).toBe('Редактор документов');
	});

	it('normalizes GAF Chat labels to Мессенджер', () => {
		expect(
			normalizeDefaultDesktopWindowTitleUserFacingCopy({
				appComponent: 'GAFChatApp',
				title: 'GAF Chat',
			})
		).toBe('Мессенджер');
	});

	it('normalizes Feedback Hub catalog row to Обращения', () => {
		expect(
			normalizeDefaultDesktopStoreAppUserFacingCopy({
				app_id: 'app-feedback-hub',
				name: 'Feedback Hub',
				description: 'Ideas and bugs',
			})
		).toMatchObject({
			name: 'Обращения',
			description: 'Пожелания и сообщения об ошибках',
		});
	});
});
