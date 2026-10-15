/**
 * Helpers for EWDesk admin body textarea: insert Markdown at selection / line.
 */

export function getLineBounds(
	text: string,
	pos: number
): { lineStart: number; lineEnd: number } {
	const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
	const nextNl = text.indexOf('\n', pos);
	const lineEnd = nextNl === -1 ? text.length : nextNl;
	return { lineStart, lineEnd };
}

export function wrapSelection(
	text: string,
	start: number,
	end: number,
	before: string,
	after: string,
	placeholder = ''
): { newText: string; selStart: number; selEnd: number } {
	const selected = start === end ? placeholder : text.slice(start, end);
	const inserted = before + selected + after;
	const newText = text.slice(0, start) + inserted + text.slice(end);
	const selStart = start + before.length;
	const selEnd = selStart + selected.length;
	return { newText, selStart, selEnd };
}

/** Insert `prefix` at the start of the line containing `cursorPos`. */
export function prefixLine(
	text: string,
	cursorPos: number,
	prefix: string
): { newText: string; selStart: number; selEnd: number } {
	const { lineStart, lineEnd } = getLineBounds(text, cursorPos);
	const line = text.slice(lineStart, lineEnd);
	const newLine = prefix + line;
	const newText = text.slice(0, lineStart) + newLine + text.slice(lineEnd);
	const delta = prefix.length;
	const newCursor = cursorPos + delta;
	return { newText, selStart: newCursor, selEnd: newCursor };
}
