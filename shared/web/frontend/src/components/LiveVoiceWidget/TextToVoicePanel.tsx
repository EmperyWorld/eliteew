/**
 * TextToVoicePanel - Панель для текстового ввода и голосового ответа
 *
 * Позволяет пользователю ввести текст, получить AI ответ и воспроизвести его голосом
 */

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTextToVoice } from './hooks/useTextToVoice';
import { VoiceSettings } from './VoiceSettings';
import { log } from '../../utils/logger';
import { DEFAULT_LLAMA_MODEL } from '../../config';
import type { VoiceSettings as CoreVoiceSettings } from '../../voice-core';
import {
	VOICE_SETTINGS_CHANGED_EVENT,
	VOICE_SETTINGS_STORAGE_KEY,
} from '../../voice-core';
import { registerTtsPlaying } from '../../voice-core/micActive';
import { resolveAudioUrlForPlayback } from '../../voice-core/utils/resolveAudioUrlForPlayback';
import {
	ArrowPathIcon,
	PaperAirplaneIcon,
	SpeakerWaveIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

interface TextToVoicePanelProps {
	onClose?: () => void;
}

export const TextToVoicePanel: React.FC<TextToVoicePanelProps> = ({
	onClose,
}) => {
	const [text, setText] = useState('');
	const [showSettings, setShowSettings] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const { isProcessing, error, response, processText, reset } =
		useTextToVoice();

	// Загружаем настройки из localStorage
	interface SavedSettings {
		llamaModel?: string;
		voice?: string;
		language?: string;
		speed?: number;
		volume?: number;
	}

	const [settings, setSettings] = useState(() => {
		try {
			const saved = localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved) as SavedSettings;
				return {
					llama_model:
						typeof parsed.llamaModel === 'string'
							? parsed.llamaModel
							: DEFAULT_LLAMA_MODEL,
					tts_voice: typeof parsed.voice === 'string' ? parsed.voice : 'xenia',
					language:
						typeof parsed.language === 'string' ? parsed.language : 'ru',
					speed: typeof parsed.speed === 'number' ? parsed.speed : 1.0,
					volume: typeof parsed.volume === 'number' ? parsed.volume : 1.0,
					temperature: 0.7,
					max_tokens: 500,
				};
			}
		} catch (e) {
			const err = e instanceof Error ? e : new Error(String(e));
			log.warn('TextToVoicePanel', 'Failed to load settings', err);
		}
		return {
			llama_model: DEFAULT_LLAMA_MODEL,
			tts_voice: 'xenia',
			language: 'ru',
			speed: 1.0,
			volume: 1.0,
			temperature: 0.7,
			max_tokens: 500,
		};
	});

	const handleSubmit = async (e: React.FormEvent): Promise<void> => {
		e.preventDefault();
		if (!text.trim() || isProcessing) {
			return;
		}

		await processText(text, settings);
	};

	// Воспроизведение аудио
	useEffect(() => {
		if (!response?.audio_url) {
			return (): void => {
				if (audioRef.current) {
					audioRef.current.pause();
					audioRef.current = null;
				}
			};
		}

		const audioUrl =
			typeof response.audio_url === 'string' ? response.audio_url : '';
		if (!audioUrl) {
			return (): void => {
				if (audioRef.current) {
					audioRef.current.pause();
					audioRef.current = null;
				}
			};
		}

		let cancelled = false;
		let revokeBlob: (() => void) | undefined;

		void (async (): Promise<void> => {
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current = null;
			}

			try {
				const { playUrl, revoke } = await resolveAudioUrlForPlayback(audioUrl);
				if (cancelled) {
					revoke();
					return;
				}
				revokeBlob = revoke;

				const unregisterTts = registerTtsPlaying();
				const audio = new Audio(playUrl);
				audioRef.current = audio;

				audio.addEventListener('ended', () => {
					revokeBlob?.();
					revokeBlob = undefined;
					unregisterTts();
					audioRef.current = null;
				});

				audio.addEventListener('error', (err) => {
					revokeBlob?.();
					revokeBlob = undefined;
					unregisterTts();
					const error =
						err instanceof Error ? err : new Error('Audio playback error');
					log.error('TextToVoicePanel', '❌ Audio playback error', error);
					audioRef.current = null;
				});

				try {
					await audio.play();
				} catch (err: unknown) {
					revokeBlob?.();
					revokeBlob = undefined;
					unregisterTts();
					const error = err instanceof Error ? err : new Error(String(err));
					log.error('TextToVoicePanel', '❌ Failed to play audio', error);
					audioRef.current = null;
				}
			} catch (err: unknown) {
				const error = err instanceof Error ? err : new Error(String(err));
				log.error('TextToVoicePanel', '❌ Failed to resolve audio URL', error);
			}
		})();

		return (): void => {
			cancelled = true;
			revokeBlob?.();
			revokeBlob = undefined;
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current = null;
			}
		};
	}, [response?.audio_url]);

	// Event-driven settings sync: voice-core broadcast + storage event (no polling)
	useEffect(() => {
		const applySettings = (s: {
			llama_model?: string;
			tts_voice?: string;
			language?: string;
			speed?: number;
			volume?: number;
		}): void => {
			setSettings((prev) => ({
				...prev,
				llama_model: s.llama_model ?? prev.llama_model,
				tts_voice: s.tts_voice ?? prev.tts_voice,
				language: s.language ?? prev.language,
				speed: s.speed ?? prev.speed,
				volume: s.volume ?? prev.volume,
			}));
		};

		const updateFromStorage = (): void => {
			try {
				const saved = localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
				if (saved) {
					const parsed = JSON.parse(saved) as SavedSettings;
					applySettings({
						llama_model:
							typeof parsed.llamaModel === 'string'
								? parsed.llamaModel
								: DEFAULT_LLAMA_MODEL,
						tts_voice:
							typeof parsed.voice === 'string' ? parsed.voice : 'xenia',
						language:
							typeof parsed.language === 'string' ? parsed.language : 'ru',
						speed: typeof parsed.speed === 'number' ? parsed.speed : 1.0,
						volume: typeof parsed.volume === 'number' ? parsed.volume : 1.0,
					});
				}
			} catch (e) {
				const err = e instanceof Error ? e : new Error(String(e));
				log.warn('TextToVoicePanel', 'Failed to update settings', err);
			}
		};

		const handleSettingsChanged = (e: Event): void => {
			const detail = (e as CustomEvent<{ settings: CoreVoiceSettings }>).detail;
			if (detail?.settings) {
				applySettings({
					llama_model: detail.settings.llamaModel,
					tts_voice: detail.settings.voice,
					language: detail.settings.language,
					speed: detail.settings.speed,
					volume: detail.settings.volume,
				});
			}
		};

		updateFromStorage();
		window.addEventListener(
			VOICE_SETTINGS_CHANGED_EVENT,
			handleSettingsChanged
		);
		window.addEventListener('storage', (e: StorageEvent) => {
			if (e.key === VOICE_SETTINGS_STORAGE_KEY) updateFromStorage();
		});

		return (): void => {
			window.removeEventListener(
				VOICE_SETTINGS_CHANGED_EVENT,
				handleSettingsChanged
			);
		};
	}, []);

	return (
		<div className="space-y-4">
			{/* Заголовок */}
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold text-white">Текст → Голос</h3>
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						className="text-gray-400 hover:text-white transition-colors"
						aria-label="Закрыть панель"
					>
						<XMarkIcon width={18} height={18} />
					</button>
				)}
			</div>

			{/* Форма ввода */}
			<form onSubmit={handleSubmit} className="space-y-3">
				<div className="relative">
					<textarea
						value={text}
						onChange={(e) => setText(e.target.value)}
						placeholder="Введите ваш вопрос или сообщение..."
						className="
              w-full min-h-[120px] p-4
              bg-white/5 border border-white/10 rounded-lg
              text-white placeholder-gray-400
              focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400
              resize-none
              transition-all duration-200
            "
						disabled={isProcessing}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
								handleSubmit(e);
							}
						}}
					/>
					<div className="absolute bottom-2 right-2 text-xs text-gray-500">
						{text.length} символов
					</div>
				</div>

				{/* Кнопки */}
				<div className="flex items-center gap-2">
					<button
						type="submit"
						disabled={!text.trim() || isProcessing}
						className="
              flex-1 flex items-center justify-center gap-2 px-4 py-2.5
              bg-gradient-to-r from-indigo-500 to-purple-600
              hover:from-indigo-600 hover:to-purple-700
              disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed
              text-white font-medium rounded-lg
              transition-all duration-200
              shadow-lg hover:shadow-xl
            "
					>
						{isProcessing ? (
							<>
								<ArrowPathIcon
									width={18}
									height={18}
									className="animate-spin"
								/>
								<span>Обработка...</span>
							</>
						) : (
							<>
								<PaperAirplaneIcon width={18} height={18} />
								<span>Отправить</span>
							</>
						)}
					</button>

					<button
						type="button"
						onClick={() => setShowSettings(!showSettings)}
						className="
              px-4 py-2.5
              bg-white/5 hover:bg-white/10
              border border-white/10 hover:border-white/20
              text-gray-300 hover:text-white
              rounded-lg
              transition-all duration-200
            "
					>
						Настройки
					</button>
				</div>

				<div className="text-xs text-gray-500 text-center">
					Cmd/Ctrl + Enter для отправки
				</div>
			</form>

			{/* Настройки */}
			{showSettings && (
				<motion.div
					initial={{ opacity: 0, height: 0 }}
					animate={{ opacity: 1, height: 'auto' }}
					exit={{ opacity: 0, height: 0 }}
					className="overflow-hidden"
				>
					<div className="p-4 bg-white/5 border border-white/10 rounded-lg">
						<VoiceSettings />
						<div className="mt-3 text-xs text-gray-400">
							Настройки автоматически применяются при следующей отправке
						</div>
					</div>
				</motion.div>
			)}

			{/* Ошибка */}
			{error && (
				<div className="p-3 bg-red-500/20 border border-red-500/40 rounded-lg">
					<p className="text-sm text-red-400">{error.message}</p>
					<button
						type="button"
						onClick={reset}
						className="mt-2 text-xs text-red-300 hover:text-red-200"
					>
						Сбросить
					</button>
				</div>
			)}

			{/* Ответ AI */}
			{response && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					className="space-y-3"
				>
					{/* Текст ответа */}
					<div className="p-4 bg-white/5 border border-white/10 rounded-lg">
						<div className="text-xs text-gray-400 mb-2">Ответ AI:</div>
						<div className="text-sm text-white whitespace-pre-wrap">
							{response.ai_response}
						</div>
					</div>

					{/* Статистика */}
					<div className="flex items-center justify-between text-xs text-gray-400">
						<div className="flex items-center gap-4">
							<span>LLM: {response.stages.llm?.duration_ms || 0}ms</span>
							<span>TTS: {response.stages.tts?.duration_ms || 0}ms</span>
							<span>Всего: {response.duration_ms}ms</span>
						</div>
						<div className="flex items-center gap-2">
							<SpeakerWaveIcon width={14} height={14} />
							<span>
								{response.voice} ({response.language})
							</span>
						</div>
					</div>

					{/* Кнопка повторного воспроизведения */}
					{response.audio_url && (
						<button
							type="button"
							onClick={(): void => {
								void (async (): Promise<void> => {
									if (audioRef.current) {
										audioRef.current.pause();
										audioRef.current.currentTime = 0;
									}
									const url =
										typeof response.audio_url === 'string'
											? response.audio_url
											: '';
									if (!url) {
										return;
									}
									try {
										const { playUrl, revoke } =
											await resolveAudioUrlForPlayback(url);
										const audio = new Audio(playUrl);
										audioRef.current = audio;
										audio.onended = () => revoke();
										audio.onerror = () => revoke();
										try {
											await audio.play();
										} catch (err: unknown) {
											revoke();
											const error =
												err instanceof Error ? err : new Error(String(err));
											log.error(
												'TextToVoicePanel',
												'❌ Failed to replay audio',
												error
											);
										}
									} catch (err: unknown) {
										const error =
											err instanceof Error ? err : new Error(String(err));
										log.error(
											'TextToVoicePanel',
											'❌ Failed to resolve replay URL',
											error
										);
									}
								})();
							}}
							className="
                w-full flex items-center justify-center gap-2 px-4 py-2
                bg-indigo-500/20 hover:bg-indigo-500/30
                border border-indigo-500/40
                text-indigo-300 hover:text-indigo-200
                rounded-lg
                transition-all duration-200
              "
						>
							<SpeakerWaveIcon width={16} height={16} />
							<span>Воспроизвести снова</span>
						</button>
					)}
				</motion.div>
			)}
		</div>
	);
};
