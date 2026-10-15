/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure coverage for installed Desktop app rows built from store catalog data.
 *
 * Invariants:
 * - Installed app rows may inherit stale store names, but visible Desktop chrome must normalize known legacy copy.
 * - App ids and appComponent values remain unchanged.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopInstalledApps.ts
 * - src/pages/Desktop/utils/desktopDefaultAppUserFacingCopy.ts
 */
import { describe, expect, it } from 'vitest';

import { buildInstalledApps } from '../useDesktopInstalledApps';

type StoreApps = Parameters<typeof buildInstalledApps>[0];

describe('buildInstalledApps', () => {
	it('normalizes legacy AI chat labels from store catalog rows', () => {
		const installed = buildInstalledApps(
			[
				{
					app_id: 'app-desktop-ai-chat',
					app_component: 'DesktopAiChatApp',
					name: 'AI Чат',
					description:
						'Чат с ИИ: вложения и память по чату, опционально хранилище проекта, умные действия и голос',
					installed: true,
					category: 'productivity',
					allow_multiple_windows: false,
					max_window_instances: 1,
				},
			] as StoreApps,
			[]
		);

		expect(installed[0]).toMatchObject({
			id: 'app-desktop-ai-chat',
			appComponent: 'DesktopAiChatApp',
			name: 'Эксперты',
			description:
				'Диалог с экспертом, который помнит контекст переписки и вложения. При желании выделите проект отдельным хранилищем, подключите инструменты и голос — ведите разговор без распыления внимания по десяти вкладкам.',
		});
	});
});
