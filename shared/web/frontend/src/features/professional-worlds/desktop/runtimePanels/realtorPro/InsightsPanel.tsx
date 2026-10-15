/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Listing-centric insights workspace: comparable price snapshots, listing quality scores, and CRM bridge actions.
 *
 * Invariants:
 * - Prefers workspace `selectedPropertyId` so Object -> Insights keeps listing context.
 * - Sub-panels load per-listing data only when a property is selected.
 *
 * Related:
 * - ../RealtorProPanels.tsx
 * - ../../runtimeModuleRegistry.tsx
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	DesktopAppButton,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';

import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsWorkspacePanel,
} from '../../layout';

import { SupportDetailsPanel } from '../../components/SupportDetailsPanel';

import {
	listRealtorListingQualityScores,
	listRealtorPriceAnalysisSnapshots,
	recomputeRealtorListingQuality,
} from '../../api';
import { formatProfessionalWorldsApiError } from '../../professionalWorldsApiError';
import { useProfessionalWorldsWorkspace } from '../../ProfessionalWorldsWorkspaceContext';
import type { RuntimeModulePanelProps } from '../../runtimeModuleRegistry';
import {
	findUniqueDealForPropertyId,
	resolveListingCommunicationFocus,
} from '../../realtorLogic';
import type {
	ProfessionalDeal,
	RealtorListingQualityScore,
	RealtorPriceAnalysisSnapshot,
	RealtorProperty,
} from '../../types';

type AsyncState<T> = {
	data: T;
	error: string | null;
	loading: boolean;
};

function resolvePreferredPropertyId(
	snapshot: RuntimeModulePanelProps['snapshot'],
	selectedPropertyId: string | null | undefined
): string {
	if (
		selectedPropertyId &&
		snapshot.properties.some((property) => property.id === selectedPropertyId)
	) {
		return selectedPropertyId;
	}
	return snapshot.properties[0]?.id ?? '';
}

function useListingCrmBridge(
	snapshot: RuntimeModulePanelProps['snapshot'],
	propertyId: string
) {
	return useMemo(() => {
		const selectedProperty =
			snapshot.properties.find((property) => property.id === propertyId) ??
			null;
		const uniqueDeal = propertyId
			? findUniqueDealForPropertyId(
					snapshot.deals,
					snapshot.properties,
					propertyId
				)
			: null;
		return { selectedProperty, uniqueDeal };
	}, [propertyId, snapshot.deals, snapshot.properties]);
}

function ListingCrmBridgeActions({
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

function JsonPreview({
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

export function PriceAnalysisPanel({
	property,
}: {
	property: RealtorProperty | null;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [{ data: snapshots }, setSnapshotsState] = useState<
		AsyncState<RealtorPriceAnalysisSnapshot[]>
	>({
		data: [],
		error: null,
		loading: false,
	});
	useEffect(() => {
		if (!property) {
			setSnapshotsState({ data: [], error: null, loading: false });
			return;
		}
		const propertyId = property.id;
		let alive = true;
		setSnapshotsState((current) => ({
			...current,
			loading: true,
			error: null,
		}));
		listRealtorPriceAnalysisSnapshots(propertyId)
			.then((data) => {
				if (alive) setSnapshotsState({ data, error: null, loading: false });
			})
			.catch((err: unknown) => {
				if (alive) {
					setSnapshotsState({
						data: [],
						error: formatProfessionalWorldsApiError(err, (key) => t(key)),
						loading: false,
					});
				}
			});
		return () => {
			alive = false;
		};
	}, [property, t]);
	const latest = snapshots[0] ?? null;

	return (
		<div className="grid gap-2 rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3">
			<strong className="text-sm">
				{t('realtorPro.insights.comparableFacts')}
			</strong>
			{latest ? (
				<>
					<JsonPreview
						value={latest.snapshot}
						summaryKey="realtorPro.insights.snapshotSupportDetails"
					/>
					<p className="text-xs text-(--desktop-text-secondary)">
						{t('realtorPro.insights.aiCommentaryPrefix')}{' '}
						{String(
							latest.snapshot?.commentary ??
								latest.snapshot?.ai_commentary ??
								t('realtorPro.insights.noCommentaryYet')
						)}
					</p>
				</>
			) : (
				<p className="text-xs text-(--desktop-text-muted)">
					{t('realtorPro.insights.noSnapshots')}
				</p>
			)}
		</div>
	);
}

export function ListingQualityPanel({
	property,
}: {
	property: RealtorProperty | null;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [scores, setScores] = useState<RealtorListingQualityScore[]>([]);

	useEffect(() => {
		if (!property) return;
		let alive = true;
		listRealtorListingQualityScores(property.id).then((next) => {
			if (alive) setScores(next);
		});
		return () => {
			alive = false;
		};
	}, [property]);

	async function handleRecompute() {
		if (!property) return;
		const score = await recomputeRealtorListingQuality(property.id);
		setScores((current) => [score, ...current]);
	}

	const latest = scores[0] ?? null;
	return (
		<div className="grid gap-2 rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3">
			<div className="flex items-center justify-between gap-2">
				<strong className="text-sm">
					{t('realtorPro.insights.listingQuality')}
				</strong>
				<DesktopAppButton
					size="sm"
					variant="ghost"
					onClick={() => void handleRecompute()}
				>
					{t('realtorPro.insights.recompute')}
				</DesktopAppButton>
			</div>
			{latest ? (
				<>
					<p className="text-2xl font-semibold">{Math.round(latest.score)}%</p>
					<JsonPreview
						value={latest.breakdown}
						summaryKey="realtorPro.insights.breakdownSupportDetails"
					/>
				</>
			) : (
				<p className="text-xs text-(--desktop-text-muted)">
					{t('realtorPro.insights.noQualityHistory')}
				</p>
			)}
		</div>
	);
}

export function InsightsPanel({ snapshot }: RuntimeModulePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { selectedPropertyId, setSelectedPropertyId } =
		useProfessionalWorldsWorkspace();
	const [propertyId, setPropertyId] = useState(
		resolvePreferredPropertyId(snapshot, selectedPropertyId)
	);
	useEffect(() => {
		const preferred = resolvePreferredPropertyId(snapshot, selectedPropertyId);
		if (preferred && preferred !== propertyId) {
			setPropertyId(preferred);
		}
	}, [propertyId, selectedPropertyId, snapshot]);
	const { selectedProperty, uniqueDeal } = useListingCrmBridge(
		snapshot,
		propertyId
	);

	return (
		<ProfessionalWorldsWorkspacePanel title={t('realtorPro.insights.title')}>
			<ProfessionalWorldsFormField
				label={t('realtorPro.insights.listingLabel')}
			>
				<DesktopNativeSelect
					value={propertyId}
					onChange={(event) => {
						setPropertyId(event.target.value);
						setSelectedPropertyId(event.target.value || null);
					}}
				>
					{snapshot.properties.map((item) => (
						<option key={item.id} value={item.id}>
							{item.title}
						</option>
					))}
				</DesktopNativeSelect>
			</ProfessionalWorldsFormField>
			<ListingCrmBridgeActions
				property={selectedProperty}
				uniqueDeal={uniqueDeal}
			/>
			<div className="grid gap-3 md:grid-cols-2">
				<PriceAnalysisPanel property={selectedProperty} />
				<ListingQualityPanel property={selectedProperty} />
			</div>
		</ProfessionalWorldsWorkspacePanel>
	);
}
