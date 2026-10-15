export interface DocEditorSelectionRange {
	from: number;
	to: number;
}

export type DocEditorRuntimeDialogRequest =
	| {
			type: 'link';
			range?: DocEditorSelectionRange;
			initialUrl?: string;
			initialText?: string;
			selectedText?: string;
	  }
	| {
			type: 'image';
			range?: DocEditorSelectionRange;
			initialUrl?: string;
			initialAlt?: string;
	  }
	| {
			type: 'formula';
			range?: DocEditorSelectionRange;
			initialValue?: string;
	  }
	| {
			type: 'textColor' | 'highlightColor';
			range?: DocEditorSelectionRange;
			position: { x: number; y: number };
	  };

export const DOC_EDITOR_RUNTIME_DIALOG_EVENT = 'doc-editor-runtime-dialog';

export function dispatchDocEditorRuntimeDialogRequest(
	detail: DocEditorRuntimeDialogRequest
): void {
	if (typeof window === 'undefined') {
		return;
	}

	window.dispatchEvent(
		new CustomEvent<DocEditorRuntimeDialogRequest>(
			DOC_EDITOR_RUNTIME_DIALOG_EVENT,
			{
				detail,
			}
		)
	);
}
