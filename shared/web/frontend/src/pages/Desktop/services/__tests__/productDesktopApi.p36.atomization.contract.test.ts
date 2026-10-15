/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P36 atomization contract: thin productDesktopApi aggregator + module split under `productDesktopApi/`.
 *
 * Related:
 * - services/productDesktopApi.ts
 * - services/productDesktopApi/*
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	ASSISTANT_STREAM_ERROR_CODE,
	normalizeFeedbackTicketListPage,
	PRODUCT_DESKTOP_API_V1_BASE,
	ewDeskNewsLinkedImagePath,
	fetchPublishedNewsPage,
} from '../productDesktopApi';

describe('productDesktopApi P36 atomization contract', () => {
	it('parent stays under 800 LOC and re-exports key public API', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const parentPath = join(dir, '../productDesktopApi.ts');
		const src = readFileSync(parentPath, 'utf8');
		const lineCount = src.split('\n').length;

		expect(lineCount).toBeLessThanOrEqual(800);
		expect(src).toContain("from './productDesktopApi/constants'");
		expect(src).toContain("from './productDesktopApi/news'");
		expect(src).toContain("from './productDesktopApi/feedback'");
		expect(src).toContain("from './productDesktopApi/assistant'");
		expect(src).toContain('export {');
	});

	it('runtime re-exports resolve for base path, news, feedback, and assistant', () => {
		expect(PRODUCT_DESKTOP_API_V1_BASE).toBe('/api/v1/product-desktop');
		expect(ewDeskNewsLinkedImagePath('abc')).toBe(
			'/api/v1/product-desktop/news-linked-image/abc'
		);
		expect(typeof fetchPublishedNewsPage).toBe('function');
		expect(normalizeFeedbackTicketListPage(null)).toEqual({
			items: [],
			total: 0,
		});
		expect(ASSISTANT_STREAM_ERROR_CODE.rateLimited).toBe('rate_limited');
	});

	it('child modules stay under 800 LOC each', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const childDir = join(dir, '../productDesktopApi');
		const modules = readdirSync(childDir).filter((f) => f.endsWith('.ts'));
		expect(modules.length).toBeGreaterThanOrEqual(4);
		for (const mod of modules) {
			const lines = readFileSync(join(childDir, mod), 'utf8').split(
				'\n'
			).length;
			expect(lines, mod).toBeLessThanOrEqual(800);
		}
	});

	it('assistant module owns SSE stream and stable error codes', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const assistantPath = join(dir, '../productDesktopApi/assistant.ts');
		const src = readFileSync(assistantPath, 'utf8');
		expect(src).toContain('sendAssistantMessageStream');
		expect(src).toContain('ASSISTANT_STREAM_ERROR_CODE');
		expect(src).toContain('apiFetchWithAuth');
	});
});
