/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock EN ugsHub keys for result/tariff modals and result body chrome.
 *
 * Related:
 * - i18n/locales/en/ugsHub.json
 */

import { describe, expect, it } from 'vitest';

import enUgsHub from '@/i18n/locales/en/ugsHub.json';

describe('ugsHub result/tariff i18n keys (EN)', () => {
	it('exposes result modal, tariff, and result body keys', () => {
		expect(enUgsHub.common.closeAria).toBe('Close');
		expect(enUgsHub.common.loadMore).toBe('Load more');
		expect(enUgsHub.resultModal.eyebrow).toBe('Generation result');
		expect(enUgsHub.tariffModal.title).toBe('Generation type costs');
		expect(enUgsHub.result.imageTitle).toBe('Generated image');
		expect(enUgsHub.result.textUnavailable).toMatch(/not available/i);
		expect(enUgsHub.tabBar.total).toContain('{{count}}');
		expect(enUgsHub.productArea.ugs_hub).toBe('UGS Hub');
	});

	it('exposes taskRow and pagination keys', () => {
		expect(enUgsHub.taskRow.view).toBe('View');
		expect(enUgsHub.taskRow.openEditor).toBe('Open in editor');
		expect(enUgsHub.pagination.shown).toContain('{{from}}');
		expect(enUgsHub.pagination.next).toBe('Next');
		expect(enUgsHub.formatting.noData).toBe('No data');
		expect(enUgsHub.loading.hubSrOnly).toBe('Loading UGS Hub');
	});

	it('exposes taskFilters keys', () => {
		expect(enUgsHub.taskFilters.searchPlaceholder).toMatch(/Search/i);
		expect(enUgsHub.taskFilters.categoryAll).toBe('All categories');
		expect(enUgsHub.taskFilters.reset).toBe('Reset');
	});

	it('exposes workflows toolbar and list keys', () => {
		expect(enUgsHub.workflows.title).toBe('My workflows');
		expect(enUgsHub.workflows.loading).toMatch(/Loading workflows/i);
		expect(enUgsHub.workflows.create).toBe('Create');
		expect(enUgsHub.workflows.emptyTitle).toMatch(/No saved workflows/i);
		expect(enUgsHub.workflows.comfyUnavailableTitle).toMatch(/unavailable/i);
		expect(enUgsHub.workflows.titleCountFiltered).toContain('{{filtered}}');
	});

	it('exposes workflows toast and confirm keys', () => {
		expect(enUgsHub.workflows.toastDeleted).toBe('Workflow deleted');
		expect(enUgsHub.workflows.toastDeleteConfirm).toMatch(/Delete/i);
		expect(enUgsHub.workflows.toastExecutionId).toContain('{{id}}');
		expect(enUgsHub.workflows.toastComfyUnavailable).toMatch(/unavailable/i);
		expect(enUgsHub.workflows.toastCopyNameSuffix).toBe('(copy)');
	});

	it('exposes workflows card keys', () => {
		expect(enUgsHub.workflows.cardQuickLaunch).toBe('Quick launch');
		expect(enUgsHub.workflows.cardPublic).toBe('Public');
		expect(enUgsHub.workflows.cardExecutionHistory).toContain('{{count}}');
		expect(enUgsHub.workflows.cardOpen).toBe('Open');
		expect(enUgsHub.workflows.cardDelete).toBe('Delete');
	});

	it('exposes workflows estimate and runtime error keys', () => {
		expect(enUgsHub.workflows.estSeconds).toContain('{{count}}');
		expect(enUgsHub.workflows.runtimeNoConnection).toMatch(/media node/i);
		expect(enUgsHub.workflows.runtimeUnavailable).toMatch(/unavailable/i);
		expect(enUgsHub.workflows.execStatusRunning).toBe('Running');
	});

	it('exposes workflows quick execute modal keys', () => {
		expect(enUgsHub.workflows.quickTitle).toContain('{{name}}');
		expect(enUgsHub.workflows.quickClose).toBe('Close');
		expect(enUgsHub.workflows.quickSubmit).toBe('Start');
		expect(enUgsHub.workflows.quickPromptPlaceholder).toMatch(/generate/i);
		expect(enUgsHub.workflows.quickWidthLabel).toBe('Width');
	});

	it('exposes generation default payload keys', () => {
		expect(enUgsHub.generationDefaults.textPrompt).toMatch(/company news/i);
		expect(enUgsHub.generationDefaults.audioText).toMatch(
			/Welcome to EliteEW/i
		);
		expect(enUgsHub.generationDefaults.translationPrompt).toMatch(
			/Translate to English/i
		);
		expect(enUgsHub.generationDefaults.codeGenerationPrompt).toMatch(
			/TypeScript/i
		);
	});

	it('exposes audio VTT fallback cue and captions track label keys', () => {
		expect(enUgsHub.result.vttFallbackCue).toMatch(/transcript unavailable/i);
		expect(enUgsHub.result.captionsTrackLabel).toBe('Captions');
	});

	it('exposes hub hook toast keys with interpolation', () => {
		expect(enUgsHub.toast.dashboardLoadFailed).toMatch(/Could not load/i);
		expect(enUgsHub.toast.generationCompleted).toContain('{{type}}');
		expect(enUgsHub.toast.generationStarted).toContain('{{type}}');
		expect(enUgsHub.toast.authRequired).toMatch(/Authentication/i);
		expect(enUgsHub.toast.bulkDeleteConfirm).toContain('{{count}}');
		expect(enUgsHub.toast.bulkDeleted).toContain('{{count}}');
		expect(enUgsHub.toast.bulkRetried).toContain('{{count}}');
		expect(enUgsHub.toast.exportedJson).toContain('{{count}}');
		expect(enUgsHub.toast.exportedCsv).toContain('{{count}}');
		expect(enUgsHub.toast.bulkDeleteLabel).toBe('Delete');
		expect(enUgsHub.toast.copiedToClipboard).toMatch(/clipboard/i);
	});

	it('exposes CSV export header keys', () => {
		expect(enUgsHub.csvExport.type).toBe('Type');
		expect(enUgsHub.csvExport.status).toBe('Status');
		expect(enUgsHub.csvExport.created).toBe('Created');
		expect(enUgsHub.csvExport.channel).toBe('Channel');
		expect(enUgsHub.csvExport.error).toBe('Error');
	});

	it('exposes workflows builder page keys', () => {
		expect(enUgsHub.workflows.builderLoadingTitle).toMatch(/Loading builder/i);
		expect(enUgsHub.workflows.builderLoadFailed).toMatch(/Could not load/i);
		expect(enUgsHub.workflows.builderRetry).toBe('Retry');
		expect(enUgsHub.workflows.builderBackToHub).toMatch(/UGS Hub/i);
	});
});
