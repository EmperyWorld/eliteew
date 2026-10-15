/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lazy Monaco JSON panel for ensemble plan drafts (raw JSON tab).
 *
 * Invariants:
 * - Must render under EnsemblePlanEditorI18nProvider.
 *
 * Related:
 * - `../EnsemblePlanMonacoTab.tsx`
 * - `../DesktopEnsemblePlanFormEditor.tsx`
 */

import * as React from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../../Desktop/constants';
import { useEditorT } from './editorI18n';

const MonacoJsonEditor = React.lazy(() => import('../EnsemblePlanMonacoTab'));

export type EnsemblePlanJsonPanelProps = {
	jsonText: string;
	onJsonTextChange: (s: string) => void;
};

export function EnsemblePlanJsonPanel({
	jsonText,
	onJsonTextChange,
}: EnsemblePlanJsonPanelProps): React.ReactElement {
	const t = useEditorT();

	return (
		<div className="space-y-2">
			<p className={`${DESKTOP_TYPOGRAPHY.meta} text-white/50`}>
				{t('adminEnsemblePlan.editor.rawJsonEditHint')}
			</p>
			<div className="overflow-hidden rounded-xl border border-white/10">
				<React.Suspense
					fallback={
						<div className={`p-8 text-center ${DESKTOP_TYPOGRAPHY.meta}`}>
							{t('adminEnsemblePlan.editor.loadingEditor')}
						</div>
					}
				>
					<MonacoJsonEditor value={jsonText} onChange={onJsonTextChange} />
				</React.Suspense>
			</div>
		</div>
	);
}
