/**
 * DnD на корневой оболочке редактора: изображения в TipTap, документы → панель импорта, лимиты размера.
 */

import type { Editor } from '@tiptap/react';
import { useCallback, useState, type DragEvent } from 'react';
import type { OverlayKey } from './docEditorPanelKeys';
import { shortenDataUrlForImageInsert } from '../utils/shortenDataUrlForImageInsert';

export interface UseDocEditorDragDropParams {
	tiptapEditor: Editor | null;
	showPanel: (panel: OverlayKey) => void;
}

export interface UseDocEditorDragDropResult {
	isDragOver: boolean;
	memoryWarning: string | null;
	dismissMemoryWarning: () => void;
	handleDragOver: (e: DragEvent) => void;
	handleDragLeave: (e: DragEvent) => void;
	handleDrop: (e: DragEvent) => Promise<void>;
}

export function useDocEditorDragDrop(
	params: UseDocEditorDragDropParams
): UseDocEditorDragDropResult {
	const { tiptapEditor, showPanel } = params;

	const [isDragOver, setIsDragOver] = useState(false);
	const [memoryWarning, setMemoryWarning] = useState<string | null>(null);

	const dismissMemoryWarning = useCallback(() => {
		setMemoryWarning(null);
	}, []);

	const handleDragOver = useCallback((e: DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
	}, []);

	const handleDrop = useCallback(
		async (e: DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);

			const files = Array.from(e.dataTransfer.files);
			const totalSize = files.reduce((sum, file) => sum + file.size, 0);
			const maxSize = 50 * 1024 * 1024; // 50MB limit

			if (totalSize > maxSize) {
				setMemoryWarning(
					`Files too large (${(totalSize / 1024 / 1024).toFixed(1)}MB). Maximum allowed: 50MB`
				);
				setTimeout(() => setMemoryWarning(null), 5000);
				return;
			}

			const imageFiles = files.filter((file) => file.type.startsWith('image/'));
			const docFiles = files.filter(
				(file) =>
					file.type === 'application/pdf' ||
					file.type.includes('document') ||
					file.type.includes('text')
			);

			for (const file of imageFiles) {
				if (file.size > 5 * 1024 * 1024) {
					setMemoryWarning(
						`Image "${file.name}" is too large. Maximum: 5MB per image`
					);
					continue;
				}

				const reader = new FileReader();
				reader.onload = (ev: ProgressEvent<FileReader>): void => {
					const result = ev.target?.result as string;
					if (result && tiptapEditor) {
						const src = shortenDataUrlForImageInsert(result);
						tiptapEditor.chain().focus().setImage({ src }).run();
					}
				};
				reader.readAsDataURL(file);
			}

			if (docFiles.length > 0) {
				showPanel('import');
			}
		},
		[tiptapEditor, showPanel]
	);

	return {
		isDragOver,
		memoryWarning,
		dismissMemoryWarning,
		handleDragOver,
		handleDragLeave,
		handleDrop,
	};
}
