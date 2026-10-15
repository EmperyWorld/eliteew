/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sticky draft action bar: publish CTA, readiness chip, and user-preview entry.
 *
 * Invariants:
 * - Visible only for draft surveys on editor/audience workflow tabs.
 *
 * Related:
 * - SurveysAdminSection.tsx
 * - surveyAdminPublishReadiness.ts
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import type { PublishReadiness } from './surveyAdminPublishReadiness';

type Props = {
	readiness: PublishReadiness;
	publishBlockedReason: string | null;
	publishPending: boolean;
	previewDisabled: boolean;
	onPublish: () => void;
	onPreview: () => void;
};

export function SurveyAdminDraftActionBar({
	readiness,
	publishBlockedReason,
	publishPending,
	previewDisabled,
	onPublish,
	onPreview,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');

	return (
		<section
			className={cn(
				'sticky bottom-0 z-20 -mx-1 mt-4 border-t border-(--desktop-border-subtle)',
				'bg-[rgb(var(--desktop-surface-panel-rgb,18_18_24)/0.92)] px-1 py-3 backdrop-blur-md',
				'supports-backdrop-filter:bg-[rgb(var(--desktop-surface-panel-rgb,18_18_24)/0.78)]'
			)}
			aria-label={t('admin.draftBar.aria')}
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<span
						className={cn(
							'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
							readiness.publishReady
								? 'border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-[rgb(var(--desktop-accent-rgb))]'
								: 'border-(--desktop-border-subtle) text-(--desktop-text-secondary)'
						)}
					>
						{t('admin.draftBar.readiness', {
							ready: readiness.readyCount,
							total: readiness.totalCount,
						})}
					</span>
					{publishBlockedReason ? (
						<p className={DESKTOP_TYPOGRAPHY.caption}>{publishBlockedReason}</p>
					) : readiness.publishReady ? (
						<p className={DESKTOP_TYPOGRAPHY.caption}>
							{t('admin.draftBar.readyHint')}
						</p>
					) : null}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						disabled={previewDisabled}
						onClick={onPreview}
					>
						{t('admin.draftBar.preview')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="accent"
						size="sm"
						disabled={Boolean(publishBlockedReason) || publishPending}
						onClick={onPublish}
					>
						{t('admin.publish')}
					</DesktopAppButton>
				</div>
			</div>
		</section>
	);
}
