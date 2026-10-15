/**
 * Command parser: normalize transcript, match aliases, extract parameters.
 * Supports multilingual aliases (RU/EN) and parameterized commands (e.g. "создай папку <name>").
 */

import { COMMAND_CATALOG } from './commandCatalog';

export type ParseResult =
	| { commandId: string; params?: Record<string, string> }
	| { ambiguous: true; intent: 'open_app'; candidates: string[] }
	| null;

/** Normalize text for matching: lowercase, trim, collapse spaces. */
function normalize(text: string): string {
	return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Map: normalized phrase -> command id (from command + aliases). */
const PHRASE_TO_ID = (() => {
	const map = new Map<string, string>();
	for (const def of COMMAND_CATALOG) {
		const phrases = [def.command, ...(def.aliases ?? [])];
		for (const p of phrases) {
			const key = normalize(p);
			if (!map.has(key)) map.set(key, def.id);
		}
	}
	return map;
})();

/** "Open app" keyword -> command id (for "открой X" / "open X"). */
const APP_KEYWORD_TO_ID: Record<string, string> = {
	чат: 'open_gaf_chat',
	chat: 'open_gaf_chat',
	гаф: 'open_gaf_chat',
	gaf: 'open_gaf_chat',
	контент: 'open_content',
	content: 'open_content',
	аналитику: 'open_ugs_analytics',
	аналитика: 'open_ugs_analytics',
	analytics: 'open_ugs_analytics',
	airflow: 'open_ugs_analytics',
	презентации: 'open_presentations',
	презентаций: 'open_presentations',
	слайд: 'open_presentations',
	слайды: 'open_presentations',
	presentations: 'open_presentations',
	документы: 'open_doc_editor',
	документ: 'open_doc_editor',
	documents: 'open_doc_editor',
	редактор: 'open_doc_editor',
	editor: 'open_doc_editor',
	comfy: 'open_image_studio',
	comfyui: 'open_image_studio',
	комфи: 'open_image_studio',
	картинки: 'open_image_studio',
	изображения: 'open_image_studio',
	'студия изображений': 'open_image_studio',
	'студия видео': 'open_video_studio',
	'видео студия': 'open_video_studio',
	плеер: 'open_music_player',
	музыку: 'open_music_player',
	музыка: 'open_music_player',
	'музыкальный плеер': 'open_music_player',
	'генератор песен': 'open_music_generator',
	'генератор музыки': 'open_music_generator',
	буфер: 'open_clipboard',
	clipboard: 'open_clipboard',
	магазин: 'open_app_store',
	'магазин приложений': 'open_app_store',
	'site studio': 'open_site_studio',
	'сайт студио': 'open_site_studio',
	соц: 'open_social_hub',
	'соц хаб': 'open_social_hub',
	друзья: 'open_social_hub',
	social: 'open_social_hub',
	маркетинг: 'open_marketing_cabinet',
	мц: 'open_marketing_cabinet',
	marketing: 'open_marketing_cabinet',
	'маркетинговый кабинет': 'open_marketing_cabinet',
	студия: 'open_studio_gu',
	гу: 'open_studio_gu',
	'студия гу': 'open_studio_gu',
	поиск: 'open_command_palette',
	палитра: 'open_command_palette',
	'командная палитра': 'open_command_palette',
};

const OPEN_APP_CANDIDATE_IDS: string[] = COMMAND_CATALOG.filter((c) =>
	c.id.startsWith('open_')
).map((c) => c.id);

const OPEN_PREFIXES = ['открой ', 'открыть ', 'open '];
const CREATE_FOLDER_PREFIXES = [
	'создай папку ',
	'создать папку ',
	'новая папка ',
	'create folder ',
	'новую папку ',
];

/**
 * Parse transcript into command id and optional params.
 * Tries: 1) exact phrase/alias match, 2) parameterized "открой <app>", 3) "создай папку <name>".
 */
export function parseCommand(transcript: string): ParseResult {
	const n = normalize(transcript);

	// 1) Exact phrase match (including all aliases)
	const exactId = PHRASE_TO_ID.get(n);
	if (exactId) return { commandId: exactId };

	// 2) "открой X" / "open X" -> open_* by app keyword, or ambiguous if no/unknown app
	for (const prefix of OPEN_PREFIXES) {
		if (n.startsWith(prefix)) {
			const rest = n.slice(prefix.length).trim();
			const id = APP_KEYWORD_TO_ID[rest];
			if (id) return { commandId: id };
			return {
				ambiguous: true,
				intent: 'open_app',
				candidates: [...OPEN_APP_CANDIDATE_IDS],
			};
		}
	}

	// 3) "создай папку <name>" -> create_folder with params.name
	for (const prefix of CREATE_FOLDER_PREFIXES) {
		const p = normalize(prefix);
		if (n.startsWith(p)) {
			const name = n.slice(p.length).trim();
			return {
				commandId: 'create_folder',
				params: { name: name || 'Новая папка' },
			};
		}
	}

	// 4) Substring match for backward compatibility (longer phrases containing key phrases)
	for (const [phrase, commandId] of PHRASE_TO_ID) {
		if (phrase.length >= 4 && n.includes(phrase)) return { commandId };
	}

	return null;
}
