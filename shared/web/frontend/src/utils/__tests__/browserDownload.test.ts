/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for central browser download helpers.
 *
 * Invariants:
 * - Blob URLs are revoked after a delay and direct URL downloads do not leave DOM anchors behind.
 *
 * Related:
 * - ../browserDownload
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
	type MockInstance,
} from 'vitest';
import {
	createRevocableObjectUrlFromBlob,
	triggerBrowserDownloadFromBlob,
	triggerBrowserDownloadFromUrl,
} from '../browserDownload';

describe('browserDownload helpers', () => {
	let clickSpy: MockInstance;
	let createObjectUrlSpy: MockInstance;
	let revokeObjectUrlSpy: MockInstance;

	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '';
		clickSpy = vi
			.spyOn(HTMLAnchorElement.prototype, 'click')
			.mockImplementation(() => {});
		createObjectUrlSpy = vi
			.spyOn(URL, 'createObjectURL')
			.mockReturnValue('blob:download-1');
		revokeObjectUrlSpy = vi
			.spyOn(URL, 'revokeObjectURL')
			.mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	it('triggers a direct URL download without leaving anchor nodes behind', () => {
		triggerBrowserDownloadFromUrl('https://app.example.test/file.pdf', {
			download: 'file.pdf',
		});

		expect(clickSpy).toHaveBeenCalledTimes(1);
		expect(document.body.querySelector('a')).toBeNull();
	});

	it('creates a Blob download URL and revokes it after the delay', () => {
		const blob = new Blob(['pdf'], { type: 'application/pdf' });

		const url = triggerBrowserDownloadFromBlob(blob, 'report.pdf', {
			revokeDelayMs: 250,
		});

		expect(url).toBe('blob:download-1');
		expect(createObjectUrlSpy).toHaveBeenCalledWith(blob);
		expect(clickSpy).toHaveBeenCalledTimes(1);
		expect(revokeObjectUrlSpy).not.toHaveBeenCalled();

		vi.advanceTimersByTime(250);

		expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:download-1');
	});

	it('can create a revocable object URL without clicking a download anchor', () => {
		const blob = new Blob(['pdf'], { type: 'application/pdf' });

		const url = createRevocableObjectUrlFromBlob(blob, 100);

		expect(url).toBe('blob:download-1');
		expect(clickSpy).not.toHaveBeenCalled();

		vi.advanceTimersByTime(100);

		expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:download-1');
	});
});
