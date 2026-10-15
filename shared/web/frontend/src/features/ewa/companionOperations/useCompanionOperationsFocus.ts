/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Operations panel/sheet focus state for companion chat (U8.1 extract).
 *
 * Invariants:
 * - Highlight ring auto-clears after a short timeout; does not cancel runs.
 * - Mobile confirm auto-open only when composer is visible on embedded layout.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/features/ewa/companionOperations/useCompanionOperationRuns.ts
 */

import { useCallback, useEffect, useState } from 'react';

import { companionRunNeedsMobileConfirmationSheet } from '@/features/ewa/companionOperations/companionOperationsUi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

export type UseCompanionOperationsFocusOptions = {
	mobileEmbeddedComposerLayout: boolean;
	composerVisible: boolean;
	/** When true, skip auto-opening mobile sheet so typing is not interrupted (R11). */
	isComposerInputFocused?: () => boolean;
	highlightClearMs?: number;
};

export function useCompanionOperationsFocus({
	mobileEmbeddedComposerLayout,
	composerVisible,
	isComposerInputFocused,
	highlightClearMs = 4000,
}: UseCompanionOperationsFocusOptions) {
	const [operationsExpanded, setOperationsExpanded] = useState(true);
	const [highlightedOperationRunId, setHighlightedOperationRunId] = useState<
		string | null
	>(null);
	const [mobileOperationsOpen, setMobileOperationsOpen] = useState(false);

	const focusOperationRun = useCallback(
		(runId: string) => {
			const trimmed = runId.trim();
			if (!trimmed) return;
			setOperationsExpanded(true);
			setHighlightedOperationRunId(trimmed);
			if (mobileEmbeddedComposerLayout) {
				setMobileOperationsOpen(true);
			}
		},
		[mobileEmbeddedComposerLayout]
	);

	const handleNewActiveOperationRun = useCallback(
		(run: EwaCompanionTaskRun) => {
			setOperationsExpanded(true);
			if (
				!mobileEmbeddedComposerLayout ||
				!composerVisible ||
				!companionRunNeedsMobileConfirmationSheet(run)
			) {
				return;
			}
			if (isComposerInputFocused?.()) {
				return;
			}
			const runId = run.id?.trim();
			if (!runId) return;
			setHighlightedOperationRunId(runId);
			setMobileOperationsOpen(true);
		},
		[composerVisible, isComposerInputFocused, mobileEmbeddedComposerLayout]
	);

	useEffect(() => {
		if (!highlightedOperationRunId) return;
		const timer = window.setTimeout(
			() => setHighlightedOperationRunId(null),
			highlightClearMs
		);
		return () => window.clearTimeout(timer);
	}, [highlightClearMs, highlightedOperationRunId]);

	return {
		operationsExpanded,
		setOperationsExpanded,
		highlightedOperationRunId,
		mobileOperationsOpen,
		setMobileOperationsOpen,
		focusOperationRun,
		handleNewActiveOperationRun,
	};
}
