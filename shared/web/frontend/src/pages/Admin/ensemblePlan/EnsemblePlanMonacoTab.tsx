/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lazy Monaco JSON editor tab for ensemble plan template bodies.
 *
 * Invariants:
 * - Monaco model/view state is not retained after unmount; admin tab switches must not accumulate editor models.
 * - The parent owns validation and persistence; this component only edits a JSON string.
 *
 * Related:
 * - src/pages/Admin/desktopAiChat/EnsemblePlanWorkbench.tsx
 */
import '@/lib/monaco/configureMonacoLoader';
import Editor from '@monaco-editor/react';
import * as React from 'react';

export type EnsemblePlanMonacoTabProps = {
	value: string;
	onChange: (v: string) => void;
	/** When false, editor is read-only (preview / validating). */
	editable?: boolean;
};

export default function EnsemblePlanMonacoTab({
	value,
	onChange,
	editable = true,
}: EnsemblePlanMonacoTabProps): React.ReactElement {
	return (
		<Editor
			height="420px"
			defaultLanguage="json"
			keepCurrentModel={false}
			path="ensemble-plan-template.json"
			saveViewState={false}
			theme="vs-dark"
			value={value}
			onChange={(v) => onChange(v ?? '')}
			options={{
				readOnly: !editable,
				minimap: { enabled: false },
				fontSize: 13,
				wordWrap: 'on',
				tabSize: 2,
				scrollBeyondLastLine: false,
				formatOnPaste: true,
			}}
		/>
	);
}
