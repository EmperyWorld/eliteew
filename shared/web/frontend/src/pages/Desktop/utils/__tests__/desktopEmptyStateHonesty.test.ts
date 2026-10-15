/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P9 lock — false empty desktop must not appear while items are still hydrating.
 *
 * Invariants:
 * - Preloader stays up when config is ready but items GET is in flight.
 * - Empty CTA only after items hydrate completes.
 *
 * Related:
 * - utils/desktopEmptyStateHonesty.ts
 */

import { describe, expect, it } from 'vitest';
import {
	shouldShowDesktopEmptyState,
	shouldShowDesktopStoragePreloader,
} from '../desktopEmptyStateHonesty';

describe('desktopEmptyStateHonesty (P9)', () => {
	it('keeps storage preloader while items hydrate after config ready', () => {
		expect(
			shouldShowDesktopStoragePreloader({
				storageLoading: false,
				hasConfig: true,
				isItemsHydrating: true,
			})
		).toBe(true);
	});

	it('shows storage preloader while config is still loading', () => {
		expect(
			shouldShowDesktopStoragePreloader({
				storageLoading: true,
				hasConfig: false,
				isItemsHydrating: false,
			})
		).toBe(true);
	});

	it('hides storage preloader when config and items are ready', () => {
		expect(
			shouldShowDesktopStoragePreloader({
				storageLoading: false,
				hasConfig: true,
				isItemsHydrating: false,
			})
		).toBe(false);
	});

	it('suppresses empty CTA while items hydrate with zero display items', () => {
		expect(
			shouldShowDesktopEmptyState({
				displayItemCount: 0,
				isItemsHydrating: true,
			})
		).toBe(false);
	});

	it('shows empty CTA only after hydrate when canvas is empty', () => {
		expect(
			shouldShowDesktopEmptyState({
				displayItemCount: 0,
				isItemsHydrating: false,
			})
		).toBe(true);
		expect(
			shouldShowDesktopEmptyState({
				displayItemCount: 2,
				isItemsHydrating: false,
			})
		).toBe(false);
	});
});
