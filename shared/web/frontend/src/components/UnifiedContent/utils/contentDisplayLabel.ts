import type { Content } from '../types';

/** Подпись строки: `title`, если задан, иначе `name` (совпадает с Content Manager и API). */
export function unifiedContentDisplayLabel(
	item: Pick<Content, 'name' | 'title'>
): string {
	const t = item.title?.trim();
	if (t) {
		return t;
	}
	return item.name.trim();
}
