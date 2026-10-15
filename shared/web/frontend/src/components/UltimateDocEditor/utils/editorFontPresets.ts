export type EditorFontPresetId =
	| 'default'
	| 'systemUi'
	| 'sans'
	| 'serif'
	| 'mono'
	| 'georgia';

export interface EditorFontPreset {
	presetId: EditorFontPresetId;
	/** Fallback, если ключ i18n отсутствует */
	label: string;
	/** Empty string = сброс к шрифту темы */
	fontFamily: string;
}

/** Курируемый набор для тулбара, слэша и контекстного меню */
export const EDITOR_FONT_PRESETS: readonly EditorFontPreset[] = [
	{ presetId: 'default', label: 'По умолчанию', fontFamily: '' },
	{
		presetId: 'systemUi',
		label: 'Системный',
		fontFamily:
			'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
	},
	{
		presetId: 'sans',
		label: 'Без засечек',
		fontFamily: 'ui-sans-serif, system-ui, sans-serif',
	},
	{
		presetId: 'serif',
		label: 'С засечками',
		fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
	},
	{
		presetId: 'mono',
		label: 'Моноширинный',
		fontFamily:
			'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
	},
	{ presetId: 'georgia', label: 'Georgia', fontFamily: 'Georgia, serif' },
] as const;

export function normalizeFontFamily(value: string | null | undefined): string {
	return (value ?? '').trim();
}
