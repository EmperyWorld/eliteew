import { useState, useCallback } from 'react';
import { transcribeAudio } from '../lib/audioTranscription.api';
import type {
	TranscriptionOptions,
	TranscriptionResponse,
	UseAudioTranscriptionResult,
} from '../lib/audioTranscription.types';

export function useAudioTranscription(): UseAudioTranscriptionResult {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<TranscriptionResponse | null>(null);

	const transcribe = useCallback(
		async (file: File, options?: TranscriptionOptions): Promise<void> => {
			setLoading(true);
			setError(null);
			setResult(null);

			try {
				const transcription = await transcribeAudio(file, options ?? {});
				setResult(transcription);
			} catch (err) {
				const message =
					err instanceof Error ? err.message : 'Неизвестная ошибка';
				setError(message);
			} finally {
				setLoading(false);
			}
		},
		[]
	);

	return {
		transcribe,
		loading,
		error,
		result,
	};
}
