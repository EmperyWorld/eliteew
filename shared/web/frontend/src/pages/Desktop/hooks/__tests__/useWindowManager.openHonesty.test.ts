/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P7 behavioral lock — openWindow creates a window in the same turn even when
 * preloadDesktopApp returns a slow Promise (no silent “opened” gap).
 *
 * Related:
 * - hooks/useWindowManager.ts
 * - utils/desktopLauncherRoles.ts
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWindowManager } from '../useWindowManager';
import type { DesktopItem } from '../../types/desktop.types';

const preloadDesktopApp = vi.hoisted(() => vi.fn());

vi.mock('../../utils/preloadDesktopApp', () => ({
	preloadDesktopApp,
	preloadDesktopApps: vi.fn(async () => undefined),
}));

const appItem: DesktopItem = {
	id: 'app-ugs',
	name: 'UGS',
	type: 'app',
	position: { x: 0, y: 0 },
	appComponent: 'UGS',
};

describe('useWindowManager openWindow honesty (P7)', () => {
	beforeEach(() => {
		preloadDesktopApp.mockReset();
		preloadDesktopApp.mockReturnValue(
			new Promise(() => {
				/* never resolves — must not block window commit */
			})
		);
	});

	it('commits a window immediately while chunk preload is still pending', () => {
		const { result } = renderHook(() => useWindowManager());

		act(() => {
			result.current.openWindow(appItem);
		});

		expect(result.current.windows).toHaveLength(1);
		expect(result.current.windows[0]?.appComponent).toBe('UGS');
		expect(preloadDesktopApp).toHaveBeenCalledWith('UGS');
	});
});
