/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for EWRP PDF URL construction.
 *
 * Invariants:
 * - Direct browser download URLs require the server-issued short-lived token.
 *
 * Related:
 * - services/ewrpApi.ts
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ewrpPdfAbsoluteUrl,
	ewrpPdfDirectDownloadUrl,
} from '@/services/ewrpApi';

describe('ewrpPdfAbsoluteUrl', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('builds same-origin path without token', () => {
		vi.stubGlobal('location', {
			...window.location,
			origin: 'https://app.example.test',
		});
		expect(ewrpPdfAbsoluteUrl('job-1')).toBe(
			'https://app.example.test/api/v1/ewrp/job-1/pdf'
		);
	});

	it('appends download token query param when provided', () => {
		vi.stubGlobal('location', {
			...window.location,
			origin: 'https://app.example.test',
		});
		expect(ewrpPdfAbsoluteUrl('job-2', ' tok ')).toBe(
			'https://app.example.test/api/v1/ewrp/job-2/pdf?token=tok'
		);
	});

	it('returns relative path when window is unavailable', () => {
		vi.stubGlobal('window', undefined);
		expect(ewrpPdfAbsoluteUrl('job-3', 'abc')).toBe('/api/v1/ewrp/job-3/pdf');
	});

	it('only enables direct browser downloads when a token is available', () => {
		vi.stubGlobal('location', {
			...window.location,
			origin: 'https://app.example.test',
		});

		expect(ewrpPdfDirectDownloadUrl('job-4', null)).toBeNull();
		expect(ewrpPdfDirectDownloadUrl('job-4', '   ')).toBeNull();
		expect(ewrpPdfDirectDownloadUrl('job-4', 'safe-token')).toBe(
			'https://app.example.test/api/v1/ewrp/job-4/pdf?token=safe-token'
		);
	});
});
