/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for useCompanionLeftRailController (U8.1 slice 5 extract).
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCompanionLeftRailController } from '@/features/ewa/companionUx/useCompanionLeftRailController';
import { APIError } from '@/services/api/client';
import { EWA_COMPANION_TURN_PLAN_NS } from '@/services/ewa/ewaCompanionChatApi';
import { getEwaCompanionActivePlan } from '@/services/ewa/ewaCompanionPlansApi';
import { resetCompanionPlansFeatureProbeStateForTests } from '@/services/ewa/companionPlansFeatureProbe';
import type { EwaCompanionProfileOut } from '@/services/ewa/ewaCompanionProfileApi';

const t = ((key: string, opts?: unknown) => {
	if (opts && typeof opts === 'object') {
		if ('tool' in opts) {
			return `${key}:${String((opts as { tool?: string }).tool ?? '')}`;
		}
		if ('percent' in opts) {
			return `${key}:${String((opts as { percent?: number }).percent ?? 0)}`;
		}
	}
	return key;
}) as Parameters<typeof useCompanionLeftRailController>[0]['t'];

function profile(
	overrides: Partial<EwaCompanionProfileOut> = {}
): Pick<
	EwaCompanionProfileOut,
	| 'principal_id'
	| 'learned_preferences'
	| 'memory_display'
	| 'companion_revision'
> {
	return {
		principal_id: 'principal-1',
		learned_preferences: {},
		memory_display: [],
		companion_revision: 1,
		...overrides,
	};
}

function baseOptions(
	overrides: Partial<Parameters<typeof useCompanionLeftRailController>[0]> = {}
) {
	return {
		profile: profile(),
		personaId: 'ewa',
		pending: false,
		ru: true,
		t,
		getSnapshot: () => null,
		isDesktopWindowActive: false,
		operationsPollEnabled: false,
		notifyError: vi.fn(),
		...overrides,
	};
}

vi.mock('@/features/ewa/useEwaCompanionAnticipationTick', () => ({
	useEwaCompanionAnticipationTick: () => ({
		hint: null,
		dismissHint: vi.fn(),
	}),
}));

const getActivePlanMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/ewa/ewaCompanionPlansApi', async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import('@/services/ewa/ewaCompanionPlansApi')
		>();
	return {
		...actual,
		getEwaCompanionActivePlan: getActivePlanMock,
	};
});

describe('useCompanionLeftRailController', () => {
	beforeEach(() => {
		getActivePlanMock.mockReset();
		getActivePlanMock.mockResolvedValue(null);
		resetCompanionPlansFeatureProbeStateForTests();
	});

	it('toggles left-rail section expand state', () => {
		const { result } = renderHook(() =>
			useCompanionLeftRailController(baseOptions())
		);

		act(() => result.current.toggleLeftRailSection('memory'));
		expect(result.current.leftRailExpanded).toBe('memory');

		act(() => result.current.toggleLeftRailSection('memory'));
		expect(result.current.leftRailExpanded).toBeNull();
	});

	it('hides memory strip for Arlika persona', () => {
		const { result } = renderHook(() =>
			useCompanionLeftRailController(
				baseOptions({
					personaId: 'arlika',
					profile: profile({ memory_display: ['line one'] }),
				})
			)
		);

		expect(result.current.hideMemoryStrip).toBe(true);
		expect(result.current.memoryStrip).toEqual([]);
	});

	it('syncTurnPlanHintFromResponse builds turn plan visual', () => {
		const { result } = renderHook(() =>
			useCompanionLeftRailController(baseOptions())
		);

		act(() =>
			result.current.syncTurnPlanHintFromResponse({
				reply: 'ok',
				companion_revision: 2,
				turn_plan_hint: 'Next step ready',
				turn_plan_next_tool: 'music_generation',
			})
		);

		expect(result.current.turnPlanVisual?.nextTool).toBe('music_generation');
		expect(result.current.turnPlanVisual?.hint).toContain('Next step ready');
	});

	it('ignores malformed persisted turn-plan snapshots without crashing', () => {
		const { result } = renderHook(() =>
			useCompanionLeftRailController(
				baseOptions({
					profile: profile({
						learned_preferences: {
							[EWA_COMPANION_TURN_PLAN_NS]: {
								source: 'legacy_partial_payload',
							},
						},
					}),
				})
			)
		);

		expect(result.current.turnPlanVisual).toBeNull();
	});

	it('treats active-plan 404 no_active_plan as enabled empty state', async () => {
		const notifyError = vi.fn();
		getActivePlanMock.mockRejectedValueOnce(
			new APIError('empty', 404, undefined, 'no_active_plan')
		);

		const { result } = renderHook(() =>
			useCompanionLeftRailController(
				baseOptions({
					operationsPollEnabled: true,
					notifyError,
				})
			)
		);

		await waitFor(() => {
			expect(getEwaCompanionActivePlan).toHaveBeenCalled();
		});
		await waitFor(() => {
			expect(result.current.planStripVisible).toBe(true);
		});

		expect(result.current.activePlanBundle).toBeNull();
		expect(result.current.planTaskPartition).toEqual({ open: [], done: [] });
		expect(notifyError).not.toHaveBeenCalled();
	});

	it('skips active-plan fetch when probe cache is disabled', async () => {
		const { cacheCompanionPlansFeatureProbeState } = await import(
			'@/services/ewa/companionPlansFeatureProbe'
		);
		cacheCompanionPlansFeatureProbeState('disabled');

		const { result } = renderHook(() =>
			useCompanionLeftRailController(
				baseOptions({
					operationsPollEnabled: true,
				})
			)
		);

		await waitFor(() => {
			expect(result.current.planStripVisible).toBe(false);
		});
		expect(getEwaCompanionActivePlan).not.toHaveBeenCalled();
	});

	it('opaque 404 sets disabled probe so subsequent refresh does not call API (#185)', async () => {
		const notifyError = vi.fn();
		getActivePlanMock.mockRejectedValueOnce(
			new APIError('Not Found', 404, undefined, undefined)
		);

		const { result } = renderHook(() =>
			useCompanionLeftRailController(
				baseOptions({
					operationsPollEnabled: true,
					notifyError,
				})
			)
		);

		await waitFor(() => {
			expect(getActivePlanMock).toHaveBeenCalled();
		});
		await waitFor(() => {
			expect(result.current.planStripVisible).toBe(false);
		});
		expect(notifyError).not.toHaveBeenCalled();

		const callsAfterOpaque404 = getActivePlanMock.mock.calls.length;
		await act(async () => {
			await result.current.refreshActivePlan({ silent: true });
		});
		expect(getActivePlanMock).toHaveBeenCalledTimes(callsAfterOpaque404);
	});

	it('skips plan visibility refresh while the document is hidden', async () => {
		getActivePlanMock.mockResolvedValue(null);
		const { cacheCompanionPlansFeatureProbeState } = await import(
			'@/services/ewa/companionPlansFeatureProbe'
		);
		cacheCompanionPlansFeatureProbeState('enabled');

		renderHook(() =>
			useCompanionLeftRailController(
				baseOptions({
					operationsPollEnabled: true,
				})
			)
		);

		await waitFor(() => {
			expect(getActivePlanMock).toHaveBeenCalled();
		});
		const callsAfterMount = getActivePlanMock.mock.calls.length;

		const visibilitySpy = vi
			.spyOn(document, 'visibilityState', 'get')
			.mockReturnValue('hidden');
		act(() => {
			document.dispatchEvent(new Event('visibilitychange'));
		});
		expect(getActivePlanMock).toHaveBeenCalledTimes(callsAfterMount);
		visibilitySpy.mockRestore();
	});
});
