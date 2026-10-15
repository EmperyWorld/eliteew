/**
 * Меню экспорта (позиция, клики снаружи) + вызов store export / клиентский XLSX.
 */

import type { Editor } from '@tiptap/react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react';
import type { StoreApi } from 'zustand';
import { log } from '@/utils/logger';
import type { UltimateDocEditorExportFormat } from '../data/ultimateDocEditorExportFormats';
import type { EditorStore } from '../store/editorStore';
import type { UltimateDocument } from '../types/editor.types';

export type DocEditorCloseAllOverlays = (options?: {
	skipToolbar?: boolean;
}) => void;

export interface UseDocEditorExportParams {
	closeAllOverlaysRef: MutableRefObject<DocEditorCloseAllOverlays | null>;
	editorStoreApi: StoreApi<EditorStore>;
	currentDocument: UltimateDocument | null;
	tiptapEditor: Editor | null;
}

export interface UseDocEditorExportResult {
	exportMenuOpen: boolean;
	setExportMenuOpen: Dispatch<SetStateAction<boolean>>;
	exportMenuPosition: { x: number; y: number } | null;
	exportMenuRef: MutableRefObject<HTMLDivElement | null>;
	exportButtonRef: MutableRefObject<HTMLButtonElement | null>;
	handleExportToggle: () => void;
	handleExport: (format: UltimateDocEditorExportFormat) => Promise<void>;
}

export function useDocEditorExport(
	params: UseDocEditorExportParams
): UseDocEditorExportResult {
	const { closeAllOverlaysRef, editorStoreApi, currentDocument, tiptapEditor } =
		params;

	const [exportMenuOpen, setExportMenuOpen] = useState(false);
	const [exportMenuPosition, setExportMenuPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const exportMenuRef = useRef<HTMLDivElement | null>(null);
	const exportButtonRef = useRef<HTMLButtonElement | null>(null);

	const handleExportToggle = useCallback(() => {
		if (exportMenuOpen) {
			setExportMenuOpen(false);
		} else {
			closeAllOverlaysRef.current?.();
			setExportMenuOpen(true);
		}
	}, [closeAllOverlaysRef, exportMenuOpen]);

	useEffect(() => {
		if (!exportMenuOpen) {
			return;
		}

		const handleClickOutside = (event: MouseEvent): void => {
			const target = event.target as Node;
			if (
				exportMenuRef.current &&
				!exportMenuRef.current.contains(target) &&
				exportButtonRef.current &&
				!exportButtonRef.current.contains(target)
			) {
				setExportMenuOpen(false);
			}
		};

		const handleEscape = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				setExportMenuOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleEscape);

		return (): void => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [exportMenuOpen]);

	useLayoutEffect(() => {
		if (!exportMenuOpen || typeof window === 'undefined') {
			return;
		}

		const updatePosition = (): void => {
			const button = exportButtonRef.current;
			if (!button) {
				return;
			}

			const menu = exportMenuRef.current;
			const buttonRect = button.getBoundingClientRect();
			const menuWidth = menu?.offsetWidth ?? 320;
			const menuHeight = menu?.offsetHeight ?? 360;
			const margin = 12;
			const gap = 12;

			let nextX = buttonRect.right - menuWidth;
			let nextY = buttonRect.bottom + gap;

			if (nextY + menuHeight > window.innerHeight - margin) {
				const flippedY = buttonRect.top - menuHeight - gap;
				nextY =
					flippedY >= margin
						? flippedY
						: window.innerHeight - menuHeight - margin;
			}

			nextX = Math.min(
				Math.max(nextX, margin),
				Math.max(margin, window.innerWidth - menuWidth - margin)
			);
			nextY = Math.min(
				Math.max(nextY, margin),
				Math.max(margin, window.innerHeight - menuHeight - margin)
			);

			setExportMenuPosition((previous) =>
				previous?.x === nextX && previous?.y === nextY
					? previous
					: { x: nextX, y: nextY }
			);
		};

		const frame = window.requestAnimationFrame(updatePosition);
		window.addEventListener('resize', updatePosition);

		return (): void => {
			window.cancelAnimationFrame(frame);
			window.removeEventListener('resize', updatePosition);
		};
	}, [exportMenuOpen]);

	const handleExcelExport = useCallback(async (): Promise<void> => {
		if (!currentDocument || !tiptapEditor) {
			return;
		}

		try {
			const ExcelJS = (await import('exceljs')).default;

			const htmlContent = tiptapEditor.getHTML();

			const parser = new DOMParser();
			const doc = parser.parseFromString(htmlContent, 'text/html');
			const tables = doc.querySelectorAll('table');

			const workbook = new ExcelJS.Workbook();

			const extractTableData = (
				table: HTMLTableElement
			): (string | number)[][] => {
				const data: (string | number)[][] = [];
				const rows = table.querySelectorAll('tr');
				rows.forEach((row) => {
					const rowData: (string | number)[] = [];
					const cells = row.querySelectorAll('th, td');
					cells.forEach((cell) => {
						const text = cell.textContent?.trim() || '';
						const numValue = Number(text);
						rowData.push(Number.isNaN(numValue) ? text : numValue);
					});
					data.push(rowData);
				});
				return data;
			};

			if (tables.length > 0) {
				tables.forEach((table, index) => {
					const tableData = extractTableData(table as HTMLTableElement);
					const sheetName =
						tables.length === 1 ? 'Данные' : `Таблица ${index + 1}`;
					const worksheet = workbook.addWorksheet(sheetName);

					tableData.forEach((row) => {
						worksheet.addRow(row);
					});
				});
			} else {
				const textContent = tiptapEditor.getText();
				const lines = textContent.split('\n').map((line) => [line]);
				const worksheet = workbook.addWorksheet('Текст');
				lines.forEach((row) => {
					worksheet.addRow(row);
				});
			}

			if (currentDocument.title) {
				workbook.creator = 'EliteEW Document Editor';
				workbook.created = new Date();
				(workbook.properties as { title?: string }).title =
					currentDocument.title;
			}

			const excelBuffer = await workbook.xlsx.writeBuffer();
			const blob = new Blob([excelBuffer], {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			});
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${currentDocument.title || 'document'}.xlsx`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
		} catch (error) {
			log.error(
				'UltimateDocEditor',
				'Excel export failed',
				error instanceof Error ? error : undefined,
				error
			);
			throw new Error('Не удалось экспортировать в Excel');
		}
	}, [currentDocument, tiptapEditor]);

	const handleExport = useCallback(
		async (format: UltimateDocEditorExportFormat): Promise<void> => {
			if (format === 'xlsx') {
				await handleExcelExport();
			} else {
				const { exportDocument } = editorStoreApi.getState();
				await exportDocument(format);
			}
		},
		[editorStoreApi, handleExcelExport]
	);

	return {
		exportMenuOpen,
		setExportMenuOpen,
		exportMenuPosition,
		exportMenuRef,
		exportButtonRef,
		handleExportToggle,
		handleExport,
	};
}
