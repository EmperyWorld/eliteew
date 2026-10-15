/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Generate-form submit block (insufficient-energy notice + primary CTA + footnote).
 *
 * Invariants:
 * - Props-only presentational — no local store.
 *
 * Related:
 * - `EwrpGenerateTabPanel.tsx`, `useEwrpGenerateTabDerived.tsx`
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { sw } from '../EwrpGeneratorChunks';

export type EwrpGenerateTabSubmitSectionProps = {
	submitting: boolean;
	formLocked: boolean;
	insufficientEnergy: boolean;
	presentationEnergyCost: number;
	ugsAvailableCredits: number | null;
	numSlides: number;
	perSlideCredits: number;
	primaryBtnClass: string;
	presentationEnergyDetail: ReactNode;
};

export function EwrpGenerateTabSubmitSection({
	submitting,
	formLocked,
	insufficientEnergy,
	presentationEnergyCost,
	ugsAvailableCredits,
	numSlides,
	perSlideCredits,
	primaryBtnClass,
	presentationEnergyDetail,
}: EwrpGenerateTabSubmitSectionProps) {
	const { t } = useTranslation('ewrp');

	return (
		<div
			className="border-t border-(--desktop-border-subtle)/45 pt-6"
			data-ewrp-guide="launch"
		>
			{insufficientEnergy ? (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.small,
						'mb-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-amber-100/95'
					)}
					role="status"
				>
					{t('energy.insufficientBalance', {
						required: presentationEnergyCost,
						available: ugsAvailableCredits ?? 0,
					})}
				</p>
			) : null}
			<button
				type="submit"
				disabled={submitting || formLocked || insufficientEnergy}
				aria-busy={submitting}
				aria-describedby="ewrp-energy-hint"
				title={t('form.submitEnergyTitle', {
					total: numSlides * perSlideCredits,
				})}
				className={cn(primaryBtnClass, 'flex flex-col gap-1 items-stretch')}
			>
				<span className="flex items-center justify-center gap-2">
					{submitting ? (
						<ArrowPathIcon className="h-5 w-5 animate-spin" strokeWidth={sw} />
					) : (
						<SparklesIcon className="h-5 w-5 shrink-0" strokeWidth={sw} />
					)}
					{submitting ? t('form.submitRunning') : t('form.submitIdle')}
				</span>
				<span className="text-[11px] font-normal leading-tight opacity-90">
					{presentationEnergyDetail}
				</span>
			</button>
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.small,
					'mt-2 text-center text-(--desktop-text-dim)'
				)}
			>
				{t('form.generateFootnote')}
			</p>
		</div>
	);
}
