/**
 * Long-form transcription (async Whisper) — logic extracted for Studio GU tab.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/services/api/client';
import { registerMicActive } from '@/voice-core/micActive';
import {
	LANGUAGES,
	TRANSCRIPTION_HISTORY_STORAGE_KEY,
	TRANSCRIPTION_RESTORE_JOB_KEY,
	validateAudioFile,
} from '../transcription/studioTranscriptionConstants';

export interface TranscriptionSegment {
	text: string;
	start: number;
	end: number;
	confidence?: number;
	speaker?: string;
}

export interface TranscriptionResult {
	/** Optional server job id */
	id?: string;
	text: string;
	language: string;
	confidence: number;
	segments: TranscriptionSegment[];
	duration_ms: number;
	file_size_bytes: number;
	format: string;
	timestamp: string;
	filename?: string;
}

export interface TranscriptionHistory {
	id: string;
	filename: string;
	text: string;
	language: string;
	timestamp: string;
	duration_ms: number;
}

export type TranscriptionStatus =
	| 'idle'
	| 'recording'
	| 'uploading'
	| 'processing'
	| 'completed'
	| 'error';

export function useStudioTranscription() {
	const [status, setStatus] = useState<TranscriptionStatus>('idle');
	const [file, setFile] = useState<File | null>(null);
	const [result, setResult] = useState<TranscriptionResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState(0);
	const [copied, setCopied] = useState(false);

	const [language, setLanguage] = useState('auto');
	const [sttModelLabel, setSttModelLabel] = useState('large-v3');
	const [showSettings, setShowSettings] = useState(false);
	const [showHistory, setShowHistory] = useState(false);

	const [isRecording, setIsRecording] = useState(false);
	const isRecordingRef = useRef(false);
	const [recordingTime, setRecordingTime] = useState(0);
	const [audioLevel, setAudioLevel] = useState(0);

	const [history, setHistory] = useState<TranscriptionHistory[]>([]);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const dropZoneRef = useRef<HTMLLabelElement>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const streamRef = useRef<MediaStream | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null
	);
	const unregisterMicRef = useRef<(() => void) | null>(null);
	const transcriptionPollRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		isRecordingRef.current = isRecording;
	}, [isRecording]);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const health = await api.get<{
					stt?: { model_size?: string };
				}>('/voice-gateway/health', { baseURL: '/api/v1' });
				const size = health?.stt?.model_size;
				if (!cancelled && typeof size === 'string' && size.trim()) {
					setSttModelLabel(size.trim());
				}
			} catch {
				// keep default label when health unavailable
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		try {
			const saved = localStorage.getItem(TRANSCRIPTION_HISTORY_STORAGE_KEY);
			if (saved) {
				setHistory(JSON.parse(saved) as TranscriptionHistory[]);
			}
		} catch (e) {
			console.error('Failed to load transcription history:', e);
		}
	}, []);

	useEffect(() => {
		return () => {
			if (transcriptionPollRef.current !== null) {
				window.clearInterval(transcriptionPollRef.current);
				transcriptionPollRef.current = null;
			}
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, []);

	const saveToHistory = useCallback((item: TranscriptionHistory) => {
		setHistory((prev) => {
			const newHistory = [item, ...prev].slice(0, 20);
			localStorage.setItem(
				TRANSCRIPTION_HISTORY_STORAGE_KEY,
				JSON.stringify(newHistory)
			);
			return newHistory;
		});
	}, []);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const droppedFile = e.dataTransfer.files[0];
		if (droppedFile) {
			setFile(droppedFile);
			setError(null);
			setResult(null);
		}
	}, []);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const selectedFile = e.target.files?.[0];
			if (selectedFile) {
				setFile(selectedFile);
				setError(null);
				setResult(null);
			}
		},
		[]
	);

	const updateLevelLoop = useCallback(() => {
		if (!analyserRef.current || !isRecordingRef.current) return;
		const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
		analyserRef.current.getByteFrequencyData(dataArray);
		const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
		setAudioLevel(avg / 255);
		if (isRecordingRef.current) {
			rafRef.current = requestAnimationFrame(updateLevelLoop);
		}
	}, []);

	const startRecording = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;

			const audioContext = new AudioContext();
			const source = audioContext.createMediaStreamSource(stream);
			const analyser = audioContext.createAnalyser();
			analyser.fftSize = 256;
			source.connect(analyser);
			analyserRef.current = analyser;

			const mediaRecorder = new MediaRecorder(stream, {
				mimeType: 'audio/webm',
			});
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];

			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) {
					audioChunksRef.current.push(e.data);
				}
			};

			mediaRecorder.onstop = () => {
				unregisterMicRef.current?.();
				unregisterMicRef.current = null;
				const audioBlob = new Blob(audioChunksRef.current, {
					type: 'audio/webm',
				});
				const audioFile = new File(
					[audioBlob],
					`recording_${Date.now()}.webm`,
					{ type: 'audio/webm' }
				);
				setFile(audioFile);
				setIsRecording(false);
				isRecordingRef.current = false;
				setRecordingTime(0);
				setAudioLevel(0);
				if (recordingIntervalRef.current) {
					clearInterval(recordingIntervalRef.current);
					recordingIntervalRef.current = null;
				}
			};

			mediaRecorder.start(100);
			unregisterMicRef.current = registerMicActive();
			setIsRecording(true);
			isRecordingRef.current = true;
			setStatus('recording');

			recordingIntervalRef.current = setInterval(() => {
				setRecordingTime((prev) => prev + 1);
			}, 1000);

			rafRef.current = requestAnimationFrame(updateLevelLoop);
		} catch (err) {
			console.error('Failed to start recording:', err);
			setError('Не удалось получить доступ к микрофону');
		}
	}, [updateLevelLoop]);

	const stopRecording = useCallback(() => {
		unregisterMicRef.current?.();
		unregisterMicRef.current = null;
		if (mediaRecorderRef.current && isRecordingRef.current) {
			mediaRecorderRef.current.stop();
			for (const track of streamRef.current?.getTracks() ?? []) {
				track.stop();
			}
			setStatus('idle');
		}
	}, []);

	const transcribe = useCallback(async () => {
		if (!file) return;

		const validationError = validateAudioFile(file);
		if (validationError) {
			setError(validationError);
			setStatus('error');
			console.warn('[useStudioTranscription] File validation failed', {
				name: file.name,
				size: file.size,
			});
			return;
		}

		setStatus('uploading');
		setError(null);
		setProgress(0);

		try {
			const formData = new FormData();
			formData.append('file', file);

			setStatus('processing');
			if (transcriptionPollRef.current !== null) {
				window.clearInterval(transcriptionPollRef.current);
				transcriptionPollRef.current = null;
			}

			const progressInterval = setInterval(() => {
				setProgress((prev) => Math.min(prev + 5, 90));
			}, 500);

			const params = new URLSearchParams();
			if (language && language !== 'auto') params.set('language', language);
			const query = params.toString();

			const queued = await api.post<{
				transcription_id: string;
				status: string;
				message: string;
			}>(
				`/voice-gateway/transcribe/async${query ? `?${query}` : ''}`,
				formData,
				{
					baseURL: '/api/v1',
					timeout: 300000,
				}
			);
			window.localStorage.setItem(
				TRANSCRIPTION_RESTORE_JOB_KEY,
				queued.transcription_id
			);
			setProgress(10);

			transcriptionPollRef.current = window.setInterval(async () => {
				try {
					const response = await api.get<{
						transcription_id: string;
						status: string;
						progress: number;
						error?: string | null;
						result?: {
							text: string;
							language: string;
							duration_ms: number;
							confidence: number;
							segments: Array<{
								text: string;
								start: number;
								end: number;
								confidence?: number;
							}>;
							timestamp: string;
						} | null;
					}>(`/voice-gateway/transcribe/status/${queued.transcription_id}`, {
						baseURL: '/api/v1',
					});

					setProgress(Math.max(response.progress ?? 0, 10));
					if (response.status === 'completed' && response.result) {
						clearInterval(progressInterval);
						if (transcriptionPollRef.current !== null) {
							window.clearInterval(transcriptionPollRef.current);
							transcriptionPollRef.current = null;
						}
						window.localStorage.removeItem(TRANSCRIPTION_RESTORE_JOB_KEY);
						setProgress(100);
						const resultWithFilename: TranscriptionResult = {
							text: response.result.text,
							language: response.result.language,
							confidence: response.result.confidence ?? 0,
							segments: response.result.segments ?? [],
							duration_ms: response.result.duration_ms ?? 0,
							file_size_bytes: file.size,
							format: file.type,
							timestamp: response.result.timestamp ?? new Date().toISOString(),
							filename: file.name,
						};
						setResult(resultWithFilename);
						setStatus('completed');
						saveToHistory({
							id: queued.transcription_id,
							filename: file.name,
							text:
								response.result.text.substring(0, 200) +
								(response.result.text.length > 200 ? '...' : ''),
							language: response.result.language,
							timestamp: new Date().toISOString(),
							duration_ms: response.result.duration_ms ?? 0,
						});
					} else if (
						response.status === 'failed' ||
						response.status === 'cancelled'
					) {
						clearInterval(progressInterval);
						if (transcriptionPollRef.current !== null) {
							window.clearInterval(transcriptionPollRef.current);
							transcriptionPollRef.current = null;
						}
						window.localStorage.removeItem(TRANSCRIPTION_RESTORE_JOB_KEY);
						setError(response.error || 'Ошибка транскрибации');
						setStatus('error');
						setProgress(0);
					}
				} catch (pollError) {
					clearInterval(progressInterval);
					if (transcriptionPollRef.current !== null) {
						window.clearInterval(transcriptionPollRef.current);
						transcriptionPollRef.current = null;
					}
					window.localStorage.removeItem(TRANSCRIPTION_RESTORE_JOB_KEY);
					setError(
						pollError instanceof Error
							? pollError.message
							: 'Ошибка транскрибации'
					);
					setStatus('error');
					setProgress(0);
				}
			}, 2000);
		} catch (err) {
			console.error('Transcription error:', err);
			setError(err instanceof Error ? err.message : 'Ошибка транскрибации');
			setStatus('error');
			setProgress(0);
		}
	}, [file, language, saveToHistory]);

	const copyToClipboard = useCallback(async () => {
		if (!result?.text) return;
		try {
			await navigator.clipboard.writeText(result.text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}, [result]);

	const exportAsTxt = useCallback(() => {
		if (!result?.text) return;
		const blob = new Blob([result.text], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `transcription_${Date.now()}.txt`;
		a.click();
		URL.revokeObjectURL(url);
	}, [result]);

	const exportAsSrt = useCallback(() => {
		if (!result) return;
		if (!result.segments?.length) {
			const blob = new Blob(
				[`1\n00:00:00,000 --> 00:00:10,000\n${result.text || ''}\n`],
				{ type: 'text/plain' }
			);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `transcription_${Date.now()}.srt`;
			a.click();
			URL.revokeObjectURL(url);
			return;
		}

		const formatTime = (sec: number) => {
			const h = Math.floor(sec / 3600);
			const m = Math.floor((sec % 3600) / 60);
			const s = Math.floor(sec % 60);
			const ms = Math.floor((sec % 1) * 1000);
			return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
		};

		const srt = result.segments
			.map((seg, i) => {
				return `${i + 1}\n${formatTime(seg.start)} --> ${formatTime(seg.end)}\n${seg.text}\n`;
			})
			.join('\n');

		const blob = new Blob([srt], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `transcription_${Date.now()}.srt`;
		a.click();
		URL.revokeObjectURL(url);
	}, [result]);

	const exportAsJson = useCallback(() => {
		if (!result) return;
		const blob = new Blob([JSON.stringify(result, null, 2)], {
			type: 'application/json',
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `transcription_${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}, [result]);

	const reset = useCallback(() => {
		setFile(null);
		setResult(null);
		setError(null);
		setStatus('idle');
		setProgress(0);
	}, []);

	const clearHistory = useCallback(() => {
		setHistory([]);
		localStorage.removeItem(TRANSCRIPTION_HISTORY_STORAGE_KEY);
	}, []);

	const restoreFromHistory = useCallback((item: TranscriptionHistory) => {
		setResult({
			text: item.text,
			language: item.language,
			confidence: 0.95,
			segments: [],
			duration_ms: item.duration_ms,
			file_size_bytes: 0,
			format: 'unknown',
			timestamp: item.timestamp,
			filename: item.filename,
			id: item.id,
		});
		setStatus('completed');
		setError(null);
	}, []);

	const formatRecordingClock = useCallback((seconds: number) => {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}, []);

	return {
		LANGUAGES,
		status,
		file,
		result,
		error,
		progress,
		copied,
		language,
		setLanguage,
		sttModelLabel,
		showSettings,
		setShowSettings,
		showHistory,
		setShowHistory,
		history,
		isRecording,
		recordingTime,
		audioLevel,
		fileInputRef,
		dropZoneRef,
		handleDrop,
		handleFileSelect,
		startRecording,
		stopRecording,
		transcribe,
		copyToClipboard,
		exportAsTxt,
		exportAsSrt,
		exportAsJson,
		reset,
		clearHistory,
		restoreFromHistory,
		formatRecordingClock,
	};
}
