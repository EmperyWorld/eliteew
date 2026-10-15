/**
 * Справка по блокам маркетингового кабинета (контент в blocks.*.json).
 */
export interface BlockHelpEntry {
	/** Заголовок во всплывающей панели */
	title: string;
	/** Короткий тезис «зачем этот блок» */
	lead: string;
	/** Абзацы: что это и как встроено в цикл */
	paragraphs: string[];
	/** С чем связано в кабинете (названия разделов/сущностей) */
	related: string[];
	/** Практические шаги */
	tips: string[];
}

export type BlockHelpCatalog = Record<string, BlockHelpEntry>;
