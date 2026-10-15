/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock: done SSE handler must resolve extractDoneStreamContext import
 * (atomization of streamEventHandlers must not drop done-context wiring).
 *
 * Invariants:
 * - done handler does not throw on ensemble streams with context payload.
 *
 * Related:
 * - streamEventHandlers.ts
 * - desktopChatSsePayload.ts
 */
import { describe, expect, it, vi } from 'vitest';
import type { MutableRefObject } from 'react';
import { createDesktopAiChatStreamEventHandler } from '../streamEventHandlers';
import type { TFunction } from 'i18next';
import type { DesktopAiStreamContextSummary } from '../../../api/desktopChatClient';

const t = ((key: string) => key) as TFunction<'desktopAiChat'>;

function makeHandler(overrides?: {
	pendingContextRef?: MutableRefObject<DesktopAiStreamContextSummary | null>;
}) {
	const pendingContextRef = overrides?.pendingContextRef ?? {
		current: null,
	};
	const runState = {
		acc: '',
		currentAsstId: 'local-a-test',
		stagedReplacement: null,
	};
	const tokenBatch = {
		cancel: vi.fn(),
		flushNow: vi.fn(),
		schedule: vi.fn(),
	};
	return {
		pendingContextRef,
		handler: createDesktopAiChatStreamEventHandler({
			stale: () => false,
			opts: {
				regenerate: false,
				signal: new AbortController().signal,
				soloAssistantLocalId: null,
				isEnsemble: true,
				useToolsFlag: false,
				useWebSearchFlag: false,
				streamChatId: 'chat-1',
				streamEpoch: 1,
				clientRequestId: 'req-1',
			},
			runState,
			tokenBatch,
			flushTokenPaint: vi.fn(),
			refs: {
				pendingContextRef,
				ensembleDeliveryModeRef: { current: 'joint' },
				ensembleJointBubbleIdRef: { current: null },
			},
			setSending: vi.fn(),
			setComposerHint: vi.fn(),
			setEnsembleDocConfirm: vi.fn(),
			setEnsembleCouncilUi: vi.fn(),
			setMessages: vi.fn(),
			setToolsHistory: vi.fn(),
			setWebSearchSourcesByMessageId: vi.fn(),
			t,
		}),
	};
}

describe('createDesktopAiChatStreamEventHandler done', () => {
	it('stores done context without ReferenceError', () => {
		const pendingContextRef: MutableRefObject<DesktopAiStreamContextSummary | null> =
			{ current: null };
		const { handler } = makeHandler({ pendingContextRef });

		expect(() =>
			handler('done', {
				event: 'done',
				context: { chat_rag_chunks: 1 },
				council_transcript: {
					version: 1,
					mode: 'joint_document',
					roster: [],
					turns: [],
					closing: null,
				},
			})
		).not.toThrow();

		expect(pendingContextRef.current).toEqual({ chat_rag_chunks: 1 });
	});
});
