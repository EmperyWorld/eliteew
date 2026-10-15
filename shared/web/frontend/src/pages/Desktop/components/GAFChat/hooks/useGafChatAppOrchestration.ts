/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat app orchestration entry hook: composes core + phase-2 slices.
 *
 * Invariants:
 * - Public export surface for GAFChatApp; behavior matches pre-atomization monolith.
 *
 * Related:
 * - GAFChatApp.tsx
 * - useGafChatAppOrchestrationCore.ts
 * - useGafChatAppOrchestrationPhase2.ts
 */
import type { GAFChatAppProps } from '../GAFChatApp';
import { useGafChatAppOrchestrationCore } from './useGafChatAppOrchestrationCore';
import { useGafChatAppOrchestrationPhase2 } from './useGafChatAppOrchestrationPhase2';
export type { GafChatAppOrchestrationResult } from './gafChatAppOrchestrationTypes';
import type { GafChatAppOrchestrationResult } from './gafChatAppOrchestrationTypes';

export function useGafChatAppOrchestration(
	props: GAFChatAppProps
): GafChatAppOrchestrationResult {
	const core = useGafChatAppOrchestrationCore(props);
	return useGafChatAppOrchestrationPhase2(core);
}
