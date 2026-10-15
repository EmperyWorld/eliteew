// AUDIO VIEWER - Audio player with waveform visualization
import { useSecureTicketMediaSrc } from '@/hooks/media/useSecureTicketMediaSrc';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useRef, useState, useEffect } from 'react';
import {
	ArrowPathIcon,
	BackwardIcon,
	ForwardIcon,
	MusicalNoteIcon,
	PauseIcon,
	PlayIcon,
	SpeakerWaveIcon,
	SpeakerXMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { log } from '../../../utils/logger';
import type { Content } from '../types';

interface AudioViewerProps {
	content: Content;
	fileUrl: string;
}

const iconBtn =
	'rounded-(--desktop-radius) p-2 text-(--desktop-text-secondary) transition-colors hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/40';

const AudioViewer: React.FC<AudioViewerProps> = ({ content, fileUrl }) => {
	const { t } = useTranslation('desktopUi');
	const { mediaSrc, accessDenied, onMediaError } = useSecureTicketMediaSrc({
		initialUrl: fileUrl,
		contentId: content.id,
	});
	const audioRef = useRef<HTMLAudioElement>(null);
	const [playing, setPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [volume, setVolume] = useState(1);
	const [muted, setMuted] = useState(false);
	const [metadataReady, setMetadataReady] = useState(false);
	const [isBuffering, setIsBuffering] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset player when media src changes
	useEffect(() => {
		setMetadataReady(false);
		setIsBuffering(false);
		setCurrentTime(0);
		setDuration(0);
		setPlaying(false);
	}, [mediaSrc]);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) {
			return;
		}

		const handleTimeUpdate = (): void => setCurrentTime(audio.currentTime);
		const handleLoadedMetadata = (): void => {
			setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
			setMetadataReady(true);
		};
		const handlePlay = (): void => setPlaying(true);
		const handlePause = (): void => setPlaying(false);
		const handleEnded = (): void => setPlaying(false);
		const handleWaiting = (): void => setIsBuffering(true);
		const handlePlaying = (): void => setIsBuffering(false);
		const handleCanPlay = (): void => setIsBuffering(false);

		audio.addEventListener('timeupdate', handleTimeUpdate);
		audio.addEventListener('loadedmetadata', handleLoadedMetadata);
		audio.addEventListener('play', handlePlay);
		audio.addEventListener('pause', handlePause);
		audio.addEventListener('ended', handleEnded);
		audio.addEventListener('waiting', handleWaiting);
		audio.addEventListener('playing', handlePlaying);
		audio.addEventListener('canplay', handleCanPlay);

		return (): void => {
			audio.removeEventListener('timeupdate', handleTimeUpdate);
			audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
			audio.removeEventListener('play', handlePlay);
			audio.removeEventListener('pause', handlePause);
			audio.removeEventListener('ended', handleEnded);
			audio.removeEventListener('waiting', handleWaiting);
			audio.removeEventListener('playing', handlePlaying);
			audio.removeEventListener('canplay', handleCanPlay);
		};
	}, []);

	const togglePlay = (): void => {
		if (accessDenied || !metadataReady || !audioRef.current) {
			return;
		}
		if (playing) {
			audioRef.current.pause();
		} else {
			audioRef.current.play().catch((err: unknown) => {
				const error = err instanceof Error ? err : new Error(String(err));
				log.error('AudioViewer', 'Failed to play audio', error);
			});
		}
	};

	const handleSeek = (e: React.ChangeEvent<HTMLInputElement>): void => {
		const time = parseFloat(e.target.value);
		setCurrentTime(time);
		if (audioRef.current) {
			audioRef.current.currentTime = time;
		}
	};

	const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		const vol = parseFloat(e.target.value);
		setVolume(vol);
		if (audioRef.current) {
			audioRef.current.volume = vol;
		}
	};

	const toggleMute = (): void => {
		setMuted(!muted);
		if (audioRef.current) {
			audioRef.current.muted = !muted;
		}
	};

	const skip = (seconds: number): void => {
		if (audioRef.current) {
			audioRef.current.currentTime += seconds;
		}
	};

	const formatTime = (time: number): string => {
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	};

	const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

	const playPrimaryLabel = !metadataReady
		? 'Загрузка аудио'
		: isBuffering && playing
			? 'Буферизация'
			: playing
				? 'Пауза'
				: 'Воспроизвести';

	return (
		<div
			className="flex min-h-[400px] flex-col items-center justify-center gap-6 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-8 py-10 shadow-(--desktop-shadow-soft)"
			aria-busy={!metadataReady && !accessDenied}
		>
			{accessDenied ? (
				<p className="text-sm text-red-400">{t('nowPlaying.error403')}</p>
			) : null}
			<audio
				ref={audioRef}
				src={mediaSrc}
				controls={false}
				preload="metadata"
				onError={onMediaError}
			>
				<source src={mediaSrc} type={content.mime_type ?? 'audio/mpeg'} />
				<track kind="captions" srcLang="und" label="Captions" />
				Ваш браузер не поддерживает воспроизведение аудио.
			</audio>

			<div className="flex items-center justify-center">
				<div className="relative">
					<div
						className={`flex h-28 w-28 items-center justify-center rounded-full border border-[rgb(var(--desktop-accent-rgb))/0.35] bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-[rgb(var(--desktop-accent-rgb))] ${playing ? 'animate-pulse' : ''}`}
					>
						<MusicalNoteIcon className="h-14 w-14" aria-hidden />
					</div>
					{playing && !isBuffering && (
						<div
							className="pointer-events-none absolute inset-0 rounded-full border-2 border-[rgb(var(--desktop-accent-rgb))/0.25] animate-ping"
							aria-hidden
						/>
					)}
				</div>
			</div>

			<div className="max-w-md w-full text-center">
				<h3 className="text-base font-semibold tracking-tight text-(--desktop-text-primary)">
					{content.name}
				</h3>
				<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1')}>
					{content.mime_type}
					{!metadataReady ? ' · загрузка…' : null}
				</p>
			</div>

			<div className="w-full max-w-md">
				<input
					type="range"
					min="0"
					max={duration || 0}
					value={currentTime}
					onChange={handleSeek}
					disabled={!metadataReady}
					className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-(--desktop-border-subtle) disabled:cursor-not-allowed disabled:opacity-50"
					aria-label="Прогресс воспроизведения"
					style={{
						background: `linear-gradient(to right, rgb(var(--desktop-accent-rgb)) 0%, rgb(var(--desktop-accent-rgb)) ${progressPct}%, color-mix(in srgb, var(--desktop-border-subtle) 100%, transparent) ${progressPct}%, color-mix(in srgb, var(--desktop-border-subtle) 100%, transparent) 100%)`,
					}}
				/>
				<div className="mt-2 flex justify-between text-[11px] tabular-nums text-(--desktop-text-dim)">
					<span>{formatTime(currentTime)}</span>
					<span>{metadataReady ? formatTime(duration) : '—:—'}</span>
				</div>
			</div>

			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={() => skip(-10)}
					className={iconBtn}
					title="Назад 10 с"
					aria-label="Назад 10 секунд"
				>
					<BackwardIcon className="h-5 w-5" />
				</button>
				<button
					type="button"
					onClick={togglePlay}
					disabled={!metadataReady}
					className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--desktop-accent-rgb))] text-white transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/50 disabled:cursor-not-allowed disabled:opacity-45"
					aria-label={playPrimaryLabel}
					aria-pressed={playing}
				>
					{!metadataReady || (isBuffering && playing) ? (
						<ArrowPathIcon className="h-7 w-7 animate-spin" aria-hidden />
					) : playing ? (
						<PauseIcon className="h-7 w-7" aria-hidden />
					) : (
						<PlayIcon className="ml-0.5 h-7 w-7" aria-hidden />
					)}
				</button>
				<button
					type="button"
					onClick={() => skip(10)}
					className={iconBtn}
					title="Вперёд 10 с"
					aria-label="Вперёд 10 секунд"
				>
					<ForwardIcon className="h-5 w-5" />
				</button>
			</div>

			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={toggleMute}
					className={iconBtn}
					aria-label={muted ? 'Включить звук' : 'Выключить звук'}
					aria-pressed={muted}
				>
					{muted ? (
						<SpeakerXMarkIcon className="h-5 w-5" />
					) : (
						<SpeakerWaveIcon className="h-5 w-5" />
					)}
				</button>
				<input
					type="range"
					min="0"
					max="1"
					step="0.1"
					value={muted ? 0 : volume}
					onChange={handleVolumeChange}
					disabled={!metadataReady}
					className="h-1 w-36 cursor-pointer appearance-none rounded-lg bg-(--desktop-border-subtle) disabled:cursor-not-allowed disabled:opacity-50"
					aria-label="Громкость"
				/>
			</div>
		</div>
	);
};

export default AudioViewer;
