/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Orchestrates UltimateDocEditorInner bootstrap + content + chrome compose stages into
 * one view-model for UltimateDocEditorInnerView.
 *
 * Invariants:
 * - Stable public entry remains UltimateDocEditorInner.tsx → this hook → view.
 * - Does not invent stores or change companion/collab/save contracts.
 *
 * Related:
 * - UltimateDocEditorInner.tsx, inner/UltimateDocEditorInnerView.tsx
 */

import type { UltimateDocEditorProps } from '../types/editor.types';
import { useUltimateDocEditorInnerBootstrapCompose } from './useUltimateDocEditorInnerBootstrapCompose';
import { useUltimateDocEditorInnerContentCompose } from './useUltimateDocEditorInnerContentCompose';
import { useUltimateDocEditorInnerChromeCompose } from './useUltimateDocEditorInnerChromeCompose';

export type UltimateDocEditorInnerViewModel = ReturnType<
	typeof useUltimateDocEditorInnerChromeCompose
>;

export function useUltimateDocEditorInnerCompose(
	props: UltimateDocEditorProps
): UltimateDocEditorInnerViewModel {
	const bootstrap = useUltimateDocEditorInnerBootstrapCompose(props);
	const session = useUltimateDocEditorInnerContentCompose(bootstrap);
	return useUltimateDocEditorInnerChromeCompose(session);
}
