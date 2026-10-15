/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin facade for Ultimate Document Editor orchestration — compose hook + chrome view.
 * Public entry stays UltimateDocEditor.tsx → UltimateDocEditorInner.
 *
 * Invariants:
 * - Named export UltimateDocEditorInner preserved for UltimateDocEditor.tsx.
 * - No store provider here (provider lives in UltimateDocEditor.tsx).
 *
 * Related:
 * - UltimateDocEditor.tsx, hooks/useUltimateDocEditorInnerCompose.ts, inner/UltimateDocEditorInnerView.tsx
 */

import * as React from 'react';

import type { UltimateDocEditorProps } from './types/editor.types';
import { useUltimateDocEditorInnerCompose } from './hooks/useUltimateDocEditorInnerCompose';
import { UltimateDocEditorInnerView } from './inner/UltimateDocEditorInnerView';

export const UltimateDocEditorInner: React.FC<UltimateDocEditorProps> = (
	props
) => {
	const vm = useUltimateDocEditorInnerCompose(props);
	return <UltimateDocEditorInnerView vm={vm} />;
};
