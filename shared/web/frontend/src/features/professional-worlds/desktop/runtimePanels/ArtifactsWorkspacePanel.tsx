/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Library of generated professional artifacts for the active vertical, with filters and cross-app handoff.
 *
 * Invariants:
 * - Handoff creates property-linked drafts only; opening the destination app is explicit via sessionStorage bridge.
 * - Successful handoff surfaces toast feedback and a retry open action when launch fails.
 *
 * Related:
 * - ArtifactHub.tsx
 * - IntegrationHandoffPanel.tsx
 * - openProfessionalDraftDestination.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import {
	createPropertyDraft,
	deleteProfessionalArtifact,
	listProfessionalCrossAppDraftLinks,
} from '../api';
import { ProfessionalWorldsDeleteAction } from '../components/ProfessionalWorldsDeleteAction';
import { resolveIntegrationKeyForDraftKind } from '../artifactQuickHandoffLogic';
import { CrossAppDraftLinksPanel } from '../components/CrossAppDraftLinksPanel';
import { ArtifactHub } from '../ArtifactHub';
import {
	crossAppDraftHandoffSuccessI18nKey,
	type CrossAppDraftRecreateHandoffRequest,
} from '../crossAppDraftLifecycleLogic';
import { resolveArtifactQuickHandoffActions } from '../artifactQuickHandoffLogic';
import {
	IntegrationHandoffPanel,
	type IntegrationHandoffRequest,
} from '../IntegrationHandoffPanel';
import {
	openProfessionalDraftDestination,
	type ProfessionalDraftOpenPayload,
} from '../openProfessionalDraftDestination';
import { useProfessionalToasts } from '../ProfessionalToast';
import { useProfessionalWorldsWorkspace } from '../ProfessionalWorldsWorkspaceContext';
import {
	integrationKeyToPropertyDraftKind,
	removeArtifactFromSnapshot,
	upsertArtifactInSnapshot,
} from '../professionalWorldsSnapshotUtils';
import {
	ProfessionalWorldsHeroPanel,
	ProfessionalWorldsProgressRail,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsTrustNote,
	ProfessionalWorldsWorkspacePanel,
	ProfessionalWorldsWorkspaceSection,
	ProfessionalWorldsWorkspaceSubtabs,
} from '../layout';

type StoredHandoffLink = {
	readonly draft_kind: string;
	readonly external_ref?: ProfessionalDraftOpenPayload &
		Record<string, unknown>;
} | null;

export function ArtifactsWorkspacePanel() {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError, notifySuccess } = useProfessionalToasts();
	const {
		activeRuntimeConfig,
		navigate,
		patchSnapshot,
		snapshot,
		selectedPropertyId,
		artifactsWorkspaceFocus,
		consumeArtifactsWorkspaceFocus,
		openProperties,
	} = useProfessionalWorldsWorkspace();
	const [artifactsWorkspaceTab, setArtifactsWorkspaceTab] = useState<
		'library' | 'handoff' | 'sources'
	>('library');
	const [selectedArtifactId, setSelectedArtifactId] = useState(
		() => snapshot.artifacts[0]?.id ?? ''
	);
	const [lastHandoffLink, setLastHandoffLink] =
		useState<StoredHandoffLink>(null);
	const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
	const [quickHandoffBusyKey, setQuickHandoffBusyKey] = useState<string | null>(
		null
	);
	const [handoffLinksRefreshSignal, setHandoffLinksRefreshSignal] = useState(0);
	const [handoffPreferredDestinationKey, setHandoffPreferredDestinationKey] =
		useState<string | null>(null);
	const [artifactDeleteTarget, setArtifactDeleteTarget] = useState<{
		id: string;
		title: string;
	} | null>(null);
	const integrations = activeRuntimeConfig?.integrations ?? [];

	useEffect(() => {
		if (!artifactsWorkspaceFocus) return;
		if (artifactsWorkspaceFocus.tab) {
			setArtifactsWorkspaceTab(artifactsWorkspaceFocus.tab);
		}
		const focusedArtifactId = artifactsWorkspaceFocus.artifactId?.trim();
		if (focusedArtifactId) {
			setSelectedArtifactId(focusedArtifactId);
		}
		consumeArtifactsWorkspaceFocus();
	}, [artifactsWorkspaceFocus, consumeArtifactsWorkspaceFocus]);

	const quickHandoffActions = useMemo(
		() => resolveArtifactQuickHandoffActions(integrations),
		[integrations]
	);

	const selectedArtifact = useMemo(
		() =>
			snapshot.artifacts.find(
				(artifact) => artifact.id === selectedArtifactId
			) ??
			snapshot.artifacts[0] ??
			null,
		[selectedArtifactId, snapshot.artifacts]
	);

	const handleRetryOpenDestination = useCallback(() => {
		if (!lastHandoffLink) return;
		const opened = openProfessionalDraftDestination(lastHandoffLink);
		if (opened) {
			notifySuccess(t('integrationHandoff.openedDestination'));
			setHandoffNotice(t('integrationHandoff.openedDestination'));
			return;
		}
		notifyApiError(
			new Error(t('integrationHandoff.openFailedRetry')),
			t,
			t('integrationHandoff.openFailedRetry')
		);
	}, [lastHandoffLink, notifyApiError, notifySuccess, t]);

	const handleRecreateHandoff = useCallback(
		(request: CrossAppDraftRecreateHandoffRequest) => {
			setSelectedArtifactId(request.artifactId);
			const integrationKey = resolveIntegrationKeyForDraftKind(
				request.draftKind,
				integrations
			);
			setHandoffPreferredDestinationKey(integrationKey);
			setHandoffNotice(null);
			setArtifactsWorkspaceTab('handoff');
		},
		[integrations]
	);

	const handleOpenListingFromDraft = useCallback(
		(propertyId: string) => {
			openProperties({ propertyId });
		},
		[openProperties]
	);

	const handleCreateDraft = useCallback(
		async (request: IntegrationHandoffRequest) => {
			setHandoffNotice(null);
			const artifact = snapshot.artifacts.find(
				(item) => item.id === request.artifactId
			);
			if (!artifact) {
				throw new Error(t('integrationHandoff.selectArtifactBody'));
			}
			if (artifact.source_type !== 'realtor_property' || !artifact.source_id) {
				throw new Error(t('integrationHandoff.needsPropertyArtifact'));
			}
			const draftKind = integrationKeyToPropertyDraftKind(
				request.destinationKey
			);
			if (!draftKind) {
				throw new Error(t('integrationHandoff.chooseDestinationError'));
			}
			try {
				const created = await createPropertyDraft(
					artifact.source_id,
					draftKind,
					{
						content: artifact.content,
						title: artifact.title,
						note: request.note,
					}
				);
				patchSnapshot((current) => upsertArtifactInSnapshot(current, created));
				const links = await listProfessionalCrossAppDraftLinks({
					artifact_id: created.id,
				});
				const link = links[0] ?? null;
				setLastHandoffLink(link);
				const opened = openProfessionalDraftDestination(link);
				const successKey = crossAppDraftHandoffSuccessI18nKey(
					draftKind,
					opened
				);
				setHandoffLinksRefreshSignal((value) => value + 1);
				notifySuccess(t(successKey));
				setHandoffNotice(t(successKey));
				if (!opened) return;
			} catch (caught: unknown) {
				notifyApiError(caught, t, t('integrationHandoff.handoffFailedGeneric'));
				throw caught;
			}
		},
		[notifyApiError, notifySuccess, patchSnapshot, snapshot.artifacts, t]
	);

	const handleQuickHandoff = useCallback(
		async (artifact: { id: string }, integrationKey: string) => {
			const busyKey = `${artifact.id}:${integrationKey}`;
			setQuickHandoffBusyKey(busyKey);
			try {
				await handleCreateDraft({
					artifactId: artifact.id,
					destinationKey: integrationKey,
					note: '',
				});
			} finally {
				setQuickHandoffBusyKey(null);
			}
		},
		[handleCreateDraft]
	);

	const handleDeleteArtifact = useCallback(async () => {
		if (!artifactDeleteTarget) return;
		try {
			await deleteProfessionalArtifact(artifactDeleteTarget.id);
			patchSnapshot((current) => {
				const next = removeArtifactFromSnapshot(
					current,
					artifactDeleteTarget.id
				);
				setSelectedArtifactId((selected) =>
					selected === artifactDeleteTarget.id
						? (next.artifacts[0]?.id ?? '')
						: selected
				);
				return next;
			});
			notifySuccess(t('artifacts.deleteSuccess'));
			setArtifactDeleteTarget(null);
		} catch (caught: unknown) {
			notifyApiError(caught, t, t('artifacts.deleteFailed'));
			throw caught instanceof Error
				? caught
				: new Error(t('artifacts.deleteFailed'));
		}
	}, [artifactDeleteTarget, notifyApiError, notifySuccess, patchSnapshot, t]);

	const artifactCount = snapshot.artifacts.length;
	const hasArtifacts = artifactCount > 0;
	const heroCopy = useMemo(
		() =>
			hasArtifacts
				? {
						title: t('artifacts.visible.readyTitle'),
						description: t('artifacts.visible.readyDescription'),
					}
				: {
						title: t('artifacts.visible.emptyTitle'),
						description: t('artifacts.visible.emptyDescription'),
					},
		[hasArtifacts, t]
	);
	const progressItems = useMemo(
		() => [
			{
				id: 'saved',
				label: t('artifacts.visible.progressSaved'),
				value: hasArtifacts
					? String(artifactCount)
					: t('artifacts.visible.progressTodo'),
				complete: hasArtifacts,
			},
		],
		[artifactCount, hasArtifacts, t]
	);
	const heroPrimaryAction = useMemo(() => {
		if (artifactsWorkspaceTab === 'handoff') {
			if (!hasArtifacts) {
				return {
					label: t('artifacts.visible.actions.openScenarios'),
					onClick: () => navigate('playbooks'),
				};
			}
			return {
				label: t('artifacts.visible.actions.openLibrary'),
				onClick: () => setArtifactsWorkspaceTab('library'),
			};
		}
		if (artifactsWorkspaceTab === 'sources') {
			return {
				label: t('properties.workspaceOpenListings'),
				onClick: () => navigate('properties'),
			};
		}
		if (!hasArtifacts) {
			return {
				label: t('artifacts.visible.actions.openScenarios'),
				onClick: () => navigate('playbooks'),
			};
		}
		return {
			label: t('artifacts.visible.actions.sendToApps'),
			onClick: () => setArtifactsWorkspaceTab('handoff'),
		};
	}, [artifactsWorkspaceTab, hasArtifacts, navigate, t]);

	return (
		<ProfessionalWorldsWorkspaceSection
			title={t('artifacts.title')}
			subtabs={
				<ProfessionalWorldsWorkspaceSubtabs
					active={artifactsWorkspaceTab}
					ariaLabel={t('artifacts.workspaceAria')}
					items={[
						{ id: 'library', label: t('artifacts.tabs.library') },
						{ id: 'handoff', label: t('artifacts.tabs.handoff') },
						{ id: 'sources', label: t('artifacts.tabs.sources') },
					]}
					onSelect={(id) =>
						setArtifactsWorkspaceTab(id as 'library' | 'handoff' | 'sources')
					}
				/>
			}
		>
			<ProfessionalWorldsHeroPanel
				eyebrow={t('artifacts.visible.eyebrow')}
				title={heroCopy.title}
				description={heroCopy.description}
				primaryAction={
					<DesktopAppButton type="button" onClick={heroPrimaryAction.onClick}>
						{heroPrimaryAction.label}
					</DesktopAppButton>
				}
				meta={
					<ProfessionalWorldsProgressRail
						title={t('overview.visible.progress.title')}
						items={progressItems}
					/>
				}
			/>
			<ProfessionalWorldsTrustNote title={t('artifacts.visible.trustTitle')}>
				{t('artifacts.visible.trustBody')}
			</ProfessionalWorldsTrustNote>
			{artifactsWorkspaceTab === 'library' ? (
				<>
					{snapshot.artifacts.length > 0 ? (
						<p className="text-xs text-(--desktop-text-muted)">
							{t('artifacts.librarySummary', {
								count: snapshot.artifacts.length,
							})}
						</p>
					) : null}
					{handoffNotice ? (
						<ProfessionalWorldsStatusBanner kind="success" role="status">
							{handoffNotice}
						</ProfessionalWorldsStatusBanner>
					) : null}
					{lastHandoffLink ? (
						<DesktopAppButton
							variant="ghost"
							onClick={handleRetryOpenDestination}
						>
							{t('integrationHandoff.openDestinationAgain')}
						</DesktopAppButton>
					) : null}
					<ArtifactHub
						artifacts={snapshot.artifacts}
						properties={snapshot.properties}
						onQuickHandoff={handleQuickHandoff}
						onRemoveArtifact={(artifact) =>
							setArtifactDeleteTarget({
								id: artifact.id,
								title: artifact.title,
							})
						}
						quickHandoffActions={quickHandoffActions}
						quickHandoffBusyKey={quickHandoffBusyKey}
					/>
				</>
			) : null}
			{artifactsWorkspaceTab === 'handoff' ? (
				<>
					<CrossAppDraftLinksPanel
						artifacts={snapshot.artifacts}
						refreshSignal={handoffLinksRefreshSignal}
						staleCheckPropertyId={selectedPropertyId}
						onRecreateHandoff={handleRecreateHandoff}
						onOpenListing={handleOpenListingFromDraft}
					/>
					<ProfessionalWorldsWorkspacePanel>
						{handoffNotice ? (
							<ProfessionalWorldsStatusBanner kind="success" role="status">
								{handoffNotice}
							</ProfessionalWorldsStatusBanner>
						) : null}
						{lastHandoffLink ? (
							<DesktopAppButton
								variant="ghost"
								onClick={handleRetryOpenDestination}
							>
								{t('integrationHandoff.openDestinationAgain')}
							</DesktopAppButton>
						) : null}
						{snapshot.artifacts.length > 1 ? (
							<label className="grid gap-1 text-sm">
								<span>{t('integrationHandoff.selectArtifactTitle')}</span>
								<select
									className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2"
									value={selectedArtifact?.id ?? ''}
									onChange={(event) =>
										setSelectedArtifactId(event.target.value)
									}
								>
									{snapshot.artifacts.map((artifact) => (
										<option key={artifact.id} value={artifact.id}>
											{artifact.title}
										</option>
									))}
								</select>
							</label>
						) : null}
						<IntegrationHandoffPanel
							artifact={selectedArtifact}
							integrations={integrations}
							onCreateDraft={handleCreateDraft}
							preferredDestinationKey={handoffPreferredDestinationKey}
						/>
					</ProfessionalWorldsWorkspacePanel>
				</>
			) : null}
			{artifactsWorkspaceTab === 'sources' ? (
				<ProfessionalWorldsWorkspacePanel
					title={t('artifacts.tabs.sources')}
					dense
				>
					<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
						{t('artifacts.sourcingBody')}
					</p>
					<DesktopAppButton
						variant="ghost"
						onClick={() => navigate('properties')}
					>
						{t('properties.workspaceOpenListings')}
					</DesktopAppButton>
				</ProfessionalWorldsWorkspacePanel>
			) : null}
			<ProfessionalWorldsDeleteAction
				isOpen={artifactDeleteTarget !== null}
				onClose={() => setArtifactDeleteTarget(null)}
				onConfirm={handleDeleteArtifact}
				title={t('artifacts.deleteTitle')}
				itemName={artifactDeleteTarget?.title}
				warningMessage={t('artifacts.deleteWarning')}
				confirmButtonLabel={t('artifacts.deleteAction')}
			/>
		</ProfessionalWorldsWorkspaceSection>
	);
}
