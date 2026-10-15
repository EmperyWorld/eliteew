/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Toolbar select for global marketing-cabinet web search quality.
 *
 * Related:
 * - MarketingWebSearchQualityContext.tsx
 */
import { cn } from '@/utils/cn';
import { GlobeAltIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { getDesktopShellToolbarClusterInsetControlClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { MarketingCabinetSelect } from './MarketingCabinetSelect';
import {
	type MarketingWebSearchQuality,
	MARKETING_WEB_SEARCH_QUALITY_OPTIONS,
} from '../marketingWebSearchQuality';
import { useMarketingWebSearchQuality } from './MarketingWebSearchQualityContext';

export function MarketingWebSearchQualitySelect({
	className,
}: {
	className?: string;
}) {
	const { t } = useTranslation('marketing');
	const { quality, setQuality } = useMarketingWebSearchQuality();
	const shellFrame = useDesktopShellFrame();
	const inset = getDesktopShellToolbarClusterInsetControlClassName(shellFrame);

	const options = MARKETING_WEB_SEARCH_QUALITY_OPTIONS.map((value) => ({
		value,
		label: t(`toolbar.webSearchQuality.${value}`),
	}));

	return (
		<div
			className={cn(
				'flex min-w-0 items-center gap-1.5',
				inset,
				'rounded-(--desktop-radius) px-2 py-1',
				className
			)}
			title={t('toolbar.webSearchQualityHint')}
		>
			<GlobeAltIcon
				className="h-4 w-4 shrink-0 text-(--desktop-text-muted)"
				strokeWidth={DESKTOP_LUCIDE.stroke}
				aria-hidden
			/>
			<MarketingCabinetSelect
				embeddedInToolbarCluster
				size="compact"
				className="min-w-[7.5rem] max-w-[11rem]"
				value={quality}
				onChange={(v) => setQuality(v as MarketingWebSearchQuality)}
				aria-label={t('toolbar.webSearchQualityAria')}
				options={options}
			/>
		</div>
	);
}
