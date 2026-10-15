/**
 * useFileDropZone - Hook для создания drop zones, которые принимают файлы из Content Manager (drag payload type content-file).
 *
 * Использование:
 * ```tsx
 * const { dropZoneProps, isDraggingOver } = useFileDropZone({
 *   onFileDrop: (file) => {
 *     log.info('File dropped:', file);
 *   }
 * });
 *
 * return <div {...dropZoneProps}>Drop files here</div>;
 * ```
 */

import { useState, useCallback, useRef } from 'react';
import { log } from '../utils/logger';

export interface DroppedFile {
	type: 'content-file';
	id: string;
	name: string;
	url: string;
	content_type: string;
	file_size: number;
}

interface UseFileDropZoneOptions {
	onFileDrop: (file: DroppedFile) => void;
	acceptTypes?: string[];
	disabled?: boolean;
}

export const useFileDropZone = (options: UseFileDropZoneOptions) => {
	const { onFileDrop, acceptTypes, disabled = false } = options;
	const [isDraggingOver, setIsDraggingOver] = useState(false);
	const dragCounter = useRef(0);

	const handleDragEnter = useCallback(
		(e: React.DragEvent) => {
			if (disabled) {
				return;
			}

			e.preventDefault();
			e.stopPropagation();
			dragCounter.current++;

			// Проверяем, что это файл из контент-менеджера
			const data = e.dataTransfer.getData('application/json');
			if (data) {
				try {
					const fileData = JSON.parse(data);
					if (fileData.type === 'content-file') {
						// Проверяем тип файла, если указан фильтр
						if (!acceptTypes || acceptTypes.includes(fileData.content_type)) {
							setIsDraggingOver(true);
							e.dataTransfer.dropEffect = 'copy';
						}
					}
				} catch (_error) {
					// Не файл из контент-менеджера, игнорируем
				}
			}
		},
		[acceptTypes, disabled]
	);

	const handleDragOver = useCallback(
		(e: React.DragEvent) => {
			if (disabled) {
				return;
			}

			e.preventDefault();
			e.stopPropagation();

			const data = e.dataTransfer.getData('application/json');
			if (data) {
				try {
					const fileData = JSON.parse(data);
					if (fileData.type === 'content-file') {
						if (!acceptTypes || acceptTypes.includes(fileData.content_type)) {
							e.dataTransfer.dropEffect = 'copy';
						}
					}
				} catch (_error) {
					// Игнорируем
				}
			}
		},
		[acceptTypes, disabled]
	);

	const handleDragLeave = useCallback(
		(e: React.DragEvent) => {
			if (disabled) {
				return;
			}

			e.preventDefault();
			e.stopPropagation();
			dragCounter.current--;

			if (dragCounter.current === 0) {
				setIsDraggingOver(false);
			}
		},
		[disabled]
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			if (disabled) {
				return;
			}

			e.preventDefault();
			e.stopPropagation();
			dragCounter.current = 0;
			setIsDraggingOver(false);

			try {
				const data = e.dataTransfer.getData('application/json');
				if (data) {
					const fileData = JSON.parse(data);
					if (fileData.type === 'content-file') {
						// Проверяем тип файла, если указан фильтр
						if (!acceptTypes || acceptTypes.includes(fileData.content_type)) {
							onFileDrop(fileData as DroppedFile);
						}
					}
				}
			} catch (error) {
				log.error(
					'useFileDropZone',
					'Failed to parse dropped file data',
					error instanceof Error ? error : undefined,
					error
				);
			}
		},
		[onFileDrop, acceptTypes, disabled]
	);

	const dropZoneProps = {
		onDragEnter: handleDragEnter,
		onDragOver: handleDragOver,
		onDragLeave: handleDragLeave,
		onDrop: handleDrop,
		style: {
			transition: 'all 0.2s',
			...(isDraggingOver && {
				backgroundColor: 'rgba(168, 85, 247, 0.1)',
				borderColor: 'rgba(168, 85, 247, 0.5)',
				borderStyle: 'dashed',
				borderWidth: '2px',
			}),
		},
	};

	return {
		dropZoneProps,
		isDraggingOver,
	};
};
