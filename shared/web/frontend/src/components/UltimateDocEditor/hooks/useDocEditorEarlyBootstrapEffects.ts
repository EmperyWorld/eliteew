/**
 * Ранний bootstrap оркестратора: открытие панели коллаба из payload окна (`openCollabAfterLoad`).
 */

import { useEffect, type MutableRefObject } from 'react';

export interface UseDocEditorEarlyBootstrapEffectsParams {
	openCollabAfterLoad: boolean;
	collabOpenedFromPayloadRef: MutableRefObject<boolean>;
	hasLoadFailure: boolean;
	isLoadingDocument: boolean;
	currentDocumentId: string | undefined;
	documentId: string | undefined;
	openCollabPanel: () => void;
}

export function useDocEditorEarlyBootstrapEffects(
	params: UseDocEditorEarlyBootstrapEffectsParams
): void {
	const {
		openCollabAfterLoad,
		collabOpenedFromPayloadRef,
		hasLoadFailure,
		isLoadingDocument,
		currentDocumentId,
		documentId,
		openCollabPanel,
	} = params;

	useEffect(() => {
		if (!openCollabAfterLoad || collabOpenedFromPayloadRef.current) return;
		if (hasLoadFailure) return;
		if (isLoadingDocument) return;
		const cid = currentDocumentId;
		if (!cid || cid === 'temp') return;
		if (documentId && cid !== documentId) return;
		collabOpenedFromPayloadRef.current = true;
		queueMicrotask(() => {
			openCollabPanel();
		});
	}, [
		openCollabAfterLoad,
		hasLoadFailure,
		isLoadingDocument,
		currentDocumentId,
		documentId,
		openCollabPanel,
		collabOpenedFromPayloadRef,
	]);
}
