/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pre-publish readiness checklist for survey drafts (audience + editor gates).
 */
import { cn } from '@/utils/cn';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DesktopAppPanel } from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';

type ChecklistItem = {
	id: string;
	ok: boolean;
	label: string;
	hint?: string;
};

type Props = {
	title: string;
	questionCount: number;
	groupCount: number;
	userCount: number;
	previewCount: number | null;
	rewardConfigured: boolean;
};

function CheckRow({ ok, label, hint }: ChecklistItem): React.ReactElement {
	const Icon = ok ? CheckCircleIcon : XCircleIcon;
	return (
		<li className="flex items-start gap-2">
			<Icon
				className={cn(
					'mt-0.5 size-5 shrink-0',
					ok
						? 'text-[rgb(var(--desktop-accent-rgb))]'
						: 'text-[rgb(var(--desktop-danger-rgb,220_38_38))]'
				)}
				strokeWidth={DESKTOP_LUCIDE.stroke}
				aria-hidden
			/>
			<div className="min-w-0">
				<p className={DESKTOP_TYPOGRAPHY.body}>{label}</p>
				{hint ? (
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-(--desktop-text-muted)'
						)}
					>
						{hint}
					</p>
				) : null}
			</div>
		</li>
	);
}

export function SurveyAdminPublishChecklist({
	title,
	questionCount,
	groupCount,
	userCount,
	previewCount,
	rewardConfigured,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const audienceAssigned = groupCount > 0 || userCount > 0;

	const items: ChecklistItem[] = [
		{
			id: 'title',
			ok: Boolean(title.trim()),
			label: t('admin.checklist.title'),
		},
		{
			id: 'questions',
			ok: questionCount > 0,
			label: t('admin.checklist.questions', { count: questionCount }),
		},
		{
			id: 'audience',
			ok: audienceAssigned,
			label: t('admin.checklist.audience'),
			hint:
				groupCount || userCount
					? t('admin.checklist.audienceDetail', {
							groups: groupCount,
							users: userCount,
						})
					: t('admin.publishGuard.noAudience'),
		},
		{
			id: 'preview',
			ok: audienceAssigned && previewCount !== null && previewCount > 0,
			label:
				previewCount !== null
					? t('admin.checklist.preview', { count: previewCount })
					: t('admin.checklist.previewPending'),
			hint:
				audienceAssigned && previewCount === 0
					? t('admin.checklist.previewZero')
					: undefined,
		},
		{
			id: 'reward',
			ok: rewardConfigured,
			label: t('admin.checklist.reward'),
			hint: rewardConfigured ? undefined : t('admin.checklist.rewardOptional'),
		},
	];

	const publishReady =
		Boolean(title.trim()) && questionCount > 0 && audienceAssigned;

	return (
		<DesktopAppPanel
			className={cn(
				'space-y-3 p-4',
				publishReady
					? 'border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.05)]'
					: 'border-(--desktop-border-subtle)'
			)}
		>
			<div>
				<h3 className={DESKTOP_TYPOGRAPHY.subtitle}>
					{t('admin.checklist.heading')}
				</h3>
				<p className={cn('mt-1', DESKTOP_TYPOGRAPHY.meta)}>
					{publishReady
						? t('admin.checklist.ready')
						: t('admin.checklist.notReady')}
				</p>
			</div>
			<ul className="space-y-3">
				{items.map((item) => (
					<CheckRow key={item.id} {...item} />
				))}
			</ul>
		</DesktopAppPanel>
	);
}
