/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compose hook + view for companion embedded document editor mode.
 *
 * Invariants:
 * - Named export CompanionDocumentEditorMode preserved for CompanionOutputSurface.
 *
 * Related:
 * - ../CompanionDocumentEditorMode.tsx (stable facade)
 * - documentation/product/ewa/EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md
 */

import { CompanionDocumentEditorModeView } from './CompanionDocumentEditorModeView';
import { useCompanionDocumentEditorMode } from './useCompanionDocumentEditorMode';
import type { CompanionDocumentEditorModeProps } from './types';

export type { CompanionDocumentEditorModeProps } from './types';

export function CompanionDocumentEditorMode(
	props: CompanionDocumentEditorModeProps
) {
	const vm = useCompanionDocumentEditorMode(props);
	return <CompanionDocumentEditorModeView vm={vm} />;
}
