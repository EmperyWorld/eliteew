/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for the T33 desktop workspace content drop-handler hook.
 *
 * Invariants:
 * - Hook exposes the three canvas drop handlers expected by the layout bridge widgetsAndDrop slice.
 * - Handler identities remain stable when unrelated params are unchanged.
 *
 * Related:
 * - src/pages/Desktop/hooks/useDesktopWorkspaceContentDropHandlers.ts
 * - types/desktopWorkspaceShellLayoutCanvasBridge.types.ts
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UseDesktopWorkspaceContentDropHandlersParams } from '../useDesktopWorkspaceContentDropHandlers';
import { useDesktopWorkspaceContentDropHandlers } from '../useDesktopWorkspaceContentDropHandlers';

function buildMinimalParams(): UseDesktopWorkspaceContentDropHandlersParams {
	return {
		items: [],
		iconSize: 'medium',
		gridStep: 'medium',
		commitItems: vi.fn(),
		desktopToast: { info: vi.fn() },
		t: ((key: string) =>
			key) as UseDesktopWorkspaceContentDropHandlersParams['t'],
		liftDesktopItemsToRoot: vi.fn(),
		moveDesktopNestedItemsToFolder: vi.fn(),
	};
}

describe('useDesktopWorkspaceContentDropHandlers', () => {
	it('returns the three canvas drop handlers for the layout bridge contract', () => {
		const params = buildMinimalParams();

		const { result } = renderHook(() =>
			useDesktopWorkspaceContentDropHandlers(params)
		);

		expect(typeof result.current.onBackgroundContentDragOver).toBe('function');
		expect(typeof result.current.onBackgroundContentDrop).toBe('function');
		expect(typeof result.current.onExternalContentDropToFolder).toBe(
			'function'
		);
	});

	it('keeps handler references stable when unrelated params are unchanged', () => {
		const params = buildMinimalParams();
		const { result, rerender } = renderHook(
			(p: UseDesktopWorkspaceContentDropHandlersParams) =>
				useDesktopWorkspaceContentDropHandlers(p),
			{ initialProps: params }
		);

		const first = result.current;
		rerender(params);

		expect(result.current.onBackgroundContentDragOver).toBe(
			first.onBackgroundContentDragOver
		);
		expect(result.current.onBackgroundContentDrop).toBe(
			first.onBackgroundContentDrop
		);
		expect(result.current.onExternalContentDropToFolder).toBe(
			first.onExternalContentDropToFolder
		);
	});
});
