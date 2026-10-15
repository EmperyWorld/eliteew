/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Encapsulate EWA/Arlika transform video portal state, on-demand loading, autoplay retry, and Escape-close behavior.
 *
 * Invariants:
 * - The hook owns media side effects only; it does not mutate companion profile or chat state.
 * - Transform MP4 files must not be preloaded on chat mount; `src` is assigned only when a transform is requested.
 * - Failed autoplay falls back to showing native controls instead of blocking the chat turn.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionTransformVideoPortal.tsx
 * - src/features/ewa/companionTransformVideoUrl.ts
 */
import { companionTransformVideoUrl } from '@/features/ewa/companionTransformVideoUrl';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type SyntheticEvent,
} from 'react';

const COMPANION_TRANSFORM_VIDEO_MAX_RETRIES = 6;

export function useCompanionTransformVideo() {
	const [companionTransformVideoOpen, setCompanionTransformVideoOpen] =
		useState(false);
	const [companionTransformVideoFailed, setCompanionTransformVideoFailed] =
		useState(false);
	const [companionTransformVideoLoading, setCompanionTransformVideoLoading] =
		useState(false);
	const [companionTransformVideoSrc, setCompanionTransformVideoSrc] = useState(
		() => companionTransformVideoUrl(null)
	);
	const [companionTransformVideoRetry, setCompanionTransformVideoRetry] =
		useState(0);
	const [
		companionTransformVideoNeedsControls,
		setCompanionTransformVideoNeedsControls,
	] = useState(false);
	const companionTransformVideoRef = useRef<HTMLVideoElement | null>(null);
	const companionTransformVideoRetryTimerRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	const companionTransformPlayGenerationRef = useRef(0);
	const companionTransformPlayHandledGenerationRef = useRef(-1);

	const closeCompanionTransformVideo = useCallback(() => {
		if (companionTransformVideoRetryTimerRef.current) {
			clearTimeout(companionTransformVideoRetryTimerRef.current);
			companionTransformVideoRetryTimerRef.current = null;
		}
		const video = companionTransformVideoRef.current;
		if (video) {
			video.pause();
			video.currentTime = 0;
		}
		setCompanionTransformVideoOpen(false);
		setCompanionTransformVideoLoading(false);
		setCompanionTransformVideoNeedsControls(false);
	}, []);

	const showCompanionTransformVideo = useCallback((kind?: string | null) => {
		if (companionTransformVideoRetryTimerRef.current) {
			clearTimeout(companionTransformVideoRetryTimerRef.current);
			companionTransformVideoRetryTimerRef.current = null;
		}
		setCompanionTransformVideoFailed(false);
		setCompanionTransformVideoLoading(true);
		setCompanionTransformVideoNeedsControls(false);
		setCompanionTransformVideoRetry(0);
		companionTransformPlayHandledGenerationRef.current = -1;
		companionTransformPlayGenerationRef.current += 1;
		setCompanionTransformVideoSrc(companionTransformVideoUrl(kind));
		setCompanionTransformVideoOpen(true);
	}, []);

	useEffect(
		() => () => {
			if (companionTransformVideoRetryTimerRef.current) {
				clearTimeout(companionTransformVideoRetryTimerRef.current);
			}
		},
		[]
	);

	useEffect(() => {
		if (!companionTransformVideoOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') closeCompanionTransformVideo();
		};
		document.addEventListener('keydown', onKey);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = prevOverflow;
		};
	}, [companionTransformVideoOpen, closeCompanionTransformVideo]);

	const attemptCompanionTransformPlay = useCallback(
		async (video: HTMLVideoElement) => {
			try {
				video.muted = true;
				if (video.currentTime > 0.05) {
					video.currentTime = 0;
				}
				await video.play();
				setCompanionTransformVideoNeedsControls(false);
			} catch (err) {
				ewaCompanionDegradeDebug(
					'companion_transform_video_autoplay',
					'transform video autoplay blocked; showing controls',
					err
				);
				setCompanionTransformVideoNeedsControls(true);
			}
		},
		[]
	);

	const handleCompanionTransformVideoReady = useCallback(
		(event: SyntheticEvent<HTMLVideoElement>) => {
			const generation = companionTransformPlayGenerationRef.current;
			if (companionTransformPlayHandledGenerationRef.current === generation) {
				return;
			}
			companionTransformPlayHandledGenerationRef.current = generation;
			setCompanionTransformVideoLoading(false);
			void attemptCompanionTransformPlay(event.currentTarget);
		},
		[attemptCompanionTransformPlay]
	);

	const handleCompanionTransformVideoError = useCallback(
		(event: SyntheticEvent<HTMLVideoElement>) => {
			const video = event.currentTarget;
			if (
				video.networkState === HTMLMediaElement.NETWORK_LOADING ||
				video.readyState < HTMLMediaElement.HAVE_METADATA
			) {
				setCompanionTransformVideoLoading(true);
				return;
			}
			setCompanionTransformVideoRetry((attempt) => {
				if (attempt >= COMPANION_TRANSFORM_VIDEO_MAX_RETRIES) {
					setCompanionTransformVideoFailed(true);
					setCompanionTransformVideoLoading(false);
					return attempt;
				}
				const nextAttempt = attempt + 1;
				if (companionTransformVideoRetryTimerRef.current) {
					clearTimeout(companionTransformVideoRetryTimerRef.current);
				}
				companionTransformVideoRetryTimerRef.current = setTimeout(
					() => {
						companionTransformPlayHandledGenerationRef.current = -1;
						setCompanionTransformVideoSrc((src) => {
							const base = src.split('?')[0] ?? src;
							return `${base}?retry=${nextAttempt}&t=${Date.now()}`;
						});
						setCompanionTransformVideoLoading(true);
					},
					600 + nextAttempt * 800
				);
				return nextAttempt;
			});
		},
		[]
	);

	return {
		companionTransformVideoOpen,
		companionTransformVideoFailed,
		companionTransformVideoLoading,
		companionTransformVideoSrc,
		companionTransformVideoRetry,
		companionTransformVideoNeedsControls,
		companionTransformVideoRef,
		closeCompanionTransformVideo,
		showCompanionTransformVideo,
		handleCompanionTransformVideoReady,
		handleCompanionTransformVideoError,
	};
}
