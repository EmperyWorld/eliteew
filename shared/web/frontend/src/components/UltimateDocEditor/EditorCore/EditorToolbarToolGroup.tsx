/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fieldset wrapper for a grouped cluster of Ultimate Doc Editor toolbar icon buttons.
 *
 * Invariants:
 * - Each group exposes a single aria-label for the fieldset.
 *
 * Related:
 * - EditorToolbar.tsx
 */
import type * as React from 'react';
import { DOC_EDITOR_TOOLBAR_GROUP_CLASS } from './docEditorToolbarChrome';

export function EditorToolbarToolGroup({
	children,
	ariaLabel,
}: {
	children: React.ReactNode;
	ariaLabel: string;
}) {
	return (
		<fieldset aria-label={ariaLabel} className={DOC_EDITOR_TOOLBAR_GROUP_CLASS}>
			{children}
		</fieldset>
	);
}
