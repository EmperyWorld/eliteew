/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for Unified Content browser download error classification and toasts.
 *
 * Invariants:
 * - 403 and network failures map to user-visible Download failed reasons.
 *
 * Related:
 * - content/contentDownloadResilience.ts
 */

import { AxiosError } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import {
	CONTENT_DOWNLOAD_ERROR_TITLE,
	classifyContentDownloadFailure,
	reportContentDownloadFailure,
} from './contentDownloadResilience';
import { APIError } from '../api/client';

const notifyError = vi.hoisted(() => vi.fn());
const logUxError = vi.hoisted(() => vi.fn());

vi.mock('@/notifications', () => ({
	notify: {
		error: notifyError,
	},
}));

vi.mock('../../utils/uxErrorLog', () => ({
	logUxError,
}));

describe('contentDownloadResilience', () => {
	it('classifies 403 as Access Denied', () => {
		const result = classifyContentDownloadFailure(
			new APIError(
				'Forbidden',
				403,
				undefined,
				undefined,
				undefined,
				'/download'
			)
		);
		expect(result).toEqual({
			title: CONTENT_DOWNLOAD_ERROR_TITLE,
			message: 'Access Denied',
		});
	});

	it('classifies network errors as Download Failed', () => {
		const err = new AxiosError('Network Error');
		err.request = {};
		const result = classifyContentDownloadFailure(err);
		expect(result).toEqual({
			title: CONTENT_DOWNLOAD_ERROR_TITLE,
			message: 'Download Failed',
		});
	});

	it('reportContentDownloadFailure shows toast for terminal blob failure', () => {
		notifyError.mockReset();
		logUxError.mockReset();

		reportContentDownloadFailure(new APIError('Forbidden', 403), {
			operation: 'content_download',
			contentId: 'content-1',
		});

		expect(notifyError).toHaveBeenCalledWith(
			'Download failed',
			'Access Denied',
			expect.objectContaining({ duration: 5000 })
		);
		expect(logUxError).toHaveBeenCalledWith(
			'unified_content',
			'content_download',
			expect.any(APIError),
			expect.objectContaining({ contentId: 'content-1' })
		);
	});
});
