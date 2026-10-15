/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Imperative ref bridge for companion operations runtime handlers — avoids Zustand
 * store writes that would re-render the full subscriber tree on every handler refresh.
 *
 * Invariants:
 * - Only useCompanionOperationsRuntime registers handlers; facade reads via get().
 *
 * Related:
 * - useCompanionOperationsRuntime.ts
 * - useCompanionOperationRuns.ts
 */

import type { CompanionOperationsRuntimeHandlers } from '@/features/ewa/companionOperations/companionOperationsStore';

let runtimeHandlers: CompanionOperationsRuntimeHandlers | null = null;

export function setCompanionOperationsRuntimeHandlers(
	handlers: CompanionOperationsRuntimeHandlers | null
): void {
	runtimeHandlers = handlers;
}

export function getCompanionOperationsRuntimeHandlers(): CompanionOperationsRuntimeHandlers | null {
	return runtimeHandlers;
}

export function clearCompanionOperationsRuntimeHandlers(): void {
	runtimeHandlers = null;
}
