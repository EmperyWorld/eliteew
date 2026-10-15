/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop Feedback Hub header chrome: icon, tagline, trusted-participant badge
 * (shell WindowTitleBar owns the app title — no duplicate H2).
 *
 * Invariants:
 * - Hidden on mobile-embedded layout; parent gates rendering.
 * - Marked `data-desktop-chrome="full-shell-only"` (Wave 4 embedded map CSS lock).
 * - Does not render catalog/app title text (desktop dual-header rule).
 *
 * Related:
 * - FeedbackHubApp.tsx · feedbackHubLayoutTokens.ts · FEEDBACK-HUB.md
 * - utils/desktopFullShellChrome.ts
 * - documentation/product/desktop/DESKTOP-EMBEDDED-APPS-UX-NEXT.md
 * - documentation/product/desktop/DESKTOP-MOBILE-EMBEDDED-SHELL.md
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ChatBubbleLeftEllipsisIcon,
	CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { desktopFullShellOnlyChromeProps } from '@/utils/desktopFullShellChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../constants';
import type { FeedbackSummary } from '../../services/productDesktopApi';
import {
	FEEDBACK_HUB_HEADER_ICON_WRAP_CLASS,
	FEEDBACK_HUB_TRUSTED_BADGE_CLASS,
} from './feedbackHubLayoutTokens';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';

export type FeedbackHubAppHeaderProps = {
	headerStripClass: string;
	summary: FeedbackSummary | undefined;
};

export function FeedbackHubAppHeader({
	headerStripClass,
	summary,
}: FeedbackHubAppHeaderProps): React.ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'feedbackHub' });

	return (
		<div
			className={cn(headerStripClass, 'relative')}
			data-feedback-hub-guide="header"
			{...desktopFullShellOnlyChromeProps()}
		>
			<div className="flex flex-wrap items-start gap-3">
				<div className={FEEDBACK_HUB_HEADER_ICON_WRAP_CLASS} aria-hidden>
					<ChatBubbleLeftEllipsisIcon
						className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb))]"
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				</div>
				<div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
					<div className="min-w-0">
						<p className={DESKTOP_TYPOGRAPHY.bodyMuted}>{t('tagline')}</p>
					</div>
					{summary?.is_trusted ? (
						<DesktopChromeTooltip
							content={t('trustedBadgeHint', {
								wishLimit: summary.wish_limit,
								bugLimit: summary.bug_limit,
							})}
							placement="bottom"
							offsetExtra={4}
						>
							<span
								className={FEEDBACK_HUB_TRUSTED_BADGE_CLASS}
								title={t('trustedBadgeHint', {
									wishLimit: summary.wish_limit,
									bugLimit: summary.bug_limit,
								})}
							>
								<CheckBadgeIcon
									className="h-3.5 w-3.5"
									aria-hidden
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
								{t('trustedBadge')}
							</span>
						</DesktopChromeTooltip>
					) : null}
				</div>
			</div>
		</div>
	);
}
