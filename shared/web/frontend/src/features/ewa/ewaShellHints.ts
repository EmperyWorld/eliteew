/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Helpers for persisted `shell_state.ewa_hints` on desktop GET/PATCH (`/api/v1/desktop/shell-state`).
 *
 * Invariants:
 * - Wire key matches backend `EWA_SHELL_HINTS_SUBTREE_KEY` (`contracts/ewa_shell_hints_wire.py`).
 *
 * Related:
 * - `src/pages/Desktop/services/desktopApi.ts`
 * - `src/pages/Desktop/utils/desktopShellStateMutationPipeline.ts`
 * - `src/features/ewa/ewaShellHintsDerive.ts` (auto-hints from window snapshot)
 * - `shared/api/ewa_platform/contracts/ewa_shell_hints_wire.py`
 */
import {
	type DesktopShellState,
	type DesktopShellStatePatch,
} from '@/pages/Desktop/services/desktopApi';
import {
	scheduleShellStateMutation,
	waitForShellStatePipelineFlush,
} from '@/pages/Desktop/utils/desktopShellStateMutationPipeline';

/** Canonical JSON key inside persisted desktop shell-state. */
export const EWA_SHELL_HINTS_SUBTREE_KEY = 'ewa_hints' as const;

/** Partial subtree; server applies relaxed well-formed checks in EWA adapters. */
export type EwaShellHintsSubtreeV1 = {
	documents_workspace?: Record<string, unknown>;
	content_manager?: Record<string, unknown>;
};

export type DesktopShellStatePatchWithEwaHints = DesktopShellStatePatch & {
	ewa_hints?: EwaShellHintsSubtreeV1 | null;
};

/** Merge-only PATCH: replaces top-level `ewa_hints` when the server applies the patch body. */
export async function patchEwaShellHintsSubtree(
	subtree: EwaShellHintsSubtreeV1
): Promise<DesktopShellState> {
	const body: DesktopShellStatePatchWithEwaHints = {
		[EWA_SHELL_HINTS_SUBTREE_KEY]: subtree,
	};
	scheduleShellStateMutation({
		source: 'other',
		merge: () => body as Record<string, unknown>,
		immediate: true,
	});
	return waitForShellStatePipelineFlush();
}
