import { AudioTranscriptionPage } from '../modules/audio-transcription';

/**
 * Маршрут страницы транскрибации аудио.
 * Сейчас рендерит полноэкранный layout внутри AudioTranscriptionPage.
 * При появлении общего AppLayout (сайдбар/хедер) можно обернуть: <AppLayout><AudioTranscriptionPage /></AppLayout>.
 */
export default function AudioTranscriptionNewRoute() {
	return <AudioTranscriptionPage />;
}
