/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for EWA companion plans HTTP client paths and 404 detail discrimination (no network).
 *
 * Invariants:
 * - Paths stay aligned with ``companion_plans.py`` mounts under ``/api/v1/ewa``.
 *
 * Related:
 * - src/services/ewa/ewaCompanionPlansApi.ts
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { APIError } from '@/services/api/client';
import {
	EWA_COMPANION_PLANS_ACTIVE_PATH,
	EWA_COMPANION_PLANS_TASK_PATH,
	isCompanionPlansFeatureDisabledError,
	isCompanionPlansNoActivePlanError,
	isCompanionPlansOpaque404Error,
	normalizeEwaCompanionPlanBundle,
} from '../ewaCompanionPlansApi';
import { resetCompanionPlansFeatureProbeStateForTests } from '../companionPlansFeatureProbe';

describe('EWA companion plans client contract', () => {
	beforeEach(() => {
		resetCompanionPlansFeatureProbeStateForTests();
	});

	it('uses hand-written paths aligned with companion_plans router', () => {
		expect(EWA_COMPANION_PLANS_ACTIVE_PATH).toBe('/ewa/companion-plans/active');
		expect(EWA_COMPANION_PLANS_TASK_PATH).toBe('/ewa/companion-plans/tasks');
	});

	it('detects feature-disabled 404', () => {
		const err = new APIError('disabled', 404, 'companion_plans_disabled');
		expect(isCompanionPlansFeatureDisabledError(err)).toBe(true);
		expect(isCompanionPlansNoActivePlanError(err)).toBe(false);
	});

	it('detects feature-disabled 404 from nested FastAPI detail payload', () => {
		const err = new APIError('disabled', 404, undefined, {
			detail: { code: 'companion_plans_disabled', message: 'off' },
		});
		expect(isCompanionPlansFeatureDisabledError(err)).toBe(true);
		expect(isCompanionPlansNoActivePlanError(err)).toBe(false);
	});

	it('detects feature-disabled 404 from production http_exception_handler payload', () => {
		const body = {
			error: { code: 'companion_plans_disabled', message: 'off' },
			detail: { code: 'companion_plans_disabled', message: 'off' },
			status_code: 404,
		};
		const err = new APIError('disabled', 404, undefined, body);
		expect(isCompanionPlansFeatureDisabledError(err)).toBe(true);
		expect(isCompanionPlansOpaque404Error(err)).toBe(false);
	});

	it('detects opaque companion-plans 404 without active-plan codes', () => {
		const err = new APIError('Not Found', 404, undefined, {
			detail: 'Not Found',
		});
		expect(isCompanionPlansOpaque404Error(err)).toBe(true);
		expect(isCompanionPlansFeatureDisabledError(err)).toBe(false);
		expect(isCompanionPlansNoActivePlanError(err)).toBe(false);
	});

	it('detects no-active-plan 404', () => {
		const err = new APIError('empty', 404, undefined, 'no_active_plan');
		expect(isCompanionPlansNoActivePlanError(err)).toBe(true);
		expect(isCompanionPlansFeatureDisabledError(err)).toBe(false);
	});

	it('normalizes empty and partial active-plan bundles to stable arrays', () => {
		expect(normalizeEwaCompanionPlanBundle(null)).toEqual({
			plan: null,
			goals: [],
			tasks: [],
		});
		expect(
			normalizeEwaCompanionPlanBundle({
				plan: {
					id: 'plan-1',
					principal_id: 'p-1',
					title: 'Plan',
				},
			})
		).toEqual({
			plan: {
				id: 'plan-1',
				principal_id: 'p-1',
				title: 'Plan',
			},
			goals: [],
			tasks: [],
		});
	});
});
