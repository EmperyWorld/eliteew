/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for AppStoreHeroSearchCluster — mobile bar reset and hero metrics.
 *
 * Invariants:
 * - Hero metrics do not use `labelOverline` uppercase shout.
 * - Desktop hero keeps title; embedded stays metrics-only.
 *
 * Related:
 * - AppStoreHeroSearchCluster.tsx
 * - appStoreCompactCardUi.ts
 * - documentation/product/desktop/DESKTOP-APP-STORE.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import {
	appStorePremiumMetricLabelClass,
	appStorePremiumMetricValueClass,
} from '../../../utils/appStoreCompactCardUi';
import { buildStoreCategories } from '../appStoreCategories';
import {
	AppStoreMobileCatalogBar,
	AppStorePremiumStorefrontHero,
} from '../AppStoreHeroSearchCluster';

const t = ((key: string) => key) as Parameters<
	typeof AppStorePremiumStorefrontHero
>[0]['t'];

const visibleStoreCategories = buildStoreCategories(t).slice(0, 2);

describe('AppStoreMobileCatalogBar', () => {
	it('resets filters when filters are active', () => {
		const onClearFilters = vi.fn();

		render(
			<AppStoreMobileCatalogBar
				t={t}
				embeddedMobileLayout={false}
				activeCategory="all"
				filteredAppsCount={1}
				appsCount={5}
				filtersActive
				categoryHintText={() => ''}
				onClearFilters={onClearFilters}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', { name: 'mobile.resetFilters' })
		);
		expect(onClearFilters).toHaveBeenCalledTimes(1);
	});
});

describe('AppStorePremiumStorefrontHero', () => {
	it('renders title and metrics without eyebrow or action strip', () => {
		render(
			<AppStorePremiumStorefrontHero
				t={t}
				embeddedMobileLayout={false}
				premiumHeroClass=""
				premiumMetricCard=""
				installedCount={1}
				availableCount={4}
				visibleStoreCategories={visibleStoreCategories}
			/>
		);

		expect(screen.getByText('premium.title')).toBeTruthy();
		expect(screen.queryByText('premium.eyebrow')).toBeNull();
		expect(
			screen.queryByRole('button', { name: 'premium.browseCta' })
		).toBeNull();
		expect(screen.getByText('premium.metricInstalled')).toBeTruthy();
	});

	it('renders compact metrics-only hero on embedded layout', () => {
		render(
			<AppStorePremiumStorefrontHero
				t={t}
				embeddedMobileLayout
				premiumHeroClass=""
				premiumMetricCard="metric-card"
				installedCount={2}
				availableCount={7}
				visibleStoreCategories={visibleStoreCategories}
			/>
		);

		expect(screen.getByLabelText('nav.summary')).toBeTruthy();
		expect(screen.queryByText('premium.title')).toBeNull();
		expect(
			screen.queryByRole('button', { name: 'premium.searchCta' })
		).toBeNull();
	});

	it('keeps metric labels sentence-case (no labelOverline shout)', () => {
		expect(appStorePremiumMetricLabelClass).not.toMatch(/\buppercase\b/);
		expect(appStorePremiumMetricLabelClass).toMatch(/tracking-normal/);
		expect(appStorePremiumMetricValueClass).toMatch(/tabular-nums/);

		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../AppStoreHeroSearchCluster.tsx'),
			'utf8'
		);
		expect(src).toContain('appStorePremiumMetricLabelClass');
		expect(src).not.toContain('DESKTOP_TYPOGRAPHY.labelOverline');
	});
});

describe('AppStoreMobileCatalogBar embedded', () => {
	it('omits keyboard shortcut hint on embedded layout', () => {
		render(
			<AppStoreMobileCatalogBar
				t={t}
				embeddedMobileLayout
				activeCategory="all"
				filteredAppsCount={3}
				appsCount={10}
				filtersActive={false}
				categoryHintText={() => ''}
				onClearFilters={vi.fn()}
			/>
		);

		expect(
			screen.getByRole('button', { name: 'mobile.focusSearch' })
		).toBeTruthy();
	});
});
