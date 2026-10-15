/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Duration quick-pick chips + numeric input for MusicForge create form.
 *
 * Related:
 * - musicForgeDurationPresets.ts, MusicForgeCreatePanel.tsx
 */

import { useTranslation } from 'react-i18next';
import {
	DesktopAppInput,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { MUSIC_FORGE_DURATION_PRESETS_SECONDS } from './musicForgeDurationPresets';

export type MusicForgeDurationPickerProps = {
	duration: number;
	min: number;
	max: number;
	onDurationChange: (value: number) => void;
	onDurationBlur: () => void;
	disabled?: boolean;
};

export function MusicForgeDurationPicker({
	duration,
	min,
	max,
	onDurationChange,
	onDurationBlur,
	disabled = false,
}: MusicForgeDurationPickerProps) {
	const { t } = useTranslation('desktopUi');
	const presets = MUSIC_FORGE_DURATION_PRESETS_SECONDS.filter(
		(value) => value >= min && value <= max
	);

	return (
		<div>
			<DesktopAppSectionLabel>
				{t('musicForge.form.durationLabel')}
			</DesktopAppSectionLabel>
			{presets.length > 0 ? (
				<div
					className="mb-2 flex flex-wrap gap-2"
					role="listbox"
					aria-label={t('musicForge.form.durationPresetsLabel')}
				>
					{presets.map((value) => {
						const selected = duration === value;
						return (
							<button
								key={value}
								type="button"
								disabled={disabled}
								role="option"
								aria-selected={selected}
								className={cn(
									'rounded-full border px-3 py-1.5 text-xs font-medium transition',
									selected
										? 'border-amber-300/60 bg-amber-500/20 text-amber-50'
										: 'border-white/15 bg-black/20 text-(--desktop-text-secondary) hover:border-white/30 hover:bg-white/5'
								)}
								onClick={() => onDurationChange(value)}
							>
								{t('musicForge.form.durationPresetChip', { seconds: value })}
							</button>
						);
					})}
				</div>
			) : null}
			<DesktopAppInput
				id="music-forge-duration"
				type="number"
				min={min}
				max={max}
				value={duration}
				disabled={disabled}
				onChange={(event) => onDurationChange(Number(event.target.value))}
				onBlur={onDurationBlur}
				aria-describedby="music-forge-duration-hint"
			/>
			<p
				id="music-forge-duration-hint"
				className="mt-1 text-xs text-(--desktop-text-dim)"
			>
				{t('musicForge.form.durationRange', { min, max })}
			</p>
		</div>
	);
}
