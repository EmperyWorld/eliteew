/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side mirror of the user workflow tool catalog when the API is unavailable.
 *
 * Invariants:
 * - Keep in sync with ``user_workflow_allowlist.USER_WORKFLOW_TOOL_CATALOG``.
 *
 * Related:
 * - src/services/ewa/companionUserWorkflowsApi.ts
 */

import type {
	CompanionUserWorkflowToolCatalogEntry,
	CompanionUserWorkflowToolCatalogField,
} from '@/services/ewa/companionUserWorkflowsApi';

type CatalogFieldDraft = {
	key: string;
	type: string;
	label_ru: string;
	label_en: string;
	placeholder_ru?: string;
	placeholder_en?: string;
	options?: CompanionUserWorkflowToolCatalogField['options'];
};

type CatalogEntryDraft = {
	name: string;
	title_ru: string;
	title_en: string;
	description_ru?: string;
	description_en?: string;
	async_step?: boolean;
	requires_confirm?: boolean;
	fields?: CatalogFieldDraft[];
};

function normalizeCatalogField(
	field: CatalogFieldDraft
): CompanionUserWorkflowToolCatalogField {
	return {
		...field,
		placeholder_ru: field.placeholder_ru ?? '',
		placeholder_en: field.placeholder_en ?? '',
	};
}

function normalizeCatalogEntry(
	entry: CatalogEntryDraft
): CompanionUserWorkflowToolCatalogEntry {
	return {
		...entry,
		description_ru: entry.description_ru ?? '',
		description_en: entry.description_en ?? '',
		async_step: entry.async_step ?? false,
		requires_confirm: entry.requires_confirm ?? false,
		fields: entry.fields?.map(normalizeCatalogField),
	};
}

/** Default tool for a new builder step (first catalog entry). */
export const COMPANION_USER_WORKFLOW_DEFAULT_TOOL =
	'music_studio_open' as const;

const COMPANION_USER_WORKFLOW_TOOL_CATALOG_FALLBACK_RAW: CatalogEntryDraft[] = [
	{
		name: 'music_studio_open',
		title_ru: 'Открыть студию записи',
		title_en: 'Open Music Studio',
		description_ru:
			'Открывает приложение «Студия записи» в Безраздельном мире.',
		description_en: 'Opens the Music Studio desktop app.',
		async_step: false,
		requires_confirm: false,
		fields: [],
	},
	{
		name: 'music_generation',
		title_ru: 'Запись песни',
		title_en: 'Song recording',
		description_ru:
			'Полный цикл генерации трека (текст, стиль, рендер). Долго — идёт в фоне.',
		description_en:
			'Full track generation pipeline (lyrics, style, render). Runs in the background.',
		async_step: true,
		requires_confirm: false,
		fields: [
			{
				key: 'theme',
				type: 'text',
				label_ru: 'Тема / настроение',
				label_en: 'Theme / mood',
				placeholder_ru: 'например: утренний lo-fi',
				placeholder_en: 'e.g. morning lo-fi',
			},
			{
				key: 'genre',
				type: 'text',
				label_ru: 'Жанр',
				label_en: 'Genre',
				placeholder_ru: 'pop, rock, electronic…',
				placeholder_en: 'pop, rock, electronic…',
			},
			{
				key: 'style',
				type: 'text',
				label_ru: 'Стиль звучания',
				label_en: 'Production style',
			},
			{
				key: 'autoplay',
				type: 'select',
				label_ru: 'Автовоспроизведение',
				label_en: 'Autoplay when ready',
				options: [
					{ value: '', label_ru: 'По умолчанию', label_en: 'Default' },
					{ value: '1', label_ru: 'Да', label_en: 'Yes' },
					{ value: '0', label_ru: 'Нет', label_en: 'No' },
				],
			},
		],
	},
	{
		name: 'music_generation_xl_base',
		title_ru: 'Песня по настроению (XL)',
		title_en: 'Mood song (XL)',
		description_ru: 'Спутник сам подберёт текст и стиль из диалога и памяти.',
		description_en:
			'Companion derives lyrics and style from chat mood and memory.',
		async_step: true,
		requires_confirm: false,
		fields: [
			{
				key: 'mood',
				type: 'text',
				label_ru: 'Настроение',
				label_en: 'Mood',
				placeholder_ru: 'спокойная, энергичная…',
				placeholder_en: 'calm, energetic…',
			},
			{
				key: 'style',
				type: 'text',
				label_ru: 'Стиль',
				label_en: 'Style',
			},
		],
	},
	{
		name: 'image_generation',
		title_ru: 'Картинка',
		title_en: 'Image',
		description_ru: 'Генерация изображения по описанию. Долго — идёт в фоне.',
		description_en: 'Generate an image from a prompt. Runs in the background.',
		async_step: true,
		requires_confirm: false,
		fields: [
			{
				key: 'prompt',
				type: 'textarea',
				label_ru: 'Описание картинки',
				label_en: 'Image prompt',
				placeholder_ru: 'закат над городом в акварели',
				placeholder_en: 'sunset over a city in watercolor',
			},
			{
				key: 'aspect_ratio',
				type: 'select',
				label_ru: 'Формат',
				label_en: 'Aspect ratio',
				options: [
					{ value: '1:1', label_ru: 'Квадрат 1:1', label_en: 'Square 1:1' },
					{ value: '16:9', label_ru: 'Широкий 16:9', label_en: 'Wide 16:9' },
					{
						value: '9:16',
						label_ru: 'Вертикальный 9:16',
						label_en: 'Portrait 9:16',
					},
				],
			},
			{
				key: 'image_tool_mode',
				type: 'select',
				label_ru: 'Режим',
				label_en: 'Mode',
				options: [
					{ value: '', label_ru: 'Новая картинка', label_en: 'Generate new' },
					{
						value: 'edit',
						label_ru: 'Редактировать файл',
						label_en: 'Edit existing file',
					},
				],
			},
			{
				key: 'source_unified_content_id',
				type: 'text',
				label_ru: 'Исходная картинка (ID)',
				label_en: 'Source image (ID)',
				placeholder_ru: 'для режима «Редактировать»',
				placeholder_en: 'for Edit mode',
			},
		],
	},
	{
		name: 'file_create',
		title_ru: 'Создать файл',
		title_en: 'Create file',
		description_ru:
			'Новый документ в каталоге EwaFile. Перед записью спросит подтверждение.',
		description_en:
			'New document in the EwaFile catalog. Asks for confirmation first.',
		async_step: false,
		requires_confirm: true,
		fields: [
			{
				key: 'name',
				type: 'text',
				label_ru: 'Имя файла',
				label_en: 'File name',
				placeholder_ru: 'notes.md',
				placeholder_en: 'notes.md',
			},
			{
				key: 'body',
				type: 'textarea',
				label_ru: 'Содержимое',
				label_en: 'Body',
			},
		],
	},
	{
		name: 'file_save_text',
		title_ru: 'Сохранить текст в файл',
		title_en: 'Save text to file',
		description_ru:
			'Записать готовый текст (например, ответ прошлого шага) в новый .md. С подтверждением.',
		description_en:
			'Write ready text (e.g. a prior step reply) into a new .md. Requires confirmation.',
		async_step: false,
		requires_confirm: true,
		fields: [
			{
				key: 'name',
				type: 'text',
				label_ru: 'Имя файла',
				label_en: 'File name',
				placeholder_ru: 'summary.md',
				placeholder_en: 'summary.md',
			},
			{
				key: 'body',
				type: 'textarea',
				label_ru: 'Текст',
				label_en: 'Text body',
				placeholder_ru: '{{steps.0.output.reply}}',
				placeholder_en: '{{steps.0.output.reply}}',
			},
		],
	},
	{
		name: 'file_open',
		title_ru: 'Открыть файл',
		title_en: 'Open file',
		description_ru: 'Открыть документ из каталога в редакторе.',
		description_en: 'Open a catalog document in the editor.',
		fields: [
			{
				key: 'file_query',
				type: 'text',
				label_ru: 'Имя или часть имени',
				label_en: 'File name or fragment',
				placeholder_ru: 'report.md',
				placeholder_en: 'report.md',
			},
		],
	},
	{
		name: 'file_rename',
		title_ru: 'Переименовать файл',
		title_en: 'Rename file',
		description_ru: 'Переименование с подтверждением.',
		description_en: 'Rename with confirmation.',
		async_step: false,
		requires_confirm: true,
		fields: [
			{
				key: 'rename_old_query',
				type: 'text',
				label_ru: 'Текущее имя',
				label_en: 'Current name',
			},
			{
				key: 'rename_new_name',
				type: 'text',
				label_ru: 'Новое имя',
				label_en: 'New name',
			},
		],
	},
	{
		name: 'file_delete',
		title_ru: 'Удалить файл',
		title_en: 'Delete file',
		description_ru: 'Удаление файла с подтверждением.',
		description_en: 'Delete a file with confirmation.',
		async_step: false,
		requires_confirm: true,
		fields: [
			{
				key: 'delete_file_query',
				type: 'text',
				label_ru: 'Имя файла',
				label_en: 'File name',
			},
		],
	},
	{
		name: 'catalog_discuss',
		title_ru: 'Разобрать файл',
		title_en: 'Discuss file',
		description_ru: 'Разбор файла из каталога по задаче.',
		description_en: 'Discuss a catalog file for your task.',
		fields: [
			{
				key: 'file_query',
				type: 'text',
				label_ru: 'Файл',
				label_en: 'File',
			},
		],
	},
	{
		name: 'presentation_generation',
		title_ru: 'Презентация',
		title_en: 'Presentation',
		description_ru: 'Генерация EWRP-презентации в фоне.',
		description_en: 'Background EWRP presentation generation.',
		async_step: true,
		requires_confirm: false,
		fields: [
			{
				key: 'topic',
				type: 'text',
				label_ru: 'Тема',
				label_en: 'Topic',
				placeholder_ru: 'например: запуск продукта',
				placeholder_en: 'e.g. product launch',
			},
			{
				key: 'title',
				type: 'text',
				label_ru: 'Заголовок',
				label_en: 'Title',
			},
			{
				key: 'num_slides',
				type: 'text',
				label_ru: 'Количество слайдов',
				label_en: 'Slides',
			},
			{
				key: 'presentation_theme',
				type: 'select',
				label_ru: 'Тема оформления',
				label_en: 'Visual theme',
				options: [
					{
						value: '',
						label_ru: 'По умолчанию (aurora)',
						label_en: 'Default (aurora)',
					},
					{ value: 'aurora', label_ru: 'Aurora', label_en: 'Aurora' },
					{ value: 'classic', label_ru: 'Classic', label_en: 'Classic' },
					{ value: 'midnight', label_ru: 'Midnight', label_en: 'Midnight' },
					{ value: 'ember', label_ru: 'Ember', label_en: 'Ember' },
					{ value: 'paper', label_ru: 'Paper', label_en: 'Paper' },
				],
			},
			{
				key: 'extra_context',
				type: 'textarea',
				label_ru: 'Доп. контекст',
				label_en: 'Extra context',
				placeholder_ru: 'аудитория, тон, ограничения…',
				placeholder_en: 'audience, tone, constraints…',
			},
		],
	},
	{
		name: 'doc_insert',
		title_ru: 'Вставить в редактор',
		title_en: 'Insert into editor',
		description_ru: 'Вставить фрагмент из другого файла в открытый документ.',
		description_en:
			'Insert a fragment from another file into the open document.',
		fields: [
			{
				key: 'source_file_query',
				type: 'text',
				label_ru: 'Исходный файл',
				label_en: 'Source file',
			},
		],
	},
	{
		name: 'app_open',
		title_ru: 'Открыть приложение',
		title_en: 'Open app',
		description_ru: 'Запуск приложения в Безраздельном мире.',
		description_en: 'Launch a desktop app.',
		fields: [
			{
				key: 'app_component',
				type: 'select',
				label_ru: 'Приложение',
				label_en: 'Application',
				options: [
					{
						value: 'MusicForgeApp',
						label_ru: 'Студия записи',
						label_en: 'Music Studio',
					},
					{
						value: 'DocEditor',
						label_ru: 'Редактор документов',
						label_en: 'Doc Editor',
					},
					{
						value: 'ContentManagerPro',
						label_ru: 'Менеджер файлов',
						label_en: 'File Manager',
					},
					{
						value: 'ImageStudio',
						label_ru: 'Студия изображений',
						label_en: 'Image Studio',
					},
					{
						value: 'MusicPlayer',
						label_ru: 'Музыкальный плеер',
						label_en: 'Music Player',
					},
					{
						value: 'DesktopShellSettings',
						label_ru: 'Настройки стола',
						label_en: 'Desktop Settings',
					},
					{ value: 'EWDeskApp', label_ru: 'EWDesk', label_en: 'EWDesk' },
					{
						value: 'VideoStudio',
						label_ru: 'Видеостудия',
						label_en: 'Video Studio',
					},
				],
			},
		],
	},
	{
		name: 'theme_set',
		title_ru: 'Сменить тему',
		title_en: 'Change theme',
		description_ru: 'Переключить светлую/тёмную тему Безраздельного мира.',
		description_en: 'Switch desktop light/dark theme.',
		fields: [
			{
				key: 'theme',
				type: 'select',
				label_ru: 'Тема',
				label_en: 'Theme',
				options: [
					{ value: 'dark', label_ru: 'Тёмная', label_en: 'Dark' },
					{ value: 'light', label_ru: 'Светлая', label_en: 'Light' },
					{ value: 'auto', label_ru: 'Как в системе', label_en: 'System' },
				],
			},
			{
				key: 'accent',
				type: 'text',
				label_ru: 'Акцент (опционально)',
				label_en: 'Accent (optional)',
			},
		],
	},
	{
		name: 'catalog_list',
		title_ru: 'Список файлов',
		title_en: 'File catalog',
		description_ru: 'Показать или найти файлы в каталоге EwaFile.',
		description_en: 'Browse or search files in the EwaFile catalog.',
		fields: [
			{
				key: 'mode',
				type: 'select',
				label_ru: 'Режим',
				label_en: 'Mode',
				options: [
					{
						value: 'list',
						label_ru: 'Список файлов',
						label_en: 'File list',
					},
					{
						value: 'search',
						label_ru: 'Поиск по имени',
						label_en: 'Search by name',
					},
				],
			},
		],
	},
	{
		name: 'social_post_compose',
		title_ru: 'Текст поста / лонгрид',
		title_en: 'Post / longread text',
		description_ru:
			'Сгенерировать готовый пост или лонгрид по теме (можно указать площадку).',
		description_en:
			'Generate a ready-to-publish post or longread from a topic (optional channel).',
		async_step: false,
		requires_confirm: false,
		fields: [
			{
				key: 'brief',
				type: 'textarea',
				label_ru: 'Тема / тезисы',
				label_en: 'Topic / brief',
			},
			{
				key: 'channel',
				type: 'select',
				label_ru: 'Площадка',
				label_en: 'Channel',
				options: [
					{ value: '', label_ru: 'По умолчанию', label_en: 'Default' },
					{ value: 'telegram', label_ru: 'Telegram', label_en: 'Telegram' },
					{ value: 'vk', label_ru: 'VK', label_en: 'VK' },
					{
						value: 'blog',
						label_ru: 'Блог / лонгрид',
						label_en: 'Blog / longread',
					},
				],
			},
			{
				key: 'file_query',
				type: 'text',
				label_ru: 'Файл-источник (опционально)',
				label_en: 'Source file (optional)',
			},
		],
	},
	{
		name: 'operations_status',
		title_ru: 'Статус операций',
		title_en: 'Operations status',
		description_ru:
			'Показать активные фоновые задачи спутника (генерации, цепочки).',
		description_en:
			'Show active companion background tasks (generations, chains).',
		async_step: false,
		requires_confirm: false,
		fields: [],
	},
	{
		name: 'recall_memory',
		title_ru: 'Контекст памяти',
		title_en: 'Memory context',
		description_ru:
			'Кратко напомнить, что спутник помнит о пользователе и умеет делать.',
		description_en: 'Summarize what the companion remembers and can do.',
		async_step: false,
		requires_confirm: false,
		fields: [],
	},
	{
		name: 'file_rewrite',
		title_ru: 'Переписать файл',
		title_en: 'Rewrite file',
		description_ru:
			'Полная перезапись содержимого файла в каталоге по инструкции (с подтверждением).',
		description_en:
			'Full rewrite of a catalog file from an instruction (requires confirmation).',
		async_step: false,
		requires_confirm: true,
		fields: [
			{
				key: 'file_query',
				type: 'text',
				label_ru: 'Файл',
				label_en: 'File',
			},
			{
				key: 'rewrite_brief',
				type: 'textarea',
				label_ru: 'Инструкция',
				label_en: 'Instruction',
			},
			{
				key: 'open_editor',
				type: 'select',
				label_ru: 'После сохранения',
				label_en: 'After save',
				options: [
					{ value: '', label_ru: 'Не открывать', label_en: 'Do not open' },
					{
						value: '1',
						label_ru: 'Открыть в редакторе',
						label_en: 'Open in editor',
					},
				],
			},
		],
	},
	{
		name: 'plan_v1',
		title_ru: 'План на сервере',
		title_en: 'Server plan',
		description_ru: 'Составить и сохранить план с целями и задачами в EWA.',
		description_en: 'Build and persist a goals/tasks plan in EWA.',
		async_step: false,
		requires_confirm: false,
		fields: [
			{
				key: 'plan_focus',
				type: 'textarea',
				label_ru: 'Фокус плана',
				label_en: 'Plan focus',
			},
			{
				key: 'horizon',
				type: 'select',
				label_ru: 'Горизонт',
				label_en: 'Horizon',
				options: [
					{ value: '', label_ru: 'Без срока', label_en: 'No horizon' },
					{ value: 'неделю', label_ru: 'На неделю', label_en: 'One week' },
					{
						value: '2 недели',
						label_ru: 'На 2 недели',
						label_en: 'Two weeks',
					},
					{ value: 'месяц', label_ru: 'На месяц', label_en: 'One month' },
				],
			},
		],
	},
	{
		name: 'plan_task_complete_v1',
		title_ru: 'Отметить шаг плана',
		title_en: 'Complete plan task',
		description_ru:
			'Отмечает задачу активного плана выполненной по названию шага.',
		description_en: 'Marks an active plan task complete by step title hint.',
		async_step: false,
		requires_confirm: false,
		fields: [
			{
				key: 'task_hint',
				type: 'text',
				label_ru: 'Название шага',
				label_en: 'Task title hint',
				placeholder_ru: 'часть названия задачи из плана',
				placeholder_en: 'fragment of the plan task title',
			},
		],
	},
	{
		name: 'check_task_status',
		title_ru: 'Статус операции',
		title_en: 'Operation status',
		description_ru:
			'Проверяет статус фоновой операции по run_id (например, после async-шага).',
		description_en:
			'Checks background operation status by run_id (e.g. after an async step).',
		async_step: false,
		requires_confirm: false,
		fields: [
			{
				key: 'run_id',
				type: 'text',
				label_ru: 'ID операции (run_id)',
				label_en: 'Operation ID (run_id)',
				placeholder_ru: '{{steps.0.output.task_run_id}}',
				placeholder_en: '{{steps.0.output.task_run_id}}',
			},
		],
	},
	{
		name: 'operation_cancel',
		title_ru: 'Отменить операцию',
		title_en: 'Cancel operation',
		description_ru:
			'Экстренная отмена фоновой операции по run_id. Требует подтверждения.',
		description_en:
			'Emergency cancel of a background operation by run_id. Requires confirmation.',
		async_step: false,
		requires_confirm: true,
		fields: [
			{
				key: 'run_id',
				type: 'text',
				label_ru: 'ID операции (run_id)',
				label_en: 'Operation ID (run_id)',
			},
		],
	},
	{
		name: 'paperless_import',
		title_ru: 'Импорт из Paperless',
		title_en: 'Import from Paperless',
		description_ru:
			'Подтянуть документ из архива Paperless-ngx в каталог / редактор.',
		description_en:
			'Pull a document from Paperless-ngx into the catalog / editor.',
		async_step: false,
		requires_confirm: false,
		fields: [
			{
				key: 'paperless_id',
				type: 'text',
				label_ru: 'ID в Paperless',
				label_en: 'Paperless ID',
				placeholder_ru: 'например: 42',
				placeholder_en: 'e.g. 42',
			},
		],
	},
	{
		name: 'pdf_parser',
		title_ru: 'Текст из PDF',
		title_en: 'Extract PDF text',
		description_ru:
			'Извлечь текст из PDF (Tika / OCR). Укажите файл каталога или вложение.',
		description_en:
			'Extract text from a PDF (Tika / OCR). Point at a catalog file or attachment.',
		async_step: false,
		requires_confirm: false,
		fields: [
			{
				key: 'unified_content_id',
				type: 'text',
				label_ru: 'ID файла в каталоге',
				label_en: 'Catalog file ID',
			},
			{
				key: 'filename',
				type: 'text',
				label_ru: 'Имя файла (подсказка)',
				label_en: 'Filename hint',
			},
		],
	},
	{
		name: 'document_extractor',
		title_ru: 'Текст из DOCX/TXT',
		title_en: 'Extract DOCX/TXT',
		description_ru: 'Извлечь текст из DOCX или TXT через Stack4 Tika.',
		description_en: 'Extract text from DOCX or TXT via Stack4 Tika.',
		async_step: false,
		requires_confirm: false,
		fields: [
			{
				key: 'unified_content_id',
				type: 'text',
				label_ru: 'ID файла в каталоге',
				label_en: 'Catalog file ID',
			},
			{
				key: 'filename',
				type: 'text',
				label_ru: 'Имя файла (подсказка)',
				label_en: 'Filename hint',
			},
		],
	},
	{
		name: 'llm_summarize',
		title_ru: 'Сжать текст',
		title_en: 'Summarize text',
		description_ru:
			'Краткое резюме длинного текста (можно подставить вывод предыдущего шага).',
		description_en: 'Summarize long text (can wire prior-step output).',
		async_step: false,
		requires_confirm: false,
		fields: [
			{
				key: 'text',
				type: 'textarea',
				label_ru: 'Текст',
				label_en: 'Text',
				placeholder_ru: '{{steps.0.output.reply}}',
				placeholder_en: '{{steps.0.output.reply}}',
			},
			{
				key: 'instruction',
				type: 'text',
				label_ru: 'Инструкция (опционально)',
				label_en: 'Instruction (optional)',
				placeholder_ru: 'кратко для команды, 5 буллетов',
				placeholder_en: 'short for the team, 5 bullets',
			},
		],
	},
	{
		name: 'llm_classify',
		title_ru: 'Классифицировать текст',
		title_en: 'Classify text',
		description_ru: 'Отнести текст к одной из категорий (метки через запятую).',
		description_en:
			'Assign text to one of the given categories (comma-separated labels).',
		async_step: false,
		requires_confirm: false,
		fields: [
			{
				key: 'text',
				type: 'textarea',
				label_ru: 'Текст',
				label_en: 'Text',
			},
			{
				key: 'categories',
				type: 'text',
				label_ru: 'Категории',
				label_en: 'Categories',
				placeholder_ru: 'срочно, обычное, архив',
				placeholder_en: 'urgent, normal, archive',
			},
		],
	},
	{
		name: 'vision_analyze',
		title_ru: 'Разобрать изображение',
		title_en: 'Analyze image',
		description_ru: 'Описание / OCR / ответ по картинке (vision pipeline).',
		description_en: 'Describe / OCR / answer about an image (vision pipeline).',
		async_step: false,
		requires_confirm: false,
		fields: [
			{
				key: 'prompt',
				type: 'textarea',
				label_ru: 'Вопрос к картинке',
				label_en: 'Question about the image',
				placeholder_ru: 'что на скриншоте? выдели ключевые цифры',
				placeholder_en: 'what is on the screenshot? list key numbers',
			},
			{
				key: 'attachment_id',
				type: 'text',
				label_ru: 'ID вложения (если есть)',
				label_en: 'Attachment ID (if any)',
			},
			{
				key: 'image_url',
				type: 'text',
				label_ru: 'URL изображения',
				label_en: 'Image URL',
			},
		],
	},
	{
		name: 'telegram_sender',
		title_ru: 'Отправить в Telegram',
		title_en: 'Send to Telegram',
		description_ru:
			'Исходящее сообщение в Telegram. Обычно ставьте шаг подтверждения перед ним.',
		description_en:
			'Outbound Telegram message. Usually place a confirm gate before this step.',
		async_step: false,
		requires_confirm: true,
		fields: [
			{
				key: 'message_text',
				type: 'textarea',
				label_ru: 'Текст сообщения',
				label_en: 'Message text',
				placeholder_ru: '{{steps.0.output.reply}}',
				placeholder_en: '{{steps.0.output.reply}}',
			},
			{
				key: 'chat_id',
				type: 'text',
				label_ru: 'Chat ID (опционально)',
				label_en: 'Chat ID (optional)',
			},
		],
	},
	{
		name: 'email_dispatcher',
		title_ru: 'Отправить email',
		title_en: 'Send email',
		description_ru:
			'Письмо через SMTP оператора. Обычно ставьте шаг подтверждения перед ним.',
		description_en:
			'Email via operator SMTP. Usually place a confirm gate before this step.',
		async_step: false,
		requires_confirm: true,
		fields: [
			{
				key: 'to',
				type: 'text',
				label_ru: 'Кому',
				label_en: 'To',
				placeholder_ru: 'team@example.com',
				placeholder_en: 'team@example.com',
			},
			{
				key: 'subject',
				type: 'text',
				label_ru: 'Тема',
				label_en: 'Subject',
			},
			{
				key: 'body',
				type: 'textarea',
				label_ru: 'Текст письма',
				label_en: 'Body',
				placeholder_ru: '{{steps.0.output.reply}}',
				placeholder_en: '{{steps.0.output.reply}}',
			},
		],
	},
];

export const COMPANION_USER_WORKFLOW_TOOL_CATALOG_FALLBACK =
	COMPANION_USER_WORKFLOW_TOOL_CATALOG_FALLBACK_RAW.map(normalizeCatalogEntry);

export function mergeCompanionUserWorkflowToolCatalog(
	serverEntries: CompanionUserWorkflowToolCatalogEntry[] | null | undefined
): {
	catalog: CompanionUserWorkflowToolCatalogEntry[];
	usedFallbackOnly: boolean;
} {
	const fallbackByName = new Map(
		COMPANION_USER_WORKFLOW_TOOL_CATALOG_FALLBACK.map((entry) => [
			entry.name,
			entry,
		])
	);
	if (!serverEntries?.length) {
		return {
			catalog: COMPANION_USER_WORKFLOW_TOOL_CATALOG_FALLBACK,
			usedFallbackOnly: true,
		};
	}
	const merged = new Map(fallbackByName);
	for (const entry of serverEntries) {
		const base = fallbackByName.get(entry.name);
		merged.set(entry.name, {
			...(base ?? { fields: [] }),
			...entry,
			fields:
				entry.fields && entry.fields.length > 0
					? entry.fields
					: (base?.fields ?? []),
		});
	}
	const catalog = Array.from(merged.values());
	catalog.sort((a, b) => {
		const ai = COMPANION_USER_WORKFLOW_TOOL_CATALOG_FALLBACK.findIndex(
			(row) => row.name === a.name
		);
		const bi = COMPANION_USER_WORKFLOW_TOOL_CATALOG_FALLBACK.findIndex(
			(row) => row.name === b.name
		);
		return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
	});
	return { catalog, usedFallbackOnly: false };
}
