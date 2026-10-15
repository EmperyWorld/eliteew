/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Связи → Телефон editor for users.preferences.video_calls.call_target (single owner UI).
 *
 * Invariants:
 * - Shared write path with mobile Profile → Видеозвонки; single DB preference.
 * - Options: both | desktop_only | mobile_only.
 *
 * Related:
 * - MobileAppHubPanel.tsx, profileService.updatePreferences, INTERNAL-VIDEO-CALLS.md
 */

import { PhoneIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppStatusBadge,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { useUserPreferencesApp } from '@/contexts/UserPreferencesAppContext';
import { getPreferences, updatePreferences } from '@/services/profileService';
import type { VideoCallTarget } from '@/types/profile';
import { cn } from '@/utils/cn';
import {
	SH_MOBILE_DOWNLOAD_PANEL_CLASS,
	SH_SUBPANEL_TITLE_CLASS,
} from '../../social-hub/layout/socialHubLayoutTokens';
import {
	normalizeCallTarget,
	VIDEO_CALL_TARGETS,
} from './callTargetPreference';

export function MobileHubCallTargetPanel(): JSX.Element {
	const { t } = useTranslation('contentManager');
	const prefsApp = useUserPreferencesApp();
	const [callTarget, setCallTarget] = useState<VideoCallTarget>('both');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const prefs = await getPreferences();
			setCallTarget(normalizeCallTarget(prefs.video_calls?.call_target));
		} catch {
			setError(t('friends.mobileApp.callTargetLoadError'));
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		void load();
	}, [load]);

	const onSelect = async (next: VideoCallTarget) => {
		if (next === callTarget || saving) return;
		setSaving(true);
		setError(null);
		const previous = callTarget;
		setCallTarget(next);
		try {
			const updated = await updatePreferences({
				video_calls: { call_target: next },
			});
			setCallTarget(normalizeCallTarget(updated.video_calls?.call_target));
			await prefsApp?.refresh(updated);
		} catch {
			setCallTarget(previous);
			setError(t('friends.mobileApp.callTargetSaveError'));
		} finally {
			setSaving(false);
		}
	};

	return (
		<section
			className={cn(SH_MOBILE_DOWNLOAD_PANEL_CLASS, 'flex flex-col gap-3')}
			aria-labelledby="mobile-hub-call-target-title"
		>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<h3
						id="mobile-hub-call-target-title"
						className={cn(SH_SUBPANEL_TITLE_CLASS, 'flex items-center gap-2')}
					>
						<PhoneIcon
							className={cn(DESKTOP_LUCIDE.sm, 'text-(--desktop-accent)')}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('friends.mobileApp.callTargetTitle')}
					</h3>
					<p className="mt-1 text-sm text-(--desktop-text-secondary)">
						{t('friends.mobileApp.callTargetDescription')}
					</p>
				</div>
				{saving || loading ? (
					<DesktopAppStatusBadge className="border-(--desktop-border-subtle) bg-(--desktop-surface-soft)">
						{loading
							? t('friends.mobileApp.callTargetLoading')
							: t('friends.mobileApp.callTargetSaving')}
					</DesktopAppStatusBadge>
				) : null}
			</div>
			{error ? (
				<DesktopProductStatusBanner
					tone="danger"
					role="alert"
					title={t('friends.mobileApp.callTargetErrorTitle')}
					description={error}
					actions={
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							onClick={() => void load()}
						>
							{t('friends.mobileApp.refresh')}
						</DesktopAppButton>
					}
				/>
			) : null}
			<div
				className="flex flex-col gap-2"
				role="radiogroup"
				aria-labelledby="mobile-hub-call-target-title"
			>
				{VIDEO_CALL_TARGETS.map((target) => {
					const selected = callTarget === target;
					return (
						<label
							key={target}
							className={cn(
								'flex cursor-pointer items-start gap-3 rounded-(--desktop-radius-md) border px-3 py-2.5',
								selected
									? 'border-(--desktop-accent) bg-(--desktop-surface-soft)'
									: 'border-(--desktop-border-subtle) bg-(--desktop-surface)'
							)}
						>
							<input
								type="radio"
								name="call_target"
								className="mt-1"
								checked={selected}
								disabled={loading || saving}
								onChange={() => void onSelect(target)}
							/>
							<span className="min-w-0">
								<span className="block text-sm font-medium text-(--desktop-text-primary)">
									{t(`friends.mobileApp.callTargetOption.${target}`)}
								</span>
								<span className="mt-0.5 block text-xs text-(--desktop-text-secondary)">
									{t(`friends.mobileApp.callTargetOptionHint.${target}`)}
								</span>
							</span>
						</label>
					);
				})}
			</div>
			<p className="text-xs text-(--desktop-text-tertiary)">
				{t('friends.mobileApp.callTargetHonesty')}
			</p>
		</section>
	);
}
