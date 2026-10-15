/**
 * 🎤 useVoiceCommands - Hook для обработки голосовых команд
 *
 * Распознает голосовые команды из транскрипций и вызывает соответствующие действия
 *
 * Поддерживаемые команды:
 * - Навигация: "следующий слайд", "предыдущий слайд", "первый слайд", "последний слайд"
 * - Управление: "пауза", "продолжить", "стоп", "выход"
 * - Таймер: "старт таймер", "стоп таймер", "сброс таймера"
 */

import { useEffect, useCallback, useRef } from 'react';

export type VoiceCommand =
	| 'next_slide'
	| 'prev_slide'
	| 'first_slide'
	| 'last_slide'
	| 'go_to_slide'
	| 'pause'
	| 'resume'
	| 'stop'
	| 'exit'
	| 'start_timer'
	| 'stop_timer'
	| 'reset_timer'
	| 'toggle_notes'
	| 'toggle_fullscreen'
	| 'toggle_thumbnails'
	| 'unknown';

export interface VoiceCommandResult {
	command: VoiceCommand;
	slideNumber?: number;
	confidence: number;
}

interface UseVoiceCommandsOptions {
	onCommand?: (result: VoiceCommandResult) => void;
	enabled?: boolean;
	language?: 'ru' | 'en';
}

// Паттерны для распознавания команд (RU и EN)
const COMMAND_PATTERNS: Record<VoiceCommand, { ru: RegExp[]; en: RegExp[] }> = {
	next_slide: {
		ru: [
			/следующий\s+слайд/i,
			/дальше/i,
			/вперёд/i,
			/вперед/i,
			/next/i,
			/далее/i,
			/следующ/i,
		],
		en: [/next\s+slide/i, /next/i, /forward/i, /continue/i],
	},
	prev_slide: {
		ru: [
			/предыдущий\s+слайд/i,
			/назад/i,
			/вернуться/i,
			/previous/i,
			/предыдущ/i,
		],
		en: [/previous\s+slide/i, /prev/i, /back/i, /go\s+back/i],
	},
	first_slide: {
		ru: [/первый\s+слайд/i, /в\s+начало/i, /начало/i, /first/i],
		en: [/first\s+slide/i, /beginning/i, /start/i],
	},
	last_slide: {
		ru: [/последний\s+слайд/i, /в\s+конец/i, /конец/i, /last/i],
		en: [/last\s+slide/i, /end/i, /final/i],
	},
	go_to_slide: {
		ru: [
			/перейти\s+к\s+слайду\s+(\d+)/i,
			/слайд\s+(\d+)/i,
			/на\s+слайд\s+(\d+)/i,
			/go\s+to\s+(\d+)/i,
		],
		en: [/go\s+to\s+slide\s+(\d+)/i, /slide\s+(\d+)/i, /show\s+slide\s+(\d+)/i],
	},
	pause: {
		ru: [/пауза/i, /приостановить/i, /pause/i],
		en: [/pause/i, /stop/i],
	},
	resume: {
		ru: [/продолжить/i, /возобновить/i, /resume/i, /continue/i],
		en: [/resume/i, /continue/i, /play/i],
	},
	stop: {
		ru: [/стоп/i, /остановить/i, /stop/i],
		en: [/stop/i, /halt/i],
	},
	exit: {
		ru: [/выход/i, /закрыть/i, /exit/i, /close/i],
		en: [/exit/i, /close/i, /quit/i],
	},
	start_timer: {
		ru: [
			/старт\s+таймер/i,
			/запустить\s+таймер/i,
			/начать\s+таймер/i,
			/start\s+timer/i,
		],
		en: [/start\s+timer/i, /begin\s+timer/i],
	},
	stop_timer: {
		ru: [/стоп\s+таймер/i, /остановить\s+таймер/i, /stop\s+timer/i],
		en: [/stop\s+timer/i, /pause\s+timer/i],
	},
	reset_timer: {
		ru: [/сброс\s+таймера/i, /сбросить\s+таймер/i, /reset\s+timer/i],
		en: [/reset\s+timer/i, /clear\s+timer/i],
	},
	toggle_notes: {
		ru: [/показать\s+заметки/i, /скрыть\s+заметки/i, /заметки/i, /notes/i],
		en: [/show\s+notes/i, /hide\s+notes/i, /toggle\s+notes/i, /notes/i],
	},
	toggle_fullscreen: {
		ru: [/полный\s+экран/i, /fullscreen/i, /на\s+весь\s+экран/i],
		en: [/fullscreen/i, /full\s+screen/i],
	},
	toggle_thumbnails: {
		ru: [/миниатюры/i, /thumbnails/i, /слайды/i],
		en: [/thumbnails/i, /slides/i, /overview/i],
	},
	unknown: {
		ru: [],
		en: [],
	},
};

/**
 * Распознает голосовую команду из текста транскрипции
 */
export const recognizeVoiceCommand = (
	text: string,
	language: 'ru' | 'en' = 'ru'
): VoiceCommandResult => {
	const normalizedText = text.trim().toLowerCase();

	// Проверяем каждую команду
	for (const [command, patterns] of Object.entries(COMMAND_PATTERNS)) {
		if (command === 'unknown') {
			continue;
		}

		const langPatterns = patterns[language];

		for (const pattern of langPatterns) {
			const match = normalizedText.match(pattern);
			if (match) {
				// Для go_to_slide извлекаем номер слайда
				if (command === 'go_to_slide' && match[1]) {
					const slideNumber = parseInt(match[1], 10);
					if (!Number.isNaN(slideNumber) && slideNumber > 0) {
						return {
							command: command as VoiceCommand,
							slideNumber,
							confidence: 0.9,
						};
					}
				} else {
					return {
						command: command as VoiceCommand,
						confidence: 0.9,
					};
				}
			}
		}
	}

	return {
		command: 'unknown',
		confidence: 0,
	};
};

/**
 * Hook для обработки голосовых команд из LiveVoiceWidget
 */
export const useVoiceCommands = (
	options: UseVoiceCommandsOptions = {}
): {
	processText: (text: string) => VoiceCommandResult;
	recognizeCommand: (text: string) => VoiceCommandResult;
} => {
	const { onCommand, enabled = true, language = 'ru' } = options;
	const commandHandlerRef = useRef<
		((result: VoiceCommandResult) => void) | null
	>(null);

	// Сохраняем обработчик команды
	useEffect(() => {
		commandHandlerRef.current = onCommand || null;
	}, [onCommand]);

	// Слушаем глобальные события голосовых команд
	useEffect(() => {
		if (!enabled) {
			return;
		}

		const handleVoiceTranscription = (event: CustomEvent<string>) => {
			const transcription = event.detail;
			if (!transcription) {
				return;
			}

			const result = recognizeVoiceCommand(transcription, language);

			if (result.command !== 'unknown' && commandHandlerRef.current) {
				commandHandlerRef.current(result);
			}
		};

		// Слушаем события от LiveVoiceWidget
		window.addEventListener(
			'voice-transcription',
			handleVoiceTranscription as EventListener
		);

		return () => {
			window.removeEventListener(
				'voice-transcription',
				handleVoiceTranscription as EventListener
			);
		};
	}, [enabled, language]);

	// Функция для ручной обработки текста (можно использовать напрямую)
	const processText = useCallback(
		(text: string): VoiceCommandResult => {
			return recognizeVoiceCommand(text, language);
		},
		[language]
	);

	return {
		processText,
		recognizeCommand: processText,
	};
};

/**
 * Утилита для отправки транскрипции в систему обработки команд
 * Используется в LiveVoiceWidget для отправки транскрипций
 */
export const emitVoiceTranscription = (text: string): void => {
	const event = new CustomEvent('voice-transcription', {
		detail: text,
		bubbles: true,
	});
	window.dispatchEvent(event);
};
