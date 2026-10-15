/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * i18n context for DesktopEnsemblePlanFormEditor section children (one TFunction per tree).
 *
 * Invariants:
 * - `useEditorT` throws outside the provider (fail-fast for missing wire-up).
 *
 * Related:
 * - `../DesktopEnsemblePlanFormEditor.tsx`
 */

import type { TFunction } from 'i18next';
import * as React from 'react';

const EditorI18nCtx = React.createContext<TFunction<'desktopUi'> | null>(null);

export function EnsemblePlanEditorI18nProvider({
	t,
	children,
}: {
	t: TFunction<'desktopUi'>;
	children: React.ReactNode;
}): React.ReactElement {
	return <EditorI18nCtx.Provider value={t}>{children}</EditorI18nCtx.Provider>;
}

export function useEditorT(): TFunction<'desktopUi'> {
	const t = React.useContext(EditorI18nCtx);
	if (!t) {
		throw new Error(
			'useEditorT must be used within DesktopEnsemblePlanFormEditor'
		);
	}
	return t;
}
