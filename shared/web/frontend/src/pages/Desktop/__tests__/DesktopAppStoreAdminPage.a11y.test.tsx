/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * a11y smoke for Desktop App Store admin (tab nav, loading state, sortable headers).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import {
	AdminTabLoading,
	DesktopAppStoreAdminPage,
} from '../DesktopAppStoreAdminPage';

vi.mock('../services/desktopAdminApi', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../services/desktopAdminApi')>();
	return {
		...actual,
		getCatalog: vi.fn().mockResolvedValue([]),
		getAccessGroups: vi.fn().mockResolvedValue([]),
	};
});

describe('AdminTabLoading', () => {
	it('exposes loading state for assistive tech (role status + aria-busy + label)', () => {
		render(<AdminTabLoading label="Loading catalog" />);
		const el = screen.getByRole('status', { name: 'Loading catalog' });
		expect(el).toHaveAttribute('aria-busy', 'true');
		expect(el).toHaveAttribute('aria-label', 'Loading catalog');
	});
});

describe('DesktopAppStoreAdminPage', () => {
	it('labels tab navigation and marks the active section with aria-pressed', async () => {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={client}>
				<DesktopAppStoreAdminPage embedded />
			</QueryClientProvider>
		);
		await screen.findByRole('navigation', {
			name: /разделы админки|App Store admin sections/i,
		});
		const catalog = screen.getByRole('button', {
			name: /^Каталог$|^Catalog$/i,
		});
		expect(catalog).toHaveAttribute('aria-pressed', 'true');
		const groups = screen.getByRole('button', {
			name: /группы допуска|Access groups/i,
		});
		expect(groups).toHaveAttribute('aria-pressed', 'false');
		expect(
			await screen.findByText(/Каталог пуст|Catalog is empty/i)
		).toBeInTheDocument();
	});

	it('shows sortable column headers when catalog has rows', async () => {
		const adminApi = await import('../services/desktopAdminApi');
		vi.mocked(adminApi.getCatalog).mockResolvedValueOnce([
			{
				id: '1',
				app_id: 'app.test',
				name: 'Test App',
				description: null,
				app_component: 'AppStore',
				category: 'productivity',
				gradient: null,
				color: null,
				sort_order: 0,
				allow_multiple_windows: false,
				max_window_instances: 1,
				is_system: false,
				is_factory: false,
				is_featured_new: false,
				maintenance_mode: false,
				ew_monthly_price: 0,
				trial_duration_days: 0,
				access_groups: [],
				created_at: '2020-01-01T00:00:00Z',
				updated_at: '2020-01-01T00:00:00Z',
			},
		]);
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={client}>
				<DesktopAppStoreAdminPage embedded />
			</QueryClientProvider>
		);
		const appIdHeader = await screen.findByRole('columnheader', {
			name: /app_id/i,
		});
		expect(appIdHeader).toHaveAttribute('aria-sort', 'ascending');
		expect(appIdHeader).toHaveAttribute('tabIndex', '0');
	});
});
