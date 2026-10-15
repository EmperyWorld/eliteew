import { describe, expect, it } from 'vitest';
import {
	PRODUCT_DESKTOP_API_V1_BASE,
	ewDeskNewsLinkedImagePath,
} from '../productDesktopApi';

describe('product desktop API path contract', () => {
	it('uses v1 product-desktop mount from domains/desktop.py', () => {
		expect(PRODUCT_DESKTOP_API_V1_BASE).toBe('/api/v1/product-desktop');
	});

	it('news-linked-image path matches product_desktop router prefix', () => {
		expect(ewDeskNewsLinkedImagePath('abc')).toBe(
			'/api/v1/product-desktop/news-linked-image/abc'
		);
	});
});
