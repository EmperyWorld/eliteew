/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * State, refs, effects, and handlers for VoiceTranscriptionPanel (record/STT/TTS/upload/play/insert).
 *
 * Invariants:
 * - Log scope 'VoiceTranscriptionPanel'; registerMicActive/registerTtsPlaying/resolveAudioUrlForPlayback unchanged.
 * - Playback blob revoke after TTS play; mic unregister on stop.
 *
 * Related:
 * - VoiceTranscriptionPanel.tsx, voice-core synthesize/transcribe
 */

import { useNotifications } from '@/notifications';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../../../../services/api';
import { log, logUxError } from '../../../../utils/logger';
import {
	synthesize as synthesizeTts,
	transcribe as transcribeStt,
} from '../../../../voice-core';
import {
	registerMicActive,
	registerTtsPlaying,
} from '../../../../voice-core/micActive';
import { resolveAudioUrlForPlayback } from '../../../../voice-core/utils/resolveAudioUrlForPlayback';
import type { VoiceTranscriptionPanelProps } from '../../types/editor.types';
import { buildTtsEmbedHtml } from './buildTtsEmbedHtml';
import {
	MAX_AUDIO_FILE_BYTES,
	MAX_AUDIO_FILE_MB,
} from './voiceTranscriptionConstants';
import { voiceUserMessage } from './voiceTranscriptionErrorMappers';
import type {
	Language,
	LanguageOption,
	ProcessingMode,
	SynthesizedAudio,
	VoiceModelOption,
	VoiceRecording,
} from './voiceTranscriptionTypes';

export interface VoiceTranscriptionPanelVm {
	t: TFunction<'docEditorPanels'>;
	mode: ProcessingMode;
	setMode: (mode: ProcessingMode) => void;
	isRecording: boolean;
	isProcessing: boolean;
	audioLevel: number;
	currentRecording: VoiceRecording | null;
	recordings: VoiceRecording[];
	synthesizedAudios: SynthesizedAudio[];
	selectedLanguage: Language;
	setSelectedLanguage: (lang: Language) => void;
	selectedVoice: string;
	setSelectedVoice: (voice: string) => void;
	inputText: string;
	setInputText: (text: string) => void;
	languages: LanguageOption[];
	voiceModels: VoiceModelOption[];
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	startRecording: () => Promise<void>;
	stopRecording: () => void;
	transcribeAudio: (recording: VoiceRecording) => Promise<void>;
	synthesizeSpeech: () => Promise<void>;
	handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
	playAudio: (audioUrl: string) => Promise<void>;
	insertTranscription: (transcription: string) => void;
	insertAudioElement: (audio: SynthesizedAudio) => void;
}

export function useVoiceTranscriptionPanel(
	props: VoiceTranscriptionPanelProps
): VoiceTranscriptionPanelVm {
	const { isOpen, onInsertTranscription, onInsertAudio } = props;
	const { t } = useTranslation('docEditorPanels');
	const [mode, setMode] = useState<ProcessingMode>('record');
	const [isRecording, setIsRecording] = useState(false);
	const [currentRecording, setCurrentRecording] =
		useState<VoiceRecording | null>(null);
	const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
	const [synthesizedAudios, setSynthesizedAudios] = useState<
		SynthesizedAudio[]
	>([]);
	const [selectedLanguage, setSelectedLanguage] = useState<Language>('ru');
	const [selectedVoice, setSelectedVoice] = useState('default');
	const [inputText, setInputText] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [audioLevel, setAudioLevel] = useState(0);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const animationFrameRef = useRef<number | undefined>(undefined);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const unregisterMicRef = useRef<(() => void) | null>(null);

	const { success, error: showError } = useNotifications();

	const voiceModels: VoiceModelOption[] = useMemo(
		() => [
			{
				id: 'silero',
				name: 'UGS',
				description: t('voice.models.sileroDescription'),
				gpu: false,
			},
		],
		[t]
	);

	const languages: LanguageOption[] = useMemo(
		() => [
			{ code: 'ru', name: t('voice.languages.ru'), flag: '🇷🇺' },
			{ code: 'en', name: t('voice.languages.en'), flag: '🇺🇸' },
			{ code: 'es', name: t('voice.languages.es'), flag: '🇪🇸' },
			{ code: 'fr', name: t('voice.languages.fr'), flag: '🇫🇷' },
			{ code: 'de', name: t('voice.languages.de'), flag: '🇩🇪' },
		],
		[t]
	);

	useEffect(() => {
		const initAudioContext = async (): Promise<void> => {
			try {
				interface WindowWithWebkitAudioContext extends Window {
					webkitAudioContext?: typeof AudioContext;
				}
				const windowWithWebkit = window as WindowWithWebkitAudioContext;
				audioContextRef.current = new (
					window.AudioContext ||
					windowWithWebkit.webkitAudioContext ||
					AudioContext
				)();
				analyserRef.current = audioContextRef.current.createAnalyser();
				analyserRef.current.fftSize = 256;
			} catch (error: unknown) {
				log.error(
					'VoiceTranscriptionPanel',
					'Failed to initialize audio context',
					error instanceof Error ? error : undefined,
					error instanceof Error ? undefined : { detail: String(error) }
				);
			}
		};

		if (isOpen) {
			void initAudioContext();
		}

		return (): void => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
			if (
				audioContextRef.current &&
				audioContextRef.current.state !== 'closed'
			) {
				audioContextRef.current.close().catch(() => {
					// Ignore errors if already closed
				});
			}
		};
	}, [isOpen]);

	const monitorAudioLevel = useCallback((): void => {
		if (!analyserRef.current || !isRecording) {
			return;
		}

		const bufferLength = analyserRef.current.frequencyBinCount;
		const dataArray = new Uint8Array(bufferLength);

		const updateLevel = (): void => {
			if (analyserRef.current) {
				analyserRef.current.getByteFrequencyData(dataArray);
			}
			const average = dataArray.reduce((a, b) => a + b) / bufferLength;
			setAudioLevel(average / 255);

			if (isRecording) {
				animationFrameRef.current = requestAnimationFrame(updateLevel);
			}
		};

		updateLevel();
	}, [isRecording]);

	useEffect(() => {
		if (isRecording) {
			monitorAudioLevel();
		} else {
			setAudioLevel(0);
		}
	}, [isRecording, monitorAudioLevel]);

	const startRecording = useCallback(async (): Promise<void> => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					sampleRate: 44100,
					channelCount: 1,
				},
			});

			if (audioContextRef.current && analyserRef.current) {
				const source = audioContextRef.current.createMediaStreamSource(stream);
				source.connect(analyserRef.current);
			}

			mediaRecorderRef.current = new MediaRecorder(stream, {
				mimeType: 'audio/webm;codecs=opus',
			});

			audioChunksRef.current = [];

			mediaRecorderRef.current.ondataavailable = (event: BlobEvent): void => {
				if (event.data.size > 0) {
					audioChunksRef.current.push(event.data);
				}
			};

			mediaRecorderRef.current.onstop = (): void => {
				unregisterMicRef.current?.();
				unregisterMicRef.current = null;
				const audioBlob = new Blob(audioChunksRef.current, {
					type: 'audio/webm',
				});
				const recording: VoiceRecording = {
					id: Date.now().toString(),
					blob: audioBlob,
					duration: 0,
					timestamp: new Date(),
				};

				setCurrentRecording(recording);
				setRecordings((prev) => [recording, ...prev]);

				stream.getTracks().forEach((track) => {
					track.stop();
				});

				success(t('voice.toasts.recordingCompleted'));
			};

			mediaRecorderRef.current.start();
			unregisterMicRef.current = registerMicActive();
			setIsRecording(true);
			success(t('voice.toasts.recordingStarted'));
		} catch (error: unknown) {
			log.error(
				'VoiceTranscriptionPanel',
				'Failed to start recording',
				error instanceof Error ? error : undefined,
				error instanceof Error ? undefined : { detail: String(error) }
			);
			showError(voiceUserMessage(error, t));
		}
	}, [success, showError, t]);

	const stopRecording = useCallback((): void => {
		unregisterMicRef.current?.();
		unregisterMicRef.current = null;
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
		}
	}, [isRecording]);

	const transcribeAudio = useCallback(
		async (recording: VoiceRecording): Promise<void> => {
			setIsProcessing(true);
			try {
				const file = new File([recording.blob], 'recording.webm', {
					type: recording.blob.type || 'audio/webm',
				});
				const result = await transcribeStt(file, {
					language:
						selectedLanguage === 'ru'
							? 'ru'
							: selectedLanguage === 'en'
								? 'en'
								: undefined,
				});
				const transcriptionText = result.text ?? '';

				if (!transcriptionText.trim()) {
					log.error(
						'VoiceTranscriptionPanel',
						'Transcription empty',
						undefined,
						{ text: result.text }
					);
					throw new Error('No transcription text received.');
				}

				const updatedRecording = {
					...recording,
					transcription: transcriptionText,
				};
				setCurrentRecording(updatedRecording);
				setRecordings((prev) =>
					prev.map((r) => (r.id === recording.id ? updatedRecording : r))
				);

				try {
					const transcriptionBlob = new Blob([transcriptionText], {
						type: 'text/plain',
					});
					const transcriptionFile = new File(
						[transcriptionBlob],
						`transcription_${recording.timestamp.toISOString().replace(/[:.]/g, '-')}.txt`,
						{ type: 'text/plain' }
					);

					const formData = new FormData();
					formData.append('file', transcriptionFile);

					const params = new URLSearchParams({
						name: `Transcription ${recording.timestamp.toLocaleString()}`,
						description: `Audio transcription (${selectedLanguage})`,
						tags: 'transcription,audio,stt',
						content_type: 'ai_result',
						visibility: 'private',
						source_service: 'voice_studio',
					});

					const saveResponse = await apiClient.post(
						`/api/v1/content?${params.toString()}`,
						formData,
						{
							headers: {
								'Content-Type': 'multipart/form-data',
							},
						}
					);

					if (saveResponse.status === 201) {
						const savedContent = saveResponse.data as { id: string };
						log.info(
							'VoiceTranscriptionPanel',
							'Transcription saved to Unified Content',
							{ contentId: savedContent.id }
						);
					} else {
						log.warn(
							'VoiceTranscriptionPanel',
							'Failed to save transcription to Unified Content',
							{
								status: saveResponse.status,
								statusText: saveResponse.statusText,
							}
						);
					}
				} catch {
					log.warn(
						'VoiceTranscriptionPanel',
						'Error saving transcription to Unified Content'
					);
				}

				success(t('voice.toasts.transcriptionCompleted'));
			} catch (error: unknown) {
				const err = error instanceof Error ? error : undefined;
				logUxError('VoiceTranscriptionPanel', 'voice', 'transcription', err, {
					message: err?.message,
				});
				log.error(
					'VoiceTranscriptionPanel',
					'Transcription failed',
					error instanceof Error ? error : undefined,
					error instanceof Error ? undefined : { detail: String(error) }
				);
				showError(voiceUserMessage(error, t));
			} finally {
				setIsProcessing(false);
			}
		},
		[selectedLanguage, success, showError, t]
	);

	const synthesizeSpeech = useCallback(async (): Promise<void> => {
		if (!inputText.trim()) {
			showError(t('voice.errors.synthNeedsText'));
			return;
		}

		setIsProcessing(true);
		try {
			const ttsResult = await synthesizeTts(inputText, {
				voice: selectedVoice || 'xenia',
				speed: 1,
				language: selectedLanguage,
			});
			const audioUrl = ttsResult.audio_url ?? '';
			if (!audioUrl) {
				throw new Error('No audio URL from synthesis');
			}

			const synthesized: SynthesizedAudio = {
				id: Date.now().toString(),
				text: inputText,
				audioUrl,
				duration: ttsResult.duration_ms ? ttsResult.duration_ms / 1000 : 0,
				voice: selectedVoice,
				language: selectedLanguage,
				timestamp: new Date(),
			};

			setSynthesizedAudios((prev) => [synthesized, ...prev]);
			success(t('voice.toasts.synthSuccess'));
		} catch (error: unknown) {
			const err = error instanceof Error ? error : undefined;
			logUxError('VoiceTranscriptionPanel', 'voice', 'synthesis', err, {
				message: err?.message,
			});
			log.error(
				'VoiceTranscriptionPanel',
				'Synthesis failed',
				error instanceof Error ? error : undefined,
				error instanceof Error ? undefined : { detail: String(error) }
			);
			showError(voiceUserMessage(error, t));
		} finally {
			setIsProcessing(false);
		}
	}, [inputText, selectedVoice, selectedLanguage, success, showError, t]);

	const handleFileUpload = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const file = event.target.files?.[0];
			event.target.value = '';
			if (!file) return;
			if (!file.type.startsWith('audio/')) {
				showError(t('voice.errors.pickAudioFile'));
				return;
			}
			if (file.size > MAX_AUDIO_FILE_BYTES) {
				showError(t('voice.errors.fileTooBig', { mb: MAX_AUDIO_FILE_MB }));
				return;
			}
			const recording: VoiceRecording = {
				id: Date.now().toString(),
				blob: file,
				duration: 0,
				timestamp: new Date(),
			};
			setRecordings((prev) => [recording, ...prev]);
			success(t('voice.toasts.audioUploaded'));
		},
		[success, showError, t]
	);

	const playAudio = useCallback(
		async (audioUrl: string): Promise<void> => {
			const unregisterTts = registerTtsPlaying();
			let revokePlayback: (() => void) | null = null;
			try {
				const { playUrl, revoke } = await resolveAudioUrlForPlayback(audioUrl);
				revokePlayback = revoke;
				const audio = new Audio(playUrl);
				audio.onended = (): void => {
					unregisterTts();
					revokePlayback?.();
				};
				audio.onerror = (): void => {
					unregisterTts();
					revokePlayback?.();
				};
				await audio.play();
			} catch {
				unregisterTts();
				revokePlayback?.();
				showError(t('voice.errors.playFailed'));
			}
		},
		[showError, t]
	);

	const insertTranscription = useCallback(
		(transcription: string): void => {
			onInsertTranscription(transcription);
			success(t('voice.toasts.transcriptionInserted'));
		},
		[onInsertTranscription, success, t]
	);

	const insertAudioElement = useCallback(
		(audio: SynthesizedAudio): void => {
			const langLabel =
				languages.find((l) => l.code === audio.language)?.name ??
				audio.language;
			const audioHtml = buildTtsEmbedHtml({
				embedTitle: t('voice.embed.title'),
				audioUnsupported: t('voice.embed.audioUnsupported'),
				voice: audio.voice,
				langLabel,
				text: audio.text,
				audioUrl: audio.audioUrl,
			});

			onInsertAudio(audioHtml);
			success(t('voice.toasts.audioElementInserted'));
		},
		[onInsertAudio, languages, success, t]
	);

	return {
		t,
		mode,
		setMode,
		isRecording,
		isProcessing,
		audioLevel,
		currentRecording,
		recordings,
		synthesizedAudios,
		selectedLanguage,
		setSelectedLanguage,
		selectedVoice,
		setSelectedVoice,
		inputText,
		setInputText,
		languages,
		voiceModels,
		fileInputRef,
		startRecording,
		stopRecording,
		transcribeAudio,
		synthesizeSpeech,
		handleFileUpload,
		playAudio,
		insertTranscription,
		insertAudioElement,
	};
}
