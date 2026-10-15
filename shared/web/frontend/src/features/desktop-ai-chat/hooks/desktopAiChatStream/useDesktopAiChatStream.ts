/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Orchestrator hook for Desktop AI Chat SSE stream — refs, epoch lifecycle,
 * composes run and action sub-hooks.
 *
 * Invariants:
 * - streamEpoch bumps invalidate stale callbacks; sendLock prevents double-send races.
 *
 * Related:
 * - hooks/useDesktopAiChatStream.ts (facade)
 * - useDesktopAiChatStreamEpoch.ts
 */
import * as React from 'react';
import type { DesktopAiStreamContextSummary } from '../../api/desktopChatClient';
import { useDesktopAiChatStreamEpoch } from '../../useDesktopAiChatStreamEpoch';
import type {
	LastFailedSendState,
	UseDesktopAiChatStreamParams,
} from './types';
import { useDesktopAiChatStreamActions } from './useDesktopAiChatStreamActions';
import { useDesktopAiChatStreamRun } from './useDesktopAiChatStreamRun';

export function useDesktopAiChatStream(params: UseDesktopAiChatStreamParams) {
	const {
		activeId,
		setSending,
		setStreamErrorBanner,
		setComposerHint,
		setEnsembleCouncilUi,
	} = params;

	const { streamEpochRef, activeIdRef, streamStale } =
		useDesktopAiChatStreamEpoch(activeId);
	const streamAbortRef = React.useRef<AbortController | null>(null);
	const sendLockRef = React.useRef(false);
	const lastFailedSendRef = React.useRef<LastFailedSendState | null>(null);
	const pendingContextRef = React.useRef<DesktopAiStreamContextSummary | null>(
		null
	);
	const ensembleDeliveryModeRef = React.useRef<'joint' | 'separate'>(
		'separate'
	);
	const ensembleJointBubbleIdRef = React.useRef<string | null>(null);

	const refs = {
		streamEpochRef,
		streamAbortRef,
		sendLockRef,
		lastFailedSendRef,
		pendingContextRef,
		ensembleDeliveryModeRef,
		ensembleJointBubbleIdRef,
	};

	React.useEffect(() => {
		streamAbortRef.current?.abort();
		streamEpochRef.current += 1;
		sendLockRef.current = false;
		setStreamErrorBanner(null);
		setSending(false);
		setComposerHint(null);
		setEnsembleCouncilUi(null);
		ensembleJointBubbleIdRef.current = null;
		ensembleDeliveryModeRef.current = 'separate';
	}, [
		streamEpochRef,
		setStreamErrorBanner,
		setSending,
		setComposerHint,
		setEnsembleCouncilUi,
	]);

	React.useEffect(() => {
		return () => {
			streamAbortRef.current?.abort();
			streamEpochRef.current += 1;
		};
	}, [streamEpochRef]);

	const streamRun = useDesktopAiChatStreamRun({ params, refs, streamStale });
	const actions = useDesktopAiChatStreamActions({
		params,
		refs,
		streamStale,
		streamRun,
	});

	return {
		streamEpochRef,
		activeIdRef,
		...actions,
	};
}
