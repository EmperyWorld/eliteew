/**
 * Нормализация HTML и «мягкое» сравнение содержимого редактора.
 * Нужно, чтобы не вызывать TipTap setContent при ответе API с тем же текстом,
 * но другой сериализации тегов — иначе каретка прыгает в конец документа.
 */

const HTML_TAG_REGEX = /<[^>]*>/i;

export const escapeHtmlForComparable = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

export const convertPlainTextToHtml = (text: string): string => {
	if (!text) {
		return '<p></p>';
	}

	const paragraphs = text.split(/\r?\n\r?\n/);
	const htmlParagraphs = paragraphs.map((paragraph) => {
		const lines = paragraph
			.split(/\r?\n/)
			.map((line) => escapeHtmlForComparable(line));
		const joined = lines.join('<br />');
		return `<p>${joined}</p>`;
	});

	return htmlParagraphs.join('');
};

export const normalizeNewlinesInHtml = (html: string): string =>
	html.replace(
		/>([^<]*)</g,
		(_, text: string) => `>${text.replace(/\r?\n/g, '<br />')}<`
	);

export const normalizeContentToHtml = (raw: string): string => {
	if (!raw) {
		return '<p></p>';
	}

	const trimmed = raw.trim();
	if (HTML_TAG_REGEX.test(trimmed)) {
		return normalizeNewlinesInHtml(raw);
	}

	return convertPlainTextToHtml(raw);
};

export const htmlToComparableText = (rawHtml: string): string =>
	normalizeContentToHtml(rawHtml || '<p></p>')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/\r/g, '')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();

export function editorHtmlContentEquivalent(a: string, b: string): boolean {
	return htmlToComparableText(a) === htmlToComparableText(b);
}

/** Пустой документ TipTap до сидирования Yjs — не путать с реальным контентом. */
export function isEffectivelyEmptyDocHtml(html: string): boolean {
	const h = html.trim();
	if (!h) return true;
	if (/<img\b/i.test(h)) return false;
	if (/<table\b/i.test(h)) return false;
	if (/<video\b/i.test(h)) return false;
	if (/<iframe\b/i.test(h)) return false;
	return htmlToComparableText(html).length === 0;
}

export interface DocEditorTableCellStyle {
	backgroundColor?: string;
	color?: string;
}

export interface DocEditorTableCell {
	value?: string;
	style?: DocEditorTableCellStyle;
}

export interface DocEditorTableColumn {
	label?: string;
}

export interface DocEditorTableData {
	rows: DocEditorTableCell[][];
	columns?: DocEditorTableColumn[];
}

/** Разметка таблицы для вставки в TipTap (без лишних зависимостей). */
export function generateDocEditorTableHtml(
	tableData: DocEditorTableData
): string {
	const columnCount = Math.max(
		(tableData.columns ?? []).length,
		tableData.rows.reduce((max, row) => Math.max(max, row.length), 0),
		1
	);
	const safeColumns =
		tableData.columns && tableData.columns.length > 0
			? tableData.columns
			: Array.from({ length: columnCount }, (_, index) => ({
					label: `Колонка ${index + 1}`,
				}));

	const headerCells = safeColumns
		.slice(0, columnCount)
		.map((column) => `<th>${escapeHtmlForComparable(column.label ?? '')}</th>`)
		.join('');

	const safeRows = tableData.rows.length > 0 ? tableData.rows : [[]];
	const rows = safeRows
		.map((row): string => {
			const cells = Array.from({ length: columnCount }, (_, index) => {
				const cell = row[index];
				return `<td>${escapeHtmlForComparable(cell?.value ?? '')}</td>`;
			}).join('');
			return `<tr>${cells}</tr>`;
		})
		.join('');

	return `<table><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
}
