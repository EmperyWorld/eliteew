/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for useCompanionOutputSurfaceHandlers (U8.1 extract).
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCompanionOutputSurfaceHandlers } from '@/features/ewa/companionOutputSurface/useCompanionOutputSurfaceHandlers';
import type { CompanionOutputSurfaceState } from '@/features/ewa/companionOutputSurface/types';

vi.mock(
	'@/features/ewa/companionOutputSurface/companionOutputSurfaceState',
	async () => {
		const actual = await vi.importActual<
			typeof import('@/features/ewa/companionOutputSurface/companionOutputSurfaceState')
		>('@/features/ewa/companionOutputSurface/companionOutputSurfaceState');
		return {
			...actual,
			saveCompanionOutputSurfaceState: vi.fn(),
		};
	}
);

describe('useCompanionOutputSurfaceHandlers', () => {
	it('persists surface changes per principal', async () => {
		const { saveCompanionOutputSurfaceState } = await import(
			'@/features/ewa/companionOutputSurface/companionOutputSurfaceState'
		);
		let surface: CompanionOutputSurfaceState = { mode: 'chat' };
		const setOutputSurface = vi.fn((next) => {
			surface =
				typeof next === 'function'
					? (
							next as (
								prev: CompanionOutputSurfaceState
							) => CompanionOutputSurfaceState
						)(surface)
					: next;
		});

		const { result } = renderHook(() =>
			useCompanionOutputSurfaceHandlers({
				principalId: 'principal-1',
				setOutputSurface,
			})
		);

		act(() => result.current.handleOutputSurfaceChange({ mode: 'my_phrases' }));

		expect(setOutputSurface).toHaveBeenCalled();
		expect(saveCompanionOutputSurfaceState).toHaveBeenCalledWith(
			'principal-1',
			{ mode: 'my_phrases' }
		);
	});

	it('syncs coerced output_surface from chat response', async () => {
		const { saveCompanionOutputSurfaceState } = await import(
			'@/features/ewa/companionOutputSurface/companionOutputSurfaceState'
		);
		const setOutputSurface = vi.fn();

		const { result } = renderHook(() =>
			useCompanionOutputSurfaceHandlers({
				principalId: 'principal-2',
				setOutputSurface,
			})
		);

		act(() =>
			result.current.syncOutputSurfaceFromResponse({
				reply: 'ok',
				companion_revision: 2,
				output_surface: { mode: 'workflow_edit', payload: {} },
			})
		);

		expect(setOutputSurface).toHaveBeenCalledWith({
			mode: 'workflow_edit',
			payload: {},
		});
		expect(saveCompanionOutputSurfaceState).toHaveBeenCalledWith(
			'principal-2',
			{ mode: 'workflow_edit', payload: {} }
		);
	});
});
