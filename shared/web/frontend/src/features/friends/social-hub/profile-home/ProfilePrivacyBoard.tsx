/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Privacy board for Profile Home — field visibility chips + audience cards always visible.
 *
 * Invariants:
 * - Uses Social Hub privacy-preview read-model (including unused `fields` map).
 * - Card / CTA clicks open visibility sheet; never reconstruct friend identities client-side.
 *
 * Related:
 * - ProfileHome.tsx
 * - ../../api/socialHubFeedApi.ts
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	EyeIcon,
	EyeSlashIcon,
	ShieldCheckIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSkeleton,
	DesktopAppStatusBadge,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import {
	fetchSocialHubPrivacyPreview,
	type SocialHubPrivacyPreviewResponse,
} from '../../api/socialHubFeedApi';
import {
	SH_PRIVACY_AUDIENCE_TITLE_CLASS,
	SH_PRIVACY_CHIP_ROW_CLASS,
	shPrivacyAudienceGridClass,
	shPrivacyChipClass,
	shPrivacyFieldChipClass,
	shPrivacyStatusPanelClass,
} from '../layout/socialHubLayoutTokens';
import { SOCIAL_HUB_PRIVACY_PREVIEW_QUERY_KEY } from '../privacyPreviewQueryKey';

const PRIVACY_PREVIEW_FIELD_TOTAL = 3;
const FIELD_ORDER = ['avatar', 'full_name', 'bio'] as const;

function fieldLabelKey(field: string): string {
	if (field === 'avatar') return 'friends.socialHubPrivacyFieldAvatar';
	if (field === 'full_name') return 'friends.socialHubPrivacyFieldFullName';
	if (field === 'bio') return 'friends.socialHubPrivacyFieldBio';
	return 'friends.socialHubPrivacyFieldUnknown';
}

function visibilityLabelKey(visibility: string): string {
	if (visibility === 'everyone') {
		return 'friends.socialHubProfilePrivacyVis.everyone';
	}
	if (visibility === 'friends_only') {
		return 'friends.socialHubProfilePrivacyVis.friends_only';
	}
	if (visibility === 'none') {
		return 'friends.socialHubProfilePrivacyVis.none';
	}
	if (visibility === 'circle') {
		return 'friends.socialHubProfilePrivacyVis.circle';
	}
	return 'friends.socialHubPrivacyFieldUnknown';
}

export default function ProfilePrivacyBoard({
	embeddedMobileLayout = false,
	onConfigureVisibility,
}: {
	embeddedMobileLayout?: boolean;
	onConfigureVisibility: () => void;
}): JSX.Element {
	const { t } = useTranslation('contentManager');
	const previewQuery = useQuery({
		queryKey: SOCIAL_HUB_PRIVACY_PREVIEW_QUERY_KEY,
		queryFn: fetchSocialHubPrivacyPreview,
		staleTime: 60_000,
		gcTime: 5 * 60_000,
		retry: 1,
	});
	const preview = previewQuery.data;
	const warningCount = preview?.warnings.length ?? 0;

	return (
		<section
			className="space-y-3"
			aria-labelledby="profile-home-privacy-heading"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<h3
						id="profile-home-privacy-heading"
						className="flex items-center gap-2 text-base font-semibold text-(--desktop-text-primary)"
					>
						<ShieldCheckIcon
							className="h-5 w-5 text-(--desktop-accent)"
							aria-hidden
						/>
						{t('friends.profileHomePrivacyTitle')}
					</h3>
					<p className="text-sm text-(--desktop-text-muted)">
						{t('friends.profileHomePrivacySubtitle')}
					</p>
				</div>
				<DesktopAppButton
					type="button"
					variant="accent"
					onClick={onConfigureVisibility}
				>
					{t('friends.socialHubPrivacyConfigureVisibility')}
				</DesktopAppButton>
			</div>

			{previewQuery.isLoading ? (
				<div
					className="grid gap-3"
					role="status"
					aria-busy="true"
					aria-label={t('friends.socialHubPrivacyLoadingAria')}
				>
					<DesktopAppSkeleton className="h-20 rounded-(--desktop-radius-lg)" />
					<DesktopAppSkeleton className="h-32 rounded-(--desktop-radius-lg)" />
				</div>
			) : previewQuery.isError ? (
				<DesktopProductStatusBanner
					tone="danger"
					role="alert"
					title={t('friends.socialHubPrivacyErrorTitle')}
					description={t('friends.socialHubPrivacyError')}
					actions={
						<DesktopAppButton
							type="button"
							variant="neutral"
							onClick={() => void previewQuery.refetch()}
						>
							<ArrowPathIcon className="h-4 w-4" aria-hidden />
							{t('friends.networkRetry')}
						</DesktopAppButton>
					}
				/>
			) : !preview ? (
				<DesktopAppEmptyState
					icon={
						<EyeSlashIcon
							className="h-7 w-7 text-(--desktop-text-dim)"
							aria-hidden
						/>
					}
					title={t('friends.socialHubPrivacyEmptyTitle')}
					description={t('friends.socialHubPrivacyEmptyDescription')}
				>
					<DesktopAppButton
						type="button"
						variant="neutral"
						onClick={() => void previewQuery.refetch()}
					>
						<ArrowPathIcon className="h-4 w-4" aria-hidden />
						{t('friends.networkRetry')}
					</DesktopAppButton>
				</DesktopAppEmptyState>
			) : (
				<PrivacyBoardBody
					preview={preview}
					warningCount={warningCount}
					embeddedMobileLayout={embeddedMobileLayout}
					onConfigureVisibility={onConfigureVisibility}
				/>
			)}
		</section>
	);
}

function PrivacyBoardBody({
	preview,
	warningCount,
	embeddedMobileLayout,
	onConfigureVisibility,
}: {
	preview: SocialHubPrivacyPreviewResponse;
	warningCount: number;
	embeddedMobileLayout: boolean;
	onConfigureVisibility: () => void;
}): JSX.Element {
	const { t } = useTranslation('contentManager');
	const fieldEntries = FIELD_ORDER.filter((key) => preview.fields[key]).map(
		(key) => [key, preview.fields[key]] as const
	);

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<DesktopAppStatusBadge
					className={cn(
						'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
						preview.discoverability === 'hidden'
							? 'text-amber-100'
							: 'text-emerald-100'
					)}
				>
					{preview.discoverability === 'hidden'
						? t('friends.socialHubPrivacyDiscoverabilityHidden')
						: t('friends.socialHubPrivacyDiscoverabilityPublic')}
				</DesktopAppStatusBadge>
				{warningCount > 0 ? (
					<span className="text-xs text-amber-100/90">
						{t('friends.socialHubPrivacyWarningSummary', {
							count: warningCount,
						})}
					</span>
				) : (
					<span className="text-xs text-emerald-100/80">
						{t('friends.socialHubPrivacyAllClearTitle')}
					</span>
				)}
			</div>

			{warningCount > 0 ? (
				<button
					type="button"
					onClick={onConfigureVisibility}
					className={cn(
						shPrivacyStatusPanelClass(true),
						'w-full cursor-pointer text-left transition hover:border-amber-300/40'
					)}
				>
					<div className="font-semibold">
						{t('friends.socialHubPrivacyWarningsTitle')}
					</div>
					<ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed">
						{preview.warnings.map((warning) => (
							<li key={warning}>
								{t(`friends.socialHubPrivacyWarnings.${warning}`, {
									defaultValue: warning.replace(/_/g, ' '),
								})}
							</li>
						))}
					</ul>
					<p className="mt-2 text-xs text-amber-100/80">
						{t('friends.profileHomeWarningsCtaHint')}
					</p>
				</button>
			) : null}

			{fieldEntries.length > 0 ? (
				<div className="grid gap-2 sm:grid-cols-3">
					{fieldEntries.map(([field, meta]) => (
						<button
							key={field}
							type="button"
							onClick={onConfigureVisibility}
							className="rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 p-3 text-left transition hover:border-(--desktop-accent)/35"
						>
							<div className="text-sm font-medium text-(--desktop-text-primary)">
								{t(fieldLabelKey(field), { field })}
							</div>
							<div className="mt-1 text-xs text-(--desktop-text-muted)">
								{t(visibilityLabelKey(meta.visibility), {
									field: meta.visibility,
								})}
							</div>
						</button>
					))}
				</div>
			) : null}

			<div className={shPrivacyAudienceGridClass(embeddedMobileLayout)}>
				{preview.audiences.map((audience) => {
					const visibleCount = audience.visible_fields.length;
					const hiddenCount = Math.max(
						0,
						PRIVACY_PREVIEW_FIELD_TOTAL - visibleCount
					);
					return (
						<button
							key={audience.id}
							type="button"
							onClick={onConfigureVisibility}
							className="group relative flex min-h-32 flex-col gap-3 overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/40 p-4 text-left transition-colors hover:border-emerald-300/30"
						>
							<div className="relative flex items-center justify-between gap-3">
								<div className="flex min-w-0 items-center gap-2">
									<UsersIcon
										className="h-5 w-5 shrink-0 text-cyan-300"
										aria-hidden
									/>
									<div className={SH_PRIVACY_AUDIENCE_TITLE_CLASS}>
										{audience.label}
									</div>
								</div>
								{typeof audience.people_count === 'number' ? (
									<span className={shPrivacyChipClass('info')}>
										{audience.people_count}
									</span>
								) : null}
							</div>
							<div className={SH_PRIVACY_CHIP_ROW_CLASS}>
								<span className={shPrivacyChipClass('success')}>
									{t('friends.socialHubPrivacyVisibleCount', {
										count: visibleCount,
										total: PRIVACY_PREVIEW_FIELD_TOTAL,
									})}
								</span>
								<span
									className={shPrivacyChipClass(
										hiddenCount > 0 ? 'warning' : 'success'
									)}
								>
									{t('friends.socialHubPrivacyHiddenCount', {
										count: hiddenCount,
									})}
								</span>
							</div>
							<div className="relative mt-auto flex flex-wrap gap-1.5">
								{audience.visible_fields.length > 0 ? (
									audience.visible_fields.map((field) => (
										<span key={field} className={shPrivacyFieldChipClass(true)}>
											<EyeIcon className="h-3.5 w-3.5" aria-hidden />
											{t(fieldLabelKey(field), { field })}
										</span>
									))
								) : (
									<span className={shPrivacyFieldChipClass(false)}>
										<EyeSlashIcon className="h-3.5 w-3.5" aria-hidden />
										{t('friends.socialHubPrivacyNoFieldsVisible')}
									</span>
								)}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
