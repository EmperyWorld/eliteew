/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for useCompanionChatSubmit (U8.1 slice 4 extract).
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCompanionChatSubmit } from '@/features/ewa/companionUx/useCompanionChatSubmit';
import { APIError } from '@/services/api/client';

const t = ((key: string) => key) as Parameters<
	typeof useCompanionChatSubmit
>[0]['t'];

function baseOptions(
	overrides: Partial<Parameters<typeof useCompanionChatSubmit>[0]> = {}
) {
	return {
		principalId: 'principal-1',
		pending: false,
		setPending: vi.fn(),
		setPendingTurn: vi.fn(),
		setStreamingText: vi.fn(),
		setTurnStage: vi.fn(),
		setActionRecords: vi.fn(),
		setTurnPlanHintState: vi.fn(),
		pendingImageRef: { current: null },
		getSnapshot: () => null,
		dispatchActions: vi.fn(),
		syncTurnPlanHintFromResponse: vi.fn(),
		syncProtocolFromResponse: vi.fn(),
		syncOutputSurfaceFromResponse: vi.fn(),
		syncTaskRunSnapshot: vi.fn(),
		applyCompanionDesktopConfigPatchSideEffects: vi.fn(),
		applyCompanionProfileReset: vi.fn(),
		showCompanionTransformVideo: vi.fn(),
		speakCompanionReply: vi.fn(),
		taskEventHandlers: {},
		updateDraft: vi.fn(),
		clearPendingImage: vi.fn(),
		reloadProfile: vi.fn(async () => undefined),
		refreshOperationRuns: vi.fn(async () => undefined),
		refreshActivePlan: vi.fn(async () => undefined),
		stopSpeaking: vi.fn(),
		notifyError: vi.fn(),
		t,
		...overrides,
	};
}

vi.mock('@/services/ewa/ewaCompanionChatApi', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('@/services/ewa/ewaCompanionChatApi')>();
	return {
		...actual,
		streamEwaCompanionChatMessage: vi.fn(async () => undefined),
		postEwaCompanionChatMessage: vi.fn(async () => ({
			reply: 'sync reply',
			companion_revision: 3,
			actions: [],
		})),
		newCompanionClientTurnId: vi.fn(() => 'turn-1'),
	};
});

describe('useCompanionChatSubmit', () => {
	it('handleCompanionChatProfileError resets profile and pending turn', () => {
		const applyCompanionProfileReset = vi.fn();
		const setPendingTurn = vi.fn();
		const { result } = renderHook(() =>
			useCompanionChatSubmit(
				baseOptions({ applyCompanionProfileReset, setPendingTurn })
			)
		);

		const handled = result.current.handleCompanionChatProfileError(
			new APIError(
				'companion_profile_not_initialized',
				404,
				'companion_profile_not_initialized'
			)
		);

		expect(handled).toBe(true);
		expect(applyCompanionProfileReset).toHaveBeenCalled();
		expect(setPendingTurn).toHaveBeenCalledWith(null);
	});

	it('submitCompanionLine no-ops while pending', async () => {
		const setPending = vi.fn();
		const { streamEwaCompanionChatMessage } = await import(
			'@/services/ewa/ewaCompanionChatApi'
		);

		const { result } = renderHook(() =>
			useCompanionChatSubmit(baseOptions({ pending: true, setPending }))
		);

		await act(async () => {
			await result.current.submitCompanionLine('hello');
		});

		expect(streamEwaCompanionChatMessage).not.toHaveBeenCalled();
		expect(setPending).not.toHaveBeenCalled();
	});

	it('submitCompanionLine falls back to sync when stream returns false', async () => {
		const { streamEwaCompanionChatMessage, postEwaCompanionChatMessage } =
			await import('@/services/ewa/ewaCompanionChatApi');
		vi.mocked(streamEwaCompanionChatMessage).mockResolvedValueOnce(undefined);
		const setPending = vi.fn();
		const speakCompanionReply = vi.fn();

		const { result } = renderHook(() =>
			useCompanionChatSubmit(baseOptions({ setPending, speakCompanionReply }))
		);

		await act(async () => {
			await result.current.submitCompanionLine('hello');
		});

		expect(streamEwaCompanionChatMessage).toHaveBeenCalled();
		expect(postEwaCompanionChatMessage).toHaveBeenCalled();
		expect(speakCompanionReply).toHaveBeenCalledWith('sync reply');
		expect(setPending).toHaveBeenCalledWith(true);
		expect(setPending).toHaveBeenCalledWith(false);
	});

	it('propagates use_web_search into stream payload', async () => {
		const { streamEwaCompanionChatMessage } = await import(
			'@/services/ewa/ewaCompanionChatApi'
		);
		vi.mocked(streamEwaCompanionChatMessage).mockResolvedValueOnce(undefined);

		const { result } = renderHook(() =>
			useCompanionChatSubmit(baseOptions({ useWebSearch: true }))
		);

		await act(async () => {
			await result.current.submitCompanionLine('find current info');
		});

		expect(streamEwaCompanionChatMessage).toHaveBeenCalledWith(
			expect.objectContaining({ use_web_search: true }),
			expect.any(Object)
		);
	});

	it('turns web search off after a successful send when it was enabled', async () => {
		const setUseWebSearch = vi.fn();
		const { result } = renderHook(() =>
			useCompanionChatSubmit(
				baseOptions({ useWebSearch: true, setUseWebSearch })
			)
		);

		await act(async () => {
			await result.current.submitCompanionLine('search the news');
		});

		expect(setUseWebSearch).toHaveBeenCalledWith(false);
	});

	it('does not turn web search off when it was disabled for the send', async () => {
		const setUseWebSearch = vi.fn();
		const { result } = renderHook(() =>
			useCompanionChatSubmit(
				baseOptions({ useWebSearch: false, setUseWebSearch })
			)
		);

		await act(async () => {
			await result.current.submitCompanionLine('hello');
		});

		expect(setUseWebSearch).not.toHaveBeenCalled();
	});
});
