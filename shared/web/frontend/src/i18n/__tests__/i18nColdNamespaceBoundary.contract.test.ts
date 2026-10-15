/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guards cold i18n bootstrap: only shell RU namespaces are statically imported.
 *
 * Invariants:
 * - `config.ts` neither imports nor requests marketing/UGS/docs namespaces at init.
 *
 * Related:
 * - `i18n/config.ts`, `i18n/lazyLocaleBackend.ts`
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('i18n cold namespace boundary', () => {
	it('statically bundles only commonUi + desktopChrome in config.ts', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../config.ts'), 'utf8');

		expect(src).toContain("from './locales/ru/commonUi.json'");
		expect(src).toContain("from './locales/ru/desktopChrome.json'");
		expect(src).not.toContain("from './locales/ru/desktopUi.json'");
		expect(src).toContain('eliteewLazyLocaleBackend');
		expect(src).toContain('ns: [...COLD_RU_NAMESPACES]');
		expect(src).not.toContain('const NAMESPACES =');
		// Partial chrome seed must not leave desktopUi stuck without a full reload.
		expect(src).toContain('reloadResources');
		expect(src).toContain('ensureFullDesktopUiLoaded');
		expect(src).toContain('ensureDesktopUiReady');
		expect(src).not.toMatch(/from ['"]\.\/locales\/ru\/marketing\.json['"]/);
		expect(src).not.toMatch(/from ['"]\.\/locales\/ru\/ugsHub\.json['"]/);
		expect(src).not.toMatch(/from ['"]\.\/locales\/ru\/gafChat\.json['"]/);
	});
});
