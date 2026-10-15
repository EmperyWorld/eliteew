/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for useCompanionMemoryForget (U8.3 slice 8).
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useCompanionMemoryForget } from '@/features/ewa/companionUx/useCompanionMemoryForget';

const forgetEwaCompanionMemory = vi.fn(async (_contentHash: string) => ({}));
const reloadProfile = vi.fn(async () => undefined);
const notifySuccess = vi.fn();
const notifyError = vi.fn();
const t = ((key: string) => key) as Parameters<
	typeof useCompanionMemoryForget
>[0]['t'];

vi.mock('@/services/ewa/ewaCompanionProfileApi', () => ({
	forgetEwaCompanionMemory: (contentHash: string) =>
		forgetEwaCompanionMemory(contentHash),
}));

describe('useCompanionMemoryForget', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('forgets memory and reloads profile on confirm', async () => {
		const { result } = renderHook(() =>
			useCompanionMemoryForget({
				reloadProfile,
				notifySuccess,
				notifyError,
				t,
			})
		);
		const row = {
			key: 'hash-1',
			label: 'Prefers tea',
			contentHash: 'hash-1',
			forgettable: true,
		};
		act(() => result.current.handleMemoryForgetRequest(row));
		await act(async () => {
			await result.current.handleMemoryForgetConfirm();
		});
		expect(forgetEwaCompanionMemory).toHaveBeenCalledWith('hash-1');
		expect(reloadProfile).toHaveBeenCalled();
		expect(notifySuccess).toHaveBeenCalledWith(
			'ewaCompanion.memoryForgetSuccess'
		);
		expect(result.current.memoryForgetTarget).toBeNull();
	});
});
