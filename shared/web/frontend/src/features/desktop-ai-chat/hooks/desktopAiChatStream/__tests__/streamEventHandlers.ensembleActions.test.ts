/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Smoke: ensemble_action_* SSE events update composer hint (Wave 1).
 *
 * Invariants:
 * - Only runs when opts.isEnsemble; skipped not_in_scope clears hint without skip copy.
 *
 * Related:
 * - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
 */
import { describe, expect, it, vi } from 'vitest';
import { createDesktopAiChatStreamEventHandler } from '../streamEventHandlers';
import type { DesktopAiChatStreamEventHandlerDeps } from '../streamEventHandlers';
import type { StreamRunMutableState } from '../types';

function makeDeps(
	overrides: Partial<DesktopAiChatStreamEventHandlerDeps> = {}
): DesktopAiChatStreamEventHandlerDeps & {
	setComposerHint: ReturnType<typeof vi.fn>;
} {
	const setComposerHint = vi.fn();
	const runState: StreamRunMutableState = {
		acc: '',
		currentAsstId: 'asst-1',
		stagedReplacement: null,
	};
	const tokenBatch = {
		append: vi.fn(),
		flush: vi.fn(),
		reset: vi.fn(),
		getAccumulated: () => '',
	};
	const base: DesktopAiChatStreamEventHandlerDeps = {
		stale: () => false,
		opts: { isEnsemble: true } as DesktopAiChatStreamEventHandlerDeps['opts'],
		runState,
		tokenBatch:
			tokenBatch as unknown as DesktopAiChatStreamEventHandlerDeps['tokenBatch'],
		flushTokenPaint: vi.fn(),
		refs: {
			pendingContextRef: { current: null },
			ensembleDeliveryModeRef: { current: 'joint' },
			ensembleJointBubbleIdRef: { current: null },
		},
		setSending: vi.fn(),
		setComposerHint,
		setEnsembleDocConfirm: vi.fn(),
		setEnsembleCouncilUi: vi.fn(),
		setMessages: vi.fn(),
		setToolsHistory: vi.fn(),
		setWebSearchSourcesByMessageId: vi.fn(),
		t: ((key: string, vars?: Record<string, unknown>) => {
			if (key === 'hintEnsembleActionsStart') {
				return `start:${vars?.count ?? ''}`;
			}
			if (key === 'hintEnsembleActionsProgress') {
				return `progress:${vars?.kind}:${vars?.index}/${vars?.total}`;
			}
			if (key === 'hintEnsembleActionsDone') {
				return 'done';
			}
			if (key === 'hintEnsembleActionsSkipped') {
				return 'skipped';
			}
			return key;
		}) as DesktopAiChatStreamEventHandlerDeps['t'],
	};
	return { ...base, ...overrides, setComposerHint };
}

describe('ensemble_action_* SSE → composer hint', () => {
	it('sets start / progress / done hints for ensemble', () => {
		const deps = makeDeps();
		const onEvent = createDesktopAiChatStreamEventHandler(deps);
		onEvent('ensemble_action_start', {
			event: 'ensemble_action_start',
			total: 3,
		});
		expect(deps.setComposerHint).toHaveBeenLastCalledWith('start:3');
		onEvent('ensemble_action_progress', {
			event: 'ensemble_action_progress',
			kind: 'web',
			index: 1,
			total: 3,
		});
		expect(deps.setComposerHint).toHaveBeenLastCalledWith('progress:web:1/3');
		onEvent('ensemble_action_done', {
			event: 'ensemble_action_done',
			ran: true,
		});
		expect(deps.setComposerHint).toHaveBeenLastCalledWith('done');
	});

	it('shows skipped copy for no_capabilities and ignores not_in_scope', () => {
		const deps = makeDeps();
		const onEvent = createDesktopAiChatStreamEventHandler(deps);
		onEvent('ensemble_action_done', {
			ran: false,
			skipped_reason: 'no_capabilities',
		});
		expect(deps.setComposerHint).toHaveBeenLastCalledWith('skipped');
		deps.setComposerHint.mockClear();
		onEvent('ensemble_action_done', {
			ran: false,
			skipped_reason: 'not_in_scope',
		});
		expect(deps.setComposerHint).toHaveBeenLastCalledWith(null);
	});

	it('ignores action events when not ensemble', () => {
		const deps = makeDeps({
			opts: {
				isEnsemble: false,
			} as DesktopAiChatStreamEventHandlerDeps['opts'],
		});
		const onEvent = createDesktopAiChatStreamEventHandler(deps);
		onEvent('ensemble_action_start', { total: 2 });
		expect(deps.setComposerHint).not.toHaveBeenCalled();
	});
});
