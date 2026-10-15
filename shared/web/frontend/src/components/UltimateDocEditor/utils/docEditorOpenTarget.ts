export type DocEditorResolvedOpenTarget = {
	targetType: 'docEditor' | 'unifiedContent';
	id: string;
} | null;

export function isDocEditorOpenTargetApplied(params: {
	openTarget: DocEditorResolvedOpenTarget;
	currentFileId: string | null;
	currentDocumentId?: string | null;
	documentSource?: 'doc_editor' | 'unified_content' | null;
}): boolean {
	const { openTarget, currentFileId, currentDocumentId, documentSource } =
		params;
	if (!openTarget) return true;
	if (openTarget.targetType === 'unifiedContent') {
		return currentFileId != null && String(currentFileId) === openTarget.id;
	}
	return documentSource === 'doc_editor' && currentDocumentId === openTarget.id;
}
