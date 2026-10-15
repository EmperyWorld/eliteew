/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared JSX primitives for Realtor Pro runtime panels (status chrome, CRM bridge, badges, JSON preview).
 *
 * Invariants:
 * - Operator-facing copy resolves through `professionalWorlds.realtorPro`.
 * - Listing bridge actions require a resolved property before opening pipeline/clients/communications.
 *
 * Related:
 * - ./shared.ts
 * - documentation/product/PROFESSIONAL-WORLDS.md
 */

import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import { ProfessionalWorldsStatusBanner } from '../../layout';

import { SupportDetailsPanel } from '../../components/SupportDetailsPanel';

import { useProfessionalWorldsWorkspace } from '../../ProfessionalWorldsWorkspaceContext';
import { resolveListingCommunicationFocus } from '../../realtorLogic';
import type { ProfessionalDeal, RealtorProperty } from '../../types';

export function PanelStatus({
	error,
	loading,
}: {
	error: string | null;
	loading: boolean;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);

	if (loading) {
		return (
			<span className="text-xs text-(--desktop-text-muted)">
				{t('realtorPro.loading')}
			</span>
		);
	}
	if (error) {
		return (
			<ProfessionalWorldsStatusBanner kind="error" className="max-w-md">
				{error}
			</ProfessionalWorldsStatusBanner>
		);
	}
	return null;
}

export function ListingCrmBridgeActions({
	property,
	uniqueDeal,
}: {
	property: RealtorProperty | null;
	uniqueDeal: ProfessionalDeal | null;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const {
		openClients,
		openCommunications,
		openPipeline,
		openProperties,
		verticalAddonModules,
	} = useProfessionalWorldsWorkspace();
	const communicationsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_communications'
	);

	if (!property) {
		return null;
	}

	const listingCommunicationFocus = resolveListingCommunicationFocus(
		property.id
	);

	return (
		<>
			<div className="mb-3 flex flex-wrap gap-2">
				<DesktopAppButton
					size="sm"
					variant="ghost"
					onClick={() => openProperties({ propertyId: property.id })}
				>
					{t('realtorPro.documents.openListing')}
				</DesktopAppButton>
				{uniqueDeal ? (
					<DesktopAppButton
						size="sm"
						variant="ghost"
						onClick={() => openPipeline({ dealId: uniqueDeal.id })}
					>
						{t('realtorPro.documents.openDealInPipeline')}
					</DesktopAppButton>
				) : (
					<DesktopAppButton
						size="sm"
						variant="ghost"
						onClick={() =>
							openClients({
								tab: 'capture',
								linkedPropertyId: property.id,
							})
						}
					>
						{t('realtorPro.documents.createDealForListing')}
					</DesktopAppButton>
				)}
				{communicationsModuleEnabled && listingCommunicationFocus ? (
					<DesktopAppButton
						size="sm"
						variant="ghost"
						onClick={() => openCommunications(listingCommunicationFocus)}
					>
						{t('realtorPro.communications.logCta')}
					</DesktopAppButton>
				) : null}
			</div>
			{uniqueDeal ? (
				<p className="mb-3 text-xs text-(--desktop-text-secondary)">
					{t('realtorPro.documents.linkedDealHint', {
						title: uniqueDeal.title,
					})}
				</p>
			) : null}
		</>
	);
}

export function Badge({ children }: { children: string }) {
	return (
		<span className="rounded-full bg-(--desktop-surface-soft-hover) px-2 py-0.5 text-[11px] text-(--desktop-text-secondary)">
			{children}
		</span>
	);
}

export function JsonPreview({
	value,
	summaryKey = 'shared.supportDetails',
}: {
	value: Record<string, unknown> | undefined;
	summaryKey?: string;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	if (!value || Object.keys(value).length === 0) {
		return null;
	}
	return (
		<SupportDetailsPanel summary={t(summaryKey)}>
			<pre className="max-h-40 overflow-auto rounded-(--desktop-radius) bg-black/20 p-2 text-[11px] text-(--desktop-text-secondary)">
				{JSON.stringify(value, null, 2)}
			</pre>
		</SupportDetailsPanel>
	);
}
