/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 1 Lock — no raw GAF/UGS jargon in user-facing tray/Start/Quick Search /
 * Generations window chrome string values.
 *
 * Related:
 * - src/i18n/locales/{en,ru}/desktopUi.json
 * - src/i18n/locales/{en,ru}/desktopChrome.json
 * - documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const frontendRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../..'
);

const JARGON = /\b(GAF|UGS)\b/;
const SCOPED_TOPS = new Set([
	'taskbar',
	'startMenu',
	'quickSearch',
	'ugsDesktop',
	'windowContextMenu',
]);

function walk(
	obj: unknown,
	prefix = ''
): Array<{ path: string; value: string }> {
	if (typeof obj === 'string') {
		return [{ path: prefix, value: obj }];
	}
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
		return [];
	}
	const out: Array<{ path: string; value: string }> = [];
	for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
		const next = prefix ? `${prefix}.${key}` : key;
		out.push(...walk(value, next));
	}
	return out;
}

function loadMergedLocale(locale: 'en' | 'ru') {
	const ui = JSON.parse(
		readFileSync(
			join(frontendRoot, `src/i18n/locales/${locale}/desktopUi.json`),
			'utf8'
		)
	) as Record<string, unknown>;
	const chrome = JSON.parse(
		readFileSync(
			join(frontendRoot, `src/i18n/locales/${locale}/desktopChrome.json`),
			'utf8'
		)
	) as Record<string, unknown>;
	return {
		...ui,
		taskbar: chrome.taskbar ?? ui.taskbar,
		quickSearch: chrome.quickSearch ?? ui.quickSearch,
	};
}

describe('desktop shell chrome jargon contract (Wave 1 Lock)', () => {
	for (const locale of ['en', 'ru'] as const) {
		it(`${locale}: scoped chrome strings have no GAF/UGS tokens`, () => {
			const merged = loadMergedLocale(locale);
			const hits: string[] = [];
			for (const { path, value } of walk(merged)) {
				const top = path.split('.')[0] ?? '';
				const allowed =
					SCOPED_TOPS.has(top) || path === 'settingsPanel.powerOptionsHint';
				if (!allowed) continue;
				if (JARGON.test(value)) {
					hits.push(`${path}=${value}`);
				}
			}
			expect(hits).toEqual([]);
		});
	}
});
