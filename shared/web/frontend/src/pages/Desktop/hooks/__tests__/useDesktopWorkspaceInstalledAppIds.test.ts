import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import { useDesktopWorkspaceInstalledAppIds } from '../useDesktopWorkspaceInstalledAppIds';

const app = (id: string): DesktopItem => ({
	id,
	name: id,
	type: 'app',
	position: { x: 0, y: 0 },
});

describe('useDesktopWorkspaceInstalledAppIds', () => {
	it('builds a set of installed app ids', () => {
		const { result } = renderHook(() =>
			useDesktopWorkspaceInstalledAppIds([app('a'), app('b')])
		);
		expect(result.current.has('a')).toBe(true);
		expect(result.current.has('b')).toBe(true);
		expect(result.current.size).toBe(2);
	});

	it('returns empty set for empty list', () => {
		const { result } = renderHook(() => useDesktopWorkspaceInstalledAppIds([]));
		expect(result.current.size).toBe(0);
	});
});
