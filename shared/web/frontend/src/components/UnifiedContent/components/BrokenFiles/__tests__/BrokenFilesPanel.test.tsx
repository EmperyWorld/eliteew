/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock for Broken files CM tab wiring (API + panel + ConfirmDeleteModal).
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listApi } from '../../../../../services/contentApi/list';
import { CONTENT_MANAGER_URL_TABS } from '../../../../../pages/ContentManager/contentManagerTypes';

const here = dirname(fileURLToPath(import.meta.url));

describe('Broken files CM contract', () => {
	it('exposes list/recheck/permanent-delete on listApi', () => {
		expect(typeof listApi.listBrokenContent).toBe('function');
		expect(typeof listApi.storageRecheck).toBe('function');
		expect(typeof listApi.permanentDeleteContent).toBe('function');
	});

	it('registers brokenFiles tab in URL allowlist', () => {
		expect(CONTENT_MANAGER_URL_TABS.has('brokenFiles')).toBe(true);
	});

	it('panel uses ConfirmDeleteModal for permanent delete', () => {
		const source = readFileSync(join(here, '../BrokenFilesPanel.tsx'), 'utf8');
		expect(source).toContain('ConfirmDeleteModal');
		expect(source).toContain('permanentDeleteContent');
		expect(source).toContain('storageRecheck');
		expect(source).toContain('listBrokenContent');
		expect(source).toContain('recheckStillBroken');
		expect(source).toContain("kind: 'still_broken'");
	});

	it('locales explain recheck still-missing outcome', () => {
		const ru = JSON.parse(
			readFileSync(
				join(here, '../../../../../i18n/locales/ru/contentManager.json'),
				'utf8'
			)
		) as { brokenFiles: Record<string, string> };
		const en = JSON.parse(
			readFileSync(
				join(here, '../../../../../i18n/locales/en/contentManager.json'),
				'utf8'
			)
		) as { brokenFiles: Record<string, string> };
		expect(ru.brokenFiles.recheckStillBroken).toMatch(/не найден/);
		expect(en.brokenFiles.recheckStillBroken).toMatch(/still missing/i);
		expect(ru.brokenFiles.recheckOk).toMatch(/вернулся/);
		expect(en.brokenFiles.recheckOk).toMatch(/returned/i);
	});

	it('tab panels mount BrokenFilesPanel for brokenFiles', () => {
		const source = readFileSync(
			join(
				here,
				'../../../../../pages/ContentManager/components/ContentManagerProMainSurfaceTabPanels.tsx'
			),
			'utf8'
		);
		expect(source).toContain("activeTab === 'brokenFiles'");
		expect(source).toContain('BrokenFilesPanel');
	});
});
