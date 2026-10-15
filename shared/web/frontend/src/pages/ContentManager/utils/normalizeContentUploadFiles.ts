/**
 * Собирает массив File из input/drag-drop для массовой загрузки в контент-менеджер.
 */
export function normalizeContentUploadFiles(
	files: FileList | File[] | null | undefined
): File[] {
	return Array.from(files ?? []).filter(
		(f): f is File => f instanceof File && f.name.length > 0
	);
}
