import type { ChartConfig, DiagramConfig } from './editor.types';

/** Данные таблицы для отложенной вставки (совместимо с DocEditorTableData). */
export type PendingTableInsert = {
	rows: {
		value?: string;
		style?: { backgroundColor?: string; color?: string };
	}[][];
	columns?: { label?: string }[];
};

/** Очередь вставки в TipTap, если редактор ещё не смонтирован (например режим Markdown). */
export type PendingDocInsert =
	| { kind: 'image'; url: string }
	| { kind: 'formula'; latex: string }
	| { kind: 'diagram'; svg: string; diagramConfig?: DiagramConfig }
	| { kind: 'chart'; chartConfig: ChartConfig }
	| { kind: 'pdfHtml'; html: string }
	| { kind: 'table'; tableData: PendingTableInsert };
