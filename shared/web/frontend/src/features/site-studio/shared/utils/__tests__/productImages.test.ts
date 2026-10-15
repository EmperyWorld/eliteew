/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract: getProductImage does not depend on bundled demo product webp modules.
 *
 * Invariants:
 * - Empty / legacy SPA asset paths → public placeholder.
 * - /uploads paths normalize without importing binaries.
 *
 * Related:
 * - features/site-studio/shared/utils/productImages.ts
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/siteStudioProxy', () => ({
	isSiteStudioProxyActive: () => false,
	rewriteSiteStudioProxyUrl: (p: string) => p,
}));

import {
	PRODUCT_IMAGE_PLACEHOLDER,
	getProductImage,
	productImages,
} from '../productImages';

describe('getProductImage', () => {
	it('returns placeholder when path missing', () => {
		expect(getProductImage(null)).toBe(PRODUCT_IMAGE_PLACEHOLDER);
		expect(getProductImage('')).toBe(PRODUCT_IMAGE_PLACEHOLDER);
	});

	it('returns placeholder for legacy SPA product asset paths', () => {
		expect(
			getProductImage(
				'@/features/site-studio/assets/products/product-1-800.webp'
			)
		).toBe(PRODUCT_IMAGE_PLACEHOLDER);
	});

	it('returns relative /uploads path when proxy inactive', () => {
		expect(getProductImage('/uploads/catalog/sku.webp')).toBe(
			'/uploads/catalog/sku.webp'
		);
	});

	it('does not ship a demo productImages catalog map', () => {
		expect(Object.keys(productImages)).toHaveLength(0);
	});
});
