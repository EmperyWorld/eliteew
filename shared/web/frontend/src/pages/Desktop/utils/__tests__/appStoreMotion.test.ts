import { describe, expect, it } from 'vitest';
import {
	appStoreCatalogViewVariants,
	appStoreDetailViewVariants,
	appStoreModalDetailPanelVariants,
} from '../appStoreMotion';

describe('appStoreMotion', () => {
	it('detail variants slide when motion is allowed', () => {
		const variants = appStoreDetailViewVariants(false);
		expect(variants.initial).toMatchObject({ x: 32, opacity: 0 });
		expect(variants.animate).toMatchObject({ x: 0, opacity: 1 });
	});

	it('catalog variants slide from the left when motion is allowed', () => {
		const variants = appStoreCatalogViewVariants(false);
		expect(variants.initial).toMatchObject({ x: -24 });
	});

	it('uses opacity-only variants when reduced motion is requested', () => {
		for (const fn of [
			appStoreCatalogViewVariants,
			appStoreDetailViewVariants,
			appStoreModalDetailPanelVariants,
		]) {
			const variants = fn(true);
			expect(variants.initial).toEqual({ opacity: 0 });
			expect(variants.initial).not.toHaveProperty('x');
			expect(variants.initial).not.toHaveProperty('scale');
		}
	});
});
