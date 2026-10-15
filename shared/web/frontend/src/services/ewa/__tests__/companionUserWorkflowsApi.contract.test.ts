/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for companion user workflow HTTP paths and expected error helpers.
 *
 * Invariants:
 * - Frontend paths stay rooted at `/api/v1/ewa/companion-user-workflows`.
 *
 * Related:
 * - src/services/ewa/companionUserWorkflowsApi.ts
 */

import { describe, expect, it } from 'vitest';

import { API_OPTIONS } from '@/pages/MarketingCabinet/marketingCabinetApi/config';
import { APIError } from '@/services/api/client';
import {
	COMPANION_USER_WORKFLOWS_PATH,
	isCompanionUserWorkflowNotFound,
} from '@/services/ewa/companionUserWorkflowsApi';

describe('companionUserWorkflowsApi contract', () => {
	it('resolves paths under /api/v1 like other EWA clients', () => {
		expect(API_OPTIONS.baseURL).toBe('/api/v1');
		expect(COMPANION_USER_WORKFLOWS_PATH).toBe('/ewa/companion-user-workflows');
		expect(
			`${API_OPTIONS.baseURL}${COMPANION_USER_WORKFLOWS_PATH}/validate`
		).toBe('/api/v1/ewa/companion-user-workflows/validate');
	});

	it('detects stale workflow 404 responses', () => {
		expect(
			isCompanionUserWorkflowNotFound(
				new APIError('user_workflow_not_found', 404)
			)
		).toBe(true);
		expect(isCompanionUserWorkflowNotFound(new APIError('other', 404))).toBe(
			false
		);
	});
});
