import * as React from 'react';
import { SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';

interface VolumeControlProps {
	volume: number;
	onChange: (value: number) => void;
	className?: string;
	/**
	 * Компактный режим – иконка + короткий слайдер (или без него).
	 */
	compact?: boolean;
	/**
	 * Показывать ли слайдер громкости.
	 * В некоторых местах (мини-виджет) можно оставить только иконку.
	 */
	showSlider?: boolean;
	title?: string;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
	volume,
	onChange,
	className,
	compact = false,
	showSlider = true,
	title,
}) => {
	const isMuted = volume <= 0;

	const toggleMute = () => {
		onChange(isMuted ? 1 : 0);
	};

	const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const v = parseFloat(e.target.value);
		if (Number.isNaN(v)) return;
		onChange(v);
	};

	const step = 0.05;

	const handleVolumeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (
			e.key !== 'ArrowLeft' &&
			e.key !== 'ArrowRight' &&
			e.key !== 'ArrowUp' &&
			e.key !== 'ArrowDown' &&
			e.key !== 'Home' &&
			e.key !== 'End'
		) {
			return;
		}
		e.preventDefault();
		let next = volume;
		if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
			next = Math.max(0, volume - step);
		} else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
			next = Math.min(1, volume + step);
		} else if (e.key === 'Home') {
			next = 0;
		} else {
			next = 1;
		}
		onChange(next);
	};

	return (
		<div
			className={cn(
				'flex items-center gap-1 text-(--desktop-text-secondary)',
				compact ? 'w-auto' : 'w-32',
				className
			)}
			title={title}
		>
			<button
				type="button"
				onClick={toggleMute}
				className={cn(
					'inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
					'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-app)',
					compact && 'p-1'
				)}
				aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
			>
				{isMuted ? (
					<SpeakerXMarkIcon className="h-4 w-4" />
				) : (
					<SpeakerWaveIcon className="h-4 w-4" />
				)}
			</button>
			{showSlider && (
				<input
					type="range"
					min={0}
					max={1}
					step={step}
					value={volume}
					onChange={handleSliderChange}
					onKeyDown={handleVolumeKeyDown}
					aria-label={title ?? 'Громкость'}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(volume * 100)}
					aria-valuetext={`${Math.round(volume * 100)}%`}
					className={cn(
						'min-h-9 min-w-0 flex-1 cursor-pointer appearance-none rounded-full accent-[rgb(var(--desktop-accent-rgb))]',
						'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-app)',
						// base track fill (Firefox + fallback); WebKit uses runnable-track below
						'bg-(--desktop-border-subtle)',
						compact
							? cn(
									'h-1 w-16 min-h-0 min-w-16 flex-none',
									'[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-(--desktop-border-subtle)',
									'[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-(--desktop-border-subtle)',
									'[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-(--desktop-surface-app) [&::-webkit-slider-thumb]:bg-[rgb(var(--desktop-accent-rgb))] [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.45),0_1px_4px_rgb(0_0_0/0.35)]',
									'[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-(--desktop-surface-app) [&::-moz-range-thumb]:bg-[rgb(var(--desktop-accent-rgb))] [&::-moz-range-thumb]:shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.45),0_1px_4px_rgb(0_0_0/0.35)]'
								)
							: cn(
									'h-2.5 flex-1',
									'[&::-webkit-slider-runnable-track]:h-2.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[color-mix(in_srgb,var(--desktop-border-subtle)_75%,var(--desktop-text-primary)_25%)]',
									'[&::-moz-range-track]:h-2.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[color-mix(in_srgb,var(--desktop-border-subtle)_75%,var(--desktop-text-primary)_25%)]',
									'[&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-(--desktop-surface-app) [&::-webkit-slider-thumb]:bg-[rgb(var(--desktop-accent-rgb))] [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.5),0_2px_6px_rgb(0_0_0/0.4)]',
									'[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-(--desktop-surface-app) [&::-moz-range-thumb]:bg-[rgb(var(--desktop-accent-rgb))] [&::-moz-range-thumb]:shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.5),0_2px_6px_rgb(0_0_0/0.4)]'
								)
					)}
				/>
			)}
		</div>
	);
};
