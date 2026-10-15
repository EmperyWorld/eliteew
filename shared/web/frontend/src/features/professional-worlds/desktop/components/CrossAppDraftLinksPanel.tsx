/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lists persisted Professional Worlds cross-app draft links with refresh, reopen, and stale recovery hints.
 *
 * Invariants:
 * - Refresh calls server bookkeeping only; opening destinations never auto-publishes or sends.
 *
 * Related:
 * - ArtifactsWorkspacePanel.tsx
 * - openProfessionalDraftDestination.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import {
	listProfessionalCrossAppDraftLinks,
	refreshProfessionalCrossAppDraft,
} from '../api';
import {
	crossAppDraftKindI18nKey,
	crossAppDraftHandoffSuccessI18nKey,
	crossAppDraftLifecycleI18nKey,
	crossAppDraftLifecycleTone,
	crossAppDraftNeedsRecovery,
	isOptimisticCrossAppDraftLink,
	type CrossAppDraftRecreateHandoffRequest,
	mergeCrossAppDraftLink,
	resolveCrossAppDraftArtifactTitle,
	resolveCrossAppDraftPropertyId,
	resolveCrossAppDraftStaleCheckPropertyId,
	resolveCrossAppDraftStaleHint,
} from '../crossAppDraftLifecycleLogic';
import {
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsWorkspacePanel,
} from '../layout';
import { openProfessionalDraftDestination } from '../openProfessionalDraftDestination';
import { useProfessionalToasts } from '../ProfessionalToast';
import type {
	ProfessionalArtifact,
	ProfessionalCrossAppDraftLink,
} from '../types';

const lifecycleToneClass: Record<
	ReturnType<typeof crossAppDraftLifecycleTone>,
	string
> = {
	neutral: 'text-(--desktop-text-secondary)',
	active: 'text-(--desktop-status-success)',
	warning: 'text-(--desktop-status-warning)',
	muted: 'text-(--desktop-text-muted)',
};

export function CrossAppDraftLinksPanel({
	artifacts,
	refreshSignal = 0,
	staleCheckPropertyId = null,
	onRecreateHandoff,
	onOpenListing,
}: {
	artifacts: readonly ProfessionalArtifact[];
	refreshSignal?: number;
	staleCheckPropertyId?: string | null;
	onRecreateHandoff?: (request: CrossAppDraftRecreateHandoffRequest) => void;
	onOpenListing?: (propertyId: string) => void;
}) {
	const { t, i18n } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError, notifySuccess } = useProfessionalToasts();
	const [links, setLinks] = useState<ProfessionalCrossAppDraftLink[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [busyLinkId, setBusyLinkId] = useState<string | null>(null);

	const artifactTitles = useMemo(
		() =>
			artifacts.map((artifact) => ({
				id: artifact.id,
				title: artifact.title,
			})),
		[artifacts]
	);

	const staleCheckProperty = useMemo(
		() => resolveCrossAppDraftStaleCheckPropertyId(staleCheckPropertyId),
		[staleCheckPropertyId]
	);

	const loadLinks = useCallback(async () => {
		setLoading(true);
		setLoadError(null);
		try {
			const rows = await listProfessionalCrossAppDraftLinks({
				stale_check_property_id: staleCheckProperty,
			});
			setLinks(rows);
		} catch (caught: unknown) {
			setLoadError(t('crossAppDrafts.loadFailed'));
			notifyApiError(caught, t, t('crossAppDrafts.loadFailed'));
		} finally {
			setLoading(false);
		}
	}, [notifyApiError, staleCheckProperty, t]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: parent bumps refreshSignal to reload without staleCheckProperty change
	useEffect(() => {
		void loadLinks();
	}, [loadLinks, refreshSignal]);

	useEffect(() => {
		const timer = window.setInterval(() => {
			void loadLinks();
		}, 10_000);
		return () => window.clearInterval(timer);
	}, [loadLinks]);

	const handleRefresh = useCallback(
		async (linkId: string) => {
			setBusyLinkId(linkId);
			try {
				const refreshed = await refreshProfessionalCrossAppDraft(linkId);
				setLinks((current) => mergeCrossAppDraftLink(current, refreshed));
				notifySuccess(t('crossAppDrafts.refreshSuccess'));
			} catch (caught: unknown) {
				notifyApiError(caught, t, t('crossAppDrafts.refreshFailed'));
			} finally {
				setBusyLinkId(null);
			}
		},
		[notifyApiError, notifySuccess, t]
	);

	const handleOpen = useCallback(
		(link: ProfessionalCrossAppDraftLink) => {
			const opened = openProfessionalDraftDestination(link);
			if (!opened) {
				notifyApiError(
					new Error(t('crossAppDrafts.openFailed')),
					t,
					t('crossAppDrafts.openFailed')
				);
				return;
			}
			notifySuccess(
				t(crossAppDraftHandoffSuccessI18nKey(link.draft_kind, opened))
			);
			void refreshProfessionalCrossAppDraft(link.id)
				.then((refreshed) => {
					setLinks((current) => mergeCrossAppDraftLink(current, refreshed));
				})
				.catch(() => {
					// Destination opened; lifecycle bookkeeping refresh is best-effort only.
				});
		},
		[notifyApiError, notifySuccess, t]
	);

	const formatUpdatedAt = useCallback(
		(iso: string) => {
			const parsed = new Date(iso);
			if (Number.isNaN(parsed.getTime())) return iso;
			return parsed.toLocaleString(i18n.language, {
				dateStyle: 'short',
				timeStyle: 'short',
			});
		},
		[i18n.language]
	);

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('crossAppDrafts.sectionTitle')}
			dense
		>
			<p className="text-sm text-(--desktop-text-secondary)">
				{t('crossAppDrafts.sectionLead')}
			</p>
			{staleCheckProperty ? (
				<p className="text-xs text-(--desktop-text-muted)">
					{t('crossAppDrafts.staleCheckLead')}
				</p>
			) : null}
			{loading ? (
				<p className="text-sm text-(--desktop-text-muted)">
					{t('crossAppDrafts.loading')}
				</p>
			) : null}
			{loadError ? (
				<ProfessionalWorldsStatusBanner kind="error" role="alert">
					{loadError}
				</ProfessionalWorldsStatusBanner>
			) : null}
			{!loading && !loadError && links.length === 0 ? (
				<div className="grid gap-1">
					<p className="text-sm font-medium text-(--desktop-text-primary)">
						{t('crossAppDrafts.emptyTitle')}
					</p>
					<p className="text-sm text-(--desktop-text-secondary)">
						{t('crossAppDrafts.emptyBody')}
					</p>
				</div>
			) : null}
			<ul className="grid gap-3">
				{links.map((link) => {
					const tone = crossAppDraftLifecycleTone(link.lifecycle_state);
					const needsRecovery = crossAppDraftNeedsRecovery(link);
					const artifactTitle = resolveCrossAppDraftArtifactTitle(
						link,
						artifactTitles
					);
					const staleHint = resolveCrossAppDraftStaleHint(link, t);
					const busy = busyLinkId === link.id;
					const recreateArtifactId = link.artifact_id?.trim() || '';
					const linkPropertyId = resolveCrossAppDraftPropertyId(link);

					return (
						<li
							key={link.id}
							className={`grid gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3${
								isOptimisticCrossAppDraftLink(link)
									? ' animate-pulse opacity-80'
									: ''
							}`}
						>
							<div className="flex flex-wrap items-baseline justify-between gap-2">
								<div className="grid gap-0.5">
									<span className="text-sm font-medium text-(--desktop-text-primary)">
										{t(crossAppDraftKindI18nKey(link.draft_kind))}
									</span>
									{artifactTitle ? (
										<span className="text-xs text-(--desktop-text-secondary)">
											{artifactTitle}
										</span>
									) : null}
								</div>
								<span
									className={`text-xs font-medium ${lifecycleToneClass[tone]}`}
								>
									{t(crossAppDraftLifecycleI18nKey(link.lifecycle_state))}
								</span>
							</div>
							<p className="text-xs text-(--desktop-text-muted)">
								{t('crossAppDrafts.updatedAt', {
									date: formatUpdatedAt(link.updated_at),
								})}
							</p>
							{needsRecovery && staleHint ? (
								<ProfessionalWorldsStatusBanner kind="warning">
									<div className="grid gap-2">
										<span>{staleHint}</span>
										{linkPropertyId && onOpenListing ? (
											<DesktopAppButton
												size="sm"
												variant="ghost"
												onClick={() => onOpenListing(linkPropertyId)}
											>
												{t('crossAppDrafts.openListing')}
											</DesktopAppButton>
										) : null}
									</div>
								</ProfessionalWorldsStatusBanner>
							) : null}
							<div className="flex flex-wrap gap-2">
								<DesktopAppButton
									variant="ghost"
									disabled={busy}
									onClick={() => handleOpen(link)}
								>
									{t('crossAppDrafts.openButton')}
								</DesktopAppButton>
								<DesktopAppButton
									variant="ghost"
									disabled={busy}
									onClick={() => void handleRefresh(link.id)}
								>
									{t('crossAppDrafts.refreshButton')}
								</DesktopAppButton>
								{needsRecovery && recreateArtifactId && onRecreateHandoff ? (
									<DesktopAppButton
										variant="ghost"
										disabled={busy}
										onClick={() =>
											onRecreateHandoff({
												artifactId: recreateArtifactId,
												draftKind: link.draft_kind,
												propertyId: linkPropertyId,
											})
										}
									>
										{t('crossAppDrafts.recreateHandoff')}
									</DesktopAppButton>
								) : null}
							</div>
						</li>
					);
				})}
			</ul>
		</ProfessionalWorldsWorkspacePanel>
	);
}
