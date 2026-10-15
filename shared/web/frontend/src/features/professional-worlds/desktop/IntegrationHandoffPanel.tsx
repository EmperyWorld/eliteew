/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime panel for sending generated artifacts into configured draft destinations (`professionalWorlds.integrationHandoff` i18n).
 *
 * Invariants:
 * - Handoff actions create or open drafts only; this component never auto-publishes or auto-sends.
 * - Destination availability comes from runtime integration bindings.
 *
 * Related:
 * - types.ts
 * - ArtifactHub.tsx
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';

import {
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsWorkspacePanel,
} from './layout';
import type {
	ProfessionalArtifact,
	ProfessionalRuntimeIntegration,
} from './types';

export type IntegrationHandoffRequest = {
	artifactId: string;
	destinationKey: string;
	note: string;
};

export function IntegrationHandoffPanel({
	artifact,
	integrations,
	onCreateDraft,
	preferredDestinationKey = null,
}: {
	artifact: ProfessionalArtifact | null;
	integrations: ProfessionalRuntimeIntegration[];
	onCreateDraft: (request: IntegrationHandoffRequest) => void | Promise<void>;
	preferredDestinationKey?: string | null;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const destinations = useMemo(
		() => integrations.filter((integration) => integration.is_enabled),
		[integrations]
	);
	const [destinationKey, setDestinationKey] = useState(
		destinations[0]?.integration_key ?? ''
	);
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const preferred = preferredDestinationKey?.trim();
		if (!preferred) return;
		if (destinations.some((item) => item.integration_key === preferred)) {
			setDestinationKey(preferred);
		}
	}, [destinations, preferredDestinationKey]);

	if (!artifact) {
		return (
			<DesktopAppEmptyState
				title={t('integrationHandoff.selectArtifactTitle')}
				description={t('integrationHandoff.selectArtifactBody')}
			/>
		);
	}
	if (destinations.length === 0) {
		return (
			<DesktopAppEmptyState
				title={t('integrationHandoff.noDestinationsTitle')}
				description={t('integrationHandoff.noDestinationsBody')}
			/>
		);
	}

	const selectedArtifact = artifact;

	async function handleCreateDraft() {
		if (!destinationKey) {
			setError(t('integrationHandoff.chooseDestinationError'));
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await onCreateDraft({
				artifactId: selectedArtifact.id,
				destinationKey,
				note: note.trim(),
			});
			setNote('');
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: t('integrationHandoff.handoffFailedGeneric')
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('integrationHandoff.sectionLabel')}
		>
			<div className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-sm">
				<strong>{selectedArtifact.title}</strong>
				<p className="mt-1 line-clamp-2 text-xs text-(--desktop-text-secondary)">
					{selectedArtifact.content}
				</p>
			</div>
			<select
				aria-label={t('integrationHandoff.draftDestinationAria')}
				value={destinationKey}
				onChange={(event) => setDestinationKey(event.target.value)}
				className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)"
			>
				{destinations.map((destination) => (
					<option
						key={destination.integration_key}
						value={destination.integration_key}
					>
						{destination.display_name}
					</option>
				))}
			</select>
			<textarea
				aria-label={t('integrationHandoff.noteAria')}
				value={note}
				onChange={(event) => setNote(event.target.value)}
				placeholder={t('integrationHandoff.notePlaceholder')}
				className="min-h-24 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)"
			/>
			{error ? (
				<ProfessionalWorldsStatusBanner kind="error">
					{error}
				</ProfessionalWorldsStatusBanner>
			) : null}
			<DesktopAppButton
				disabled={busy || !destinationKey}
				onClick={() => void handleCreateDraft()}
			>
				{t('integrationHandoff.createDraftButton')}
			</DesktopAppButton>
		</ProfessionalWorldsWorkspacePanel>
	);
}
