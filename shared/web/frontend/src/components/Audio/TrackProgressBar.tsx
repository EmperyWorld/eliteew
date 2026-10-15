/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared seek/progress bar for desktop audio playback surfaces.
 *
 * Invariants:
 * - Hover/seek coordinates clamp to [0, duration].
 * - Buffered ranges render only within valid duration boundaries.
 *
 * Related:
 * - src/pages/Desktop/context/NowPlayingContext.tsx
 * - src/pages/MusicPlayer/MusicPlayerNowPlayingBar.tsx
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { formatDuration } from '../../utils/formatDuration';

type BufferedRange = { start: number; end: number };
type TrackProgressMarker = { time: number; label?: string };

interface TrackProgressBarProps {
	currentTime: number;
	duration: number;
	onSeek?: (time: number) => void;
	bufferedRanges?: BufferedRange[];
	markers?: TrackProgressMarker[];
	/**
	 * Компактный режим – тонкая полоса без большого слайдера.
	 * Используется в мини‑виджете на десктопе.
	 */
	compact?: boolean;
	className?: string;
}

function clientXToTime(
	clientX: number,
	rect: DOMRect,
	safeDuration: number
): number {
	const relative = (clientX - rect.left) / rect.width;
	const clamped = Math.max(0, Math.min(1, relative));
	return clamped * safeDuration;
}

function normalizeBufferedRanges(
	ranges: BufferedRange[] | undefined,
	safeDuration: number
): BufferedRange[] {
	if (!ranges || safeDuration <= 0) return [];
	return ranges
		.filter(
			(range) => Number.isFinite(range.start) && Number.isFinite(range.end)
		)
		.map((range) => ({
			start: Math.max(0, Math.min(safeDuration, range.start)),
			end: Math.max(0, Math.min(safeDuration, range.end)),
		}))
		.filter((range) => range.end > range.start)
		.sort((a, b) => a.start - b.start);
}

function normalizeMarkers(
	markers: TrackProgressMarker[] | undefined,
	safeDuration: number
): TrackProgressMarker[] {
	if (!markers || safeDuration <= 0) return [];
	return markers
		.filter((marker) => Number.isFinite(marker.time))
		.map((marker) => ({
			...marker,
			time: Math.max(0, Math.min(safeDuration, marker.time)),
		}))
		.sort((a, b) => a.time - b.time);
}

export const TrackProgressBar: React.FC<TrackProgressBarProps> = ({
	currentTime,
	duration,
	onSeek,
	bufferedRanges,
	markers,
	compact = false,
	className,
}) => {
	const [hoverPercent, setHoverPercent] = useState<number | null>(null);
	const barRef = useRef<HTMLButtonElement>(null);
	const draggingRef = useRef(false);

	const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
	const clampedTime = Math.min(Math.max(currentTime, 0), safeDuration || 0);
	const percent = safeDuration > 0 ? (clampedTime / safeDuration) * 100 : 0;
	const normalizedBufferedRanges = useMemo(
		() => normalizeBufferedRanges(bufferedRanges, safeDuration),
		[bufferedRanges, safeDuration]
	);
	const normalizedMarkers = useMemo(
		() => normalizeMarkers(markers, safeDuration),
		[markers, safeDuration]
	);

	const hoverTime = useMemo(() => {
		if (hoverPercent == null || safeDuration <= 0) return null;
		return (hoverPercent / 100) * safeDuration;
	}, [hoverPercent, safeDuration]);
	const hoverTooltipPercent =
		hoverPercent == null ? null : Math.max(6, Math.min(94, hoverPercent));

	const seekFromClientX = useCallback(
		(clientX: number) => {
			if (!onSeek || safeDuration <= 0 || !barRef.current) return;
			const rect = barRef.current.getBoundingClientRect();
			onSeek(clientXToTime(clientX, rect, safeDuration));
		},
		[onSeek, safeDuration]
	);

	const handleBarSeek = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			seekFromClientX(e.clientX);
		},
		[seekFromClientX]
	);

	const handleBarHover = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			if (safeDuration <= 0) {
				setHoverPercent(null);
				return;
			}
			const rect = e.currentTarget.getBoundingClientRect();
			const relative = (e.clientX - rect.left) / rect.width;
			const clamped = Math.max(0, Math.min(1, relative));
			setHoverPercent(clamped * 100);
		},
		[safeDuration]
	);

	const handleBarLeave = useCallback(() => {
		if (!draggingRef.current) setHoverPercent(null);
	}, []);

	const onPointerDown = useCallback(
		(e: React.PointerEvent<HTMLButtonElement>) => {
			if (!onSeek || safeDuration <= 0) return;
			e.currentTarget.setPointerCapture(e.pointerId);
			draggingRef.current = true;
			seekFromClientX(e.clientX);
		},
		[onSeek, safeDuration, seekFromClientX]
	);

	useEffect(() => {
		const onMove = (e: PointerEvent): void => {
			if (!draggingRef.current) return;
			seekFromClientX(e.clientX);
		};
		const onUp = (): void => {
			draggingRef.current = false;
			setHoverPercent(null);
		};
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
		return (): void => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
		};
	}, [seekFromClientX]);

	const onKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLButtonElement>) => {
			if (!onSeek || safeDuration <= 0) return;
			const step = Math.max(5, safeDuration * 0.05);
			let next = clampedTime;
			if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
				e.preventDefault();
				next = Math.min(safeDuration, clampedTime + step);
			} else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
				e.preventDefault();
				next = Math.max(0, clampedTime - step);
			} else if (e.key === 'Home') {
				e.preventDefault();
				next = 0;
			} else if (e.key === 'End') {
				e.preventDefault();
				next = safeDuration;
			} else {
				return;
			}
			onSeek(next);
		},
		[onSeek, safeDuration, clampedTime]
	);

	const barHeight = compact ? 'h-0.5' : 'h-2';
	/** Unplayed rail: higher contrast vs played accent (no HTML5 buffer API here). */
	const railBgClass =
		'bg-[color-mix(in_srgb,var(--desktop-border-subtle)_78%,var(--desktop-text-primary)_22%)]';
	const thumbClass = compact
		? ''
		: 'absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-(--desktop-surface-app) bg-[rgb(var(--desktop-accent-rgb))] shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.5),0_2px_8px_rgb(0_0_0/0.35)] transition-transform group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.55)]';

	const sliderA11y =
		onSeek && safeDuration > 0
			? {
					role: 'slider' as const,
					'aria-valuemin': 0,
					'aria-valuemax': Math.round(safeDuration),
					'aria-valuenow': Math.round(clampedTime),
					'aria-label': 'Позиция в треке',
					'aria-valuetext': `${formatDuration(clampedTime)} из ${formatDuration(safeDuration)}`,
				}
			: {
					role: 'progressbar' as const,
					'aria-valuemin': 0,
					'aria-valuemax': 100,
					'aria-valuenow': safeDuration > 0 ? Math.round(percent) : 0,
					'aria-label': 'Прогресс воспроизведения',
				};

	if (compact) {
		return (
			<div className={cn('flex flex-col gap-1', className)}>
				<button
					ref={barRef}
					type="button"
					className={cn(
						'relative w-full cursor-pointer overflow-hidden rounded-full border border-(--desktop-border-subtle) group touch-none',
						railBgClass,
						barHeight,
						onSeek && safeDuration > 0
							? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-1 focus-visible:ring-offset-(--desktop-surface-app)'
							: 'pointer-events-none cursor-default'
					)}
					data-testid="track-progress-bar-inner"
					disabled={!onSeek || safeDuration <= 0}
					onClick={handleBarSeek}
					onPointerDown={onPointerDown}
					onMouseMove={handleBarHover}
					onMouseLeave={handleBarLeave}
					onKeyDown={onKeyDown}
					tabIndex={onSeek && safeDuration > 0 ? 0 : -1}
					{...sliderA11y}
				>
					{normalizedBufferedRanges.map((range) => {
						const left = (range.start / safeDuration) * 100;
						const width = ((range.end - range.start) / safeDuration) * 100;
						return (
							<div
								key={`${range.start}-${range.end}`}
								data-testid="track-progress-buffered-range"
								className="pointer-events-none absolute inset-y-0 rounded-full bg-[color-mix(in_srgb,var(--desktop-accent-rgb)_20%,var(--desktop-surface-panel-strong)_80%)]"
								style={{ left: `${left}%`, width: `${width}%` }}
							/>
						);
					})}
					{normalizedMarkers.map((marker) => {
						const left = (marker.time / safeDuration) * 100;
						return (
							<div
								key={`marker-${marker.time}-${marker.label ?? ''}`}
								data-testid="track-progress-marker"
								className="pointer-events-none absolute inset-y-0 w-px bg-[rgb(var(--desktop-accent-rgb)/0.55)]"
								style={{ left: `${left}%` }}
								title={marker.label}
							/>
						);
					})}
					<div
						className="absolute inset-y-0 left-0 rounded-full bg-[rgb(var(--desktop-accent-rgb))] shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] transition-[width] duration-75"
						style={{ width: `${percent}%` }}
					/>
					{hoverTime != null && (
						<div
							className="pointer-events-none absolute -top-5 rounded border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) px-1.5 py-0.5 font-variant-numeric tabular-nums text-[10px] text-(--desktop-text-primary) shadow-(--desktop-shadow-soft)"
							style={{
								left: `${hoverTooltipPercent ?? 0}%`,
								transform: 'translateX(-50%)',
							}}
						>
							{formatDuration(hoverTime)}
						</div>
					)}
				</button>
				<div className="flex items-center justify-between text-[10px] text-(--desktop-text-muted)">
					<span className="font-variant-numeric tabular-nums">
						{formatDuration(clampedTime)}
					</span>
					<span className="font-variant-numeric tabular-nums">
						{safeDuration > 0 ? formatDuration(safeDuration) : '0:00'}
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className={cn('flex flex-col gap-1', className)}>
			<div className="flex items-center justify-between text-[11px] text-(--desktop-text-muted)">
				<span className="font-variant-numeric tabular-nums">
					{formatDuration(clampedTime)}
				</span>
				<span className="font-variant-numeric tabular-nums">
					{safeDuration > 0 ? formatDuration(safeDuration) : '0:00'}
				</span>
			</div>
			<button
				ref={barRef}
				type="button"
				className={cn(
					'relative w-full cursor-pointer overflow-hidden rounded-full border border-(--desktop-border-subtle) group touch-none',
					railBgClass,
					barHeight,
					onSeek && safeDuration > 0
						? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-app)'
						: 'pointer-events-none cursor-default'
				)}
				data-testid="track-progress-bar-inner"
				disabled={!onSeek || safeDuration <= 0}
				onClick={handleBarSeek}
				onPointerDown={onPointerDown}
				onMouseMove={handleBarHover}
				onMouseLeave={handleBarLeave}
				onKeyDown={onKeyDown}
				tabIndex={onSeek && safeDuration > 0 ? 0 : -1}
				{...sliderA11y}
			>
				<div
					className="absolute inset-y-0 left-0 w-full rounded-full bg-[color-mix(in_srgb,var(--desktop-border-subtle)_55%,transparent)]"
					style={{ width: '100%' }}
				/>
				{normalizedBufferedRanges.map((range) => {
					const left = (range.start / safeDuration) * 100;
					const width = ((range.end - range.start) / safeDuration) * 100;
					return (
						<div
							key={`${range.start}-${range.end}`}
							data-testid="track-progress-buffered-range"
							className="pointer-events-none absolute inset-y-0 rounded-full bg-[color-mix(in_srgb,var(--desktop-accent-rgb)_22%,var(--desktop-surface-panel-strong)_78%)]"
							style={{ left: `${left}%`, width: `${width}%` }}
						/>
					);
				})}
				{normalizedMarkers.map((marker) => {
					const left = (marker.time / safeDuration) * 100;
					return (
						<div
							key={`marker-${marker.time}-${marker.label ?? ''}`}
							data-testid="track-progress-marker"
							className="pointer-events-none absolute inset-y-0 w-px bg-[rgb(var(--desktop-accent-rgb)/0.62)]"
							style={{ left: `${left}%` }}
							title={marker.label}
						/>
					);
				})}
				<div
					className="absolute inset-y-0 left-0 rounded-full bg-[rgb(var(--desktop-accent-rgb))] shadow-[inset_0_1px_0_rgb(255_255_255/0.15)] transition-[width] duration-75"
					style={{ width: `${percent}%` }}
				/>
				<div
					className={thumbClass}
					style={{ left: `${percent}%`, transform: 'translate(-50%, -50%)' }}
				/>
				{hoverTime != null && (
					<div
						className="pointer-events-none absolute -top-6 rounded border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) px-1.5 py-0.5 font-variant-numeric tabular-nums text-[10px] text-(--desktop-text-primary) shadow-(--desktop-shadow-soft)"
						style={{
							left: `${hoverTooltipPercent ?? 0}%`,
							transform: 'translateX(-50%)',
						}}
					>
						{formatDuration(hoverTime)}
					</div>
				)}
			</button>
		</div>
	);
};
