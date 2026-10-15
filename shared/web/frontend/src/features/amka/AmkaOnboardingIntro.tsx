/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shows the compact AMKA onboarding and current entrypoint guidance inside Marketing Cabinet.
 * It explains that standalone AMKA is an internal component boundary until a separate app exists.
 *
 * Invariants:
 * - The collapsed state is session-scoped and must not persist across browser sessions.
 * - User-facing copy comes from the marketing i18n namespace.
 *
 * Related:
 * - src/features/amka/MarketingCabinetAmkaView.tsx
 * - src/pages/MarketingCabinet/views/AmkaView.tsx
 * - documentation/product/amka-seed-album/AMKA-ENTRYPOINTS.md
 */
import { cn } from '@/utils/cn';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AmkaEntrypointNotice } from '@/features/amka/AmkaEntrypointNotice';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';

const STORAGE_KEY = 'mc-amka-intro-collapsed';

function readIntroOpen(): boolean {
	try {
		return globalThis.sessionStorage?.getItem(STORAGE_KEY) === '0';
	} catch {
		return false;
	}
}

export function AmkaOnboardingIntro() {
	const { t } = useTranslation('marketing');
	const [open, setOpen] = useState(readIntroOpen);

	const handleToggle = (nextOpen: boolean) => {
		setOpen(nextOpen);
		try {
			globalThis.sessionStorage?.setItem(STORAGE_KEY, nextOpen ? '0' : '1');
		} catch {
			/* ignore */
		}
	};

	return (
		<details
			open={open}
			onToggle={(e) => handleToggle((e.target as HTMLDetailsElement).open)}
			className="rounded-xl border border-(--desktop-border-subtle) bg-[rgb(var(--desktop-accent-rgb)/0.06)] px-3 py-2.5"
		>
			<summary
				className={cn(
					DESKTOP_TYPOGRAPHY.caption,
					'cursor-pointer list-none font-semibold text-(--desktop-text-primary) [&::-webkit-details-marker]:hidden',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				aria-label={t('amkaView.onboardingAria')}
			>
				{t('amkaView.onboardingSummary')}
			</summary>
			<AmkaEntrypointNotice className="mt-2 border-t border-(--desktop-border-subtle) pt-3" />
			<ol className="mt-3 list-decimal space-y-2 border-t border-(--desktop-border-subtle) pt-3 pl-5 text-sm leading-relaxed text-(--desktop-text-secondary) wrap-pretty">
				<li>{t('amkaView.onboardingStep1')}</li>
				<li>{t('amkaView.onboardingStep2')}</li>
				<li>{t('amkaView.onboardingStep3')}</li>
				<li>{t('amkaView.onboardingStep4')}</li>
				<li>{t('amkaView.onboardingStep5')}</li>
			</ol>
			<p className="mt-2 text-xs text-(--desktop-text-muted) wrap-pretty">
				{t('amkaView.onboardingFootnote')}
			</p>
		</details>
	);
}
