/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for Professional Worlds toast helpers (`notifyApiError`, success paths).
 *
 * Invariants:
 * - Parse drift surfaces contract i18n key via shared formatter, not raw Zod text.
 *
 * Related:
 * - ProfessionalToast.ts
 * - professionalWorldsApiError.ts
 */

import type { TFunction } from 'i18next';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('@/notifications', () => ({
	useNotifications: () => ({
		toast: {
			success: toastSuccess,
			error: toastError,
			warning: vi.fn(),
		},
	}),
}));

import { useProfessionalToasts } from '../ProfessionalToast';
import { ProfessionalWorldsApiParseError } from '../professionalWorldsApiZod';

describe('useProfessionalToasts', () => {
	it('notifyApiError maps parse errors through formatProfessionalWorldsApiError', () => {
		const { result } = renderHook(() => useProfessionalToasts());
		const t = ((key: string) => key) as TFunction;

		act(() => {
			result.current.notifyApiError(
				new ProfessionalWorldsApiParseError('Invalid deal response'),
				t
			);
		});

		expect(toastError).toHaveBeenCalledWith(
			'realtorPro.errors.actionFailedTitle',
			'realtorPro.errors.apiContract'
		);
	});

	it('notifyApiError uses explicit fallback for unknown errors', () => {
		const { result } = renderHook(() => useProfessionalToasts());
		const t = ((key: string) => key) as TFunction;

		act(() => {
			result.current.notifyApiError({}, t, 'custom fallback');
		});

		expect(toastError).toHaveBeenCalledWith(
			'realtorPro.errors.actionFailedTitle',
			'custom fallback'
		);
	});

	it('notifySuccess delegates to toast.success', () => {
		const { result } = renderHook(() => useProfessionalToasts());

		act(() => {
			result.current.notifySuccess('Saved', 'Row updated');
		});

		expect(toastSuccess).toHaveBeenCalledWith('Saved', 'Row updated');
	});
});
