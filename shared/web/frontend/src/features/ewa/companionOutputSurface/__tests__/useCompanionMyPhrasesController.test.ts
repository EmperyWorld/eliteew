/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for useCompanionMyPhrasesController (U8.1 slice 3 extract).
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCompanionMyPhrasesController } from '@/features/ewa/companionOutputSurface/useCompanionMyPhrasesController';
import { buildBuiltinCompanionQuickPresets } from '@/features/ewa/ewaCompanionQuickPresetsUi';

const t = ((key: string) => key) as Parameters<
	typeof useCompanionMyPhrasesController
>[0]['t'];

vi.mock('@/services/ewa/ewaCompanionProfileApi', async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import('@/services/ewa/ewaCompanionProfileApi')
		>();
	return {
		...actual,
		createEwaCompanionQuickPreset: vi.fn(),
		deleteEwaCompanionQuickPreset: vi.fn(),
		listEwaCompanionQuickPresets: vi.fn(),
		patchEwaCompanionQuickPreset: vi.fn(),
	};
});

vi.mock(
	'@/features/ewa/companionOutputSurface/companionMyPhraseIconsStorage',
	() => ({
		readMyPhraseIconOverrides: vi.fn(() => ({})),
		writeMyPhraseIconOverride: vi.fn((_principalId, _presetId, visual) => ({
			[_presetId]: visual,
		})),
	})
);

describe('useCompanionMyPhrasesController', () => {
	it('falls back to built-in presets when server load fails', async () => {
		const { listEwaCompanionQuickPresets } = await import(
			'@/services/ewa/ewaCompanionProfileApi'
		);
		vi.mocked(listEwaCompanionQuickPresets).mockRejectedValueOnce(
			new Error('network')
		);

		const { result } = renderHook(() =>
			useCompanionMyPhrasesController({
				principalId: 'principal-1',
				draft: '',
				pending: false,
				notifyError: vi.fn(),
				notifySuccess: vi.fn(),
				t,
			})
		);

		await waitFor(() => {
			expect(result.current.baseQuickPresets).toEqual(
				buildBuiltinCompanionQuickPresets(t)
			);
		});
	});

	it('opens save dialog from composer draft', () => {
		const { result } = renderHook(() =>
			useCompanionMyPhrasesController({
				principalId: 'principal-2',
				draft: '  Plan my week  ',
				pending: false,
				notifyError: vi.fn(),
				notifySuccess: vi.fn(),
				t,
			})
		);

		act(() => result.current.handleSaveQuickPreset());

		expect(result.current.quickPresetLabelDialog).toMatchObject({
			mode: 'save',
			value: 'Plan my week',
			promptText: 'Plan my week',
		});
	});

	it('queues delete confirmation for user-owned preset', async () => {
		const { listEwaCompanionQuickPresets } = await import(
			'@/services/ewa/ewaCompanionProfileApi'
		);
		vi.mocked(listEwaCompanionQuickPresets).mockResolvedValueOnce([
			{
				id: 'preset-user-1',
				principal_id: 'principal-3',
				label: 'Weekly plan',
				prompt_text: 'Plan my week',
				sort_order: 10,
			},
		]);

		const { result } = renderHook(() =>
			useCompanionMyPhrasesController({
				principalId: 'principal-3',
				draft: '',
				pending: false,
				notifyError: vi.fn(),
				notifySuccess: vi.fn(),
				t,
			})
		);

		await waitFor(() =>
			expect(
				result.current.baseQuickPresets.some(
					(row) => row.id === 'preset-user-1'
				)
			).toBe(true)
		);

		const userPreset = result.current.baseQuickPresets.find(
			(row) => row.id === 'preset-user-1'
		);
		if (!userPreset) throw new Error('expected user preset');

		act(() => result.current.handleDeleteQuickPreset(userPreset));

		expect(result.current.quickPresetDeleteTarget?.id).toBe('preset-user-1');
	});
});
