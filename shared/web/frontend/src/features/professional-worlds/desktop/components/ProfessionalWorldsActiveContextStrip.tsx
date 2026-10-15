/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persistent active listing / client / deal context for Realtor workspace views.
 *
 * Invariants:
 * - Uses workspace `selectedProperty` only; does not infer context from the first snapshot row.
 * - Hidden when no listing, client, or deal context is available.
 *
 * Related:
 * - ProfessionalWorldsWorkspaceContext.tsx
 * - documentation/product/PROFESSIONAL-WORLDS.md
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import { useProfessionalWorldsWorkspace } from '../ProfessionalWorldsWorkspaceContext';
import { findUniqueDealForPropertyId } from '../realtorLogic';

export function ProfessionalWorldsActiveContextStrip() {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const {
		activeView,
		listingWorkspaceEnabled,
		openClients,
		openPipeline,
		openProperties,
		openShowings,
		openTasks,
		selectedProperty,
		snapshot,
		verticalAddonModules,
	} = useProfessionalWorldsWorkspace();

	const pipelineModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_pipeline'
	);
	const showingsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_showings'
	);
	const tasksModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_tasks'
	);

	const contextDeal = useMemo(
		() =>
			selectedProperty
				? findUniqueDealForPropertyId(
						snapshot.deals,
						snapshot.properties,
						selectedProperty.id
					)
				: null,
		[selectedProperty, snapshot.deals, snapshot.properties]
	);

	const contextClient = useMemo(() => {
		if (contextDeal?.client_id) {
			return (
				snapshot.clients.find(
					(client) => client.id === contextDeal.client_id
				) ?? null
			);
		}
		return null;
	}, [contextDeal?.client_id, snapshot.clients]);

	if (activeView === 'overview') {
		return null;
	}

	const hasContext = Boolean(selectedProperty || contextClient || contextDeal);
	if (!hasContext) {
		return null;
	}

	return (
		<section
			aria-label={t('contextStrip.ariaLabel')}
			className="flex flex-wrap items-center gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2"
		>
			<span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--desktop-text-muted)">
				{t('contextStrip.label')}
			</span>
			{selectedProperty ? (
				<span className="inline-flex max-w-full items-center gap-2 rounded-full bg-(--desktop-surface-elevated) px-3 py-1 text-xs text-(--desktop-text-primary)">
					<span className="truncate">{selectedProperty.title}</span>
					{listingWorkspaceEnabled ? (
						<DesktopAppButton
							size="sm"
							variant="ghost"
							onClick={() =>
								openProperties({ propertyId: selectedProperty.id })
							}
						>
							{t('contextStrip.openListing')}
						</DesktopAppButton>
					) : null}
				</span>
			) : null}
			{contextClient ? (
				<span className="inline-flex max-w-full items-center gap-2 rounded-full bg-(--desktop-surface-elevated) px-3 py-1 text-xs text-(--desktop-text-primary)">
					<span className="truncate">{contextClient.name}</span>
					<DesktopAppButton
						size="sm"
						variant="ghost"
						onClick={() =>
							openClients({
								tab: 'directory',
								filterClientId: contextClient.id,
							})
						}
					>
						{t('contextStrip.openClient')}
					</DesktopAppButton>
				</span>
			) : null}
			{contextDeal && pipelineModuleEnabled ? (
				<span className="inline-flex max-w-full items-center gap-2 rounded-full bg-(--desktop-surface-elevated) px-3 py-1 text-xs text-(--desktop-text-primary)">
					<span className="truncate">{contextDeal.title}</span>
					<DesktopAppButton
						size="sm"
						variant="ghost"
						onClick={() => openPipeline({ dealId: contextDeal.id })}
					>
						{t('contextStrip.openDeal')}
					</DesktopAppButton>
				</span>
			) : null}
			{selectedProperty && showingsModuleEnabled ? (
				<DesktopAppButton
					size="sm"
					variant="ghost"
					onClick={() =>
						openShowings({
							propertyId: selectedProperty.id,
							clientId: contextClient?.id ?? null,
						})
					}
				>
					{t('contextStrip.openShowings')}
				</DesktopAppButton>
			) : null}
			{tasksModuleEnabled &&
			(selectedProperty || contextClient || contextDeal) ? (
				<DesktopAppButton
					size="sm"
					variant="ghost"
					onClick={() =>
						openTasks({
							propertyId: selectedProperty?.id ?? null,
							clientId: contextClient?.id ?? null,
							dealId: contextDeal?.id ?? null,
						})
					}
				>
					{t('contextStrip.openTasks')}
				</DesktopAppButton>
			) : null}
		</section>
	);
}
