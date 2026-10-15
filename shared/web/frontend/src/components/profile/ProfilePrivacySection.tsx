/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile visibility editor (discoverability + per-field rules). Premium layout
 * uses field cards and user copy; classic layout remains for embedded UserProfile.
 *
 * Invariants:
 * - Privacy settings persist through `/api/v1/profile/me/privacy`; UI hints are previews only.
 * - Circle visibility must warn when no circle is selected.
 * - After save, invalidate SOCIAL_HUB_PRIVACY_PREVIEW_QUERY_KEY.
 *
 * Related:
 * - features/friends/social-hub/sections/SocialHubPrivacySection.tsx
 * - features/friends/social-hub/privacyPreviewQueryKey.ts
 */

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

import { listFriendCircles } from '@/features/friends/api/friendsApi';
import { SOCIAL_HUB_PRIVACY_PREVIEW_QUERY_KEY } from '@/features/friends/social-hub/privacyPreviewQueryKey';
import type { FriendCircle } from '@/features/friends/types';
import { useNotifications } from '@/notifications';
import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopAppPanel,
	DesktopAppStatusBadge,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import { getDesktopShellContentPanelClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import { APIError } from '@/services/api/client';
import {
	getProfilePrivacy,
	updateProfilePrivacy,
} from '@/services/profileService';
import type {
	ProfileDiscoverability,
	ProfileFieldVisibility,
	ProfilePrivacySettings,
} from '@/types/profile';
import { cn } from '@/utils/cn';
import { log } from '@/utils/logger';

const VIS_VALUES: ProfileFieldVisibility[] = [
	'everyone',
	'friends_only',
	'none',
	'circle',
];

const DISC_VALUES: ProfileDiscoverability[] = ['public', 'hidden'];

function privacyErrorMessage(err: unknown, fallback: string): string {
	if (err instanceof APIError) {
		return err.message;
	}
	if (err && typeof err === 'object' && 'response' in err) {
		const data = (err as { response?: { data?: Record<string, unknown> } })
			.response?.data;
		if (data && typeof data === 'object') {
			const msg = data.detail ?? data.message ?? data.error;
			if (typeof msg === 'string') {
				return msg;
			}
		}
	}
	return fallback;
}

function FieldControl(props: {
	layout: 'classic' | 'premium';
	label: string;
	hint?: string;
	value: ProfileFieldVisibility;
	circleId: string | null;
	circles: FriendCircle[];
	onChange: (v: ProfileFieldVisibility) => void;
	onCircleChange: (id: string | null) => void;
	disabled?: boolean;
}): JSX.Element {
	const { t } = useTranslation('contentManager');
	const {
		layout,
		label,
		hint,
		value,
		circleId,
		circles,
		onChange,
		onCircleChange,
		disabled,
	} = props;
	const selectClass = 'min-h-10 max-w-md text-sm';
	const selectedCircle =
		circles.find((circle) => circle.id === circleId) ?? null;

	const controls = (
		<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
			<DesktopNativeSelect
				disabled={disabled}
				value={value}
				onChange={(e) => onChange(e.target.value as ProfileFieldVisibility)}
				className={selectClass}
			>
				{VIS_VALUES.map((option) => (
					<option
						key={option}
						value={option}
						className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
					>
						{t(`friends.socialHubProfilePrivacyVis.${option}`)}
					</option>
				))}
			</DesktopNativeSelect>
			{value === 'circle' ? (
				<DesktopNativeSelect
					disabled={disabled}
					value={circleId ?? ''}
					onChange={(e) =>
						onCircleChange(e.target.value ? e.target.value : null)
					}
					className={selectClass}
				>
					<option value="" className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}>
						{t('friends.socialHubProfilePrivacyCirclePlaceholder')}
					</option>
					{circles.map((circle) => (
						<option
							key={circle.id}
							value={circle.id}
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{circle.name}
						</option>
					))}
				</DesktopNativeSelect>
			) : null}
			{value === 'circle' && selectedCircle ? (
				<span className="text-xs text-(--desktop-text-muted)">
					{t('friends.privacyCirclePreview', {
						count: selectedCircle.members_count,
					})}
				</span>
			) : value === 'circle' ? (
				<span className="text-xs text-amber-200">
					{t('friends.privacyCircleEmptyPreview')}
				</span>
			) : null}
		</div>
	);

	if (layout === 'premium') {
		return (
			<div className="rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 p-4">
				<div className="mb-2">
					<div className="text-sm font-medium text-(--desktop-text-primary)">
						{label}
					</div>
					{hint ? (
						<p className="mt-0.5 text-xs leading-relaxed text-(--desktop-text-muted)">
							{hint}
						</p>
					) : null}
				</div>
				{controls}
			</div>
		);
	}

	return (
		<div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
			<span className="text-sm text-(--desktop-text-muted) antialiased">
				{label}
			</span>
			{controls}
		</div>
	);
}

export default function ProfilePrivacySection({
	embedded = false,
	layout = 'classic',
}: {
	embedded?: boolean;
	layout?: 'classic' | 'premium';
} = {}): JSX.Element {
	const { t } = useTranslation('contentManager');
	const queryClient = useQueryClient();
	const shellFrame = useDesktopShellFrame();
	const shellPanel = embedded
		? getDesktopShellContentPanelClassName(shellFrame)
		: '';
	const { toast } = useNotifications();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [circles, setCircles] = useState<FriendCircle[]>([]);
	const [state, setState] = useState<ProfilePrivacySettings | null>(null);
	const isPremium = layout === 'premium';

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [privacy, circleList] = await Promise.all([
				getProfilePrivacy(),
				listFriendCircles(),
			]);
			setState(privacy);
			setCircles(circleList);
		} catch (err: unknown) {
			log.error(
				'ProfilePrivacySection',
				'load failed',
				err instanceof Error ? err : undefined,
				err
			);
			const msg = privacyErrorMessage(
				err,
				t('friends.socialHubProfilePrivacyLoadError')
			);
			setError(msg);
			toast.error(t('friends.socialHubProfilePrivacyToastTitle'), msg);
		} finally {
			setLoading(false);
		}
	}, [toast, t]);

	useEffect(() => {
		void load();
	}, [load]);

	const save = async (): Promise<void> => {
		if (!state) return;
		setSaving(true);
		setError(null);
		try {
			const next = await updateProfilePrivacy({
				discoverability: state.discoverability,
				avatar_visibility: state.avatar_visibility,
				avatar_circle_id: state.avatar_circle_id,
				full_name_visibility: state.full_name_visibility,
				full_name_circle_id: state.full_name_circle_id,
				bio_visibility: state.bio_visibility,
				bio_circle_id: state.bio_circle_id,
			});
			setState(next);
			void queryClient.invalidateQueries({
				queryKey: SOCIAL_HUB_PRIVACY_PREVIEW_QUERY_KEY,
			});
			toast.success(
				t('friends.socialHubProfilePrivacyToastTitle'),
				t('friends.socialHubProfilePrivacyToastSaved')
			);
		} catch (err: unknown) {
			log.error(
				'ProfilePrivacySection',
				'save failed',
				err instanceof Error ? err : undefined,
				err
			);
			const msg = privacyErrorMessage(
				err,
				t('friends.socialHubProfilePrivacySaveError')
			);
			setError(msg);
			toast.error(t('friends.socialHubProfilePrivacySaveFailedTitle'), msg);
		} finally {
			setSaving(false);
		}
	};

	if (loading || !state) {
		return (
			<DesktopAppPanel
				className={cn(
					shellPanel,
					'flex items-center gap-3 p-6 text-(--desktop-text-muted)'
				)}
			>
				<ArrowPathIcon
					className="h-5 w-5 shrink-0 animate-spin"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
				{t('friends.socialHubProfilePrivacyLoading')}
			</DesktopAppPanel>
		);
	}

	const discoverabilityControl = (
		<div
			className={
				isPremium
					? 'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 p-4'
					: 'grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center'
			}
		>
			{isPremium ? (
				<div className="mb-2">
					<div className="text-sm font-medium text-(--desktop-text-primary)">
						{t('friends.socialHubProfilePrivacyDiscoverabilityLabel')}
					</div>
					<p className="mt-0.5 text-xs leading-relaxed text-(--desktop-text-muted)">
						{t('friends.socialHubProfilePrivacyDiscoverabilityHint')}
					</p>
				</div>
			) : (
				<span className="text-sm text-(--desktop-text-muted) antialiased">
					{t('friends.socialHubProfilePrivacyDiscoverabilityLabel')}
				</span>
			)}
			<DesktopNativeSelect
				value={state.discoverability}
				onChange={(e) =>
					setState((s) =>
						s
							? {
									...s,
									discoverability: e.target.value as ProfileDiscoverability,
								}
							: s
					)
				}
				className="min-h-10 max-w-md text-sm"
			>
				{DISC_VALUES.map((option) => (
					<option
						key={option}
						value={option}
						className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
					>
						{t(`friends.socialHubProfilePrivacyDisc.${option}`)}
					</option>
				))}
			</DesktopNativeSelect>
		</div>
	);

	return (
		<DesktopAppPanel
			className={cn(shellPanel, isPremium ? 'space-y-4 p-5' : 'space-y-3 p-5')}
		>
			<section className="contents" aria-labelledby="profile-privacy-heading">
				<div className="flex flex-wrap items-center gap-2">
					<DesktopAppStatusBadge className="border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary)">
						<ShieldCheckIcon
							className="mr-1 inline h-3.5 w-3.5 text-cyan-400"
							aria-hidden
						/>
						<span id="profile-privacy-heading">
							{t('friends.socialHubProfilePrivacyHeading')}
						</span>
					</DesktopAppStatusBadge>
				</div>
				<p className="text-xs leading-relaxed text-(--desktop-text-muted)">
					{t('friends.socialHubProfilePrivacyHelp')}
				</p>

				{error ? (
					<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
						{error}
					</div>
				) : null}

				<div className={isPremium ? 'grid gap-3' : 'grid gap-3'}>
					{discoverabilityControl}

					<FieldControl
						layout={layout}
						label={t('friends.socialHubPrivacyFieldAvatar')}
						hint={
							isPremium
								? t('friends.socialHubProfilePrivacyFieldHintAvatar')
								: undefined
						}
						value={state.avatar_visibility}
						circleId={state.avatar_circle_id}
						circles={circles}
						disabled={saving}
						onChange={(v) =>
							setState((s) => (s ? { ...s, avatar_visibility: v } : s))
						}
						onCircleChange={(id) =>
							setState((s) => (s ? { ...s, avatar_circle_id: id } : s))
						}
					/>
					<FieldControl
						layout={layout}
						label={t('friends.socialHubPrivacyFieldFullName')}
						hint={
							isPremium
								? t('friends.socialHubProfilePrivacyFieldHintName')
								: undefined
						}
						value={state.full_name_visibility}
						circleId={state.full_name_circle_id}
						circles={circles}
						disabled={saving}
						onChange={(v) =>
							setState((s) => (s ? { ...s, full_name_visibility: v } : s))
						}
						onCircleChange={(id) =>
							setState((s) => (s ? { ...s, full_name_circle_id: id } : s))
						}
					/>
					<FieldControl
						layout={layout}
						label={t('friends.socialHubPrivacyFieldBio')}
						hint={
							isPremium
								? t('friends.socialHubProfilePrivacyFieldHintBio')
								: undefined
						}
						value={state.bio_visibility}
						circleId={state.bio_circle_id}
						circles={circles}
						disabled={saving}
						onChange={(v) =>
							setState((s) => (s ? { ...s, bio_visibility: v } : s))
						}
						onCircleChange={(id) =>
							setState((s) => (s ? { ...s, bio_circle_id: id } : s))
						}
					/>
				</div>

				<div className="flex flex-wrap items-center gap-2 pt-2">
					<DesktopAppButton
						type="button"
						variant="accent"
						disabled={saving}
						onClick={() => void save()}
						className="min-h-10"
					>
						{saving
							? t('friends.socialHubProfilePrivacySaving')
							: t('friends.socialHubProfilePrivacySave')}
					</DesktopAppButton>
					{isPremium ? (
						<details className="text-sm text-(--desktop-text-muted)">
							<summary className="cursor-pointer">
								{t('friends.socialHubProfilePrivacyAdvanced')}
							</summary>
							<div className="mt-2">
								<DesktopAppButton
									type="button"
									variant="ghost"
									disabled={saving}
									onClick={() => void load()}
								>
									{t('friends.socialHubProfilePrivacyReload')}
								</DesktopAppButton>
							</div>
						</details>
					) : (
						<DesktopAppButton
							type="button"
							variant="ghost"
							disabled={saving}
							onClick={() => void load()}
						>
							{t('friends.socialHubProfilePrivacyReload')}
						</DesktopAppButton>
					)}
				</div>
			</section>
		</DesktopAppPanel>
	);
}
