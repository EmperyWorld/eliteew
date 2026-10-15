/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Taskbar volume icon (glyph by level) + portaled slider / now-playing menus.
 * Isolated memo subtree from TaskbarRightToolbar.
 *
 * Invariants:
 * - Primary rail shows a single speaker icon (muted/low/medium/high) — no permanent range.
 * - Left click opens slider popover (mute + range); wheel on icon adjusts volume.
 * - Context menu opens portaled now-playing menu via ShellPortalMount.
 * - Range never nests inside role=button on the rail chip.
 *
 * Related:
 * - ../TaskbarRightToolbar.tsx
 * - utils/desktopTaskbarAttentionPolicy.ts
 * - TaskbarRightToolbar.volume.contract.test.ts
 */

import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { themeDesignTokens } from '@/theme/designTokens';
import { cn } from '@/utils/cn';
import { AnimatePresence, m } from 'framer-motion';
import {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type WheelEvent as ReactWheelEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { hasDesktopAudioUserGesture } from '../../utils/notificationSound';
import { useDesktopPopoverOpenGuard } from '../../hooks/useDesktopPopoverOpenGuard';
import { FavoriteHexIcon } from '../../../MusicPlayer/MusicPlayerFavoriteHex';
import { NowPlayingLoadHint } from '@/components/Audio/NowPlayingLoadHint';
import { useMusicLibraryContext } from '../../context/MusicLibraryContext';
import { useMusicPlaybackDomain } from '../../context/MusicPlaybackDomainContext';
import { useNowPlayingTransport } from '../../context/NowPlayingContext';
import { getFloatingMenuPosition } from '../../utils/desktopUi';
import { shouldCloseVolumeMenuOnOutsidePointer } from '../../utils/desktopShellOutsideDismiss';
import {
	resolveTaskbarVolumeGlyphLevel,
	type TaskbarVolumeGlyphLevel,
} from '../../utils/desktopTaskbarAttentionPolicy';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { DesktopAppButton, DesktopAppMenuSurface } from '../DesktopAppChrome';
import { TASKBAR_VOLUME_PERCENT_CLASS } from './taskbarChrome';
import {
	BackwardIcon,
	ForwardIcon,
	PauseIcon,
	PlayIcon,
	SpeakerXMarkIcon,
} from '@heroicons/react/24/outline';

function clampVolume(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function swallowWheelEvent(event: ReactWheelEvent<HTMLElement>): void {
	if (event.cancelable) {
		event.preventDefault();
	}
	event.stopPropagation();
}

const VOLUME_WHEEL_STEP = 0.04;
const VOLUME_CUE_MIN_INTERVAL_MS = 70;

/** Popover / menu track — same thumb language as prior taskbar range. */
const TASKBAR_VOLUME_RANGE_CLASS = cn(
	'h-1.5 min-h-0 w-full min-w-20 max-w-none shrink-0 cursor-pointer appearance-none rounded-full accent-[rgb(var(--desktop-accent-rgb))]',
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-app)',
	'bg-(--desktop-border-subtle)',
	'[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[color-mix(in_srgb,var(--desktop-border-subtle)_82%,var(--desktop-text-muted)_18%)]',
	'[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[color-mix(in_srgb,var(--desktop-border-subtle)_82%,var(--desktop-text-muted)_18%)]',
	'[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-(--desktop-surface-app) [&::-webkit-slider-thumb]:bg-[rgb(var(--desktop-accent-rgb))] [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.45),0_1px_4px_rgb(0_0_0/0.35)]',
	'[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-(--desktop-surface-app) [&::-moz-range-thumb]:bg-[rgb(var(--desktop-accent-rgb))] [&::-moz-range-thumb]:shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.45),0_1px_4px_rgb(0_0_0/0.35)]'
);

function TaskbarVolumeLevelIcon({
	level,
	className,
}: {
	level: TaskbarVolumeGlyphLevel;
	className?: string;
}) {
	if (level === 'muted') {
		return (
			<SpeakerXMarkIcon
				className={className}
				strokeWidth={DESKTOP_LUCIDE.stroke}
				aria-hidden
				data-volume-level="muted"
			/>
		);
	}
	const showMid = level === 'medium' || level === 'high';
	const showHigh = level === 'high';
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth={DESKTOP_LUCIDE.stroke}
			stroke="currentColor"
			className={className}
			aria-hidden
			data-volume-level={level}
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M6 9.75v4.5a.75.75 0 0 0 .75.75h2.19l3.81 3.06V5.94L8.94 9H6.75A.75.75 0 0 0 6 9.75Z"
			/>
			{level === 'low' || showMid ? (
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M15.54 9.46a3 3 0 0 1 0 5.08"
				/>
			) : null}
			{showMid ? (
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M17.66 7.34a6 6 0 0 1 0 9.32"
					opacity={showHigh ? 0.55 : 1}
				/>
			) : null}
			{showHigh ? (
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M19.78 5.22a9 9 0 0 1 0 13.56"
				/>
			) : null}
		</svg>
	);
}

export type TaskbarVolumeControlProps = {
	taskbarButtonSurface: string;
};

export const TaskbarVolumeControl = memo(function TaskbarVolumeControl({
	taskbarButtonSurface,
}: TaskbarVolumeControlProps) {
	const { t } = useTranslation('desktopUi');
	const portalStackBase = useDesktopWindowPortalStackBase();
	const { taskbar } = themeDesignTokens.desktop;
	const {
		track,
		playing,
		isLoading,
		isLoadingStalled,
		error: playbackError,
		errorTrackId,
		retryCurrentTrack,
		volume,
		setVolume,
		togglePlayPause,
		next,
		prev,
	} = useNowPlayingTransport();
	const { hasPrev, hasNext } = useMusicPlaybackDomain();
	const { favoriteIdsSet, toggleFavorite } = useMusicLibraryContext();
	const volumePercent = Math.round(volume * 100);
	const volumeLevel = resolveTaskbarVolumeGlyphLevel(volume);
	const isFavoriteTrack = track ? favoriteIdsSet.has(track.id) : false;
	const [volumeMenu, setVolumeMenu] = useState<{ x: number; y: number } | null>(
		null
	);
	const [volumeSlider, setVolumeSlider] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const volumeMenuOpenClickGuardRef = useDesktopPopoverOpenGuard(
		volumeMenu !== null || volumeSlider !== null
	);
	const volumeButtonRef = useRef<HTMLButtonElement | null>(null);
	const volumeRef = useRef(volume);
	const lastNonZeroVolumeRef = useRef(volume > 0 ? volume : 0.7);
	const audioCueContextRef = useRef<AudioContext | null>(null);
	const audioCueLastAtRef = useRef(0);

	useEffect(() => {
		volumeRef.current = volume;
		if (volume > 0.001) {
			lastNonZeroVolumeRef.current = volume;
		}
	}, [volume]);

	useEffect(() => {
		return () => {
			if (audioCueContextRef.current) {
				void audioCueContextRef.current.close().catch(() => {});
				audioCueContextRef.current = null;
			}
		};
	}, []);

	const playVolumeStepCue = useCallback((level: number) => {
		if (typeof window === 'undefined') return;
		const now = performance.now();
		if (now - audioCueLastAtRef.current < VOLUME_CUE_MIN_INTERVAL_MS) return;
		audioCueLastAtRef.current = now;
		const AudioContextCtor =
			window.AudioContext ||
			(
				window as Window & {
					webkitAudioContext?: typeof AudioContext;
				}
			).webkitAudioContext;
		if (!AudioContextCtor) return;
		if (!hasDesktopAudioUserGesture()) return;
		if (!audioCueContextRef.current) {
			audioCueContextRef.current = new AudioContextCtor();
		}
		const ctx = audioCueContextRef.current;
		if (ctx.state === 'suspended') {
			void ctx.resume().catch(() => {});
		}
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		const startedAt = ctx.currentTime;
		const duration = 0.032;
		const normalizedLevel = clampVolume(level);
		const frequency = 180 + normalizedLevel * 1240;
		const peakGain = 0.026 + normalizedLevel * 0.074;
		osc.type = 'sine';
		osc.frequency.setValueAtTime(frequency, startedAt);
		gain.gain.setValueAtTime(0.0001, startedAt);
		gain.gain.linearRampToValueAtTime(peakGain, startedAt + 0.004);
		gain.gain.exponentialRampToValueAtTime(
			Math.max(0.003, peakGain * 0.24),
			startedAt + duration * 0.55
		);
		gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + duration);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(startedAt);
		osc.stop(startedAt + duration + 0.01);
	}, []);

	const applyVolume = useCallback(
		(nextVolume: number, withCue = false) => {
			const safe = clampVolume(nextVolume);
			volumeRef.current = safe;
			if (safe > 0.001) {
				lastNonZeroVolumeRef.current = safe;
			}
			setVolume(safe);
			if (withCue) {
				playVolumeStepCue(safe);
			}
		},
		[playVolumeStepCue, setVolume]
	);

	const adjustVolumeByWheel = useCallback(
		(delta: number) => {
			applyVolume(volumeRef.current + delta, false);
		},
		[applyVolume]
	);

	const toggleMute = useCallback(() => {
		if (volumeRef.current <= 0.001) {
			applyVolume(
				lastNonZeroVolumeRef.current > 0 ? lastNonZeroVolumeRef.current : 0.7
			);
			return;
		}
		applyVolume(0);
	}, [applyVolume]);

	const openVolumeMenu = useCallback((x: number, y: number) => {
		setVolumeSlider(null);
		setVolumeMenu({ x, y });
	}, []);

	const closeVolumeMenu = useCallback(() => {
		setVolumeMenu(null);
	}, []);

	const openVolumeSlider = useCallback(() => {
		const el = volumeButtonRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		setVolumeMenu(null);
		setVolumeSlider((prev) =>
			prev
				? null
				: {
						x: rect.left + rect.width / 2,
						y: rect.top,
					}
		);
	}, []);

	const closeVolumeSlider = useCallback(() => {
		setVolumeSlider(null);
	}, []);

	const volumeMenuPos = useMemo(() => {
		if (!volumeMenu) return null;
		return getFloatingMenuPosition(
			{ x: volumeMenu.x, y: volumeMenu.y },
			{
				menuWidth: 272,
				menuHeight: track ? 190 : 138,
				preferAbove: true,
				anchorGap: 12,
			}
		);
	}, [track, volumeMenu]);

	const volumeSliderPos = useMemo(() => {
		if (!volumeSlider) return null;
		return getFloatingMenuPosition(
			{ x: volumeSlider.x, y: volumeSlider.y },
			{
				menuWidth: 240,
				menuHeight: 118,
				preferAbove: true,
				anchorGap: 12,
			}
		);
	}, [volumeSlider]);

	useEffect(() => {
		if (!volumeMenu && !volumeSlider) return;
		const onWindowPointerDown = (event: MouseEvent | PointerEvent) => {
			if (
				!shouldCloseVolumeMenuOnOutsidePointer({
					openClickGuardActive: volumeMenuOpenClickGuardRef.current,
					target: event.target as Element,
				})
			) {
				return;
			}
			setVolumeMenu(null);
			setVolumeSlider(null);
		};
		window.addEventListener('mousedown', onWindowPointerDown, {
			capture: true,
		});
		window.addEventListener('pointerdown', onWindowPointerDown, {
			capture: true,
		});
		return () => {
			window.removeEventListener('mousedown', onWindowPointerDown, {
				capture: true,
			});
			window.removeEventListener('pointerdown', onWindowPointerDown, {
				capture: true,
			});
		};
	}, [volumeMenu, volumeSlider, volumeMenuOpenClickGuardRef]);

	useEffect(() => {
		if (!volumeMenu && !volumeSlider) return;
		const onEsc = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setVolumeMenu(null);
				setVolumeSlider(null);
			}
		};
		window.addEventListener('keydown', onEsc);
		return () => window.removeEventListener('keydown', onEsc);
	}, [volumeMenu, volumeSlider]);

	return (
		<>
			<DesktopChromeTooltip
				content={`${t('taskbar.taskbarVolumeLabel')}: ${volumePercent}% · ${t('taskbar.taskbarVolumeWheelHint')} · ${t('taskbar.taskbarVolumeLeftClickHint')} · ${t('taskbar.taskbarVolumeContextHint')}`}
				placement="top"
				offsetExtra={12}
			>
				<button
					ref={volumeButtonRef}
					type="button"
					data-taskbar-interactive="true"
					data-volume-mini-popup
					data-volume-level={volumeLevel}
					className={cn(
						'm-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 p-0',
						taskbar.HIT_MIN_CLASS,
						taskbar.ICON_FOCUS,
						taskbarButtonSurface,
						'text-(--desktop-text-secondary) hover:text-(--desktop-text-primary)'
					)}
					aria-label={`${t('taskbar.taskbarVolumeLabel')}: ${volumePercent}%`}
					aria-expanded={volumeSlider !== null || volumeMenu !== null}
					aria-haspopup="dialog"
					onClick={(e) => {
						e.stopPropagation();
						openVolumeSlider();
					}}
					onWheel={(e) => {
						swallowWheelEvent(e);
						const delta = e.deltaY > 0 ? -VOLUME_WHEEL_STEP : VOLUME_WHEEL_STEP;
						adjustVolumeByWheel(delta);
					}}
					onContextMenu={(e) => {
						e.preventDefault();
						e.stopPropagation();
						openVolumeMenu(e.clientX, e.clientY);
					}}
				>
					<TaskbarVolumeLevelIcon
						level={volumeLevel}
						className="h-4 w-4 shrink-0"
					/>
				</button>
			</DesktopChromeTooltip>
			<ShellPortalMount>
				<AnimatePresence>
					{volumeSlider && volumeSliderPos ? (
						<m.div
							key="taskbar-volume-slider"
							initial={{ opacity: 0, scale: 0.96, y: 4 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.96, y: 4 }}
							transition={{ duration: 0.12 }}
							className="fixed"
							style={{
								zIndex: portalStackBase,
								left: volumeSliderPos.x,
								top: volumeSliderPos.y,
							}}
							data-volume-mini-popup
							onClick={(e) => e.stopPropagation()}
							onMouseDown={(e) => e.stopPropagation()}
						>
							<DesktopAppMenuSurface className="w-60 p-2.5">
								<div className="mb-2 flex items-center justify-between gap-2">
									<p className={DESKTOP_TYPOGRAPHY.widgetTrackTitle}>
										{t('taskbar.taskbarVolumeLabel')}
									</p>
									<span className={TASKBAR_VOLUME_PERCENT_CLASS}>
										{volumePercent}%
									</span>
								</div>
								<div className="flex items-center gap-2">
									<button
										type="button"
										className={cn(
											'inline-flex shrink-0 items-center justify-center rounded-md p-1',
											'text-(--desktop-text-secondary) hover:text-(--desktop-text-primary)',
											'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
										)}
										aria-label={
											volume <= 0
												? t('taskbar.taskbarVolumeUnmuteAria', {
														defaultValue: t('taskbar.taskbarVolumeLabel'),
													})
												: t('taskbar.taskbarVolumeMuteAria', {
														defaultValue: t('taskbar.taskbarVolumeLabel'),
													})
										}
										onClick={(e) => {
											e.stopPropagation();
											toggleMute();
										}}
									>
										<TaskbarVolumeLevelIcon
											level={volumeLevel}
											className="h-4 w-4 shrink-0"
										/>
									</button>
									<input
										type="range"
										min={0}
										max={1}
										step={0.01}
										value={volume}
										onChange={(e) => applyVolume(Number(e.target.value))}
										onWheel={(e) => {
											swallowWheelEvent(e);
											const delta =
												e.deltaY > 0 ? -VOLUME_WHEEL_STEP : VOLUME_WHEEL_STEP;
											adjustVolumeByWheel(delta);
										}}
										className={TASKBAR_VOLUME_RANGE_CLASS}
										aria-label={t('taskbar.taskbarVolumeLabel')}
										aria-valuetext={`${volumePercent}%`}
									/>
								</div>
								<div className="mt-2 flex justify-end">
									<DesktopAppButton
										type="button"
										size="sm"
										variant="neutral"
										onClick={closeVolumeSlider}
									>
										{t('taskbar.volumeMenuClose')}
									</DesktopAppButton>
								</div>
							</DesktopAppMenuSurface>
						</m.div>
					) : null}
					{volumeMenu && volumeMenuPos ? (
						<m.div
							key="taskbar-volume-menu"
							initial={{ opacity: 0, scale: 0.96, y: 4 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.96, y: 4 }}
							transition={{ duration: 0.12 }}
							className="fixed"
							style={{
								zIndex: portalStackBase,
								left: volumeMenuPos.x,
								top: volumeMenuPos.y,
							}}
							data-volume-mini-popup
							onClick={(e) => e.stopPropagation()}
							onMouseDown={(e) => e.stopPropagation()}
						>
							<DesktopAppMenuSurface className="w-68 p-2.5">
								<div className="mb-2 flex items-center justify-between gap-2">
									<p
										className={cn(
											DESKTOP_TYPOGRAPHY.widgetTrackTitle,
											'truncate'
										)}
									>
										{track?.name ?? t('taskbar.volumeMenuNoTrack')}
									</p>
									<DesktopAppButton
										type="button"
										size="sm"
										variant={isFavoriteTrack ? 'accent' : 'ghost'}
										className="shrink-0 gap-1.5 px-2"
										disabled={!track}
										onClick={() => {
											if (!track) return;
											toggleFavorite(track.id);
										}}
									>
										<FavoriteHexIcon
											className="h-4 w-4"
											filled={isFavoriteTrack}
										/>
										<span
											className={cn(
												DESKTOP_TYPOGRAPHY.captionInherit,
												'text-(--desktop-text-primary)'
											)}
										>
											{isFavoriteTrack
												? t('taskbar.volumeMenuFavoriteRemove')
												: t('taskbar.volumeMenuFavoriteAdd')}
										</span>
									</DesktopAppButton>
								</div>
								<NowPlayingLoadHint
									compact
									className="mb-2"
									isLoadingStalled={isLoadingStalled}
									error={
										playbackError ??
										(errorTrackId
											? t('settingsPanel.widgetsPanel.playbackError')
											: null)
									}
									onRetry={() => {
										void retryCurrentTrack();
									}}
								/>
								<div className="grid grid-cols-3 gap-1.5">
									<DesktopChromeTooltip
										content={t('taskbar.volumeMenuPrev')}
										placement="top"
										offsetExtra={8}
									>
										<span className="inline-flex">
											<DesktopAppButton
												type="button"
												variant="ghost"
												size="icon"
												disabled={!track || !hasPrev}
												onClick={() => prev()}
												aria-label={t('taskbar.volumeMenuPrev')}
											>
												<BackwardIcon
													className={taskbar.ICON_CLASS}
													strokeWidth={DESKTOP_LUCIDE.stroke}
												/>
											</DesktopAppButton>
										</span>
									</DesktopChromeTooltip>
									<DesktopChromeTooltip
										content={
											playing
												? t('taskbar.volumeMenuPause')
												: t('taskbar.volumeMenuPlay')
										}
										placement="top"
										offsetExtra={8}
									>
										<span className="inline-flex">
											<DesktopAppButton
												type="button"
												variant="ghost"
												size="icon"
												disabled={!track || isLoading}
												onClick={() => togglePlayPause()}
												aria-label={
													playing
														? t('taskbar.volumeMenuPause')
														: t('taskbar.volumeMenuPlay')
												}
											>
												{playing ? (
													<PauseIcon
														className={taskbar.ICON_CLASS}
														strokeWidth={DESKTOP_LUCIDE.stroke}
													/>
												) : (
													<PlayIcon
														className={taskbar.ICON_CLASS}
														strokeWidth={DESKTOP_LUCIDE.stroke}
													/>
												)}
											</DesktopAppButton>
										</span>
									</DesktopChromeTooltip>
									<DesktopChromeTooltip
										content={t('taskbar.volumeMenuNext')}
										placement="top"
										offsetExtra={8}
									>
										<span className="inline-flex">
											<DesktopAppButton
												type="button"
												variant="ghost"
												size="icon"
												disabled={!track || !hasNext}
												onClick={() => next()}
												aria-label={t('taskbar.volumeMenuNext')}
											>
												<ForwardIcon
													className={taskbar.ICON_CLASS}
													strokeWidth={DESKTOP_LUCIDE.stroke}
												/>
											</DesktopAppButton>
										</span>
									</DesktopChromeTooltip>
								</div>
								<div className="mt-2 flex items-center justify-between gap-2">
									<span
										className={cn(
											DESKTOP_TYPOGRAPHY.shellMeta10,
											'tracking-normal'
										)}
									>
										{t('taskbar.taskbarVolumeLabel')}
									</span>
									<span className={TASKBAR_VOLUME_PERCENT_CLASS}>
										{volumePercent}%
									</span>
								</div>
								<input
									type="range"
									min={0}
									max={1}
									step={0.01}
									value={volume}
									onChange={(e) => applyVolume(Number(e.target.value))}
									onWheel={(e) => {
										swallowWheelEvent(e);
										const delta =
											e.deltaY > 0 ? -VOLUME_WHEEL_STEP : VOLUME_WHEEL_STEP;
										adjustVolumeByWheel(delta);
									}}
									className={cn(TASKBAR_VOLUME_RANGE_CLASS, 'mt-1.5')}
									aria-label={t('taskbar.taskbarVolumeAria', {
										volume: volumePercent,
									})}
								/>
								<div className="mt-2 flex justify-end">
									<DesktopAppButton
										type="button"
										size="sm"
										variant="neutral"
										onClick={closeVolumeMenu}
									>
										{t('taskbar.volumeMenuClose')}
									</DesktopAppButton>
								</div>
							</DesktopAppMenuSurface>
						</m.div>
					) : null}
				</AnimatePresence>
			</ShellPortalMount>
		</>
	);
});
