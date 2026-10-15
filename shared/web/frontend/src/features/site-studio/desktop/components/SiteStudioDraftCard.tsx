/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Site Studio draft card for AI content, SEO, and image drafts with apply status feedback.
 *
 * Invariants:
 * - User-facing errors and apply reports stay inside the card; actions remain provided by the parent surface.
 * - Loading overlay must keep the card aria-busy for assistive tech.
 *
 * Related:
 * - features/site-studio/desktop/UserSiteStudioApp.tsx
 * - features/site-studio/desktop/api.ts
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppPanel,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { ArrowPathIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

interface SiteStudioDraftCardProps {
	eyebrow?: string;
	title: string;
	summary?: string;
	createdAt?: string;
	loading?: boolean;
	error?: string | null;
	applyResult?: string | null;
	actions?: React.ReactNode;
	children?: React.ReactNode;
}

function formatCreatedAt(
	value: string | undefined,
	locale: string
): string | null {
	if (!value) return null;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return null;
	return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
		day: '2-digit',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	}).format(parsed);
}

export const SiteStudioDraftCard: React.FC<SiteStudioDraftCardProps> = ({
	eyebrow,
	title,
	summary,
	createdAt,
	loading,
	error,
	applyResult,
	actions,
	children,
}) => {
	const { t, i18n } = useTranslation('siteStudio');
	const createdAtLabel = formatCreatedAt(createdAt, i18n.language);

	return (
		<DesktopAppPanel
			className={cn(
				'relative flex min-h-0 flex-col gap-4 overflow-hidden p-4',
				loading && 'pointer-events-none opacity-60 motion-reduce:opacity-80'
			)}
			aria-busy={loading ? true : undefined}
		>
			{loading ? (
				<div
					className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-(--desktop-surface-app)/75 backdrop-blur-[2px] motion-reduce:backdrop-blur-none"
					aria-live="polite"
				>
					<div className="flex items-center gap-2 text-sm text-(--desktop-text-secondary)">
						<ArrowPathIcon
							className="h-5 w-5 shrink-0 animate-spin text-[rgb(var(--desktop-accent-rgb))] motion-reduce:animate-none"
							aria-hidden
						/>
						<span>{t('draftCard.applying')}</span>
					</div>
				</div>
			) : null}

			<div className="space-y-2">
				{eyebrow ? (
					<DesktopAppSectionLabel>{eyebrow}</DesktopAppSectionLabel>
				) : null}
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-1">
						<h3 className="text-base font-semibold text-(--desktop-text-primary)">
							{title}
						</h3>
						{summary ? (
							<p className="max-w-2xl text-sm leading-6 text-(--desktop-text-secondary)">
								{summary}
							</p>
						) : null}
					</div>
					{createdAtLabel ? (
						<div className="inline-flex items-center gap-2 rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2.5 py-1 text-xs text-(--desktop-text-dim)">
							<CalendarDaysIcon className="h-3.5 w-3.5" aria-hidden />
							{createdAtLabel}
						</div>
					) : null}
				</div>
			</div>

			{error ? (
				<DesktopAppSurface
					variant="soft"
					padding="sm"
					className="border border-red-500/25 bg-red-500/10 text-sm text-red-100"
					role="alert"
				>
					<span className="font-medium">{t('draftCard.applyError')}.</span>{' '}
					{error}
				</DesktopAppSurface>
			) : null}

			{applyResult ? (
				<DesktopAppSurface
					variant="soft"
					padding="sm"
					className="border border-emerald-400/25 bg-emerald-400/10 text-sm text-emerald-100"
					aria-live="polite"
				>
					<span className="font-medium">{t('draftCard.applyResult')}.</span>{' '}
					{applyResult}
				</DesktopAppSurface>
			) : null}

			{children ? <div className="grid gap-3">{children}</div> : null}
			{actions ? (
				<div className="mt-auto flex flex-wrap gap-2">{actions}</div>
			) : null}
		</DesktopAppPanel>
	);
};

export default SiteStudioDraftCard;
