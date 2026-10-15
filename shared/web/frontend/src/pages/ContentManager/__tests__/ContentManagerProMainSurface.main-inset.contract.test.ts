/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock `#content-manager-pro-main` inset markers: desktop embedded files-split
 * must not reuse mobile-tight px-2 padding.
 *
 * Invariants:
 * - desktop-split and mobile-split branches both present in MainSurface source.
 * - Search mode copy keys stay human-facing (not bare «Текст» / «Умный»).
 *
 * Related:
 * - ContentManagerProMainSurface.tsx
 * - documentation/product/CONTENT-MANAGER.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ContentManagerProMainSurface main inset contract', () => {
	it('distinguishes desktop vs mobile embedded files-split padding', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const mainSurface = readFileSync(
			join(dir, '../components/ContentManagerProMainSurface.tsx'),
			'utf8'
		);
		expect(mainSurface).toContain('data-cm-main-inset');
		expect(mainSurface).toContain("'desktop-split'");
		expect(mainSurface).toContain("'mobile-split'");
		expect(mainSurface).toContain('embeddedMobileLayout');
		expect(mainSurface).toMatch(/px-3 py-3 sm:px-3\.5 sm:py-3\.5/);
		expect(mainSurface).toMatch(/embeddedMobileLayout\s*\?\s*'px-2 py-2'/);
	});

	it('keeps clarified search mode labels in locale packs', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const ru = JSON.parse(
			readFileSync(
				join(dir, '../../../i18n/locales/ru/contentManager.json'),
				'utf8'
			)
		) as { files: { searchMode: { keyword: string; hybrid: string } } };
		const en = JSON.parse(
			readFileSync(
				join(dir, '../../../i18n/locales/en/contentManager.json'),
				'utf8'
			)
		) as { files: { searchMode: { keyword: string; hybrid: string } } };

		expect(ru.files.searchMode.keyword).toBe('По тексту');
		expect(ru.files.searchMode.hybrid).toBe('Умный поиск');
		expect(en.files.searchMode.keyword).toBe('By text');
		expect(en.files.searchMode.hybrid).toBe('Smart search');
	});
});
