/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Command catalog: canonical list of voice commands with metadata and RU/EN aliases.
 *
 * Invariants:
 * - Visible command text follows EliteEW terminology; legacy aliases may remain for recognition compatibility.
 * - Command ids stay stable because executors route by id.
 *
 * Related:
 * - `commandExecutor.ts`
 */

export type CommandCategory = 'apps' | 'desktop' | 'info' | 'system';

export interface CommandDef {
	id: string;
	command: string;
	description: string;
	icon: string;
	category: CommandCategory;
	/** Alternative phrases (RU/EN) for matching. */
	aliases?: string[];
	/** If true, UI should ask for confirmation before executing. */
	requiresConfirmation?: boolean;
	/** If true, command is considered destructive (close, delete, etc.). */
	destructive?: boolean;
}

/** All available commands for display and parsing. */
export const COMMAND_CATALOG: CommandDef[] = [
	{
		id: 'open_gaf_chat',
		command: 'открой чат',
		description: 'Открыть GAF Chat',
		icon: '💬',
		category: 'apps',
		aliases: [
			'открыть чат',
			'gaf чат',
			'gaf chat',
			'open chat',
			'open gaf',
			'чат',
		],
	},
	{
		id: 'open_content',
		command: 'открой контент',
		description: 'Открыть Content Manager',
		icon: '📂',
		category: 'apps',
		aliases: [
			'контент менеджер',
			'content',
			'content manager',
			'открой контент менеджер',
		],
	},
	{
		id: 'open_ugs_analytics',
		command: 'открой аналитику',
		description: 'Открыть UGS Аналитику',
		icon: '📊',
		category: 'apps',
		aliases: [
			'ugs аналитика',
			'аналитика',
			'open analytics',
			'airflow',
			'би аирфлоу',
		],
	},
	{
		id: 'open_presentations',
		command: 'открой презентации',
		description: 'Открыть Presentations',
		icon: '📽️',
		category: 'apps',
		aliases: [
			'презентации',
			'слайд',
			'presentations',
			'open presentations',
			'слайды',
		],
	},
	{
		id: 'open_doc_editor',
		command: 'открой документы',
		description: 'Открыть Doc Editor',
		icon: '📄',
		category: 'apps',
		aliases: [
			'документ',
			'док редактор',
			'редактор документов',
			'doc editor',
			'open documents',
			'документы',
		],
	},
	{
		id: 'open_image_studio',
		command: 'открой студию изображений',
		description: 'Открыть Студию изображений',
		icon: '🖼️',
		category: 'apps',
		aliases: [
			'студия изображений',
			'image studio',
			'картинки',
			'изображения',
			'open image studio',
			'comfy',
			'comfyui',
			'комфи',
			'комфорт ui',
			'open comfy',
			'открой comfyui',
		],
	},
	{
		id: 'open_video_studio',
		command: 'открой студию видео',
		description: 'Открыть Студию видео',
		icon: '🎬',
		category: 'apps',
		aliases: [
			'студия видео',
			'video studio',
			'open video studio',
			'видео студия',
		],
	},
	{
		id: 'open_music_player',
		command: 'открой музыкальный плеер',
		description: 'Открыть Музыкальный плеер',
		icon: '🎵',
		category: 'apps',
		aliases: [
			'плеер',
			'music player',
			'музыку',
			'музыка плеер',
			'open music player',
		],
	},
	{
		id: 'open_music_generator',
		command: 'открой генератор музыки',
		description: 'Открыть Генератор песен',
		icon: '🎼',
		category: 'apps',
		aliases: [
			'генератор песен',
			'генератор музыки',
			'music generator',
			'песни ai',
			'open music generator',
		],
	},
	{
		id: 'open_clipboard',
		command: 'открой буфер обмена',
		description: 'Открыть Буфер обмена',
		icon: '📋',
		category: 'apps',
		aliases: ['буфер', 'clipboard', 'история копирований', 'open clipboard'],
	},
	{
		id: 'open_app_store',
		command: 'открой магазин приложений',
		description: 'Открыть Магазин приложений',
		icon: '🛒',
		category: 'apps',
		aliases: [
			'магазин',
			'магазин приложений',
			'app store',
			'приложения магазин',
			'open app store',
		],
	},
	{
		id: 'open_site_studio',
		command: 'открой site studio',
		description: 'Открыть Site Studio',
		icon: '🌐',
		category: 'apps',
		aliases: [
			'site studio',
			'сайт студио',
			'studio сайта',
			'user site',
			'open site studio',
		],
	},
	{
		id: 'open_social_hub',
		command: 'открой соц сеть',
		description: 'Открыть Связи',
		icon: '👥',
		category: 'apps',
		aliases: [
			'social hub',
			'connections',
			'связи',
			'соц хаб',
			'друзья',
			'профиль',
			'open social',
		],
	},
	{
		id: 'open_marketing_cabinet',
		command: 'открой маркетинговый кабинет',
		description: 'Открыть Маркетинговый кабинет',
		icon: '📣',
		category: 'apps',
		aliases: [
			'маркетинг',
			'маркетинговый кабинет',
			'маркетинг кабинет',
			'marketing cabinet',
			'marketing',
			'open marketing',
			'мц',
		],
	},
	{
		id: 'open_studio_gu',
		command: 'открой студию гу',
		description: 'Открыть Студию ГУ',
		icon: '🎙️',
		category: 'apps',
		aliases: [
			'студия гу',
			'студиягу',
			'голосовая студия',
			'voice studio',
			'open studio gu',
			'studio gu',
		],
	},
	{
		id: 'focus_next_window',
		command: 'следующее окно',
		description: 'Фокус на следующем окне (как переключатель окон)',
		icon: '🔀',
		category: 'desktop',
		aliases: [
			'переключи окно',
			'next window',
			'переключи окно вперёд',
			'окно вперёд',
			'следующее приложение',
		],
	},
	{
		id: 'focus_previous_window',
		command: 'предыдущее окно',
		description: 'Фокус на предыдущем окне',
		icon: '🔙',
		category: 'desktop',
		aliases: [
			'окно назад',
			'previous window',
			'переключи окно назад',
			'предыдущее приложение',
		],
	},
	{
		id: 'open_command_palette',
		command: 'открой поиск',
		description: 'Палитра команд и поиск по Безраздельному миру',
		icon: '⌘',
		category: 'desktop',
		aliases: [
			'поиск по безраздельному миру',
			'поиск по рабочему столу',
			'командная палитра',
			'command palette',
			'open search',
			'палитра команд',
			'открой палитру',
		],
	},
	{
		id: 'voice_sound_mute',
		command: 'выключи звук ответов',
		description: 'Не озвучивать ответы штаба (TTS)',
		icon: '🔇',
		category: 'system',
		aliases: [
			'без звука',
			'mute',
			'выключи озвучку',
			'тише ответы',
			'выключи звук',
		],
	},
	{
		id: 'voice_sound_unmute',
		command: 'включи звук ответов',
		description: 'Снова озвучивать ответы штаба',
		icon: '🔊',
		category: 'system',
		aliases: ['со звуком', 'unmute', 'включи озвучку'],
	},
	{
		id: 'voice_sound_toggle',
		command: 'переключи звук ответов',
		description: 'Вкл/выкл озвучку ответов',
		icon: '🔉',
		category: 'system',
		aliases: ['переключи звук', 'toggle sound', 'звук ответов'],
	},
	{
		id: 'create_folder',
		command: 'создай папку',
		description: 'Создать новую папку',
		icon: '📁',
		category: 'desktop',
		aliases: [
			'новая папка',
			'новую папку',
			'create folder',
			'создать папку',
			'make folder',
		],
	},
	{
		id: 'minimize_all',
		command: 'сверни всё',
		description: 'Свернуть все окна',
		icon: '🪟',
		category: 'desktop',
		aliases: [
			'сверни',
			'минимизируй',
			'minimize all',
			'minimize',
			'свернуть всё',
		],
	},
	{
		id: 'show_desktop',
		command: 'покажи Безраздельный мир',
		description: 'Показать Безраздельный мир',
		icon: '🖥️',
		category: 'desktop',
		aliases: [
			'безраздельный мир',
			'покажи безраздельный мир',
			'рабочий стол',
			'покажи десктоп',
			'show desktop',
			'desktop',
		],
	},
	{
		id: 'close_window',
		command: 'закрой окно',
		description: 'Закрыть активное окно',
		icon: '❌',
		category: 'desktop',
		requiresConfirmation: true,
		destructive: true,
		aliases: ['закрыть окно', 'close window', 'close'],
	},
	{
		id: 'time',
		command: 'который час',
		description: 'Узнать время',
		icon: '🕐',
		category: 'info',
		aliases: [
			'время',
			'сколько время',
			'what time',
			'time',
			'который сейчас час',
		],
	},
	{
		id: 'date',
		command: 'какое сегодня число',
		description: 'Узнать дату',
		icon: '📅',
		category: 'info',
		aliases: [
			'какое число',
			'какая дата',
			'сегодня',
			'what date',
			'date',
			'какое сегодня число',
		],
	},
	{
		id: 'help',
		command: 'помощь',
		description: 'Показать команды',
		icon: '❓',
		category: 'system',
		aliases: ['команды', 'что умеешь', 'что ты умеешь', 'help', 'commands'],
	},
	{
		id: 'clear_history',
		command: 'очисти историю',
		description: 'Очистить чат',
		icon: '🗑️',
		category: 'system',
		requiresConfirmation: true,
		aliases: ['удали историю', 'очистить', 'clear history', 'очисти чат'],
	},
	{
		id: 'thanks',
		command: 'спасибо',
		description: 'Благодарность',
		icon: '🙏',
		category: 'system',
		aliases: ['благодарю', 'thank you', 'thanks'],
	},
	{
		id: 'greeting',
		command: 'привет',
		description: 'Приветствие',
		icon: '👋',
		category: 'system',
		aliases: ['здравствуй', 'hello', 'hi', 'hey'],
	},
];

export function getCommandById(id: string): CommandDef | undefined {
	return COMMAND_CATALOG.find((c) => c.id === id);
}

export function getAllCommands(): CommandDef[] {
	return [...COMMAND_CATALOG];
}
