/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders where Marketing Cabinet AMKA (marketing runs) lives versus desktop AMKA platform orchestration.
 *
 * Invariants:
 * - Copy distinguishes cabinet marketing runs from the desktop `EwaApp` orchestration window (`amkaView.entrypointCurrent*`).
 * - Copy stays in the marketing namespace until AMKA owns a separate i18n namespace.
 *
 * Related:
 * - src/features/amka/AmkaOnboardingIntro.tsx
 * - documentation/product/amka-seed-album/AMKA-ENTRYPOINTS.md
 */
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';

export function AmkaEntrypointNotice({ className }: { className?: string }) {
	const { t } = useTranslation('marketing');

	return (
		<p
			className={cn(
				'text-sm leading-relaxed text-(--desktop-text-secondary) wrap-pretty',
				className
			)}
		>
			<span className="font-medium text-(--desktop-text-primary)">
				{t('amkaView.entrypointCurrentLabel')}
			</span>{' '}
			{t('amkaView.entrypointCurrentNote')}
		</p>
	);
}
