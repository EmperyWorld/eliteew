/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for AppStoreCatalogSidebar — category nav contract.
 *
 * Invariants:
 * - Category nav uses data-store-category + onCategoryNavClick contract.
 * - Summary caption and category counts stay sentence-case (no chrome shout).
 *
 * Related:
 * - AppStoreCatalogSidebar.tsx
 * - documentation/product/desktop/DESKTOP-APP-STORE.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import { buildStoreCategories } from '../appStoreCategories';
import { AppStoreCatalogSidebar } from '../AppStoreCatalogSidebar';

const t = ((key: string) => key) as Parameters<
	typeof AppStoreCatalogSidebar
>[0]['t'];

const storeCategories = buildStoreCategories(t);
const visibleStoreCategories = storeCategories.filter((c) =>
	['communication', 'productivity'].includes(c.id)
);
const categoryTotals = new Map([
	['communication', 2],
	['productivity', 3],
]);

function renderSidebar(
	overrides: Partial<Parameters<typeof AppStoreCatalogSidebar>[0]> = {}
) {
	const onCategoryNavClick = vi.fn();

	render(
		<AppStoreCatalogSidebar
			t={t}
			variant="modal"
			embeddedMobileLayout={false}
			asideClassName="test-aside"
			isLoading={false}
			appsCount={8}
			filterStrip=""
			storeCategoryNavClass=""
			activeCategory="all"
			onCategoryNavClick={onCategoryNavClick}
			visibleStoreCategories={visibleStoreCategories}
			categoryHintText={() => ''}
			categoryTotals={categoryTotals}
			sidebarNavRow=""
			sidebarNavIcon=""
			contentPanel=""
			sectionPanelShadow=""
			installedCount={2}
			availableCount={6}
			{...overrides}
		/>
	);

	return { onCategoryNavClick };
}

describe('AppStoreCatalogSidebar', () => {
	it('delegates category nav clicks via data-store-category', () => {
		const onCategoryNavClick = vi.fn();
		renderSidebar({
			onCategoryNavClick,
		});

		const productivityBtn = screen.getByRole('button', {
			name: /categories\.productivity/i,
		});
		fireEvent.click(productivityBtn);
		expect(onCategoryNavClick).toHaveBeenCalledTimes(1);
	});

	it('keeps rail summary caption sentence-case (no DesktopAppSectionLabel shout)', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../AppStoreCatalogSidebar.tsx'),
			'utf8'
		);
		expect(src).toContain('appStoreMetaCaptionClass');
		expect(src).toContain('appStoreSidebarCategoryCountClass');
		expect(src).not.toContain('DesktopAppSectionLabel');
		expect(src).not.toContain('as-meta-caption');
	});
});
