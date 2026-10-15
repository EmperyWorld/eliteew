/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lazy Monaco JSON editor tab for EWA companion workflow definitions.
 *
 * Invariants:
 * - Monaco model/view state is not retained after unmount; admin tab switches must not accumulate editor models.
 * - The parent owns workflow validation and persistence; this component only edits a JSON string.
 *
 * Related:
 * - src/features/ewa/admin/EwaCompanionAdminPanel.tsx
 */
import '@/lib/monaco/configureMonacoLoader';
import Editor from '@monaco-editor/react';
import * as React from 'react';

export type CompanionWorkflowMonacoTabProps = {
	value: string;
	onChange: (v: string) => void;
	editable?: boolean;
};

export default function CompanionWorkflowMonacoTab({
	value,
	onChange,
	editable = true,
}: CompanionWorkflowMonacoTabProps): React.ReactElement {
	return (
		<Editor
			height="420px"
			defaultLanguage="json"
			keepCurrentModel={false}
			path="ewa-companion-workflow.json"
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
