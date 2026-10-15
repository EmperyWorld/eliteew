/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public facade for EWRP generator orchestration — re-exports compose hook and props type.
 *
 * Invariants:
 * - Single import path for `EWRPGeneratorMain`; implementation lives in `ewrpOrchestration/`.
 *
 * Related:
 * - `ewrpOrchestration/useEwrpGeneratorCompose.tsx`, `EWRPGeneratorMain.tsx`
 */

import { useEwrpGeneratorCompose } from './ewrpOrchestration/useEwrpGeneratorCompose';
import type { EWRPGeneratorProps as EWRPGeneratorPropsType } from './ewrpOrchestration/ewrpOrchestrationTypes';

export type EWRPGeneratorProps = EWRPGeneratorPropsType;

export function useEwrpGeneratorOrchestration(props?: EWRPGeneratorProps) {
	return useEwrpGeneratorCompose(props);
}
