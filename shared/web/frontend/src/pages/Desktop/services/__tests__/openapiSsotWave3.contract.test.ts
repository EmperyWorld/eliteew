/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Wave 3 OpenAPI SSOT bridges for desktop admin and product-desktop clients.
 *
 * Related:
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption Wave 3
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(__dirname, '../../../..');

function readSrc(rel: string): string {
	return readFileSync(join(SRC_ROOT, rel), 'utf8');
}

describe('openapi SSOT Wave 3 bridges', () => {
	it('desktopAdminOpenApi re-exports catalog admin schemas from desktop-openapi', () => {
		const src = readSrc('pages/Desktop/services/desktopAdminOpenApi.ts');
		expect(src).toContain('@/generated/desktop-openapi');
		expect(src).toContain("Schemas['CatalogAppResponse']");
		expect(src).toContain("Schemas['WebSearchQuotaStatusResponse']");
	});

	it('desktopAdminApi imports DTOs from bridge, not hand interfaces', () => {
		const src = readSrc('pages/Desktop/services/desktopAdminApi.ts');
		expect(src).toContain('./desktopAdminOpenApi');
		expect(src).not.toMatch(/export interface CatalogAppResponse/);
	});

	it('productDesktopSurveysOpenApi aliases survey schemas from product-desktop-openapi', () => {
		const src = readSrc(
			'pages/Desktop/services/productDesktopSurveysOpenApi.ts'
		);
		expect(src).toContain('@/generated/product-desktop-openapi');
		expect(src).toContain("Schemas['SurveyResultsSummaryOut']");
	});

	it('productDesktopSurveysApi imports survey DTOs from bridge', () => {
		const src = readSrc('pages/Desktop/services/productDesktopSurveysApi.ts');
		expect(src).toContain('./productDesktopSurveysOpenApi');
		expect(src).not.toMatch(/export type SurveyAdmin = \{/);
	});

	it('productDesktopAssistantOpenApi aliases assistant KB schemas', () => {
		const src = readSrc(
			'pages/Desktop/services/productDesktopAssistantOpenApi.ts'
		);
		expect(src).toContain('@/generated/product-desktop-openapi');
		expect(src).toContain("Schemas['AssistantKbReindexAllOut']");
		expect(src).toContain("Schemas['AssistantKbSyncHandbookOut']");
	});

	it('assistant client keeps hand SSE overlay documented', () => {
		const src = readSrc(
			'pages/Desktop/services/productDesktopApi/assistant.ts'
		);
		expect(src).toContain('../productDesktopAssistantOpenApi');
		expect(src).toContain('Hand SSE overlay');
		expect(src).toContain('type StreamEvent');
	});
});
