/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render-count baseline for useDesktopAiChatStream — guards against hook churn regressions.
 *
 * Invariants:
 * - Stable hook params should not re-render the probe more than the baseline on parent rerender.
 *
 * Related:
 * - hooks/useDesktopAiChatStream.ts
 * ---
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import baseline from './fixtures/desktop_ai_chat_stream_perf_baseline.json';
import type { UseDesktopAiChatStreamParams } from '../hooks/useDesktopAiChatStream';
import { useDesktopAiChatStream } from '../hooks/useDesktopAiChatStream';

const STREAM_HOOK_RENDER_BASELINE = baseline.streamHookRenderBaseline;

vi.mock('../api/desktopChatClient', () => ({
	streamDesktopAiChat: vi.fn(),
	listDesktopAiMessages: vi.fn(),
	verifyDesktopAiChatContext: vi.fn(),
	classifyDesktopStreamError: vi.fn(() => ({
		message: 'err',
		retryable: false,
	})),
}));

vi.mock('../useDesktopAiChatStreamEpoch', () => ({
	useDesktopAiChatStreamEpoch: () => ({
		streamEpochRef: { current: 0 },
		activeIdRef: { current: 'chat-a' },
		streamStale: () => false,
	}),
}));

function makeStableParams(): UseDesktopAiChatStreamParams {
	const noop = vi.fn();
	const stickToBottomRef = { current: true };
	const skipTtsRef = { current: false };
	return {
		activeId: 'chat-a',
		featureOn: true,
		sending: false,
		setSending: noop,
		input: '',
		setInput: noop,
		messages: [],
		setMessages: noop,
		chats: [],
		settings: {},
		useTools: false,
		useWebSearch: false,
		consumeWebSearchArm: noop,
		ensembleDocConfirm: null,
		setEnsembleDocConfirm: noop,
		soloSendsBlocked: false,
		setSoloSlotModalOpen: noop,
		setStreamErrorBanner: noop,
		setComposerHint: noop,
		setShowScrollDown: noop,
		setToolsHistory: noop,
		setEnsembleCouncilUi: noop,
		setAssistantContextByMessageId: noop,
		setWebSearchSourcesByMessageId: noop,
		stickToBottomRef,
		skipTtsRef,
		remoteStreamBusyRef: { current: false },
		applyTailMergeAfterStream: noop,
		applyTailReplace: noop,
		refreshAttachments: noop,
		playTts: noop,
		t: ((key: string) => key) as UseDesktopAiChatStreamParams['t'],
	};
}

/** Baseline loaded from fixtures/desktop_ai_chat_stream_perf_baseline.json */

describe('desktopAiChatStreamPerf', () => {
	it('useDesktopAiChatStream stays within render-count baseline', () => {
		let renderCount = 0;
		const params = makeStableParams();

		const { rerender } = renderHook(
			({ p }: { p: UseDesktopAiChatStreamParams }) => {
				renderCount += 1;
				return useDesktopAiChatStream(p);
			},
			{ initialProps: { p: params } }
		);

		expect(renderCount).toBe(1);

		rerender({ p: params });
		expect(renderCount).toBeLessThanOrEqual(STREAM_HOOK_RENDER_BASELINE);
	});
});
