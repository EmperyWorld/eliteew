/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Site Studio admin catalog endpoints for server-side price/KPI APIs.
 *
 * Related:
 * - features/site-studio/shared/constants/api.ts
 */

import { describe, expect, it } from 'vitest';
import { API_ENDPOINTS } from '@/features/site-studio/shared/constants/api';

describe('Site Studio catalog API endpoints', () => {
	it('exposes bulk-price and summary paths for Olenti proxy', () => {
		expect(API_ENDPOINTS.PRODUCTS_BULK_PRICE).toBe('/products/bulk-price');
		expect(API_ENDPOINTS.PRODUCTS_SUMMARY).toBe('/products/summary');
		expect(API_ENDPOINTS.ADMIN_ORDERS_SUMMARY).toBe('/admin/orders/summary');
	});
});
