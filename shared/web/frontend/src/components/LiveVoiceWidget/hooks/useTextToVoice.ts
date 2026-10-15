/**
 * useTextToVoice - Hook для работы с text-to-voice API (unified voice-core client).
 *
 * Обрабатывает текстовый ввод, получает AI ответ и голосовой синтез (stack9 silero).
 */

import { useState, useCallback } from 'react';
import { processTextToVoice } from '../../../voice-core';
import type {
	TextToVoiceResponse,
	TextToVoiceSettings,
} from '../../../voice-core';
import { log } from '../../../utils/logger';

export type { TextToVoiceResponse, TextToVoiceSettings };

export interface UseTextToVoiceReturn {
	isProcessing: boolean;
	error: Error | null;
	response: TextToVoiceResponse | null;
	processText: (text: string, settings?: TextToVoiceSettings) => Promise<void>;
	reset: () => void;
}

export const useTextToVoice = (): UseTextToVoiceReturn => {
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [response, setResponse] = useState<TextToVoiceResponse | null>(null);

	const processText = useCallback(
		async (text: string, settings?: TextToVoiceSettings) => {
			if (!text.trim()) {
				setError(new Error('Текст не может быть пустым'));
				return;
			}

			setIsProcessing(true);
			setError(null);
			setResponse(null);

			try {
				const result = await processTextToVoice(text, settings);
				setResponse(result);
			} catch (err: unknown) {
				const error =
					err instanceof Error ? err : new Error('Ошибка обработки текста');
				setError(error);
				const errorForLog = err instanceof Error ? err : new Error(String(err));
				log.error('useTextToVoice', '❌ Text-to-Voice error', errorForLog);
			} finally {
				setIsProcessing(false);
			}
		},
		[]
	);

	const reset = useCallback(() => {
		setError(null);
		setResponse(null);
		setIsProcessing(false);
	}, []);

	return {
		isProcessing,
		error,
		response,
		processText,
		reset,
	};
};
