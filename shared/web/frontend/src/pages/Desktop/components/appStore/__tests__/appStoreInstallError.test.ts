/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for App Store install API error → i18n message mapping.
 *
 * Invariants:
 * - Raw API English strings must not leak to UI copy.
 *
 * Related:
 * - utils/appStoreInstallError.ts
 */

import { describe, expect, it } from 'vitest';
import { APIError } from '@/services/api/client';
import { appStoreInstallErrorMessage } from '../../../utils/appStoreInstallError';

const t = ((key: string) => key) as Parameters<
	typeof appStoreInstallErrorMessage
>[1];

describe('appStoreInstallErrorMessage', () => {
	it('maps 409 maintenance to maintenanceInstall key', () => {
		expect(
			appStoreInstallErrorMessage(
				new APIError('App temporarily unavailable', 409),
				t
			)
		).toBe('error.maintenanceInstall');
	});

	it('maps 402 insufficient EW without leaking server message', () => {
		expect(
			appStoreInstallErrorMessage(
				new APIError('Not enough EW for subscription to this app', 402),
				t
			)
		).toBe('error.insufficientEw');
	});

	it('maps 403 access denied', () => {
		expect(
			appStoreInstallErrorMessage(
				new APIError('Access denied to this app', 403),
				t
			)
		).toBe('error.accessDenied');
	});

	it('maps 404 and 410 catalog errors', () => {
		expect(
			appStoreInstallErrorMessage(
				new APIError('App not found in catalog', 404),
				t
			)
		).toBe('error.appNotFound');
		expect(
			appStoreInstallErrorMessage(new APIError('App is deprecated', 410), t)
		).toBe('error.appDeprecated');
	});

	it('maps network and 5xx to friendly keys', () => {
		expect(
			appStoreInstallErrorMessage(new APIError('Network Error', 0), t)
		).toBe('error.network');
		expect(appStoreInstallErrorMessage(new APIError('Internal', 500), t)).toBe(
			'error.serverError'
		);
	});

	it('falls back to installFailed for unknown client errors', () => {
		expect(appStoreInstallErrorMessage(new Error('network down'), t)).toBe(
			'error.installFailed'
		);
		expect(
			appStoreInstallErrorMessage(new APIError('Bad request', 400), t)
		).toBe('error.installFailed');
	});
});
