/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Edge coverage for companion rail + EWA shell snapshot invariant (includeAllVirtualDesktops).
 *
 * Related:
 * - hooks/useDesktopWorkspaceCompanionAndAssistantRail.ts
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as React from 'react';
import { useDesktopWorkspaceCompanionAndAssistantRail } from '../useDesktopWorkspaceCompanionAndAssistantRail';
import type { WindowState } from '../../types/desktop.types';

const buildSnapshot = vi.hoisted(() =>
	vi.fn((_args?: unknown) => ({ schema_version: 1 }))
);

vi.mock('../../utils/buildEwaCompanionShellContext', () => ({
	buildEwaCompanionShellContextSnapshot: (args: unknown) => buildSnapshot(args),
}));

describe('useDesktopWorkspaceCompanionAndAssistantRail', () => {
	const windowsRef = {
		current: [] as WindowState[],
	} as React.MutableRefObject<WindowState[]>;

	it('returns null rail for mobile (edge)', () => {
		const { result } = renderHook(() =>
			useDesktopWorkspaceCompanionAndAssistantRail({
				isMobile: true,
				items: [
					{
						id: 'a',
						name: 'A',
						type: 'app',
						position: { x: 0, y: 0 },
					},
				],
				selected: new Set(['a']),
				assistantContextActions: [
					{
						id: 'explain-selection',
						label: 'Explain',
						source: 'selection',
						assistantTarget: 'assistant',
						enabled: true,
					},
				],
				openAssistantContextAction: vi.fn(),
				activeDesktopWindow: null,
				windowsRef,
				desktops: [{ id: 'd1', name: 'Main', isActive: true, windows: [] }],
				activeDesktopId: 'd1',
				activeDesktopWindowId: null,
			})
		);
		expect(result.current.assistantSelectionRail).toBeNull();
	});

	it('returns null rail when selection empty (edge)', () => {
		const { result } = renderHook(() =>
			useDesktopWorkspaceCompanionAndAssistantRail({
				isMobile: false,
				items: [],
				selected: new Set(),
				assistantContextActions: [
					{
						id: 'explain-selection',
						label: 'Explain',
						source: 'selection',
						assistantTarget: 'assistant',
						enabled: true,
					},
				],
				openAssistantContextAction: vi.fn(),
				activeDesktopWindow: null,
				windowsRef,
				desktops: [{ id: 'd1', name: 'Main', isActive: true, windows: [] }],
				activeDesktopId: 'd1',
				activeDesktopWindowId: null,
			})
		);
		expect(result.current.assistantSelectionRail).toBeNull();
	});

	it('returns null rail when all actions disabled (negative)', () => {
		const { result } = renderHook(() =>
			useDesktopWorkspaceCompanionAndAssistantRail({
				isMobile: false,
				items: [
					{
						id: 'a',
						name: 'A',
						type: 'app',
						position: { x: 0, y: 0 },
					},
				],
				selected: new Set(['a']),
				assistantContextActions: [
					{
						id: 'explain-selection',
						label: 'Explain',
						source: 'selection',
						assistantTarget: 'assistant',
						enabled: false,
					},
				],
				openAssistantContextAction: vi.fn(),
				activeDesktopWindow: null,
				windowsRef,
				desktops: [{ id: 'd1', name: 'Main', isActive: true, windows: [] }],
				activeDesktopId: 'd1',
				activeDesktopWindowId: null,
			})
		);
		expect(result.current.assistantSelectionRail).toBeNull();
	});

	it('companion snapshot always sets includeAllVirtualDesktops true', () => {
		buildSnapshot.mockClear();
		const { result } = renderHook(() =>
			useDesktopWorkspaceCompanionAndAssistantRail({
				isMobile: false,
				items: [],
				selected: new Set(),
				assistantContextActions: [],
				openAssistantContextAction: vi.fn(),
				activeDesktopWindow: null,
				windowsRef,
				desktops: [{ id: 'd1', name: 'Main', isActive: true, windows: [] }],
				activeDesktopId: 'd1',
				activeDesktopWindowId: 'w1',
			})
		);
		result.current.companionShellBridge.getSnapshot();
		expect(buildSnapshot).toHaveBeenCalledWith(
			expect.objectContaining({
				includeAllVirtualDesktops: true,
				maxWindows: 40,
				activeWindowId: 'w1',
			})
		);
	});
});
