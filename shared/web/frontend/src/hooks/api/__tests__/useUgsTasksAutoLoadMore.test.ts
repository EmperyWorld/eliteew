/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral test for UGS Hub infinite scroll sentinel hook.
 *
 * Related:
 * - useUgsTasksAutoLoadMore.ts
 */

import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useUgsTasksAutoLoadMore } from '../useUgsTasksAutoLoadMore';

describe('useUgsTasksAutoLoadMore', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('calls fetchNextPage when sentinel intersects and not already fetching', () => {
		const fetchNextPage = vi.fn().mockResolvedValue(undefined);
		const sentinelRef = createRef<HTMLDivElement>();
		const sentinel = document.createElement('div');
		sentinelRef.current = sentinel;
		document.body.appendChild(sentinel);

		let observerCallback: IntersectionObserverCallback = () => {};
		const observe = vi.fn();
		const disconnect = vi.fn();

		class MockIntersectionObserver {
			constructor(cb: IntersectionObserverCallback) {
				observerCallback = cb;
			}
			observe = observe;
			disconnect = disconnect;
			unobserve = vi.fn();
		}

		vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

		renderHook(() =>
			useUgsTasksAutoLoadMore(sentinelRef, {
				enabled: true,
				hasNextPage: true,
				isFetchingNextPage: false,
				fetchNextPage,
			})
		);

		expect(observe).toHaveBeenCalledWith(sentinel);

		observerCallback(
			[{ isIntersecting: true } as IntersectionObserverEntry],
			{} as IntersectionObserver
		);

		expect(fetchNextPage).toHaveBeenCalledTimes(1);

		sentinel.remove();
	});

	it('does not fetch when disabled or no next page', () => {
		const fetchNextPage = vi.fn().mockResolvedValue(undefined);
		const sentinelRef = createRef<HTMLDivElement>();
		sentinelRef.current = document.createElement('div');

		const observe = vi.fn();
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				observe = observe;
				disconnect = vi.fn();
				unobserve = vi.fn();
			}
		);

		renderHook(() =>
			useUgsTasksAutoLoadMore(sentinelRef, {
				enabled: false,
				hasNextPage: true,
				isFetchingNextPage: false,
				fetchNextPage,
			})
		);

		expect(observe).not.toHaveBeenCalled();
		expect(fetchNextPage).not.toHaveBeenCalled();
	});
});
