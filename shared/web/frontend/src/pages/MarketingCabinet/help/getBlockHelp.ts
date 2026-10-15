import type { BlockHelpCatalog, BlockHelpEntry } from './blockHelp.types';

import blocksEn from './blocks.en.json';
import blocksRu from './blocks.ru.json';

const en = blocksEn as BlockHelpCatalog;
const ru = blocksRu as BlockHelpCatalog;

function pickCatalog(lang: string | undefined): BlockHelpCatalog {
	if (!lang) return ru;
	const lower = lang.toLowerCase();
	if (lower.startsWith('ru')) return ru;
	return en;
}

/** Текст справки для блока или null, если ключа нет в каталоге. */
export function getBlockHelp(
	lang: string | undefined,
	blockId: string
): BlockHelpEntry | null {
	const catalog = pickCatalog(lang);
	const entry = catalog[blockId];
	return entry ?? null;
}
