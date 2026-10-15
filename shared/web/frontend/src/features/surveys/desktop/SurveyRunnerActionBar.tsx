/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sticky primary/secondary actions for survey runner steps and review.
 */
import { cn } from '@/utils/cn';
import { ArrowRightIcon, CheckIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { SH_RUNNER_ACTION_BAR_CLASS } from './surveyHubLayoutTokens';

export type SurveyRunnerActionBarProps = {
	primaryLabel: string;
	primaryDisabled?: boolean;
	primaryReady?: boolean;
	primaryHint?: string | null;
	showPrimaryIcon?: boolean;
	primaryIcon?: 'next' | 'submit';
	onPrimary: () => void;
	showBack?: boolean;
	onBack?: () => void;
	secondaryLabel?: string;
	onSecondary?: () => void;
	onCancel: () => void;
};

export function SurveyRunnerActionBar({
	primaryLabel,
	primaryDisabled = false,
	primaryReady = true,
	primaryHint = null,
	showPrimaryIcon = false,
	primaryIcon = 'next',
	onPrimary,
	showBack = false,
	onBack,
	secondaryLabel,
	onSecondary,
	onCancel,
}: SurveyRunnerActionBarProps): React.ReactElement {
	const { t } = useTranslation('surveys');

	return (
		<div className="mt-auto space-y-2 border-t border-(--desktop-border-subtle) pt-3">
			<div className={cn(SH_RUNNER_ACTION_BAR_CLASS, 'border-0 pt-0')}>
				<DesktopAppButton
					type="button"
					variant="accent"
					disabled={primaryDisabled}
					className={cn(
						'min-w-[8.5rem] gap-1.5',
						primaryReady &&
							!primaryDisabled &&
							'shadow-[0_0_0_1px_rgb(var(--desktop-accent-rgb)/0.35)]'
					)}
					onClick={onPrimary}
				>
					<span>{primaryLabel}</span>
					{showPrimaryIcon ? (
						primaryIcon === 'submit' ? (
							<CheckIcon
								className="h-4 w-4 shrink-0"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						) : (
							<ArrowRightIcon
								className="h-4 w-4 shrink-0"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						)
					) : null}
				</DesktopAppButton>
				{showBack && onBack ? (
					<DesktopAppButton type="button" variant="neutral" onClick={onBack}>
						{t('runner.back')}
					</DesktopAppButton>
				) : null}
				{secondaryLabel && onSecondary ? (
					<DesktopAppButton
						type="button"
						variant="neutral"
						onClick={onSecondary}
					>
						{secondaryLabel}
					</DesktopAppButton>
				) : null}
				<DesktopAppButton
					type="button"
					variant="ghost"
					className="ml-auto"
					onClick={onCancel}
				>
					{t('runner.cancel')}
				</DesktopAppButton>
			</div>
			{primaryDisabled && primaryHint ? (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'px-1 text-(--desktop-text-dim)'
					)}
				>
					{primaryHint}
				</p>
			) : null}
		</div>
	);
}
