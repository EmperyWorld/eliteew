/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Hub tab rail: workflows + admin_history only when UGS admin.
 *
 * Invariants:
 * - Non-admin rail is overview/active/history/results only.
 *
 * Related:
 * - hooks/ugsHub/useUgsHubTabItems.ts
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

import { useUgsHubTabItems } from '../useUgsHubTabItems';

const counts = {
	filteredTasksCount: 1,
	filteredActiveCount: 2,
	filteredHistoryCount: 3,
	filteredCompletedCount: 4,
	adminHistoryCount: 5,
	workflowTypeCount: 6,
};

describe('useUgsHubTabItems', () => {
	it('hides workflows and admin_history for non-admin users', () => {
		const { result } = renderHook(() =>
			useUgsHubTabItems({ showUgsAdminLink: false, ...counts })
		);
		const ids = result.current.map((tab) => tab.id);
		expect(ids).toEqual(['overview', 'active', 'history', 'results']);
	});

	it('includes admin_history then workflows for UGS admins', () => {
		const { result } = renderHook(() =>
			useUgsHubTabItems({ showUgsAdminLink: true, ...counts })
		);
		const ids = result.current.map((tab) => tab.id);
		expect(ids).toEqual([
			'overview',
			'active',
			'history',
			'results',
			'admin_history',
			'workflows',
		]);
	});
});
