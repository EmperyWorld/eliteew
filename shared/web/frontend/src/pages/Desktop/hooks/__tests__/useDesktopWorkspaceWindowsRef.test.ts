import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDesktopWorkspaceWindowsRef } from '../useDesktopWorkspaceWindowsRef';

describe('useDesktopWorkspaceWindowsRef', () => {
	it('updates ref.current when value changes', () => {
		const { result, rerender } = renderHook(
			({ v }: { v: string }) => useDesktopWorkspaceWindowsRef(v),
			{ initialProps: { v: 'a' } }
		);
		expect(result.current.current).toBe('a');
		rerender({ v: 'b' });
		expect(result.current.current).toBe('b');
	});
});
