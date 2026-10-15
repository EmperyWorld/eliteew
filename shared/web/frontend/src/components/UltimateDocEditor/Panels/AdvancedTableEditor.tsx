/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Excel-like table editor panel for Ultimate Doc Editor: cell editing,
 * formatting, formulas, undo/redo, and insert/export actions.
 *
 * Invariants:
 * - User-entered formulas are evaluated by a small arithmetic parser, never by `eval`/`new Function`.
 * - Table state mutations happen on cloned table data before React state replacement.
 *
 * Related:
 * - src/components/UltimateDocEditor/Panels/ChartsDiagramsPanel.tsx
 * - src/components/UltimateDocEditor/types/editor.types.ts
 */

import { useNotifications } from '@/notifications';
import { cn } from '@/utils/cn';
import { motion } from 'framer-motion';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppPanel,
	DesktopAppStatusBadge,
	DesktopAppToolbar,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import type { TableCell, TableColumn, TableData } from '../types/editor.types';
import { useDesktopShellFrame } from '../../../pages/Desktop/context/DesktopShellFrameContext';
import { useEmbeddedPortaledModalZIndex } from '../../../pages/Desktop/context/DesktopWindowPortalStackContext';
import {
	ArrowDownTrayIcon,
	ArrowUturnLeftIcon,
	ArrowUturnRightIcon,
	ClipboardIcon,
	DocumentDuplicateIcon,
	MinusIcon,
	PlusIcon,
	TableCellsIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

import {
	DESKTOP_WINDOW_FRAME_STYLES,
	getDesktopShellFooterStripClassName,
	getDesktopShellHeaderStripClassName,
	getDesktopShellPanelClassName,
} from '../../../pages/Desktop/utils/desktopVisualSystem';

interface AdvancedTableEditorProps {
	isOpen: boolean;
	onClose: () => void;
	onInsertTable?: (tableData: TableData) => void;
	initialData?: TableData;
}

const DEFAULT_ROWS = 5;
const DEFAULT_COLS = 4;

const TABLE_PANEL_ACCENT_ICON_CLASS =
	'flex items-center justify-center rounded-xl border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent) text-white shadow-(--desktop-shadow-panel)';

const TABLE_REMOVE_BUTTON_CLASS =
	'absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-red-400/35 bg-red-500/12 text-[10px] leading-none text-red-100 transition-colors hover:bg-red-500/20 disabled:opacity-50';

/** Inline cell styles follow desktop shell tokens (light/dark via --desktop-*). */
const TABLE_CELL_BACKGROUND = 'var(--desktop-surface-panel-strong)';
const TABLE_CELL_TEXT = 'var(--desktop-text-primary)';
const TABLE_BORDER = '1px solid var(--desktop-border-subtle)';

const createDefaultCellStyle = (): TableCell['style'] => ({
	backgroundColor: TABLE_CELL_BACKGROUND,
	color: TABLE_CELL_TEXT,
	fontWeight: 'normal',
	fontStyle: 'normal',
	textAlign: 'left',
	border: TABLE_BORDER,
});

const createEmptyCell = (id: string): TableCell => ({
	id,
	value: '',
	formula: '',
	style: createDefaultCellStyle(),
});

type FormulaParser = {
	peek: () => string | undefined;
	consume: () => string | undefined;
};

function columnLettersToIndex(letters: string): number {
	return (
		letters
			.toUpperCase()
			.split('')
			.reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1
	);
}

function numericCellValue(rows: TableCell[][], ref: string): number {
	const match = /^([A-Z]+)(\d+)$/i.exec(ref.trim());
	if (!match) return 0;
	const col = columnLettersToIndex(match[1] ?? '');
	const row = Number.parseInt(match[2] ?? '0', 10) - 1;
	const raw = rows[row]?.[col]?.value ?? '0';
	const value = Number.parseFloat(raw);
	return Number.isFinite(value) ? value : 0;
}

function tokenizeArithmeticExpression(
	source: string,
	rows: TableCell[][]
): string[] {
	const expanded = source.replace(/\b[A-Z]+\d+\b/gi, (ref) =>
		String(numericCellValue(rows, ref))
	);
	if (!/^[\d+\-*/().\s]+$/.test(expanded)) {
		throw new Error('Formula contains unsupported tokens');
	}
	return expanded.match(/\d+(?:\.\d+)?|[()+\-*/]/g) ?? [];
}

function parseArithmeticExpression(tokens: string[]): number {
	let index = 0;
	const parser: FormulaParser = {
		peek: () => tokens[index],
		consume: () => tokens[index++],
	};

	const parseFactor = (): number => {
		const token = parser.peek();
		if (token === '+' || token === '-') {
			parser.consume();
			const value = parseFactor();
			return token === '-' ? -value : value;
		}
		if (token === '(') {
			parser.consume();
			const value = parseExpr();
			if (parser.consume() !== ')') throw new Error('Unbalanced formula');
			return value;
		}
		const consumed = parser.consume();
		const value = Number.parseFloat(consumed ?? '');
		if (!Number.isFinite(value)) throw new Error('Invalid number');
		return value;
	};

	const parseTerm = (): number => {
		let value = parseFactor();
		while (parser.peek() === '*' || parser.peek() === '/') {
			const op = parser.consume();
			const right = parseFactor();
			value = op === '*' ? value * right : value / right;
		}
		return value;
	};

	const parseExpr = (): number => {
		let value = parseTerm();
		while (parser.peek() === '+' || parser.peek() === '-') {
			const op = parser.consume();
			const right = parseTerm();
			value = op === '+' ? value + right : value - right;
		}
		return value;
	};

	const result = parseExpr();
	if (index !== tokens.length || !Number.isFinite(result)) {
		throw new Error('Invalid formula');
	}
	return result;
}

function evaluateTableFormula(formula: string, rows: TableCell[][]): number {
	if (formula.toUpperCase().startsWith('SUM(')) {
		const range = formula.match(/SUM\(([^)]+)\)/i)?.[1];
		if (!range) {
			throw new Error('Invalid SUM range');
		}

		const [start, end] = range.split(':');
		if (!start || !end) {
			throw new Error('Invalid SUM range format');
		}
		const startCol = columnLettersToIndex(start.replace(/\d+/g, ''));
		const startRow = Number.parseInt(start.replace(/\D+/g, ''), 10) - 1;
		const endCol = columnLettersToIndex(end.replace(/\d+/g, ''));
		const endRow = Number.parseInt(end.replace(/\D+/g, ''), 10) - 1;

		let sum = 0;
		for (let r = startRow; r <= endRow; r++) {
			for (let c = startCol; c <= endCol; c++) {
				sum += numericCellValue(rows, `${String.fromCharCode(65 + c)}${r + 1}`);
			}
		}
		return sum;
	}

	return parseArithmeticExpression(tokenizeArithmeticExpression(formula, rows));
}

export const AdvancedTableEditor: React.FC<AdvancedTableEditorProps> = ({
	isOpen,
	onClose,
	onInsertTable,
	initialData,
}) => {
	const { t } = useTranslation('docEditorPanels');
	const { success } = useNotifications();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const shellFrame = useDesktopShellFrame();
	const shellPreset = useMemo(
		() =>
			DESKTOP_WINDOW_FRAME_STYLES[shellFrame] ??
			DESKTOP_WINDOW_FRAME_STYLES.glass,
		[shellFrame]
	);
	const tableModalShellClass = useMemo(
		() =>
			cn(
				'fixed inset-4 flex flex-col text-(--desktop-text-primary)',
				getDesktopShellPanelClassName(shellFrame, 'strong')
			),
		[shellFrame]
	);
	const tableHeaderStripClass = useMemo(
		() => getDesktopShellHeaderStripClassName(shellFrame),
		[shellFrame]
	);
	const tableFooterStripClass = useMemo(
		() => getDesktopShellFooterStripClassName(shellFrame),
		[shellFrame]
	);

	// TableCellsIcon state
	const [tableData, setTableData] = useState<TableData>(() => {
		if (initialData) {
			return initialData;
		}

		const rows = Array.from({ length: DEFAULT_ROWS }, (_, rowIndex) =>
			Array.from({ length: DEFAULT_COLS }, (_, colIndex) =>
				createEmptyCell(`cell-${rowIndex}-${colIndex}`)
			)
		);

		const columns = Array.from({ length: DEFAULT_COLS }, (_, index) => ({
			id: `col-${index}`,
			label: String.fromCharCode(65 + index), // A, B, C, D...
			width: 120,
		}));

		return { rows, columns, id: `table-${Date.now()}` };
	});

	// UI state
	const [selectedCell, setSelectedCell] = useState<{
		row: number;
		col: number;
	} | null>(null);
	const [editingCell, setEditingCell] = useState<{
		row: number;
		col: number;
	} | null>(null);
	const [clipboard, setClipboard] = useState<TableCell[][]>([]);
	const [history, setHistory] = useState<TableData[]>([]);
	const [historyIndex, setHistoryIndex] = useState(-1);

	const inputRef = useRef<HTMLInputElement>(null);

	// ArrowDownTrayIcon to history for undo/redo
	const saveToHistory = useCallback(
		(data: TableData): void => {
			const newHistory = history.slice(0, historyIndex + 1);
			const clonedData: TableData = JSON.parse(
				JSON.stringify(data)
			) as TableData;
			newHistory.push(clonedData);
			setHistory(newHistory);
			setHistoryIndex(newHistory.length - 1);
		},
		[history, historyIndex]
	);

	// Initialize history
	useEffect(() => {
		if (history.length === 0) {
			saveToHistory(tableData);
		}
	}, [tableData, history.length, saveToHistory]);

	const evaluateFormula = useCallback(
		(formula: string, rows: TableCell[][]): number => {
			try {
				return evaluateTableFormula(formula, rows);
			} catch {
				throw new Error('Invalid formula');
			}
		},
		[]
	);

	const updateCell = useCallback(
		(row: number, col: number, value: string): void => {
			setTableData((prev) => {
				const newData: TableData = JSON.parse(
					JSON.stringify(prev)
				) as TableData;
				newData.rows[row][col].value = value;

				if (value.startsWith('=')) {
					newData.rows[row][col].formula = value;
					try {
						const result = evaluateFormula(value.substring(1), newData.rows);
						newData.rows[row][col].value = result.toString();
					} catch {
						newData.rows[row][col].value = '#ERROR';
					}
				} else {
					newData.rows[row][col].formula = '';
				}

				saveToHistory(newData);
				return newData;
			});
		},
		[saveToHistory, evaluateFormula]
	);

	// Add row
	const addRow = useCallback(
		(afterIndex: number): void => {
			setTableData((prev) => {
				const newData: TableData = JSON.parse(
					JSON.stringify(prev)
				) as TableData;
				const newRow = Array.from(
					{ length: prev.columns.length },
					(_, colIndex) => createEmptyCell(`cell-${afterIndex + 1}-${colIndex}`)
				);
				newData.rows.splice(afterIndex + 1, 0, newRow);
				saveToHistory(newData);
				return newData;
			});
		},
		[saveToHistory]
	);

	// Add column
	const addColumn = useCallback(
		(afterIndex: number): void => {
			setTableData((prev) => {
				const newData: TableData = JSON.parse(
					JSON.stringify(prev)
				) as TableData;
				const newCol: TableColumn = {
					id: `col-${prev.columns.length}`,
					label: String.fromCharCode(65 + prev.columns.length),
					width: 120,
				};
				newData.columns.splice(afterIndex + 1, 0, newCol);

				// Add cells to all rows
				newData.rows.forEach((row, rowIndex) => {
					row.splice(
						afterIndex + 1,
						0,
						createEmptyCell(`cell-${rowIndex}-${afterIndex + 1}`)
					);
				});

				saveToHistory(newData);
				return newData;
			});
		},
		[saveToHistory]
	);

	// Delete row
	const deleteRow = useCallback(
		(rowIndex: number): void => {
			if (tableData.rows.length <= 1) {
				return;
			}

			setTableData((prev) => {
				const newData: TableData = JSON.parse(
					JSON.stringify(prev)
				) as TableData;
				newData.rows.splice(rowIndex, 1);
				saveToHistory(newData);
				return newData;
			});
		},
		[tableData.rows.length, saveToHistory]
	);

	// Delete column
	const deleteColumn = useCallback(
		(colIndex: number): void => {
			if (tableData.columns.length <= 1) {
				return;
			}

			setTableData((prev) => {
				const newData: TableData = JSON.parse(
					JSON.stringify(prev)
				) as TableData;
				newData.columns.splice(colIndex, 1);
				newData.rows.forEach((row) => {
					row.splice(colIndex, 1);
				});
				saveToHistory(newData);
				return newData;
			});
		},
		[tableData.columns.length, saveToHistory]
	);

	// DocumentDuplicateIcon selection
	const copySelection = useCallback((): void => {
		if (!selectedCell) {
			return;
		}

		const startRow = Math.min(
			selectedCell.row,
			editingCell?.row ?? selectedCell.row
		);
		const endRow = Math.max(
			selectedCell.row,
			editingCell?.row ?? selectedCell.row
		);
		const startCol = Math.min(
			selectedCell.col,
			editingCell?.col ?? selectedCell.col
		);
		const endCol = Math.max(
			selectedCell.col,
			editingCell?.col ?? selectedCell.col
		);

		const copiedData: TableCell[][] = [];
		for (let r = startRow; r <= endRow; r++) {
			const row: TableCell[] = [];
			for (let c = startCol; c <= endCol; c++) {
				const cell = tableData.rows[r]?.[c];
				if (cell) {
					row.push(cell);
				} else {
					row.push(createEmptyCell(`cell-${r}-${c}`));
				}
			}
			copiedData.push(row);
		}

		setClipboard(copiedData);
		success(
			t('panels.table.advanced.toast.copyTitle'),
			t('panels.table.advanced.toast.copyBody')
		);
	}, [selectedCell, editingCell, tableData.rows, success, t]);

	// Paste data
	const pasteData = useCallback((): void => {
		if (!selectedCell || clipboard.length === 0) {
			return;
		}

		setTableData((prev) => {
			const newData: TableData = JSON.parse(JSON.stringify(prev)) as TableData;
			const startRow = selectedCell.row;
			const startCol = selectedCell.col;

			clipboard.forEach((row, rowOffset) => {
				row.forEach((cell, colOffset) => {
					const targetRow = startRow + rowOffset;
					const targetCol = startCol + colOffset;

					if (newData.rows[targetRow]?.[targetCol]) {
						newData.rows[targetRow][targetCol] = { ...cell };
					}
				});
			});

			saveToHistory(newData);
			return newData;
		});

		success(
			t('panels.table.advanced.toast.pasteTitle'),
			t('panels.table.advanced.toast.pasteBody')
		);
	}, [selectedCell, clipboard, success, saveToHistory, t]);

	// ArrowUturnLeftIcon/ArrowUturnRightIcon
	const undo = useCallback((): void => {
		if (historyIndex > 0) {
			const prevData = history[historyIndex - 1];
			if (prevData) {
				setHistoryIndex(historyIndex - 1);
				setTableData(prevData);
			}
		}
	}, [history, historyIndex]);

	const redo = useCallback((): void => {
		if (historyIndex < history.length - 1) {
			const nextData = history[historyIndex + 1];
			if (nextData) {
				setHistoryIndex(historyIndex + 1);
				setTableData(nextData);
			}
		}
	}, [history, historyIndex]);

	// Export to CSV
	const exportToCSV = useCallback((): void => {
		const csvContent = tableData.rows
			.map((row) => row.map((cell) => `"${cell.value}"`).join(','))
			.join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'table.csv';
		a.click();
		URL.revokeObjectURL(url);

		success(t('panels.table.advanced.toast.exportCsv'));
	}, [tableData.rows, success, t]);

	// Handle cell click
	const handleCellClick = (row: number, col: number): void => {
		setSelectedCell({ row, col });
		setEditingCell(null);
	};

	// Handle cell double click
	const handleCellDoubleClick = (row: number, col: number): void => {
		setSelectedCell({ row, col });
		setEditingCell({ row, col });
	};

	// Handle cell edit
	const handleCellEdit = (value: string): void => {
		if (editingCell) {
			updateCell(editingCell.row, editingCell.col, value);
			setEditingCell(null);
		}
	};

	// Handle key presses
	const handleKeyDown = (e: React.KeyboardEvent): void => {
		if (e.key === 'Enter' && editingCell) {
			handleCellEdit(inputRef.current?.value || '');
		} else if (e.key === 'Escape') {
			setEditingCell(null);
		} else if (e.ctrlKey || e.metaKey) {
			switch (e.key) {
				case 'c':
					e.preventDefault();
					copySelection();
					break;
				case 'v':
					e.preventDefault();
					pasteData();
					break;
				case 'z':
					e.preventDefault();
					if (e.shiftKey) {
						redo();
					} else {
						undo();
					}
					break;
				case 'y':
					e.preventDefault();
					redo();
					break;
			}
		}
	};

	// Insert table into editor
	const handleInsertTable = (): void => {
		if (onInsertTable) {
			onInsertTable(tableData);
			success(t('panels.table.advanced.toast.inserted'));
			onClose();
		}
	};

	if (!isOpen) {
		return null;
	}

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			transition={{ duration: 0.2 }}
			className={tableModalShellClass}
			style={{ zIndex: embeddedModalZ.content }}
			onKeyDown={handleKeyDown}
		>
			{/* Header */}
			<div
				className={cn(
					'flex items-center justify-between p-4',
					tableHeaderStripClass
				)}
			>
				<div className="flex items-center gap-3">
					<div className={`${TABLE_PANEL_ACCENT_ICON_CLASS} p-2`}>
						<TableCellsIcon width={20} height={20} />
					</div>
					<div>
						<h2 className="text-lg font-semibold text-(--desktop-text-primary)">
							{t('panels.table.advanced.title')}
						</h2>
						<p className="text-sm text-(--desktop-text-muted) antialiased">
							{t('panels.table.advanced.subtitle')}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<DesktopAppButton
						onClick={undo}
						disabled={historyIndex <= 0}
						variant="ghost"
						size="icon"
						title={t('panels.table.advanced.undoTitle')}
						aria-label={t('panels.table.advanced.undoAria')}
					>
						<ArrowUturnLeftIcon width={16} height={16} />
					</DesktopAppButton>
					<DesktopAppButton
						onClick={redo}
						disabled={historyIndex >= history.length - 1}
						variant="ghost"
						size="icon"
						title={t('panels.table.advanced.redoTitle')}
						aria-label={t('panels.table.advanced.redoAria')}
					>
						<ArrowUturnRightIcon width={16} height={16} />
					</DesktopAppButton>

					<div className="mx-1 h-6 w-px bg-(--desktop-border-subtle)" />

					<DesktopAppButton
						onClick={copySelection}
						disabled={!selectedCell}
						variant="ghost"
						size="icon"
						title={t('panels.table.advanced.copyTitle')}
						aria-label={t('panels.table.advanced.copyAria')}
					>
						<DocumentDuplicateIcon width={16} height={16} />
					</DesktopAppButton>
					<DesktopAppButton
						onClick={pasteData}
						disabled={clipboard.length === 0}
						variant="ghost"
						size="icon"
						title={t('panels.table.advanced.pasteTitle')}
						aria-label={t('panels.table.advanced.pasteAria')}
					>
						<ClipboardIcon width={16} height={16} />
					</DesktopAppButton>

					<div className="mx-1 h-6 w-px bg-(--desktop-border-subtle)" />

					<DesktopAppButton
						onClick={exportToCSV}
						variant="ghost"
						size="icon"
						title={t('panels.table.advanced.exportCsvTitle')}
						aria-label={t('panels.table.advanced.exportCsvAria')}
					>
						<ArrowDownTrayIcon width={16} height={16} />
					</DesktopAppButton>

					<DesktopAppButton
						onClick={onClose}
						variant="ghost"
						size="icon"
						title={t('panels.table.advanced.closeTitle')}
						aria-label={t('panels.table.advanced.closeAria')}
					>
						<XMarkIcon width={16} height={16} />
					</DesktopAppButton>
				</div>
			</div>

			{/* Toolbar */}
			<DesktopAppToolbar
				className={cn('gap-2 px-3 py-3', tableHeaderStripClass)}
			>
				<DesktopAppButton
					onClick={() => selectedCell && addRow(selectedCell.row)}
					variant="accent"
					size="sm"
				>
					<PlusIcon width={14} height={14} />
					{t('panels.table.advanced.addRow')}
				</DesktopAppButton>
				<DesktopAppButton
					onClick={() => selectedCell && addColumn(selectedCell.col)}
					variant="neutral"
					size="sm"
				>
					<PlusIcon width={14} height={14} />
					{t('panels.table.advanced.addColumn')}
				</DesktopAppButton>

				{selectedCell && (
					<>
						<DesktopAppButton
							onClick={() => deleteRow(selectedCell.row)}
							disabled={tableData.rows.length <= 1}
							variant="danger"
							size="sm"
						>
							<MinusIcon width={14} height={14} />
							{t('panels.table.advanced.deleteRow')}
						</DesktopAppButton>
						<DesktopAppButton
							onClick={() => deleteColumn(selectedCell.col)}
							disabled={tableData.columns.length <= 1}
							variant="danger"
							size="sm"
						>
							<MinusIcon width={14} height={14} />
							{t('panels.table.advanced.deleteColumn')}
						</DesktopAppButton>
					</>
				)}

				<div className="ml-auto">
					{selectedCell && tableData.columns[selectedCell.col] ? (
						<DesktopAppStatusBadge className="border-(--desktop-border-subtle) bg-(--desktop-surface-panel) text-(--desktop-text-secondary)">
							{t('panels.table.advanced.cellBadge', {
								col: tableData.columns[selectedCell.col]?.label || '',
								row: selectedCell.row + 1,
							})}
						</DesktopAppStatusBadge>
					) : null}
				</div>
			</DesktopAppToolbar>

			{/* TableCellsIcon */}
			<div
				className={cn('min-h-0 flex-1 overflow-auto p-4', shellPreset.content)}
			>
				<DesktopAppPanel className="overflow-hidden border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-0">
					<table className="w-full border-collapse">
						{/* Header */}
						<thead className="sticky top-0 z-1 shadow-[0_1px_0_0_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_22%,transparent)]">
							<tr>
								<th className="w-12 border border-[color-mix(in_srgb,var(--desktop-border-subtle)_65%,transparent)] bg-[color-mix(in_srgb,var(--desktop-surface-soft)_82%,rgb(var(--desktop-accent-rgb))_10%)] text-center text-sm font-semibold text-(--desktop-text-primary)">
									#
								</th>
								{tableData.columns.map((col, colIndex) => (
									<th
										key={col.id}
										className="relative border border-[color-mix(in_srgb,var(--desktop-border-subtle)_65%,transparent)] bg-[color-mix(in_srgb,var(--desktop-surface-soft)_82%,rgb(var(--desktop-accent-rgb))_10%)] text-center text-sm font-semibold text-(--desktop-text-primary)"
										style={{ width: col.width }}
										scope="col"
									>
										{col.label}
										<button
											type="button"
											onClick={() => deleteColumn(colIndex)}
											disabled={tableData.columns.length <= 1}
											className={TABLE_REMOVE_BUTTON_CLASS}
											aria-label={t('panels.table.advanced.deleteColumnAria', {
												label: col.label,
											})}
										>
											×
										</button>
									</th>
								))}
							</tr>
						</thead>

						{/* Body */}
						<tbody>
							{tableData.rows.map((row, rowIndex) => (
								<tr key={row.map((c) => c.id).join('|')}>
									<td className="relative border border-[color-mix(in_srgb,var(--desktop-border-subtle)_45%,transparent)] bg-[color-mix(in_srgb,var(--desktop-surface-soft)_92%,transparent)] text-center text-sm text-(--desktop-text-muted) antialiased">
										{rowIndex + 1}
										<button
											type="button"
											onClick={() => deleteRow(rowIndex)}
											disabled={tableData.rows.length <= 1}
											className={TABLE_REMOVE_BUTTON_CLASS}
											aria-label={t('panels.table.advanced.deleteRowAria', {
												n: rowIndex + 1,
											})}
										>
											×
										</button>
									</td>
									{row.map((cell, colIndex) => (
										<td
											key={cell.id}
											className={`cursor-pointer border border-[color-mix(in_srgb,var(--desktop-border-subtle)_35%,transparent)] outline-none transition-colors hover:bg-[rgb(var(--desktop-accent-rgb))]/8 ${
												selectedCell?.row === rowIndex &&
												selectedCell?.col === colIndex
													? 'z-1 bg-[rgb(var(--desktop-accent-rgb))]/14 ring-2 ring-inset ring-[rgb(var(--desktop-accent-rgb))]/65'
													: ''
											}`}
											style={{
												backgroundColor: cell.style.backgroundColor,
												color: cell.style.color,
												fontWeight: cell.style.fontWeight,
												fontStyle: cell.style.fontStyle,
												textAlign: cell.style.textAlign as
													| 'left'
													| 'center'
													| 'right'
													| 'justify',
												minWidth: tableData.columns[colIndex]?.width,
											}}
											onClick={() => handleCellClick(rowIndex, colIndex)}
											onDoubleClick={() =>
												handleCellDoubleClick(rowIndex, colIndex)
											}
											onKeyDown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													handleCellClick(rowIndex, colIndex);
												}
											}}
										>
											{editingCell?.row === rowIndex &&
											editingCell?.col === colIndex ? (
												<input
													ref={inputRef}
													defaultValue={cell.formula || cell.value}
													className="w-full border-none bg-transparent px-2 py-1 text-(--desktop-text-primary) outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/50 focus-visible:ring-inset"
													aria-label={t('panels.table.advanced.editCellAria', {
														col: tableData.columns[colIndex]?.label ?? '',
														row: rowIndex + 1,
													})}
													aria-invalid={cell.value === '#ERROR'}
													title={
														cell.value === '#ERROR'
															? t('panels.table.formulaInvalid')
															: undefined
													}
													onBlur={(e) =>
														handleCellEdit((e.target as HTMLInputElement).value)
													}
													onKeyDown={(e) => {
														if (e.key === 'Enter') {
															handleCellEdit(
																(e.target as HTMLInputElement).value
															);
														} else if (e.key === 'Escape') {
															setEditingCell(null);
														}
													}}
												/>
											) : (
												<div className="flex min-h-[24px] items-center px-2 py-1 text-(--desktop-text-primary)">
													{cell.value === '#ERROR' ? (
														<span className="text-red-300">
															{t('panels.table.formulaInvalid')}
														</span>
													) : (
														cell.value || '\u00A0'
													)}
												</div>
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</DesktopAppPanel>
			</div>

			{/* Footer */}
			<div
				className={cn(
					'flex items-center justify-between p-4',
					tableFooterStripClass
				)}
			>
				<div className="text-sm text-(--desktop-text-muted) antialiased">
					{t('panels.table.advanced.dimensions', {
						rows: tableData.rows.length,
						cols: tableData.columns.length,
					})}
				</div>

				<div className="flex items-center gap-3">
					<DesktopAppButton onClick={onClose} variant="ghost">
						{t('panels.table.advanced.cancel')}
					</DesktopAppButton>
					<DesktopAppButton onClick={handleInsertTable} variant="accent">
						<ArrowDownTrayIcon width={16} height={16} />
						{t('panels.table.advanced.insertTable')}
					</DesktopAppButton>
				</div>
			</div>
		</motion.div>
	);
};
