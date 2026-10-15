/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resume banner when tab-local survey runner session exists.
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { SurveyRunnerSessionPayload } from './surveyRunnerSession';

type Props = {
	session: SurveyRunnerSessionPayload;
	questionCount: number;
	onContinue: () => void;
	onStartFresh: () => void;
};

export function SurveyRunnerResumeBanner({
	session,
	questionCount,
	onContinue,
	onStartFresh,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');

	return (
		<section
			className={cn(
				'rounded-(--desktop-radius-lg) border border-[rgb(var(--desktop-accent-rgb)/0.28)]',
				'bg-[rgb(var(--desktop-accent-rgb)/0.06)] px-4 py-3'
			)}
			aria-label={t('runner.resumeBannerAria')}
		>
			<p className={DESKTOP_TYPOGRAPHY.body}>{t('runner.resumeBannerBody')}</p>
			<p className={cn('mt-1', DESKTOP_TYPOGRAPHY.meta)}>
				{session.review
					? t('runner.resumeAtReview')
					: t('runner.resumeAtQuestion', {
							current: Math.min(session.step + 1, questionCount),
						})}
			</p>
			<div className="mt-3 flex flex-wrap gap-2">
				<DesktopAppButton type="button" variant="accent" onClick={onContinue}>
					{t('runner.resumeContinue')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="neutral"
					onClick={onStartFresh}
				>
					{t('runner.resumeStartFresh')}
				</DesktopAppButton>
			</div>
		</section>
	);
}
