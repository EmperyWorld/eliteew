/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF bubble block for survey publish notifications with deep link to Survey Hub.
 */
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import type { GafSurveyAnnouncementMeta } from './gafChatSurveyAnnouncementMeta';
import {
	highlightSearchInPlainText,
	renderGafMessageContent,
} from './gafChatMessageBodyRender';
import { requestOpenDesktopApp } from '../../utils/desktopDeepLink';

type DesktopGafOpen = { openAppByComponent: (c: string) => void } | null;

type Props = {
	body: string;
	meta: GafSurveyAnnouncementMeta;
	highlightQuery: string;
	plainShellClass: string;
	bodyMarkdownProse: string;
	gafDesktop: DesktopGafOpen;
	t: TFunction<'gafChat'>;
};

export function GafChatSurveyAnnouncementBlock({
	body,
	meta,
	highlightQuery,
	plainShellClass,
	bodyMarkdownProse,
	gafDesktop,
	t,
}: Props): ReactNode {
	const bodyStr = body.trim();
	const hq = highlightQuery.trim();
	const renderedBody =
		bodyStr && hq && !bodyStr.includes('```') ? (
			<div
				className={cn(
					'wrap-anywhere whitespace-pre-wrap leading-[1.45]',
					plainShellClass
				)}
			>
				{highlightSearchInPlainText(bodyStr, hq)}
			</div>
		) : bodyStr ? (
			renderGafMessageContent(bodyStr, bodyMarkdownProse, plainShellClass)
		) : null;

	const surveyTitle =
		meta.title?.trim() || t('surveyAnnouncementFallbackTitle');

	const openSurvey = () => {
		const surveyId = meta.deep_link?.surveyId ?? meta.survey_id;
		if (gafDesktop) {
			requestOpenDesktopApp({
				appComponent: meta.open_app_component,
				initialPayload: { surveyId },
			});
			return;
		}
		requestOpenDesktopApp({
			appComponent: meta.open_app_component,
			initialPayload: { surveyId },
		});
	};

	return (
		<div
			className={cn(
				'min-w-0 rounded-(--desktop-radius) border border-[rgb(var(--desktop-accent-rgb)/0.22)]',
				'bg-[rgb(var(--desktop-accent-rgb)/0.06)] p-3'
			)}
		>
			<div className="mb-2 flex items-start gap-2">
				<ClipboardDocumentListIcon
					className="mt-0.5 size-5 shrink-0 text-[rgb(var(--desktop-accent-rgb))]"
					aria-hidden
				/>
				<div className="min-w-0">
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.subtitle,
							'text-(--desktop-text-primary)'
						)}
					>
						{surveyTitle}
					</p>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-(--desktop-text-muted)'
						)}
					>
						{t('surveyAnnouncementSubtitle')}
					</p>
				</div>
			</div>
			{renderedBody}
			<div className="mt-3 flex flex-wrap gap-1.5">
				<DesktopChromeTooltip
					content={t('surveyAnnouncementOpen')}
					placement="top"
					offsetExtra={4}
				>
					<DesktopAppButton
						type="button"
						variant="accent"
						size="sm"
						className="touch-manipulation"
						onClick={openSurvey}
					>
						{t('surveyAnnouncementOpen')}
					</DesktopAppButton>
				</DesktopChromeTooltip>
				{!gafDesktop ? (
					<p
						className={cn(
							'self-center',
							DESKTOP_TYPOGRAPHY.caption,
							'text-(--desktop-text-muted)'
						)}
					>
						{t('onboardingDesktopOnlyHint')}
					</p>
				) : null}
			</div>
		</div>
	);
}
