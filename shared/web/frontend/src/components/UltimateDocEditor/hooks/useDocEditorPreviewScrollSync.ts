/**
 * Режим превью: Escape выходит из превью; скролл редактора ↔ превью по доле прокрутки.
 */

import {
	useEffect,
	useRef,
	type Dispatch,
	type MutableRefObject,
	type RefObject,
	type SetStateAction,
} from 'react';

export interface UseDocEditorPreviewScrollSyncParams {
	previewMode: boolean;
	setPreviewMode: Dispatch<SetStateAction<boolean>>;
	editorScrollContainerRef: RefObject<HTMLDivElement | null>;
}

export interface UseDocEditorPreviewScrollSyncResult {
	previewScrollRef: MutableRefObject<HTMLDivElement | null>;
}

export function useDocEditorPreviewScrollSync(
	params: UseDocEditorPreviewScrollSyncParams
): UseDocEditorPreviewScrollSyncResult {
	const { previewMode, setPreviewMode, editorScrollContainerRef } = params;

	const previewScrollRef = useRef<HTMLDivElement | null>(null);
	const scrollSyncSourceRef = useRef<'editor' | 'preview' | null>(null);

	useEffect(() => {
		if (!previewMode) {
			return;
		}
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				event.preventDefault();
				setPreviewMode(false);
			}
		};
		window.addEventListener('keydown', onKey);
		return (): void => {
			window.removeEventListener('keydown', onKey);
		};
	}, [previewMode, setPreviewMode]);

	useEffect(() => {
		if (!previewMode) {
			return;
		}
		const ed = editorScrollContainerRef.current;
		const pr = previewScrollRef.current;
		if (!ed || !pr) {
			return;
		}

		const syncFromEditor = (): void => {
			if (scrollSyncSourceRef.current === 'preview') {
				return;
			}
			scrollSyncSourceRef.current = 'editor';
			const maxE = Math.max(0, ed.scrollHeight - ed.clientHeight);
			const maxP = Math.max(0, pr.scrollHeight - pr.clientHeight);
			const ratio = maxE > 0 ? ed.scrollTop / maxE : 0;
			pr.scrollTop = ratio * maxP;
			window.requestAnimationFrame(() => {
				scrollSyncSourceRef.current = null;
			});
		};

		const syncFromPreview = (): void => {
			if (scrollSyncSourceRef.current === 'editor') {
				return;
			}
			scrollSyncSourceRef.current = 'preview';
			const maxE = Math.max(0, ed.scrollHeight - ed.clientHeight);
			const maxP = Math.max(0, pr.scrollHeight - pr.clientHeight);
			const ratio = maxP > 0 ? pr.scrollTop / maxP : 0;
			ed.scrollTop = ratio * maxE;
			window.requestAnimationFrame(() => {
				scrollSyncSourceRef.current = null;
			});
		};

		ed.addEventListener('scroll', syncFromEditor, { passive: true });
		pr.addEventListener('scroll', syncFromPreview, { passive: true });
		return (): void => {
			ed.removeEventListener('scroll', syncFromEditor);
			pr.removeEventListener('scroll', syncFromPreview);
		};
	}, [editorScrollContainerRef, previewMode]);

	return { previewScrollRef };
}
