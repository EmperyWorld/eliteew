/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for user workflow tool catalog fallback merge.
 */

import { describe, expect, it } from 'vitest';

import {
	COMPANION_USER_WORKFLOW_TOOL_CATALOG_FALLBACK,
	mergeCompanionUserWorkflowToolCatalog,
} from '@/services/ewa/companionUserWorkflowToolCatalogFallback';

describe('companion user workflow tool catalog fallback', () => {
	it('exposes more than music_generation only', () => {
		const names = COMPANION_USER_WORKFLOW_TOOL_CATALOG_FALLBACK.map(
			(entry) => entry.name
		);
		expect(names.length).toBeGreaterThanOrEqual(20);
		expect(names).toContain('image_generation');
		expect(names).toContain('app_open');
		expect(names).toContain('theme_set');
		expect(names).toContain('file_rewrite');
		expect(names).toContain('plan_v1');
		expect(names).toContain('llm_summarize');
		expect(names).toContain('pdf_parser');
		expect(names).toContain('telegram_sender');
		expect(names).toContain('email_dispatcher');
		expect(names).toContain('vision_analyze');
		expect(names).toContain('document_extractor');
		expect(names).toContain('paperless_import');
	});

	it('uses fallback when server catalog is empty', () => {
		const { catalog, usedFallbackOnly } = mergeCompanionUserWorkflowToolCatalog(
			[]
		);
		expect(usedFallbackOnly).toBe(true);
		expect(catalog.length).toBe(
			COMPANION_USER_WORKFLOW_TOOL_CATALOG_FALLBACK.length
		);
	});

	it('merges server titles with fallback fields', () => {
		const { catalog, usedFallbackOnly } = mergeCompanionUserWorkflowToolCatalog(
			[
				{
					name: 'theme_set',
					title_ru: 'Тема (сервер)',
					title_en: 'Theme (server)',
					description_ru: '',
					description_en: '',
					async_step: false,
					requires_confirm: false,
				},
			]
		);
		expect(usedFallbackOnly).toBe(false);
		const theme = catalog.find((row) => row.name === 'theme_set');
		expect(theme?.title_ru).toBe('Тема (сервер)');
		expect(theme?.fields?.some((field) => field.key === 'theme')).toBe(true);
	});
});
