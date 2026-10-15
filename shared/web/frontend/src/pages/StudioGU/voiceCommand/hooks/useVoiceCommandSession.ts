/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Voice Command session pipeline: mic capture, HTTP/WS process, intents, macros, TTS playback, hotkeys.
 *
 * Invariants:
 * - Hooks run unconditionally (including `backgroundOnly` mount) so Desktop on-demand engine stays live.
 * - TTS playback normalizes heavy `data:` URLs via `resolveAudioUrlForPlayback`.
 *
 * Related:
 * - `VoiceCommandCenter.tsx`, `intent/`, `useLiveVoiceWebSocket`
 */

import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import type { TFunction } from 'i18next';
import { notify } from '@/notifications';
import { api } from '@/services/api/client';
import { useLiveVoiceWebSocket } from '@/components/LiveVoiceWidget/hooks/useLiveVoiceWebSocket';
import { synthesize } from '@/voice-core';
import { registerTtsPlaying } from '@/voice-core/micActive';
import { resolveAudioUrlForPlayback } from '@/voice-core/utils/resolveAudioUrlForPlayback';
import type { DesktopVoiceContextValue } from '@/pages/Desktop/context/DesktopVoiceContext';
import { log } from '@/utils/logger';
import type { CommandHistoryItem } from '../components/CommandHistoryPanel';
import { executeCommand, isReversible, parseCommand } from '../engine';
import {
	resolveTranscriptToIntent,
	runMacroVoiceTurn,
	runVoiceCommandIntent,
} from '../intent';
import type { VoiceMacro } from '../macros/voiceMacros';
import { loadMacros } from '../macros/voiceMacros';
import type { DisambiguateState, VoiceMessage } from '../types';
import { VOICE_HOTKEY } from '../types';
import { useVoiceCommandHistory } from '../useVoiceCommandHistory';
import { voiceGatewayErrorMessage } from '../voiceGatewayErrorMessage';
import { resolveExecutionResponse } from '../utils/voiceCommandI18n';

export interface VoiceCommandSessionSettings {
	language: 'ru' | 'en' | 'auto';
	ttsVoice: string;
	llmModel: string;
	soundFeedback: boolean;
	autoListen: boolean;
	websocketMode: boolean;
	pushToTalk: boolean;
}

export interface UseVoiceCommandSessionParams {
	settings: VoiceCommandSessionSettings;
	desktopVoice: DesktopVoiceContextValue | null;
	t: TFunction<'desktopUi', 'voiceCommand'>;
	resolveResponse: (
		result: Parameters<typeof resolveExecutionResponse>[0]
	) => string;
}

export interface UseVoiceCommandSessionReturn {
	isListening: boolean;
	isProcessing: boolean;
	messages: VoiceMessage[];
	setMessages: Dispatch<SetStateAction<VoiceMessage[]>>;
	audioLevel: number;
	currentTranscript: string;
	commandHistory: CommandHistoryItem[];
	isLocalOnly: boolean;
	clearCommandHistory: () => void;
	historySaveFailed: boolean;
	macros: VoiceMacro[];
	setMacros: Dispatch<SetStateAction<VoiceMacro[]>>;
	runningMacroId: string | null;
	runMacro: (macro: VoiceMacro) => Promise<void>;
	disambiguate: DisambiguateState | null;
	setDisambiguate: Dispatch<SetStateAction<DisambiguateState | null>>;
	handleDisambiguateChoice: (commandId: string) => Promise<void>;
	confirmTranscript: string | null;
	closeConfirm: () => void;
	confirmCommand: () => void;
	toggleListening: () => void;
	handleReplay: (item: CommandHistoryItem) => Promise<void>;
	handleUndo: (item: CommandHistoryItem) => void;
	messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function useVoiceCommandSession({
	settings,
	desktopVoice,
	t,
	resolveResponse,
}: UseVoiceCommandSessionParams): UseVoiceCommandSessionReturn {
	const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
	const [confirmTranscript, setConfirmTranscript] = useState<string | null>(
		null
	);
	const requestConfirm = useCallback((transcript: string) => {
		return new Promise<boolean>((resolve) => {
			confirmResolverRef.current = resolve;
			setConfirmTranscript(transcript);
		});
	}, []);

	const [isListening, setIsListening] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [_isSpeaking, setIsSpeaking] = useState(false);
	const [messages, setMessages] = useState<VoiceMessage[]>([]);
	const [audioLevel, setAudioLevel] = useState(0);
	const [currentTranscript, setCurrentTranscript] = useState('');
	const {
		commandHistory,
		prependCommandHistoryItem,
		isLocalOnly,
		clearCommandHistory,
		historySaveFailed,
		acknowledgeHistorySaveFailure,
	} = useVoiceCommandHistory();
	const [macros, setMacros] = useState<VoiceMacro[]>(loadMacros);
	const [runningMacroId, setRunningMacroId] = useState<string | null>(null);
	const [disambiguate, setDisambiguate] = useState<DisambiguateState | null>(
		null
	);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const animationFrameRef = useRef<number | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const revokePlaybackRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		return (): void => {
			revokePlaybackRef.current?.();
			revokePlaybackRef.current = null;
		};
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: ref target updates when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	useEffect(() => {
		if (!historySaveFailed) return;
		notify.error(t('history.saveFailed'));
		acknowledgeHistorySaveFailure();
	}, [historySaveFailed, acknowledgeHistorySaveFailure, t]);

	const recordCommandInHistory = useCallback(
		(
			transcript: string,
			status: 'success' | 'error' | 'cancelled',
			responseText?: string,
			commandId?: string,
			params?: Record<string, string>
		) => {
			const item: CommandHistoryItem = {
				id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`,
				transcript,
				status,
				responseText,
				timestamp: new Date(),
				commandId,
				params,
			};
			prependCommandHistoryItem(item);
			if (commandId) {
				void api
					.post('/api/v1/voice-commands/audit', {
						command_id: commandId,
						transcript,
						status,
					})
					.catch((err: unknown) => {
						log.warn(
							'VoiceCommandCenter',
							'voice-commands audit POST failed',
							err instanceof Error ? err : undefined
						);
					});
			}
			if (desktopVoice) {
				desktopVoice.setVoiceCommandStatus({
					lastSuccess:
						status === 'success'
							? 'success'
							: status === 'error'
								? 'error'
								: null,
				});
			}
		},
		[desktopVoice, prependCommandHistoryItem]
	);

	const playAudio = useCallback(
		(url: string) => {
			void (async (): Promise<void> => {
				revokePlaybackRef.current?.();
				revokePlaybackRef.current = null;
				if (audioRef.current) {
					audioRef.current.pause();
				}
				let unregisterTts: (() => void) | null = null;
				try {
					const { playUrl, revoke } = await resolveAudioUrlForPlayback(url);
					revokePlaybackRef.current = revoke;
					unregisterTts = registerTtsPlaying();
					const audio = new Audio(playUrl);
					audioRef.current = audio;
					audio.onended = () => {
						unregisterTts?.();
						unregisterTts = null;
						revokePlaybackRef.current?.();
						revokePlaybackRef.current = null;
					};
					audio.onerror = () => {
						unregisterTts?.();
						unregisterTts = null;
						revokePlaybackRef.current?.();
						revokePlaybackRef.current = null;
					};
					await audio.play();
				} catch (e: unknown) {
					unregisterTts?.();
					revokePlaybackRef.current?.();
					revokePlaybackRef.current = null;
					const blocked =
						e instanceof DOMException && e.name === 'NotAllowedError';
					if (!blocked) {
						notify.error(t('feed.audioPlayFailed'));
					}
				}
			})();
		},
		[t]
	);

	const addMessage = useCallback(
		(msg: Omit<VoiceMessage, 'id' | 'timestamp'>) => {
			setMessages((prev) => [
				...prev,
				{
					...msg,
					id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
					timestamp: new Date(),
				},
			]);
		},
		[]
	);

	const speakText = useCallback(
		async (text: string) => {
			try {
				setIsSpeaking(true);
				const result = await synthesize(text, {
					voice: settings.ttsVoice,
					speed: 1,
				});
				if (result.audio_url) {
					playAudio(result.audio_url);
				}
			} catch (err) {
				console.error('TTS error:', err);
			} finally {
				setIsSpeaking(false);
			}
		},
		[settings.ttsVoice, playAudio]
	);

	const runMacro = useCallback(
		async (macro: VoiceMacro) => {
			setRunningMacroId(macro.id);
			try {
				for (let i = 0; i < macro.commandIds.length; i++) {
					const commandId = macro.commandIds[i];
					const result = executeCommand(commandId);
					const responseText = resolveResponse(result);
					addMessage({
						type: 'command',
						text: responseText,
						command: macro.name,
						status: result.status,
					});
					if (result.sideEffect === 'clear_messages') {
						setMessages([]);
					}
					if (settings.soundFeedback && responseText) {
						await speakText(responseText);
					}
					if (i < macro.commandIds.length - 1) {
						await new Promise((r) => setTimeout(r, 400));
					}
				}
			} finally {
				setRunningMacroId(null);
			}
		},
		[addMessage, speakText, settings.soundFeedback, resolveResponse]
	);

	const processAudio = useCallback(
		async (audioBlob: Blob) => {
			setIsProcessing(true);
			setCurrentTranscript('');

			if (audioBlob.size === 0) {
				setIsProcessing(false);
				addMessage({
					type: 'system',
					text: t('feed.recordingEmpty'),
					status: 'error',
				});
				return;
			}
			const minAudioBytes = 2000;
			if (audioBlob.size < minAudioBytes) {
				setIsProcessing(false);
				addMessage({
					type: 'system',
					text: t('feed.recordingTooShort'),
					status: 'error',
				});
				return;
			}

			try {
				const formData = new FormData();
				formData.append('file', audioBlob, 'recording.webm');
				formData.append('session_id', `voice-cmd-${Date.now()}`);
				formData.append(
					'language',
					settings.language === 'auto' ? 'ru' : settings.language
				);

				const result = await api.post<{
					transcription?: string;
					llm_response?: string;
					audio_url?: string;
				}>('/api/v1/voice-gateway/process', formData, {
					timeout: 120000,
				});
				const transcript = result.transcription || '';
				setCurrentTranscript(transcript);
				addMessage({ type: 'user', text: transcript });

				const llmResponse = result.llm_response || '';
				const intent = await resolveTranscriptToIntent(transcript, macros);
				if (intent.kind === 'macro') {
					await runMacroVoiceTurn({
						transcript,
						macro: intent.macro,
						soundFeedback: settings.soundFeedback,
						recordCommandInHistory,
						addMessage,
						runMacro,
						speakText,
					});
					setIsProcessing(false);
					return;
				}
				if (intent.kind === 'disambiguate') {
					setDisambiguate({
						transcript,
						intent: intent.intent,
						candidates: intent.candidates,
					});
					setIsProcessing(false);
					return;
				}
				if (intent.kind === 'command') {
					await runVoiceCommandIntent({
						transcript,
						commandId: intent.commandId,
						params: intent.params,
						soundFeedback: settings.soundFeedback,
						recordCommandInHistory,
						addMessage,
						setMessages,
						speakText,
						resolveResponse,
						cancelledMessage: t('feed.commandCancelled'),
						requestConfirm,
					});
				} else {
					addMessage({
						type: 'assistant',
						text: llmResponse,
						audioUrl: result.audio_url,
					});
					if (result.audio_url && settings.soundFeedback) {
						playAudio(result.audio_url);
					}
				}
			} catch (err) {
				const message = voiceGatewayErrorMessage(err, t);
				console.error('Processing error:', err);
				addMessage({
					type: 'system',
					text: message,
					status: 'error',
				});
			} finally {
				setIsProcessing(false);
			}
		},
		[
			settings,
			addMessage,
			speakText,
			recordCommandInHistory,
			playAudio,
			macros,
			runMacro,
			t,
			resolveResponse,
			requestConfirm,
		]
	);

	const lastTurnWasCommandRef = useRef(false);
	const wsSessionIdRef = useRef(`vcc-ws-${Date.now()}`).current;

	const handleWsTranscription = useCallback(
		async (transcript: string) => {
			setCurrentTranscript(transcript);
			addMessage({ type: 'user', text: transcript });
			lastTurnWasCommandRef.current = false;
			const intent = await resolveTranscriptToIntent(transcript, macros);
			if (intent.kind === 'macro') {
				lastTurnWasCommandRef.current = true;
				await runMacroVoiceTurn({
					transcript,
					macro: intent.macro,
					soundFeedback: settings.soundFeedback,
					recordCommandInHistory,
					addMessage,
					runMacro,
					speakText,
				});
				setIsProcessing(false);
				return;
			}
			if (intent.kind === 'disambiguate') {
				setDisambiguate({
					transcript,
					intent: intent.intent,
					candidates: intent.candidates,
				});
				setIsProcessing(false);
				return;
			}
			if (intent.kind === 'command') {
				lastTurnWasCommandRef.current = true;
				await runVoiceCommandIntent({
					transcript,
					commandId: intent.commandId,
					params: intent.params,
					soundFeedback: settings.soundFeedback,
					recordCommandInHistory,
					addMessage,
					setMessages,
					speakText,
					resolveResponse,
					cancelledMessage: t('feed.commandCancelled'),
					requestConfirm,
				});
			}
			setIsProcessing(false);
		},
		[
			addMessage,
			macros,
			recordCommandInHistory,
			runMacro,
			settings.soundFeedback,
			speakText,
			resolveResponse,
			requestConfirm,
			t,
		]
	);

	const handleWsResponse = useCallback(
		(text: string) => {
			if (!lastTurnWasCommandRef.current && text) {
				addMessage({ type: 'assistant', text });
			}
			lastTurnWasCommandRef.current = false;
		},
		[addMessage]
	);

	const handleWsAudio = useCallback(
		(url: string) => {
			if (!lastTurnWasCommandRef.current && settings.soundFeedback) {
				playAudio(url);
			}
			lastTurnWasCommandRef.current = false;
			setIsProcessing(false);
		},
		[playAudio, settings.soundFeedback]
	);

	const wsApi = useLiveVoiceWebSocket({
		sessionId: wsSessionIdRef,
		autoConnect: false,
		onTranscription: handleWsTranscription,
		onResponse: handleWsResponse,
		onAudio: handleWsAudio,
	});

	const startListening = useCallback(async () => {
		if (settings.websocketMode && wsApi.setActive) {
			wsApi.setActive(true);
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

			audioContextRef.current = new AudioContext();
			analyserRef.current = audioContextRef.current.createAnalyser();
			const source = audioContextRef.current.createMediaStreamSource(stream);
			source.connect(analyserRef.current);
			analyserRef.current.fftSize = 256;

			const updateLevel = () => {
				if (analyserRef.current) {
					const dataArray = new Uint8Array(
						analyserRef.current.frequencyBinCount
					);
					analyserRef.current.getByteFrequencyData(dataArray);
					const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
					setAudioLevel(avg / 255);
				}
				animationFrameRef.current = requestAnimationFrame(updateLevel);
			};
			updateLevel();

			mediaRecorderRef.current = new MediaRecorder(stream, {
				mimeType: 'audio/webm;codecs=opus',
			});
			audioChunksRef.current = [];

			mediaRecorderRef.current.ondataavailable = (e) => {
				if (e.data.size > 0) {
					audioChunksRef.current.push(e.data);
				}
			};

			mediaRecorderRef.current.onstop = async () => {
				const audioBlob = new Blob(audioChunksRef.current, {
					type: 'audio/webm',
				});
				if (settings.websocketMode && wsApi.sendAudio) {
					setIsProcessing(true);
					wsApi.sendAudio(audioBlob);
				} else {
					await processAudio(audioBlob);
				}
				stream.getTracks().forEach((track) => {
					track.stop();
				});
			};

			mediaRecorderRef.current.start();
			setIsListening(true);

			addMessage({
				type: 'system',
				text: t('feed.listening'),
			});
		} catch (err) {
			console.error('Failed to start recording:', err);
			addMessage({
				type: 'system',
				text: t('feed.micDenied'),
				status: 'error',
			});
		}
	}, [
		processAudio,
		addMessage,
		settings.websocketMode,
		wsApi.sendAudio,
		wsApi.setActive,
		t,
	]);

	const stopListening = useCallback(() => {
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current);
		}
		if (audioContextRef.current) {
			audioContextRef.current.close();
		}
		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state !== 'inactive'
		) {
			mediaRecorderRef.current.stop();
		}
		setIsListening(false);
		setAudioLevel(0);
	}, []);

	useEffect(() => {
		if (!desktopVoice?.pendingVoiceCommandStart) return;
		startListening();
		desktopVoice.clearPendingVoiceCommandStart();
	}, [
		desktopVoice?.pendingVoiceCommandStart,
		desktopVoice?.clearPendingVoiceCommandStart,
		startListening,
	]);

	useEffect(() => {
		if (!desktopVoice || desktopVoice.activeMode === 'voice-command') return;
		if (isListening) stopListening();
	}, [desktopVoice?.activeMode, desktopVoice, isListening, stopListening]);

	const toggleListening = useCallback(() => {
		if (isListening) {
			stopListening();
		} else {
			startListening();
		}
	}, [isListening, startListening, stopListening]);

	useEffect(() => {
		const tag = (e: KeyboardEvent) => {
			const target = e.target as Node;
			if (target && typeof (target as HTMLElement).closest === 'function') {
				const el = (target as HTMLElement).closest(
					'input, textarea, select, [contenteditable="true"]'
				);
				if (el) return true;
			}
			return false;
		};
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== VOICE_HOTKEY || tag(e)) return;
			if (!settings.pushToTalk && e.repeat) return;
			e.preventDefault();
			if (settings.pushToTalk) {
				if (!isListening) startListening();
			} else {
				toggleListening();
			}
		};
		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.key !== VOICE_HOTKEY || tag(e)) return;
			e.preventDefault();
			if (settings.pushToTalk && isListening) {
				stopListening();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		};
	}, [
		settings.pushToTalk,
		isListening,
		startListening,
		stopListening,
		toggleListening,
	]);

	const handleDisambiguateChoice = useCallback(
		async (commandId: string) => {
			if (!disambiguate) return;
			const transcript = disambiguate.transcript;
			setDisambiguate(null);
			await runVoiceCommandIntent({
				transcript,
				commandId,
				soundFeedback: settings.soundFeedback,
				recordCommandInHistory,
				addMessage,
				setMessages,
				speakText,
				resolveResponse,
				cancelledMessage: t('feed.commandCancelled'),
				requestConfirm,
				skipUserConfirm: true,
			});
		},
		[
			disambiguate,
			addMessage,
			speakText,
			recordCommandInHistory,
			settings.soundFeedback,
			resolveResponse,
			requestConfirm,
			t,
		]
	);

	const handleUndo = useCallback(
		(item: CommandHistoryItem) => {
			if (!item.commandId || !isReversible(item.commandId)) return;
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'undo_reversible', commandId: item.commandId },
				})
			);
			addMessage({
				type: 'system',
				text: t('feed.undone', { transcript: item.transcript }),
			});
		},
		[addMessage, t]
	);

	const handleReplay = useCallback(
		async (item: CommandHistoryItem) => {
			const commandId =
				item.commandId ??
				(parseCommand(item.transcript) as { commandId: string } | undefined)
					?.commandId;
			const params =
				item.params ??
				(
					parseCommand(item.transcript) as
						| { params: Record<string, string> }
						| undefined
				)?.params;
			if (!commandId) return;
			const execResult = executeCommand(commandId, params);
			const responseText = resolveResponse(execResult);
			if (execResult.sideEffect === 'clear_messages') {
				setMessages([]);
			}
			addMessage({
				type: 'command',
				text: responseText,
				command: item.transcript,
				status: execResult.status,
			});
			if (settings.soundFeedback) {
				await speakText(responseText);
			}
			recordCommandInHistory(
				item.transcript,
				execResult.status,
				responseText,
				commandId,
				params
			);
		},
		[
			addMessage,
			speakText,
			recordCommandInHistory,
			settings.soundFeedback,
			resolveResponse,
		]
	);

	const closeConfirm = useCallback(() => {
		confirmResolverRef.current?.(false);
		confirmResolverRef.current = null;
		setConfirmTranscript(null);
	}, []);

	const confirmCommand = useCallback(() => {
		confirmResolverRef.current?.(true);
		confirmResolverRef.current = null;
		setConfirmTranscript(null);
	}, []);

	return {
		isListening,
		isProcessing,
		messages,
		setMessages,
		audioLevel,
		currentTranscript,
		commandHistory,
		isLocalOnly,
		clearCommandHistory,
		historySaveFailed,
		macros,
		setMacros,
		runningMacroId,
		runMacro,
		disambiguate,
		setDisambiguate,
		handleDisambiguateChoice,
		confirmTranscript,
		closeConfirm,
		confirmCommand,
		toggleListening,
		handleReplay,
		handleUndo,
		messagesEndRef,
	};
}
