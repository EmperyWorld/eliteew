/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component tests for dashboard favorites slot local-only UX banner.
 *
 * Invariants:
 * - When `isLocalOnly`, user sees `widgetsPanel.localOnlyHint` and `data-local-only`.
 *
 * Related:
 * - `pages/Desktop/components/DashboardFavoritesSlotBody.tsx`
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardFavoritesSlotBody } from '../DashboardFavoritesSlotBody';

const useDashboardFavorites = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useDashboardFavorites', () => ({
	useDashboardFavorites,
	openDashboardFavoriteUrl: vi.fn(),
}));

vi.mock('react-i18next', () => ({
	useTranslation: (_ns?: string, opts?: { keyPrefix?: string }) => ({
		t: (key: string) => {
			if (opts?.keyPrefix === 'workspace' && key === 'localOnlyHint') {
				return 'Saved only on this device';
			}
			return (
				{
					'settingsPanel.widgetsPanel.loading': 'Loading…',
					'settingsPanel.widgetsPanel.favoritesLoading': 'Loading your links…',
					'settingsPanel.widgetsPanel.favoritesEmpty':
						'Add a link to open it in one click.',
					'settingsPanel.widgetsPanel.favoritesAdd': 'Add',
				}[key] ?? key
			);
		},
	}),
}));

describe('DashboardFavoritesSlotBody', () => {
	it('shows local-only banner when favorites fall back to device storage', () => {
		useDashboardFavorites.mockReturnValue({
			favorites: [{ id: '1', title: 'Docs', url: '#', icon: '⭐' }],
			isLoading: false,
			isLocalOnly: true,
			storageWriteFailed: false,
			error: new Error('offline'),
			addFavorite: vi.fn(),
			removeFavorite: vi.fn(),
			reorderFavorites: vi.fn(),
			isMutating: false,
		});

		render(<DashboardFavoritesSlotBody compact={false} />);

		expect(screen.getByText('Saved only on this device')).toBeInTheDocument();
		expect(screen.getByText('Saved only on this device')).toHaveAttribute(
			'data-local-only',
			'true'
		);
		expect(
			screen.getByText('Saved only on this device').closest('[data-local-only]')
		).toHaveAttribute('data-local-only', 'true');
	});

	it('hides local-only banner when favorites load from API', () => {
		useDashboardFavorites.mockReturnValue({
			favorites: [{ id: '1', title: 'Docs', url: '#', icon: '⭐' }],
			isLoading: false,
			isLocalOnly: false,
			storageWriteFailed: false,
			error: null,
			addFavorite: vi.fn(),
			removeFavorite: vi.fn(),
			reorderFavorites: vi.fn(),
			isMutating: false,
		});

		render(<DashboardFavoritesSlotBody compact={false} />);

		expect(
			screen.queryByText('Saved only on this device')
		).not.toBeInTheDocument();
	});

	it('shows favorites loading skeleton with plain copy', () => {
		useDashboardFavorites.mockReturnValue({
			favorites: [],
			isLoading: true,
			isLocalOnly: false,
			storageWriteFailed: false,
			error: null,
			addFavorite: vi.fn(),
			removeFavorite: vi.fn(),
			reorderFavorites: vi.fn(),
			isMutating: false,
		});

		render(<DashboardFavoritesSlotBody compact={false} />);

		expect(screen.getByText('Loading your links…')).toBeInTheDocument();
		expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
	});

	it('shows plain empty state when there are no favorites', () => {
		useDashboardFavorites.mockReturnValue({
			favorites: [],
			isLoading: false,
			isLocalOnly: false,
			storageWriteFailed: false,
			error: null,
			addFavorite: vi.fn(),
			removeFavorite: vi.fn(),
			reorderFavorites: vi.fn(),
			isMutating: false,
		});

		render(<DashboardFavoritesSlotBody compact={false} />);

		expect(
			screen.getByText('Add a link to open it in one click.')
		).toBeInTheDocument();
	});
});
