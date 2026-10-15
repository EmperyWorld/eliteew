/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat voice note capture via MediaRecorder (blob output, no STT in this hook).
 *
 * Invariants:
 * - `onRecordingComplete` fires after stop/limit, not on cancel.
 * - Elapsed UI resyncs from monotonic start time when the tab becomes visible again.
 *
 * Related:
 * - utils/subscribeDocumentVisibleSync.ts
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeDocumentVisibleSync } from '../../../utils/subscribeDocumentVisibleSync';

const DEFAULT_MAX_MS = 5 * 60 * 1000;

/** Elapsed whole seconds since `startTimeMs` (for UI + max-duration guard). */
export function computeGafVoiceRecorderElapsedSec(
	startTimeMs: number,
	nowMs: number = Date.now()
): number {
	if (startTimeMs <= 0) return 0;
	return Math.floor(Math.max(0, nowMs - startTimeMs) / 1000);
}

function pickRecorderMime(): string | undefined {
	if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
		return undefined;
	}
	const candidates = [
		'audio/webm;codecs=opus',
		'audio/webm',
		'audio/mp4',
		'audio/ogg;codecs=opus',
	];
	for (const t of candidates) {
		if (MediaRecorder.isTypeSupported(t)) return t;
	}
	return undefined;
}

export function isGafVoiceRecordingSupported(): boolean {
	if (typeof window === 'undefined') return false;
	if (typeof MediaRecorder === 'undefined') return false;
	if (!navigator.mediaDevices?.getUserMedia) return false;
	return true;
}

/**
 * Запись голоса для GAF Chat: MediaRecorder → Blob (без STT).
 * onRecordingComplete вызывается после остановки (в т.ч. по лимиту длительности), не при отмене.
 */
export function useGafVoiceRecorder(
	options: {
		maxDurationMs?: number;
		onRecordingComplete?: (result: { blob: Blob; mime: string } | null) => void;
	} = {}
) {
	const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_MS;
	const onRecordingCompleteRef = useRef(options.onRecordingComplete);
	onRecordingCompleteRef.current = options.onRecordingComplete;
	const streamRef = useRef<MediaStream | null>(null);
	const recorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<BlobPart[]>([]);
	const mimeRef = useRef<string>('');
	const discardRef = useRef(false);
	const tickRef = useRef<number | null>(null);
	const startTimeRef = useRef(0);
	const resolveStopRef = useRef<
		((v: { blob: Blob; mime: string } | null) => void) | null
	>(null);
	const stopRef = useRef<() => Promise<{ blob: Blob; mime: string } | null>>(
		async () => null
	);

	const [isRecording, setIsRecording] = useState(false);
	const [elapsedSec, setElapsedSec] = useState(0);
	const recordingActiveRef = useRef(false);

	const clearTick = useCallback(() => {
		if (tickRef.current != null) {
			window.clearInterval(tickRef.current);
			tickRef.current = null;
		}
	}, []);

	const stopStream = useCallback(() => {
		const tracks = streamRef.current?.getTracks();
		if (tracks) {
			for (const t of tracks) {
				t.stop();
			}
		}
		streamRef.current = null;
	}, []);

	const cleanupAfterStop = useCallback(() => {
		clearTick();
		recorderRef.current = null;
		chunksRef.current = [];
		recordingActiveRef.current = false;
		startTimeRef.current = 0;
		stopStream();
		setIsRecording(false);
		setElapsedSec(0);
	}, [clearTick, stopStream]);

	const syncElapsedFromClock = useCallback(() => {
		if (!recordingActiveRef.current || startTimeRef.current <= 0) return;
		const elapsedMs = Date.now() - startTimeRef.current;
		setElapsedSec(computeGafVoiceRecorderElapsedSec(startTimeRef.current));
		if (elapsedMs >= maxDurationMs) {
			const cur = recorderRef.current;
			if (cur && cur.state === 'recording') {
				void stopRef.current();
			}
		}
	}, [maxDurationMs]);

	useEffect(() => {
		if (!isRecording) return;
		return subscribeDocumentVisibleSync(syncElapsedFromClock);
	}, [isRecording, syncElapsedFromClock]);

	const start = useCallback(async () => {
		if (recordingActiveRef.current) return;
		if (!isGafVoiceRecordingSupported()) {
			throw new Error('Voice recording is not supported in this browser');
		}
		recordingActiveRef.current = true;
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
				},
			});
		} catch {
			recordingActiveRef.current = false;
			throw new Error('Microphone access denied or unavailable');
		}
		const mime = pickRecorderMime();
		streamRef.current = stream;
		chunksRef.current = [];
		discardRef.current = false;
		mimeRef.current = mime || '';
		const rec = new MediaRecorder(
			stream,
			mime ? { mimeType: mime } : undefined
		);
		recorderRef.current = rec;
		rec.ondataavailable = (e) => {
			if (e.data.size > 0) chunksRef.current.push(e.data);
		};
		rec.onstop = () => {
			const usedMime = mimeRef.current || rec.mimeType || 'audio/webm';
			if (discardRef.current) {
				discardRef.current = false;
				cleanupAfterStop();
				const res = resolveStopRef.current;
				resolveStopRef.current = null;
				res?.(null);
				return;
			}
			const blob = new Blob(chunksRef.current, { type: usedMime });
			chunksRef.current = [];
			cleanupAfterStop();
			const res = resolveStopRef.current;
			resolveStopRef.current = null;
			const payload = blob.size > 0 ? { blob, mime: usedMime } : null;
			res?.(payload);
			onRecordingCompleteRef.current?.(payload);
		};

		startTimeRef.current = Date.now();
		rec.start(200);
		setIsRecording(true);
		setElapsedSec(0);
		clearTick();
		tickRef.current = window.setInterval(syncElapsedFromClock, 250);
	}, [clearTick, cleanupAfterStop, syncElapsedFromClock]);

	const stop = useCallback((): Promise<{ blob: Blob; mime: string } | null> => {
		return new Promise((resolve) => {
			const rec = recorderRef.current;
			if (!rec || rec.state === 'inactive') {
				resolve(null);
				return;
			}
			resolveStopRef.current = resolve;
			rec.stop();
		});
	}, []);

	stopRef.current = stop;

	const cancel = useCallback(() => {
		if (!recorderRef.current || recorderRef.current.state === 'inactive') {
			cleanupAfterStop();
			return;
		}
		discardRef.current = true;
		recorderRef.current.stop();
	}, [cleanupAfterStop]);

	useEffect(
		() => () => {
			clearTick();
			discardRef.current = true;
			const r = recorderRef.current;
			if (r && r.state !== 'inactive') r.stop();
			stopStream();
		},
		[clearTick, stopStream]
	);

	const isSupported = useMemo(() => isGafVoiceRecordingSupported(), []);

	return {
		isSupported,
		isRecording,
		elapsedSec,
		start,
		stop,
		cancel,
	};
}
