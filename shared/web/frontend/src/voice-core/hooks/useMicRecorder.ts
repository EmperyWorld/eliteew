/**
 * Reusable microphone recording hook with level meter, cleanup, and safe stop semantics.
 * Unified Voice Core (Stack9) - shared by LiveVoiceWidget, Voice Hub, ArlyQueen, etc.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { registerMicActive } from '../micActive';

const DEFAULT_MIME = 'audio/webm;codecs=opus';
const LEVEL_FFT_SIZE = 256;
const CHUNK_INTERVAL_MS = 100;
const MAX_DURATION_SEC = 300;

export interface UseMicRecorderOptions {
	/** Called when recording stops with the final blob. */
	onStop?: (blob: Blob) => void;
	onError?: (error: Error) => void;
	maxDurationSec?: number;
}

export interface UseMicRecorderReturn {
	isRecording: boolean;
	/** 0–255 raw level; scale to 0–100 in UI if needed. */
	level: number;
	durationSec: number;
	start: () => Promise<void>;
	/** Returns the recorded blob when ready. */
	stop: () => Promise<Blob | null>;
	error: Error | null;
	/** Ref to current chunks (for consumers that need incremental access). */
	chunksRef: React.MutableRefObject<Blob[]>;
}

export function useMicRecorder(
	options: UseMicRecorderOptions = {}
): UseMicRecorderReturn {
	const { onStop, onError, maxDurationSec = MAX_DURATION_SEC } = options;
	const [isRecording, setIsRecording] = useState(false);
	const [level, setLevel] = useState(0);
	const [durationSec, setDurationSec] = useState(0);
	const [error, setError] = useState<Error | null>(null);

	const streamRef = useRef<MediaStream | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);
	const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null
	);
	const levelRafRef = useRef<number | null>(null);
	const startTimeRef = useRef<number>(0);
	const unregisterMicActiveRef = useRef<(() => void) | null>(null);

	const stopTracks = useCallback((): void => {
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((t) => {
				t.stop();
			});
			streamRef.current = null;
		}
	}, []);

	const closeAudioContext = useCallback((): void => {
		if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
			audioContextRef.current.close().catch(() => {});
			audioContextRef.current = null;
		}
		analyserRef.current = null;
	}, []);

	const clearTimers = useCallback((): void => {
		if (durationIntervalRef.current) {
			clearInterval(durationIntervalRef.current);
			durationIntervalRef.current = null;
		}
		if (levelRafRef.current !== null) {
			cancelAnimationFrame(levelRafRef.current);
			levelRafRef.current = null;
		}
	}, []);

	const stop = useCallback((): Promise<Blob | null> => {
		return new Promise((resolve) => {
			if (
				!mediaRecorderRef.current ||
				mediaRecorderRef.current.state === 'inactive'
			) {
				clearTimers();
				stopTracks();
				closeAudioContext();
				unregisterMicActiveRef.current?.();
				unregisterMicActiveRef.current = null;
				setLevel(0);
				setDurationSec(0);
				setIsRecording(false);
				resolve(null);
				return;
			}

			resolveStopRef.current = resolve;

			const mr = mediaRecorderRef.current;
			if (mr.state === 'recording' || mr.state === 'paused') {
				mr.stop();
			}

			clearTimers();
			setLevel(0);
			setIsRecording(false);
			// Note: blob is delivered in onstop handler
		});
	}, [clearTimers, stopTracks, closeAudioContext]);

	const start = useCallback(async (): Promise<void> => {
		try {
			setError(null);
			setDurationSec(0);
			setLevel(0);
			chunksRef.current = [];

			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: 1,
					echoCancellation: true,
					noiseSuppression: true,
				},
			});
			streamRef.current = stream;

			const mimeType = MediaRecorder.isTypeSupported(DEFAULT_MIME)
				? DEFAULT_MIME
				: 'audio/webm';
			const mediaRecorder = new MediaRecorder(stream, { mimeType });
			mediaRecorderRef.current = mediaRecorder;

			const audioContext = new AudioContext();
			const source = audioContext.createMediaStreamSource(stream);
			const analyser = audioContext.createAnalyser();
			analyser.fftSize = LEVEL_FFT_SIZE;
			source.connect(analyser);
			audioContextRef.current = audioContext;
			analyserRef.current = analyser;

			mediaRecorder.ondataavailable = (e: BlobEvent): void => {
				if (e.data.size > 0) chunksRef.current.push(e.data);
			};

			mediaRecorder.onstop = (): void => {
				unregisterMicActiveRef.current?.();
				unregisterMicActiveRef.current = null;
				const blob = new Blob(chunksRef.current, { type: mimeType });
				stopTracks();
				closeAudioContext();
				onStop?.(blob);
				if (resolveStopRef.current) {
					resolveStopRef.current(blob);
					resolveStopRef.current = null;
				}
			};

			mediaRecorder.onerror = (e: Event): void => {
				const err = new Error((e as ErrorEvent).message || 'Recording error');
				setError(err);
				onError?.(err);
				if (resolveStopRef.current) {
					resolveStopRef.current(null);
					resolveStopRef.current = null;
				}
			};

			mediaRecorder.start(CHUNK_INTERVAL_MS);
			unregisterMicActiveRef.current = registerMicActive();
			setIsRecording(true);
			startTimeRef.current = Date.now();

			const updateLevel = (): void => {
				if (
					!analyserRef.current ||
					!mediaRecorderRef.current ||
					mediaRecorderRef.current.state === 'inactive'
				)
					return;
				const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
				analyserRef.current.getByteFrequencyData(dataArray);
				const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
				setLevel(avg);
				levelRafRef.current = requestAnimationFrame(updateLevel);
			};
			updateLevel();

			durationIntervalRef.current = setInterval(() => {
				const elapsed = (Date.now() - startTimeRef.current) / 1000;
				setDurationSec(elapsed);
				if (elapsed >= maxDurationSec) void stop();
			}, 100);
		} catch (err) {
			const e = err instanceof Error ? err : new Error(String(err));
			setError(e);
			onError?.(e);
			setIsRecording(false);
		}
	}, [maxDurationSec, onStop, onError, stopTracks, closeAudioContext, stop]);

	useEffect(() => {
		return (): void => {
			unregisterMicActiveRef.current?.();
			unregisterMicActiveRef.current = null;
			if (
				mediaRecorderRef.current &&
				mediaRecorderRef.current.state !== 'inactive'
			) {
				try {
					mediaRecorderRef.current.stop();
				} catch {
					// ignore
				}
				mediaRecorderRef.current = null;
			}
			clearTimers();
			stopTracks();
			closeAudioContext();
			if (resolveStopRef.current) {
				resolveStopRef.current(null);
				resolveStopRef.current = null;
			}
		};
	}, [clearTimers, stopTracks, closeAudioContext]);

	return {
		isRecording,
		level,
		durationSec,
		start,
		stop,
		error,
		chunksRef,
	};
}
