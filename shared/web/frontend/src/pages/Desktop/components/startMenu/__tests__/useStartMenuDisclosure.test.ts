/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral coverage for Start Menu progressive-disclosure intent sync.
 *
 * Related:
 * - ../useStartMenuDisclosure.ts
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	useStartMenuDisclosure,
	type StartMenuIntent,
} from '../useStartMenuDisclosure';
import type { StartMenuTab } from '../../../types/desktopStartMenu';

describe('useStartMenuDisclosure', () => {
	function setup(initialOpen = true, initialIntent?: StartMenuIntent) {
		const setActiveTab = vi.fn<(tab: StartMenuTab) => void>();
		const setSearch = vi.fn<(search: string) => void>();
		const hook = renderHook(
			({
				isOpen,
				intent,
			}: {
				isOpen: boolean;
				intent: StartMenuIntent | undefined;
			}) => useStartMenuDisclosure(isOpen, intent, setActiveTab, setSearch),
			{
				initialProps: {
					isOpen: initialOpen,
					intent: initialIntent,
				},
			}
		);
		return { ...hook, setActiveTab, setSearch };
	}

	it('expands work advanced for work intent without opening More menu', () => {
		const { result, rerender, setActiveTab, setSearch } = setup(true);

		act(() => {
			rerender({ isOpen: true, intent: { tab: 'work', nonce: 1 } });
		});
		expect(result.current.showMoreTabs).toBe(false);
		expect(result.current.showWorkAdvanced).toBe(true);
		expect(result.current.showLibraryDiscovery).toBe(false);
		expect(setActiveTab).toHaveBeenCalledWith('work');
		expect(setSearch).toHaveBeenCalledWith('');

		act(() => {
			rerender({ isOpen: true, intent: { tab: 'pinned', nonce: 2 } });
		});
		expect(result.current.showMoreTabs).toBe(false);
		expect(setActiveTab).toHaveBeenCalledWith('pinned');

		act(() => {
			rerender({ isOpen: true, intent: { tab: 'all', nonce: 3 } });
		});
		expect(result.current.showMoreTabs).toBe(false);
		expect(setActiveTab).toHaveBeenCalledWith('all');
	});

	it('selects recent tab for recent intent without expanding library', () => {
		const { result, rerender, setActiveTab } = setup(true);
		act(() => {
			rerender({ isOpen: true, intent: { tab: 'recent', nonce: 1 } });
		});
		expect(result.current.showLibraryDiscovery).toBe(false);
		expect(result.current.showMoreTabs).toBe(false);
		expect(result.current.showWorkAdvanced).toBe(false);
		expect(setActiveTab).toHaveBeenCalledWith('recent');
	});

	it('ignores stale or same nonce', () => {
		const { result, rerender, setActiveTab } = setup(true, {
			tab: 'work',
			nonce: 5,
		});
		expect(result.current.showMoreTabs).toBe(false);
		expect(result.current.showWorkAdvanced).toBe(true);
		expect(setActiveTab).toHaveBeenCalledTimes(1);

		act(() => {
			rerender({ isOpen: true, intent: { tab: 'pinned', nonce: 5 } });
		});
		expect(setActiveTab).toHaveBeenCalledTimes(1);
		expect(result.current.showWorkAdvanced).toBe(true);

		act(() => {
			rerender({ isOpen: true, intent: { tab: 'all', nonce: 4 } });
		});
		expect(setActiveTab).toHaveBeenCalledTimes(1);
	});

	it('resolves legacy categories intent to all (P19)', () => {
		const { setActiveTab, rerender } = setup(true);
		act(() => {
			rerender({ isOpen: true, intent: { tab: 'categories', nonce: 1 } });
		});
		expect(setActiveTab).toHaveBeenCalledWith('all');
	});

	it('resets disclosure when the menu closes', () => {
		const { result, rerender } = setup(true, { tab: 'work', nonce: 1 });
		expect(result.current.showWorkAdvanced).toBe(true);

		act(() => {
			result.current.setShowMoreTabs(true);
			result.current.setShowLibraryDiscovery(true);
		});
		expect(result.current.showMoreTabs).toBe(true);
		expect(result.current.showLibraryDiscovery).toBe(true);

		act(() => {
			rerender({ isOpen: false, intent: { tab: 'work', nonce: 1 } });
		});
		expect(result.current.showMoreTabs).toBe(false);
		expect(result.current.showLibraryDiscovery).toBe(false);
		expect(result.current.showWorkAdvanced).toBe(false);
	});
});
