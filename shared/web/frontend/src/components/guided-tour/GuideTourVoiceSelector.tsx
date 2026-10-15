/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Segmented control for guided-tour narrator: po&T (man) vs TZBrand (woman).
 *
 * Related:
 * - guideTourVoicePreference.ts, SpotlightGuideModal.tsx
 */

import {
	GUIDE_TOUR_VOICE_KEYS,
	GUIDE_TOUR_VOICE_PROFILES,
	type GuideTourVoiceKey,
} from '@/components/guided-tour/guideTourVoicePreference';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';

type GuideTourVoiceSelectorProps = {
	value: GuideTourVoiceKey;
	onChange: (voice: GuideTourVoiceKey) => void;
	className?: string;
};

export function GuideTourVoiceSelector({
	value,
	onChange,
	className,
}: GuideTourVoiceSelectorProps) {
	const { t } = useTranslation('desktopUi');

	return (
		<fieldset
			aria-label={t('guideTour.voice.selectorAria')}
			className={cn(
				'm-0 inline-flex min-w-0 rounded-xl border border-white/10 bg-white/5 p-0.5',
				className
			)}
		>
			{GUIDE_TOUR_VOICE_KEYS.map((key) => {
				const profile = GUIDE_TOUR_VOICE_PROFILES[key];
				const selected = value === key;
				const titleKey =
					key === 'man'
						? 'guideTour.voice.manTitle'
						: 'guideTour.voice.womanTitle';
				return (
					<DesktopChromeTooltip
						key={key}
						content={t(titleKey)}
						placement="top"
						offsetExtra={4}
					>
						<button
							type="button"
							onClick={() => onChange(key)}
							aria-pressed={selected}
							className={cn(
								'rounded-[0.65rem] px-2 py-1 text-[11px] font-semibold tracking-wide transition-colors sm:px-2.5 sm:text-xs',
								'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50',
								selected
									? 'bg-violet-500/35 text-violet-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
									: 'text-slate-400 hover:bg-white/10 hover:text-slate-200'
							)}
						>
							{profile.displayName}
						</button>
					</DesktopChromeTooltip>
				);
			})}
		</fieldset>
	);
}
