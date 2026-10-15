/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock for O0+O1 Start / offline shell entitlement gates (+ FoFline W2).
 */

import { describe, expect, it } from 'vitest';
import {
	canOpenCloudSpa,
	canOpenFoflineSpa,
	offlineShellReady,
} from './entitlementGate';

describe('entitlementGate', () => {
	it('allows cloud SPA when entitlement + allowOnline + preflight ok', () => {
		expect(
			canOpenCloudSpa({
				versionOk: true,
				entitlementOk: true,
				allowOnline: true,
				preflightOk: true,
			})
		).toBe(true);
	});

	it('blocks cloud SPA on session online bind without local entitlement', () => {
		expect(
			canOpenCloudSpa({
				versionOk: true,
				entitlementOk: false,
				onlineBoundSession: true,
				allowOnline: true,
				preflightOk: true,
			})
		).toBe(false);
	});

	it('blocks cloud SPA without preflight even if entitlement ok', () => {
		expect(
			canOpenCloudSpa({
				versionOk: true,
				entitlementOk: true,
				allowOnline: true,
				preflightOk: false,
			})
		).toBe(false);
		expect(
			canOpenCloudSpa({
				versionOk: true,
				entitlementOk: true,
				allowOnline: true,
			})
		).toBe(false);
	});

	it('blocks cloud SPA without version', () => {
		expect(
			canOpenCloudSpa({
				versionOk: false,
				entitlementOk: true,
				allowOnline: true,
				preflightOk: true,
			})
		).toBe(false);
	});

	it('offline shell requires verified entitlement only', () => {
		expect(offlineShellReady(true)).toBe(true);
		expect(offlineShellReady(false)).toBe(false);
	});

	it('blocks cloud SPA when allowOnline is false or unset', () => {
		expect(
			canOpenCloudSpa({
				versionOk: true,
				entitlementOk: true,
				preflightOk: true,
				allowOnline: false,
			})
		).toBe(false);
		expect(
			canOpenCloudSpa({
				versionOk: true,
				entitlementOk: true,
				preflightOk: true,
				allowOnline: null,
			})
		).toBe(false);
		expect(
			canOpenCloudSpa({
				versionOk: true,
				entitlementOk: true,
				preflightOk: true,
			})
		).toBe(false);
	});

	it('FoFline Start requires allowFofline true + preflight', () => {
		expect(
			canOpenFoflineSpa({
				versionOk: true,
				entitlementOk: true,
				allowFofline: false,
				preflightOk: true,
			})
		).toBe(false);
		expect(
			canOpenFoflineSpa({
				versionOk: true,
				entitlementOk: true,
				allowFofline: null,
				preflightOk: true,
			})
		).toBe(false);
		expect(
			canOpenFoflineSpa({
				versionOk: true,
				entitlementOk: true,
				allowFofline: true,
				preflightOk: true,
			})
		).toBe(true);
	});
});
