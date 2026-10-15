// VIDEO VIEWER - HTML5 video player with controls
import * as React from 'react';
import { useRef, useState, useEffect } from 'react';
import {
	BackwardIcon,
	ForwardIcon,
	PauseIcon,
	PlayIcon,
	SpeakerWaveIcon,
	SpeakerXMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useSecureTicketMediaSrc } from '@/hooks/media/useSecureTicketMediaSrc';
import { log } from '../../../utils/logger';
import type { Content } from '../types';

interface VideoViewerProps {
	content: Content;
	fileUrl: string;
	isFullscreen: boolean;
}

const VideoViewer: React.FC<VideoViewerProps> = ({ content, fileUrl }) => {
	const { t } = useTranslation('desktopUi');
	const { mediaSrc, accessDenied, onMediaError } = useSecureTicketMediaSrc({
		initialUrl: fileUrl,
		contentId: content.id,
	});
	const videoRef = useRef<HTMLVideoElement>(null);
	const [playing, setPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [volume, setVolume] = useState(1);
	const [muted, setMuted] = useState(false);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) {
			return;
		}

		const handleTimeUpdate = (): void => setCurrentTime(video.currentTime);
		const handleLoadedMetadata = (): void => setDuration(video.duration);
		const handlePlay = (): void => setPlaying(true);
		const handlePause = (): void => setPlaying(false);

		video.addEventListener('timeupdate', handleTimeUpdate);
		video.addEventListener('loadedmetadata', handleLoadedMetadata);
		video.addEventListener('play', handlePlay);
		video.addEventListener('pause', handlePause);

		return (): void => {
			video.removeEventListener('timeupdate', handleTimeUpdate);
			video.removeEventListener('loadedmetadata', handleLoadedMetadata);
			video.removeEventListener('play', handlePlay);
			video.removeEventListener('pause', handlePause);
		};
	}, []);

	const togglePlay = (): void => {
		if (videoRef.current) {
			if (playing) {
				videoRef.current.pause();
			} else {
				videoRef.current.play().catch((err: unknown) => {
					const error = err instanceof Error ? err : new Error(String(err));
					log.error('VideoViewer', 'Failed to play video', error);
				});
			}
		}
	};

	const handleSeek = (e: React.ChangeEvent<HTMLInputElement>): void => {
		const time = parseFloat(e.target.value);
		setCurrentTime(time);
		if (videoRef.current) {
			videoRef.current.currentTime = time;
		}
	};

	const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		const vol = parseFloat(e.target.value);
		setVolume(vol);
		if (videoRef.current) {
			videoRef.current.volume = vol;
		}
	};

	const toggleMute = (): void => {
		setMuted(!muted);
		if (videoRef.current) {
			videoRef.current.muted = !muted;
		}
	};

	const skip = (seconds: number): void => {
		if (videoRef.current) {
			videoRef.current.currentTime += seconds;
		}
	};

	const formatTime = (time: number): string => {
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	};

	return (
		<div className="relative bg-black h-full flex flex-col">
			{accessDenied ? (
				<div className="flex-1 flex items-center justify-center px-6 text-center text-red-300">
					{t('nowPlaying.error403')}
				</div>
			) : (
				<div className="flex-1 flex items-center justify-center">
					<video
						ref={videoRef}
						src={mediaSrc}
						className="max-w-full max-h-full"
						onClick={togglePlay}
						onError={onMediaError}
					>
						<track kind="captions" srcLang="und" label="Captions" />
					</video>
				</div>
			)}

			{/* Custom Controls */}
			<div className="bg-black/80 backdrop-blur-xs p-4 border-t border-white/20">
				{/* Progress Bar */}
				<div className="mb-3">
					<input
						type="range"
						min="0"
						max={duration || 0}
						value={currentTime}
						onChange={handleSeek}
						aria-label="Прогресс воспроизведения"
						className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
						style={{
							background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(currentTime / duration) * 100}%, #374151 ${(currentTime / duration) * 100}%, #374151 100%)`,
						}}
					/>
					<div className="flex justify-between text-xs text-gray-400 mt-1">
						<span>{formatTime(currentTime)}</span>
						<span>{formatTime(duration)}</span>
					</div>
				</div>

				{/* Control Buttons */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => skip(-10)}
							className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
							title="Rewind 10s"
						>
							<BackwardIcon className="w-5 h-5" />
						</button>
						<button
							type="button"
							onClick={togglePlay}
							className="p-3 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors text-white"
						>
							{playing ? (
								<PauseIcon className="w-5 h-5" />
							) : (
								<PlayIcon className="w-5 h-5" />
							)}
						</button>
						<button
							type="button"
							onClick={() => skip(10)}
							className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
							title="Forward 10s"
						>
							<ForwardIcon className="w-5 h-5" />
						</button>
					</div>

					{/* Volume Controls */}
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={toggleMute}
							className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
						>
							{muted ? (
								<SpeakerXMarkIcon className="w-5 h-5" />
							) : (
								<SpeakerWaveIcon className="w-5 h-5" />
							)}
						</button>
						<input
							type="range"
							min="0"
							aria-label="Громкость"
							max="1"
							step="0.1"
							value={muted ? 0 : volume}
							onChange={handleVolumeChange}
							className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

export default VideoViewer;
