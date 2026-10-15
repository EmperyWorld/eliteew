/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for App Store embedded mobile layout (`#/mobile-app-store`).
 *
 * Invariants:
 * - Layout branches use embeddedMobileLayout, not Tailwind lg: alone.
 *
 * Related:
 * - AppStore.tsx, AppStoreCatalogSections.tsx, AppStoreHeroSearchCluster.tsx
 * - documentation/product/mobile/MOBILE-ANDROID-EMBEDDED-SPA-UI-STYLE.md §4.9
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readComponentSource(relativePath: string): string {
	const dir = dirname(fileURLToPath(import.meta.url));
	return readFileSync(join(dir, relativePath), 'utf8');
}

describe('AppStore mobile embedded contract', () => {
	it('forces column layout and mobile catalog patterns on embeddedMobileLayout', () => {
		const src = readComponentSource('../AppStore.tsx');

		expect(src).toContain('embeddedMobileLayout');
		expect(src).toContain('catalogGridClass');
		expect(src).toContain('storeCategoryNavClass');
		expect(src).toContain("!embeddedMobileLayout && 'lg:flex-row'");
		expect(src).toContain('data-app-store-root');
		expect(src).toContain('data-embedded-mobile');
		expect(src).toContain("aria-busy={isLoading || isBusy ? 'true' : 'false'}");
		expect(src).toContain('grid-cols-1');
	});

	it('hides discovery rows and compresses hero on embedded layout modules', () => {
		const sectionsSrc = readComponentSource(
			'../appStore/AppStoreCatalogSections.tsx'
		);
		const heroSrc = readComponentSource(
			'../appStore/AppStoreHeroSearchCluster.tsx'
		);
		const windowSrc = readComponentSource('../AppStoreWindowContent.tsx');

		expect(sectionsSrc).toContain('embeddedMobileLayout');
		expect(sectionsSrc).toContain('showDiscoveryRows');
		expect(sectionsSrc).toContain('!embeddedMobileLayout');

		expect(heroSrc).toContain('embeddedMobileLayout');
		expect(heroSrc).toContain('search.shortcutHint');
		expect(heroSrc).toMatch(/if \(embeddedMobileLayout\)/);

		expect(windowSrc).toContain('embeddedMobile');
		expect(windowSrc).toContain('if (embeddedMobile) {');
	});
});
