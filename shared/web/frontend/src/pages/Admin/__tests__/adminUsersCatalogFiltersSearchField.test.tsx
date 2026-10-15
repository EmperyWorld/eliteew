/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Autofill/a11y guard: admin users catalog search input has id and name.
 *
 * Related:
 * - pages/Admin/users/AdminUsersCatalogFiltersPanel.tsx
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminUsersCatalogFiltersPanel } from '../users/AdminUsersCatalogFiltersPanel';
import type { AdminUsersCatalogFiltersController } from '../users/adminUsersCatalogFiltersTypes';
import { DEFAULT_ADMIN_USERS_TABLE_COLUMNS } from '../adminUsersTableColumns';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

function makeCtrl(
	overrides: Partial<AdminUsersCatalogFiltersController> = {}
): AdminUsersCatalogFiltersController {
	return {
		search: '',
		setSearch: vi.fn(),
		searchInputRef: { current: null },
		roleFilter: '',
		setRoleFilter: vi.fn(),
		groupFilter: '',
		setGroupFilter: vi.fn(),
		activeFilter: 'all',
		setActiveFilter: vi.fn(),
		trustedFilter: 'all',
		setTrustedFilter: vi.fn(),
		verifiedFilter: 'all',
		setVerifiedFilter: vi.fn(),
		onlineOnly: false,
		setOnlineOnly: vi.fn(),
		anomalyOnly: false,
		setAnomalyOnly: vi.fn(),
		ssoBrowserOnly: false,
		setSsoBrowserOnly: vi.fn(),
		ssoMobileOnly: false,
		setSsoMobileOnly: vi.fn(),
		ssoDesktopOnly: false,
		setSsoDesktopOnly: vi.fn(),
		mismatchOnly: false,
		setMismatchOnly: vi.fn(),
		sortValue: 'created_desc',
		setSortValue: vi.fn(),
		channelsCompact: false,
		setChannelsCompact: vi.fn(),
		tableColumns: DEFAULT_ADMIN_USERS_TABLE_COLUMNS,
		setTableColumns: vi.fn(),
		autoRefresh: false,
		setAutoRefresh: vi.fn(),
		groups: [],
		groupsLoading: false,
		hasActiveFilters: false,
		clearFilters: vi.fn(),
		setPage: vi.fn(),
		filtersExpanded: true,
		onFiltersExpandedChange: vi.fn(),
		...overrides,
	};
}

describe('AdminUsersCatalogFiltersPanel search field', () => {
	it('exposes id and name on the catalog search input', () => {
		render(<AdminUsersCatalogFiltersPanel ctrl={makeCtrl()} />);
		const input = screen.getByPlaceholderText(
			'adminUsersHub.filters.searchPlaceholder'
		);
		expect(input).toHaveAttribute('id');
		expect(input.getAttribute('id')).toMatch(/-search$/);
		expect(input).toHaveAttribute('name', 'admin-users-catalog-search');
	});
});
