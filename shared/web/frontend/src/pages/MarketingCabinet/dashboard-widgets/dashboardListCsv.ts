function csvEscape(cell: string): string {
	return `"${cell.replace(/"/g, '""')}"`;
}

/** Trigger download of a UTF-8 CSV (RFC-style, Excel-friendly with BOM). */
export function downloadDashboardListCsv(
	filename: string,
	header: string[],
	rows: string[][]
): void {
	const bom = '\ufeff';
	const lines = [
		header.map(csvEscape).join(','),
		...rows.map((r) => r.map((c) => csvEscape(String(c))).join(',')),
	];
	const blob = new Blob([bom + lines.join('\n')], {
		type: 'text/csv;charset=utf-8',
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
