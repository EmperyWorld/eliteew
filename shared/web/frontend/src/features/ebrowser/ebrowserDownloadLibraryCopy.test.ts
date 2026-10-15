/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock EBrowser download chrome copy for account library ingest phases.
 *
 * Related:
 * - features/ebrowser/ebrowserNative.ts
 * - documentation/reference/solution-readiness/2026-09-10-ebrowser-download-to-account-library.md
 */
import { describe, expect, it } from 'vitest';
import { ebrowserDownloadStatusCopy } from './ebrowserNative';

describe('ebrowserDownloadStatusCopy', () => {
	it('points library success at account Загрузки', () => {
		const copy = ebrowserDownloadStatusCopy({
			id: 1,
			name: 'a.pdf',
			phase: 'library',
			progress: 1,
			bytesReceived: 10,
			contentId: 'uuid',
		});
		expect(copy).toContain('Загрузках');
		expect(copy).not.toContain('EliteEW-EBrowser');
	});

	it('shows ingesting and auth failure honestly', () => {
		expect(
			ebrowserDownloadStatusCopy({
				id: 2,
				name: 'b.bin',
				phase: 'ingesting',
				progress: 1,
				bytesReceived: 1,
			})
		).toMatch(/Загрузки/);
		expect(
			ebrowserDownloadStatusCopy({
				id: 3,
				name: 'c.bin',
				phase: 'library_auth_failed',
				progress: 1,
				bytesReceived: 1,
			})
		).toMatch(/сессии/);
	});
});
