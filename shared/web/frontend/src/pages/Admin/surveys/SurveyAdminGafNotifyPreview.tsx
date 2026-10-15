/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Live preview of GAF survey announcement message in admin editor.
 *
 * Related:
 * - GafChatSurveyAnnouncementBlock.tsx
 * - surveyAdminGafNotify.ts
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { DesktopAppPanel } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { resolveSurveyGafNotifyBody } from './surveyAdminGafNotify';

type Props = {
	surveyTitle: string;
	template: string;
};

export function SurveyAdminGafNotifyPreview({
	surveyTitle,
	template,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const { body, usesDefault } = resolveSurveyGafNotifyBody(
		template,
		surveyTitle
	);
	const displayTitle =
		surveyTitle.trim() || t('admin.gafPreview.fallbackTitle');

	return (
		<DesktopAppPanel className="space-y-3 border border-[rgb(var(--desktop-accent-rgb)/0.22)] bg-(--desktop-surface-accent) p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className={DESKTOP_TYPOGRAPHY.caption}>
						{t('admin.gafPreview.heading')}
					</p>
					<p className={cn('mt-1', DESKTOP_TYPOGRAPHY.meta)}>
						{usesDefault
							? t('admin.gafPreview.usingDefault')
							: t('admin.gafPreview.usingCustom')}
					</p>
				</div>
				<span
					className={cn(
						'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs',
						'bg-[rgb(var(--desktop-accent-rgb)/0.15)] text-(--desktop-text-secondary)'
					)}
				>
					<ClipboardDocumentListIcon className="size-3.5" aria-hidden />
					{t('admin.gafPreview.badge')}
				</span>
			</div>
			<div
				className={cn(
					'rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
					'bg-(--desktop-surface-panel) p-3'
				)}
			>
				<p className="font-medium text-(--desktop-text-primary)">
					{displayTitle}
				</p>
				<p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-(--desktop-text-secondary)">
					{body}
				</p>
				<p
					className={cn(
						'mt-3',
						DESKTOP_TYPOGRAPHY.caption,
						'text-(--desktop-text-dim)'
					)}
				>
					{t('admin.gafPreview.ctaHint')}
				</p>
			</div>
		</DesktopAppPanel>
	);
}
