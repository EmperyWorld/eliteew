/**
 * ============================================
 * FILE: translations.ts
 * ============================================
 *
 * Translations for viewer components
 * English and Russian language support
 *
 * @version 1.0.0
 * @date 2025-10-24
 * @author UI Designer Agent
 */

export interface ViewerTranslations {
	// Toolbar
	toolbar: {
		zoomIn: string;
		zoomOut: string;
		fitPage: string;
		fitWidth: string;
		fitHeight: string;
		rotate: string;
		rotateLeft: string;
		rotateRight: string;
		download: string;
		share: string;
		print: string;
		fullscreen: string;
		exitFullscreen: string;
		previousPage: string;
		nextPage: string;
		page: string;
		of: string;
	};

	// Upload
	upload: {
		placeholder: string;
		dragHere: string;
		dropHere: string;
		clickToBrowse: string;
		maxSize: string;
		maxFiles: string;
		accepted: string;
		uploading: string;
		uploadFiles: string;
		uploadFailed: string;
		fileTooLarge: string;
		typeNotAccepted: string;
		maxFilesExceeded: string;
	};

	// File info
	file: {
		name: string;
		size: string;
		format: string;
		lastModified: string;
		editable: string;
		readOnly: string;
		today: string;
		yesterday: string;
		daysAgo: string;
	};

	// Actions
	actions: {
		select: string;
		deselect: string;
		selectAll: string;
		deselectAll: string;
		download: string;
		share: string;
		delete: string;
		preview: string;
		edit: string;
		remove: string;
		cancel: string;
		confirm: string;
		close: string;
		save: string;
		moreOptions: string;
	};

	// File types
	fileTypes: {
		document: string;
		spreadsheet: string;
		presentation: string;
		image: string;
		video: string;
		audio: string;
		code: string;
		archive: string;
		database: string;
		executable: string;
		unknown: string;
	};

	// Status
	status: {
		success: string;
		error: string;
		warning: string;
		info: string;
		pending: string;
		uploading: string;
		processing: string;
		completed: string;
		failed: string;
	};

	// Messages
	messages: {
		noFiles: string;
		noFilesSelected: string;
		filesSelected: string;
		uploadSuccess: string;
		uploadError: string;
		deleteConfirm: string;
		unsavedChanges: string;
	};
}

// ============================================================================
// ENGLISH TRANSLATIONS
// ============================================================================

export const en: ViewerTranslations = {
	toolbar: {
		zoomIn: 'Zoom in',
		zoomOut: 'Zoom out',
		fitPage: 'Fit page',
		fitWidth: 'Fit width',
		fitHeight: 'Fit height',
		rotate: 'Rotate',
		rotateLeft: 'Rotate counter-clockwise',
		rotateRight: 'Rotate clockwise',
		download: 'Download',
		share: 'Share',
		print: 'Print',
		fullscreen: 'Enter fullscreen',
		exitFullscreen: 'Exit fullscreen',
		previousPage: 'Previous page',
		nextPage: 'Next page',
		page: 'Page',
		of: 'of',
	},

	upload: {
		placeholder: 'Drag files here or click to browse',
		dragHere: 'Drag files here',
		dropHere: 'Drop files here',
		clickToBrowse: 'Click to browse',
		maxSize: 'Max size',
		maxFiles: 'Up to',
		accepted: 'Accepted',
		uploading: 'Uploading',
		uploadFiles: 'Upload files',
		uploadFailed: 'Upload failed',
		fileTooLarge: 'File too large',
		typeNotAccepted: 'File type not accepted',
		maxFilesExceeded: 'Maximum files exceeded',
	},

	file: {
		name: 'File name',
		size: 'Size',
		format: 'Format',
		lastModified: 'Last modified',
		editable: 'Editable',
		readOnly: 'Read-only',
		today: 'Today',
		yesterday: 'Yesterday',
		daysAgo: 'days ago',
	},

	actions: {
		select: 'Select',
		deselect: 'Deselect',
		selectAll: 'Select all',
		deselectAll: 'Deselect all',
		download: 'Download',
		share: 'Share',
		delete: 'Delete',
		preview: 'Preview',
		edit: 'Edit',
		remove: 'Remove',
		cancel: 'Cancel',
		confirm: 'Confirm',
		close: 'Close',
		save: 'Save',
		moreOptions: 'More options',
	},

	fileTypes: {
		document: 'Document',
		spreadsheet: 'Spreadsheet',
		presentation: 'Presentation',
		image: 'Image',
		video: 'Video',
		audio: 'Audio',
		code: 'Code',
		archive: 'Archive',
		database: 'Database',
		executable: 'Executable',
		unknown: 'Unknown',
	},

	status: {
		success: 'Success',
		error: 'Error',
		warning: 'Warning',
		info: 'Info',
		pending: 'Pending',
		uploading: 'Uploading',
		processing: 'Processing',
		completed: 'Completed',
		failed: 'Failed',
	},

	messages: {
		noFiles: 'No files found',
		noFilesSelected: 'No files selected',
		filesSelected: 'files selected',
		uploadSuccess: 'Files uploaded successfully',
		uploadError: 'Failed to upload files',
		deleteConfirm: 'Are you sure you want to delete this file?',
		unsavedChanges: 'You have unsaved changes. Do you want to continue?',
	},
};

// ============================================================================
// RUSSIAN TRANSLATIONS
// ============================================================================

export const ru: ViewerTranslations = {
	toolbar: {
		zoomIn: 'Увеличить',
		zoomOut: 'Уменьшить',
		fitPage: 'По размеру страницы',
		fitWidth: 'По ширине',
		fitHeight: 'По высоте',
		rotate: 'Повернуть',
		rotateLeft: 'Повернуть против часовой стрелки',
		rotateRight: 'Повернуть по часовой стрелке',
		download: 'Скачать',
		share: 'Поделиться',
		print: 'Печать',
		fullscreen: 'На весь экран',
		exitFullscreen: 'Выйти из полноэкранного режима',
		previousPage: 'Предыдущая страница',
		nextPage: 'Следующая страница',
		page: 'Страница',
		of: 'из',
	},

	upload: {
		placeholder: 'Перетащите файлы сюда или нажмите для выбора',
		dragHere: 'Перетащите файлы сюда',
		dropHere: 'Отпустите файлы здесь',
		clickToBrowse: 'Нажмите для выбора',
		maxSize: 'Макс. размер',
		maxFiles: 'До',
		accepted: 'Принимаются',
		uploading: 'Загрузка',
		uploadFiles: 'Загрузить файлы',
		uploadFailed: 'Ошибка загрузки',
		fileTooLarge: 'Файл слишком большой',
		typeNotAccepted: 'Тип файла не поддерживается',
		maxFilesExceeded: 'Превышено максимальное количество файлов',
	},

	file: {
		name: 'Имя файла',
		size: 'Размер',
		format: 'Формат',
		lastModified: 'Изменён',
		editable: 'Редактируемый',
		readOnly: 'Только для чтения',
		today: 'Сегодня',
		yesterday: 'Вчера',
		daysAgo: 'дней назад',
	},

	actions: {
		select: 'Выбрать',
		deselect: 'Отменить выбор',
		selectAll: 'Выбрать все',
		deselectAll: 'Отменить выбор всех',
		download: 'Скачать',
		share: 'Поделиться',
		delete: 'Удалить',
		preview: 'Предпросмотр',
		edit: 'Редактировать',
		remove: 'Удалить',
		cancel: 'Отмена',
		confirm: 'Подтвердить',
		close: 'Закрыть',
		save: 'Сохранить',
		moreOptions: 'Ещё',
	},

	fileTypes: {
		document: 'Документ',
		spreadsheet: 'Таблица',
		presentation: 'Презентация',
		image: 'Изображение',
		video: 'Видео',
		audio: 'Аудио',
		code: 'Код',
		archive: 'Архив',
		database: 'База данных',
		executable: 'Исполняемый файл',
		unknown: 'Неизвестный',
	},

	status: {
		success: 'Успешно',
		error: 'Ошибка',
		warning: 'Предупреждение',
		info: 'Информация',
		pending: 'Ожидание',
		uploading: 'Загрузка',
		processing: 'Обработка',
		completed: 'Завершено',
		failed: 'Не удалось',
	},

	messages: {
		noFiles: 'Файлы не найдены',
		noFilesSelected: 'Файлы не выбраны',
		filesSelected: 'файлов выбрано',
		uploadSuccess: 'Файлы успешно загружены',
		uploadError: 'Не удалось загрузить файлы',
		deleteConfirm: 'Вы уверены, что хотите удалить этот файл?',
		unsavedChanges: 'У вас есть несохранённые изменения. Продолжить?',
	},
};

// ============================================================================
// TRANSLATION HOOK
// ============================================================================

/**
 * Get translations for current language
 * @param lang - Language code ('en' | 'ru')
 * @returns Translations object
 */
export const getViewerTranslations = (
	lang: 'en' | 'ru' = 'en'
): ViewerTranslations => {
	return lang === 'ru' ? ru : en;
};

// Default export
export const viewerTranslations = {
	en,
	ru,
	getViewerTranslations,
};

export default viewerTranslations;
