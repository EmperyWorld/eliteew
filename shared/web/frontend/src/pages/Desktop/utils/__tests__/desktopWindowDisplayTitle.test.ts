/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Focused coverage for desktop display-title helpers that keep EWA companion chrome persona-aware.
 *
 * Invariants:
 * - Display helpers must never require changing `appComponent` or app ids.
 *
 * Related:
 * - src/pages/Desktop/utils/desktopWindowDisplayTitle.ts
 */
import { beforeAll, describe, expect, it } from 'vitest';

import i18n from '@/i18n/config';
import type { DesktopItem, WindowState } from '../../types/desktop.types';
import {
	resolveDesktopWindowDisplayTitle,
	withEwaDesktopItemsDisplayName,
} from '../desktopWindowDisplayTitle';

function windowState(patch: Partial<WindowState>): WindowState {
	return {
		id: 'w1',
		title: 'EWA',
		type: 'app',
		isMinimized: false,
		isMaximized: false,
		isMinimizing: false,
		position: { x: 0, y: 0 },
		size: { width: 800, height: 600 },
		restoreBounds: null,
		zIndex: 10,
		folderId: 'app-ewa',
		path: [],
		appComponent: 'EwaApp',
		...patch,
	};
}

describe('desktopWindowDisplayTitle', () => {
	beforeAll(async () => {
		await i18n.changeLanguage('ru');
	});

	it('uses companion display name for EwaApp chrome without changing app component', () => {
		const win = windowState({
			initialPayload: {
				ewaDesktopPersonaId: 'tala',
				ewaDesktopDisplayName: 'Тала',
			},
		});

		expect(resolveDesktopWindowDisplayTitle(win)).toBe('Тала');
		expect(win.appComponent).toBe('EwaApp');
	});

	it('projects newest companion display name onto EWA desktop shortcuts', () => {
		const items: DesktopItem[] = [
			{
				id: 'app-ewa',
				name: 'EWA',
				type: 'app',
				position: { x: 0, y: 0 },
				appComponent: 'EwaApp',
			},
			{
				id: 'app-docs',
				name: 'Documents',
				type: 'app',
				position: { x: 80, y: 0 },
				appComponent: 'ContentManagerPro',
			},
		];

		const next = withEwaDesktopItemsDisplayName(items, [
			windowState({
				zIndex: 1,
				initialPayload: { ewaDesktopDisplayName: 'Мела' },
			}),
			windowState({
				id: 'w2',
				zIndex: 2,
				initialPayload: { ewaDesktopDisplayName: 'Тала' },
			}),
		]);

		expect(next[0]?.name).toBe('Тала');
		expect(next[0]?.appComponent).toBe('EwaApp');
		expect(next[1]?.name).toBe('Documents');
	});

	it('normalizes legacy built-in window titles for shell chrome', () => {
		expect(
			resolveDesktopWindowDisplayTitle(
				windowState({
					title: 'Site Manager Ops',
					folderId: 'app-site-manager-ops',
					appComponent: 'SiteManagerOps',
				})
			)
		).toBe('Контроль сайтов');

		expect(
			resolveDesktopWindowDisplayTitle(
				windowState({
					title: 'Site Studio',
					folderId: 'app-site-studio',
					appComponent: 'UserSiteStudio',
				})
			)
		).toBe('Студия сайтов');
	});

	it('localizes system folder chrome title and nested path segments', () => {
		const t = ((key: string, opts?: { defaultValue?: string }) => {
			if (key === 'systemFolders.documents') return 'Документы';
			if (key === 'systemFolders.images') return 'Изображения';
			return opts?.defaultValue ?? key;
		}) as never;

		expect(
			resolveDesktopWindowDisplayTitle(
				windowState({
					type: 'folder',
					title: 'Documents',
					folderId: 'documents',
					path: ['Documents'],
					appComponent: undefined,
				}),
				t
			)
		).toBe('Документы');

		expect(
			resolveDesktopWindowDisplayTitle(
				windowState({
					type: 'folder',
					title: 'Vacation',
					folderId: 'user-vacation',
					path: ['Documents', 'Vacation'],
					appComponent: undefined,
				}),
				t
			)
		).toBe('Документы › Vacation');
	});
});
