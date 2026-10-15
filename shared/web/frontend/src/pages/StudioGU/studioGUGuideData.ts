import type { CreativeStudioGuideStep } from '@/components/guided-tour/CreativeStudioGuideTourModal';

export type StudioGUGuideMode = 'dialog' | 'live' | 'transcription';

export const STUDIO_GU_GUIDE_ROOT_ID = 'studio-gu-guide-root';

export const STUDIO_GU_GUIDE_AUDIO_LS_KEY = 'studio-gu-guide-audio-enabled';

export const STUDIO_GU_GUIDE_TOUR_FOLDER = 'studio-gu-guide';

export function studioGUGuideAudioPath(stepId: string): string {
	return `${import.meta.env.BASE_URL}audio/studio-gu-guide/ru/${stepId}.wav`;
}

export function getStudioGUGuideSteps(
	mode: StudioGUGuideMode
): CreativeStudioGuideStep[] {
	switch (mode) {
		case 'dialog':
			return [
				{
					id: 'gu-dialog-intro',
					title: 'Диалог',
					body: 'Короткие реплики: запись, распознавание речи, ответ ассистента и озвучка. Режимы Студии ГУ переключаются кнопками в верхней полосе.',
					highlightSelector: null,
				},
				{
					id: 'gu-dialog-modes',
					title: 'Режимы',
					body: 'Диалог, штаб, Live Voice и транскрипция — разные сценарии. Сейчас вы в режиме «Диалог».',
					highlightSelector: '[data-studio-gu-guide="mode-rail"]',
				},
				{
					id: 'gu-dialog-settings',
					title: 'Настройки голоса',
					body: 'Раскройте настройки, чтобы выбрать голос синтеза речи для ответов.',
					highlightSelector: '[data-studio-gu-guide="dialog-settings"]',
				},
				{
					id: 'gu-dialog-stage',
					title: 'Запись',
					body: 'Центральная кнопка — старт и остановка записи. Пока идёт обработка цепочки, повторное нажатие может быть недоступно.',
					highlightSelector: '[data-studio-gu-guide="dialog-stage"]',
				},
				{
					id: 'gu-dialog-history',
					title: 'История',
					body: 'Ниже — реплики диалога: ваши фразы и ответы ассистента; при наличии можно воспроизвести прикреплённое аудио.',
					highlightSelector: '[data-studio-gu-guide="dialog-history"]',
				},
			];
		case 'live':
			return [
				{
					id: 'gu-live-intro',
					title: 'Live Voice',
					body: 'Потоковый сценарий и общая панель справа на рабочем столе. Здесь — статус и быстрый переход к панели.',
					highlightSelector: null,
				},
				{
					id: 'gu-live-modes',
					title: 'Режимы',
					body: 'Переключайте вкладки вверху, чтобы вернуться к диалогу, штабу или транскрипции.',
					highlightSelector: '[data-studio-gu-guide="mode-rail"]',
				},
				{
					id: 'gu-live-state',
					title: 'Состояние',
					body: 'Видно, активен ли Live Voice на рабочем столе и доступен ли сервис по сокету.',
					highlightSelector: '[data-studio-gu-guide="live-state-panel"]',
				},
				{
					id: 'gu-live-actions',
					title: 'Панель',
					body: 'Откройте панель Live Voice, чтобы управлять записью с плавающего виджета. Если включён режим голосовых команд, сначала отключите его на виджете.',
					highlightSelector: '[data-studio-gu-guide="live-actions"]',
				},
			];
		case 'transcription':
			return [
				{
					id: 'gu-tr-intro',
					title: 'Транскрипция',
					body: 'Длинные файлы: загрузка, при необходимости запись с микрофона, распознавание речи на сервере и экспорт текста.',
					highlightSelector: null,
				},
				{
					id: 'gu-tr-modes',
					title: 'Режимы',
					body: 'Переключение режимов — в верхней полосе. Здесь — только сценарий транскрипции.',
					highlightSelector: '[data-studio-gu-guide="mode-rail"]',
				},
				{
					id: 'gu-tr-toolbar',
					title: 'История и настройки',
					body: 'История заданий и языковые настройки — через кнопки справа вверху.',
					highlightSelector: '[data-studio-gu-guide="transcription-toolbar"]',
				},
				{
					id: 'gu-tr-upload',
					title: 'Файл',
					body: 'Перетащите аудио или видео в область загрузки либо выберите файл с диска.',
					highlightSelector: '[data-studio-gu-guide="transcription-upload"]',
				},
				{
					id: 'gu-tr-run',
					title: 'Запуск',
					body: 'После выбора файла нажмите транскрибацию. Прогресс и текст результата появятся в соседних колонках.',
					highlightSelector: '[data-studio-gu-guide="transcription-run"]',
				},
			];
		default:
			return [];
	}
}
