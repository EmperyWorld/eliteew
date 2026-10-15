/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Premium Privacy overview: one hero composition (who you are + one primary CTA),
 * with audience matrix under progressive disclosure.
 *
 * Invariants:
 * - Preview uses the Social Hub read-model endpoint; never reconstructs friend identities client-side.
 * - Overview variant shows at most one filled primary CTA above the fold.
 * - Empty/error states provide retry actions instead of passive dead ends.
 * - Avatar uses SecureAvatar (Bearer blob), never raw `<img src="/api/.../download">`.
 *
 * Related:
 * - ../api/socialHubFeedApi.ts
 * - ../social-hub/sections/SocialHubPrivacySection.tsx
 * - @/components/profile/SecureAvatar.tsx
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
	DesktopAppPanel,
	DesktopAppSkeleton,
	DesktopAppStatusBadge,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { SecureAvatar } from '@/components/profile/SecureAvatar';
import type { UserProfileResponse } from '@/types/profile';
import { cn } from '@/utils/cn';

import { fetchSocialHubPrivacyPreview } from '../api/socialHubFeedApi';
import { SocialHubSectionLead } from '../social-hub/layout/SocialHubSectionLead';
import {
	SH_PRIVACY_AUDIENCE_TITLE_CLASS,
	SH_PRIVACY_CHIP_ROW_CLASS,
	SH_PRIVACY_LOADING_GRID_CLASS,
	shPrivacyAudienceGridClass,
	shPrivacyChipClass,
	shPrivacyFieldChipClass,
	shPrivacyStatusPanelClass,
} from '../social-hub/layout/socialHubLayoutTokens';
import { SOCIAL_HUB_PRIVACY_PREVIEW_QUERY_KEY } from '../social-hub/privacyPreviewQueryKey';

const PRIVACY_PREVIEW_FIELD_TOTAL = 3;

function fieldLabelKey(field: string): string {
	if (field === 'avatar') return 'friends.socialHubPrivacyFieldAvatar';
	if (field === 'full_name') return 'friends.socialHubPrivacyFieldFullName';
	if (field === 'bio') return 'friends.socialHubPrivacyFieldBio';
	return 'friends.socialHubPrivacyFieldUnknown';
}

function AudienceMatrix({
	embeddedMobileLayout,
	audiences,
}: {
	embeddedMobileLayout: boolean;
	audiences: Array<{
		id: string;
		label: string;
		visible_fields: string[];
		people_count?: number | null;
	}>;
}): JSX.Element {
	const { t } = useTranslation('contentManager');
	return (
		<div className={shPrivacyAudienceGridClass(embeddedMobileLayout)}>
			{audiences.map((audience) => {
				const visibleCount = audience.visible_fields.length;
				const hiddenCount = Math.max(
					0,
					PRIVACY_PREVIEW_FIELD_TOTAL - visibleCount
				);
				return (
					<DesktopAppPanel
						key={audience.id}
						className="group relative flex min-h-36 flex-col gap-3 overflow-hidden p-4 transition-colors hover:border-emerald-300/30"
					>
						<span
							aria-hidden
							className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_70%)] opacity-0 transition-opacity group-hover:opacity-100"
						/>
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
					</DesktopAppPanel>
				);
			})}
		</div>
	);
}

export default function SocialHubPrivacyPreviewPanel({
	variant = 'detail',
	embeddedMobileLayout = false,
	profile = null,
	onConfigureVisibility,
	onEditProfile,
	onOpenAccountMore,
}: {
	/** overview = hero + one CTA; detail = full matrix always visible */
	variant?: 'overview' | 'detail';
	embeddedMobileLayout?: boolean;
	profile?: UserProfileResponse | null;
	onConfigureVisibility?: () => void;
	onEditProfile?: () => void;
	onOpenAccountMore?: () => void;
} = {}): JSX.Element {
	const { t } = useTranslation('contentManager');
	const isOverview = variant === 'overview';
	const previewQuery = useQuery({
		queryKey: SOCIAL_HUB_PRIVACY_PREVIEW_QUERY_KEY,
		queryFn: fetchSocialHubPrivacyPreview,
		staleTime: 60_000,
		gcTime: 5 * 60_000,
		retry: 1,
	});
	const preview = previewQuery.data;
	const warningCount = preview?.warnings.length ?? 0;
	const displayName =
		profile?.full_name?.trim() ||
		profile?.username ||
		t('friends.socialHubPrivacyYouFallback');

	const primaryActions =
		onConfigureVisibility || onEditProfile || onOpenAccountMore ? (
			<>
				{onConfigureVisibility ? (
					<DesktopAppButton
						type="button"
						variant="accent"
						onClick={onConfigureVisibility}
					>
						{t('friends.socialHubPrivacyConfigureVisibility')}
					</DesktopAppButton>
				) : null}
				{onEditProfile ? (
					<DesktopAppButton
						type="button"
						variant={isOverview ? 'ghost' : 'neutral'}
						onClick={onEditProfile}
					>
						{t('friends.socialHubPrivacyEditProfile')}
					</DesktopAppButton>
				) : null}
				{isOverview && onOpenAccountMore ? (
					<DesktopAppButton
						type="button"
						variant="ghost"
						onClick={onOpenAccountMore}
					>
						{t('friends.socialHubPrivacyAccountMore')}
					</DesktopAppButton>
				) : null}
			</>
		) : undefined;

	const statusStrip =
		preview && !previewQuery.isLoading && !previewQuery.isError ? (
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
		) : null;

	const body = previewQuery.isLoading ? (
		<div
			className={isOverview ? 'grid gap-3' : SH_PRIVACY_LOADING_GRID_CLASS}
			role="status"
			aria-live="polite"
			aria-busy="true"
			aria-label={t('friends.socialHubPrivacyLoadingAria')}
		>
			{isOverview ? (
				<>
					<DesktopAppSkeleton className="h-16 rounded-(--desktop-radius-lg)" />
					<DesktopAppSkeleton className="h-10 w-48 rounded-(--desktop-radius-md)" />
				</>
			) : (
				<>
					<DesktopAppSkeleton className="h-32 rounded-(--desktop-radius-lg)" />
					<DesktopAppSkeleton className="h-32 rounded-(--desktop-radius-lg)" />
					<DesktopAppSkeleton className="h-32 rounded-(--desktop-radius-lg)" />
				</>
			)}
		</div>
	) : previewQuery.isError ? (
		<DesktopProductStatusBanner
			tone="danger"
			role="alert"
			aria-live="assertive"
			title={t('friends.socialHubPrivacyErrorTitle')}
			description={t('friends.socialHubPrivacyError')}
			actions={
				<DesktopAppButton
					type="button"
					variant="neutral"
					className="shrink-0"
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
	) : isOverview ? (
		<>
			{warningCount > 0 ? (
				<DesktopAppPanel className={shPrivacyStatusPanelClass(true)}>
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
				</DesktopAppPanel>
			) : null}
			<details className="group rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/25 px-4 py-3">
				<summary className="cursor-pointer text-sm font-medium text-(--desktop-text-secondary)">
					{t('friends.socialHubPrivacyMatrixToggle')}
				</summary>
				<div className="mt-3">
					<AudienceMatrix
						embeddedMobileLayout={embeddedMobileLayout}
						audiences={preview.audiences}
					/>
				</div>
			</details>
		</>
	) : (
		<>
			{preview.warnings.length > 0 ? (
				<DesktopAppPanel className={shPrivacyStatusPanelClass(true)}>
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
				</DesktopAppPanel>
			) : (
				<DesktopAppPanel className={shPrivacyStatusPanelClass(false)}>
					<div className="flex items-start gap-3">
						<ShieldCheckIcon
							className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200"
							aria-hidden
						/>
						<div>
							<div className="font-semibold">
								{t('friends.socialHubPrivacyAllClearTitle')}
							</div>
							<p className="mt-1 text-xs leading-relaxed text-emerald-100/80">
								{t('friends.socialHubPrivacyAllClearDescription')}
							</p>
						</div>
					</div>
				</DesktopAppPanel>
			)}
			<AudienceMatrix
				embeddedMobileLayout={embeddedMobileLayout}
				audiences={preview.audiences}
			/>
		</>
	);

	return (
		<div className="space-y-4">
			<SocialHubSectionLead
				title={
					<span className="flex items-center gap-2">
						<ShieldCheckIcon
							className="h-5 w-5 text-(--desktop-accent)"
							aria-hidden
						/>
						{t(
							isOverview
								? 'friends.socialHubPrivacyHeroTitle'
								: 'friends.socialHubPrivacyTitle'
						)}
					</span>
				}
				description={t(
					isOverview
						? 'friends.socialHubPrivacyHeroSubtitle'
						: 'friends.socialHubPrivacySubtitle'
				)}
				actions={primaryActions}
			/>

			{isOverview ? (
				<div className="flex flex-wrap items-center gap-3 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-4 py-3">
					{profile?.avatar_url ? (
						<SecureAvatar
							avatarUrl={profile.avatar_url}
							alt=""
							className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-(--desktop-border-subtle)"
						/>
					) : (
						<div
							aria-hidden
							className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-(--desktop-surface) text-sm font-semibold text-(--desktop-text-secondary) ring-1 ring-(--desktop-border-subtle)"
						>
							{displayName.slice(0, 1).toUpperCase()}
						</div>
					)}
					<div className="min-w-0">
						<div className="truncate text-sm font-semibold text-(--desktop-text-primary)">
							{displayName}
						</div>
						{profile?.username ? (
							<div className="truncate text-xs text-(--desktop-text-muted)">
								@{profile.username}
							</div>
						) : (
							<div className="text-xs text-(--desktop-text-muted)">
								{t('friends.socialHubPrivacyIdentityHint')}
							</div>
						)}
					</div>
				</div>
			) : null}

			{statusStrip}
			{body}
		</div>
	);
}
