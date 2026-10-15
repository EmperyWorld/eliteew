/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for catalog display copy — store/API SSOT over i18n when non-empty.
 *
 * Related:
 * - localizeDefaultDesktopAppCatalogCopy.ts
 */
import { describe, expect, it, vi } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import {
	localizeDefaultDesktopAppCatalogItem,
	localizeDefaultDesktopAppCatalogName,
	localizeDefaultDesktopStoreAppCatalogRow,
} from '../localizeDefaultDesktopAppCatalogCopy';

describe('localizeDefaultDesktopAppCatalogCopy', () => {
	const t = vi.fn((key: string, opts?: { defaultValue?: string }) => {
		if (key === 'defaultApps.app-store.name') return 'i18n:app-store-name';
		if (key === 'defaultApps.app-store.description') {
			return 'i18n:app-store-description';
		}
		if (key === 'defaultApps.app-content.name') return 'Файловый менеджер';
		if (key === 'defaultApps.app-content.description') {
			return 'i18n:content-description';
		}
		return opts?.defaultValue ?? `i18n:${key}`;
	}) as unknown as Parameters<typeof localizeDefaultDesktopAppCatalogItem>[1];

	it('keeps non-empty store/API name and description (catalog SSOT over i18n)', () => {
		const item = {
			id: 'app-content',
			name: 'Файловый менеджер',
			type: 'app',
			description:
				'Обходите библиотеку файлов, находите нужное по имени и открывайте документы.',
			position: { x: 0, y: 0 },
			appComponent: 'ContentManagerPro',
		} as DesktopItem;

		expect(localizeDefaultDesktopAppCatalogItem(item, t)).toMatchObject({
			id: 'app-content',
			name: 'Файловый менеджер',
			description:
				'Обходите библиотеку файлов, находите нужное по имени и открывайте документы.',
		});
		expect(t).not.toHaveBeenCalled();
	});

	it('uses i18n only when catalog name is empty (offline fallback)', () => {
		expect(localizeDefaultDesktopAppCatalogName('app-store', '', t)).toBe(
			'i18n:app-store-name'
		);
		expect(t).toHaveBeenCalledWith('defaultApps.app-store.name', {
			defaultValue: '',
		});
	});

	it('store row keeps catalog name when present', () => {
		const row = localizeDefaultDesktopStoreAppCatalogRow(
			{
				app_id: 'app-content',
				name: 'Файловый менеджер',
				description: 'Каталожное описание',
			},
			t
		);
		expect(row.name).toBe('Файловый менеджер');
		expect(row.description).toBe('Каталожное описание');
	});

	it('leaves non-catalog items unchanged', () => {
		const custom = {
			id: 'custom-app',
			name: 'My tool',
			type: 'app',
			position: { x: 0, y: 0 },
		} as DesktopItem;
		expect(localizeDefaultDesktopAppCatalogItem(custom, t)).toBe(custom);
	});
});
