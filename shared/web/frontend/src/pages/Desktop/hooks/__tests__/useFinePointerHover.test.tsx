/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for fine-pointer hover detection with Quest laser exclusion.
 */
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFinePointerHover } from '@/pages/Desktop/hooks/useFinePointerHover';

vi.mock('@/pages/Desktop/utils/desktopLaserPointerEnvironment', () => ({
	isDesktopLaserPointerEnvironment: vi.fn(() => false),
}));

describe('useFinePointerHover', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('returns true when media query matches and not on Quest laser browser', async () => {
		const env = await import(
			'@/pages/Desktop/utils/desktopLaserPointerEnvironment'
		);
		vi.mocked(env.isDesktopLaserPointerEnvironment).mockReturnValue(false);
		vi.stubGlobal(
			'matchMedia',
			vi.fn().mockImplementation((query: string) => ({
				matches: query === '(hover: hover) and (pointer: fine)',
				media: query,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}))
		);

		const { result } = renderHook(() => useFinePointerHover());
		expect(result.current).toBe(true);
		vi.unstubAllGlobals();
	});

	it('returns false on Quest laser browser even when media query is fine', async () => {
		const env = await import(
			'@/pages/Desktop/utils/desktopLaserPointerEnvironment'
		);
		vi.mocked(env.isDesktopLaserPointerEnvironment).mockReturnValue(true);
		vi.stubGlobal(
			'matchMedia',
			vi.fn().mockImplementation((query: string) => ({
				matches: query === '(hover: hover) and (pointer: fine)',
				media: query,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}))
		);

		const { result } = renderHook(() => useFinePointerHover());
		expect(result.current).toBe(false);
		vi.unstubAllGlobals();
	});
});
