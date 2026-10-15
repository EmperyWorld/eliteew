/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for dashboard favorites hook (API path + local fallback).
 *
 * Invariants:
 * - API list maps to UI items; API failure enables localStorage mode.
 *
 * Related:
 * - `pages/Desktop/hooks/useDashboardFavorites.ts`
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../../constants';
import {
	openDashboardFavoriteUrl,
	useDashboardFavorites,
} from '../useDashboardFavorites';

const getDashboardFavorites = vi.hoisted(() => vi.fn());
const createDashboardFavorite = vi.hoisted(() => vi.fn());
const deleteDashboardFavorite = vi.hoisted(() => vi.fn());
const reorderDashboardFavorites = vi.hoisted(() => vi.fn());

vi.mock('../../services/desktopApi', () => ({
	getDashboardFavorites,
	createDashboardFavorite,
	deleteDashboardFavorite,
	reorderDashboardFavorites,
}));

vi.mock('../../../../contexts/AuthContext', () => ({
	useAuth: () => ({ user: { id: 'test-user-wave-b' } }),
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

function ensureLocalStorageForTest(): void {
	const canUseNative =
		typeof localStorage !== 'undefined' &&
		typeof localStorage.setItem === 'function';
	if (canUseNative) {
		try {
			localStorage.setItem('__desktop_favorites_test__', '1');
			localStorage.removeItem('__desktop_favorites_test__');
			return;
		} catch {
			// broken jsdom/localstorage-file — install in-memory polyfill below
		}
	}
	const store = new Map<string, string>();
	const storage = {
		getItem: vi.fn((key: string) => store.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			store.set(key, String(value));
		}),
		removeItem: vi.fn((key: string) => {
			store.delete(key);
		}),
		clear: vi.fn(() => {
			store.clear();
		}),
		key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
		get length() {
			return store.size;
		},
	} satisfies Storage;
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: storage,
	});
	if (typeof window !== 'undefined') {
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			value: storage,
		});
	}
}

describe('useDashboardFavorites', () => {
	beforeEach(() => {
		ensureLocalStorageForTest();
		localStorage.clear();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		getDashboardFavorites.mockReset();
		createDashboardFavorite.mockReset();
		deleteDashboardFavorite.mockReset();
		reorderDashboardFavorites.mockReset();
	});

	it('loads favorites from API', async () => {
		getDashboardFavorites.mockResolvedValue([
			{
				id: 'f1',
				title: 'Docs',
				url: 'https://example.com',
				icon: '⭐',
				color: 'from-pink-500/20 to-rose-500/20',
				sort_order: 0,
				created_at: '2026-06-30T08:00:00.000Z',
			},
		]);

		const { result } = renderHook(() => useDashboardFavorites(), { wrapper });

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.favorites).toHaveLength(1);
		expect(result.current.favorites[0]?.title).toBe('Docs');
		expect(result.current.isLocalOnly).toBe(false);
	});

	it('falls back to localStorage when API fails', async () => {
		localStorage.setItem(
			STORAGE_KEYS.WIDGET_FAVORITES,
			JSON.stringify([
				{
					id: 'local-1',
					title: 'Local link',
					url: '#',
					createdAt: '2026-06-30T08:00:00.000Z',
				},
			])
		);
		getDashboardFavorites.mockRejectedValue(new Error('offline'));

		const { result } = renderHook(() => useDashboardFavorites(), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isLocalOnly).toBe(true);
			},
			{ timeout: 3000 }
		);

		expect(result.current.favorites).toHaveLength(1);
		expect(result.current.favorites[0]?.title).toBe('Local link');
	});

	it('creates favorite via API when online', async () => {
		getDashboardFavorites.mockResolvedValue([]);
		createDashboardFavorite.mockResolvedValue({
			id: 'new-1',
			title: 'New',
			url: '#',
			icon: '⭐',
			color: 'from-pink-500/20 to-rose-500/20',
			sort_order: 0,
			created_at: '2026-06-30T08:00:00.000Z',
		});

		const { result } = renderHook(() => useDashboardFavorites(), { wrapper });

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		act(() => {
			result.current.addFavorite({ title: 'New', url: '#' });
		});

		await waitFor(() => {
			expect(createDashboardFavorite.mock.calls[0]?.[0]).toMatchObject({
				title: 'New',
			});
		});
	});

	it('removes favorite via API when online', async () => {
		getDashboardFavorites.mockResolvedValue([
			{
				id: 'f1',
				title: 'Docs',
				url: '#',
				icon: '⭐',
				color: 'from-pink-500/20 to-rose-500/20',
				sort_order: 0,
				created_at: '2026-06-30T08:00:00.000Z',
			},
		]);
		deleteDashboardFavorite.mockResolvedValue(undefined);

		const { result } = renderHook(() => useDashboardFavorites(), { wrapper });

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});
		expect(result.current.isLocalOnly).toBe(false);

		act(() => {
			result.current.removeFavorite('f1');
		});

		await waitFor(() => {
			expect(deleteDashboardFavorite.mock.calls[0]?.[0]).toBe('f1');
		});
	});

	it('reorders favorites in local-only mode and persists order', async () => {
		localStorage.setItem(
			STORAGE_KEYS.WIDGET_FAVORITES,
			JSON.stringify([
				{
					id: 'local-1',
					title: 'First',
					url: '#',
					sortOrder: 0,
					createdAt: '2026-06-30T08:00:00.000Z',
				},
				{
					id: 'local-2',
					title: 'Second',
					url: '#',
					sortOrder: 1,
					createdAt: '2026-06-30T08:01:00.000Z',
				},
			])
		);
		getDashboardFavorites.mockRejectedValue(new Error('offline'));

		const { result } = renderHook(() => useDashboardFavorites(), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isLocalOnly).toBe(true);
			},
			{ timeout: 3000 }
		);

		act(() => {
			result.current.reorderFavorites(0, 1);
		});

		await waitFor(() => {
			expect(result.current.favorites.map((row) => row.title)).toEqual([
				'Second',
				'First',
			]);
		});

		const stored = JSON.parse(
			localStorage.getItem(STORAGE_KEYS.WIDGET_FAVORITES) ?? '[]'
		) as Array<{ title: string; sortOrder: number }>;
		expect(stored.map((row) => row.title)).toEqual(['Second', 'First']);
		expect(stored[0]?.sortOrder).toBe(0);
		expect(stored[1]?.sortOrder).toBe(1);
	});

	it('reorders favorites optimistically when API list is loaded', async () => {
		getDashboardFavorites.mockResolvedValue([
			{
				id: 'f1',
				title: 'Alpha',
				url: '#',
				icon: '⭐',
				color: 'from-pink-500/20 to-rose-500/20',
				sort_order: 0,
				created_at: '2026-06-30T08:00:00.000Z',
			},
			{
				id: 'f2',
				title: 'Beta',
				url: '#',
				icon: '⭐',
				color: 'from-pink-500/20 to-rose-500/20',
				sort_order: 1,
				created_at: '2026-06-30T08:01:00.000Z',
			},
		]);
		reorderDashboardFavorites.mockResolvedValue(undefined);

		const { result } = renderHook(() => useDashboardFavorites(), { wrapper });

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		act(() => {
			result.current.reorderFavorites(0, 1);
		});

		await waitFor(() => {
			expect(result.current.favorites.map((row) => row.title)).toEqual([
				'Beta',
				'Alpha',
			]);
		});

		await waitFor(() => {
			expect(reorderDashboardFavorites.mock.calls[0]?.[0]).toEqual([
				'f2',
				'f1',
			]);
		});
	});

	it('sets storageWriteFailed when localStorage save fails', async () => {
		getDashboardFavorites.mockRejectedValue(new Error('offline'));
		vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
			throw new Error('quota');
		});

		const { result } = renderHook(() => useDashboardFavorites(), { wrapper });

		await waitFor(
			() => {
				expect(result.current.isLocalOnly).toBe(true);
			},
			{ timeout: 3000 }
		);

		act(() => {
			result.current.addFavorite({ title: 'Blocked', url: '#' });
		});

		await waitFor(() => {
			expect(result.current.storageWriteFailed).toBe(true);
		});
	});
});

describe('openDashboardFavoriteUrl', () => {
	it('opens http(s) links in a new tab', () => {
		const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
		openDashboardFavoriteUrl('https://example.com/docs');
		expect(openSpy).toHaveBeenCalledWith(
			'https://example.com/docs',
			'_blank',
			'noopener,noreferrer'
		);
		openSpy.mockRestore();
	});

	it('ignores empty and hash-only urls', () => {
		const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
		openDashboardFavoriteUrl('#');
		openDashboardFavoriteUrl('  ');
		expect(openSpy).not.toHaveBeenCalled();
		openSpy.mockRestore();
	});

	it('opens relative app paths in a new tab', () => {
		const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
		openDashboardFavoriteUrl('/desktop');
		expect(openSpy).toHaveBeenCalledWith(
			'/desktop',
			'_blank',
			'noopener,noreferrer'
		);
		openSpy.mockRestore();
	});

	it('opens mailto links', () => {
		const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
		openDashboardFavoriteUrl('mailto:hello@example.com');
		expect(openSpy).toHaveBeenCalledWith(
			'mailto:hello@example.com',
			'_blank',
			'noopener,noreferrer'
		);
		openSpy.mockRestore();
	});

	it('opens bare domains with https prefix', () => {
		const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
		openDashboardFavoriteUrl('app.eliteew.ru');
		expect(openSpy).toHaveBeenCalledWith(
			'https://app.eliteew.ru',
			'_blank',
			'noopener,noreferrer'
		);
		openSpy.mockRestore();
	});
});
