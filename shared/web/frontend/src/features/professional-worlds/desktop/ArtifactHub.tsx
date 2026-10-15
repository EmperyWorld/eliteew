/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime artifact browser with filters by property, module, artifact kind and creation date.
 *
 * Invariants:
 * - Filters are client-side only and never mutate artifact state.
 * - Source and module keys are treated as opaque backend identifiers.
 *
 * Related:
 * - types.ts
 * - ProfessionalWorldsApp.tsx
 */

import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { ProfessionalWorldsWorkspacePanel } from './layout';
import { SupportDetailsPanel } from './components/SupportDetailsPanel';

import type { ProfessionalArtifact, RealtorProperty } from './types';
import type { ArtifactQuickHandoffAction } from './artifactQuickHandoffLogic';
import { artifactSupportsQuickHandoff } from './artifactQuickHandoffLogic';

function uniqueSorted(values: Array<string | null | undefined>) {
	return Array.from(
		new Set(values.filter((value): value is string => Boolean(value)))
	).sort((a, b) => a.localeCompare(b));
}

function toDateInput(value: string) {
	return value.slice(0, 10);
}

function humanizeKey(value: string): string {
	return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function translateWithFallback(
	t: TFunction,
	key: string,
	fallback: string
): string {
	const translated = t(key);
	return translated === key ? fallback : translated;
}

function formatArtifactModuleLabel(
	t: TFunction,
	moduleKey: string | null | undefined
): string {
	if (!moduleKey) {
		return t('runtimeComponents.artifactHub.unknownModule');
	}
	return translateWithFallback(
		t,
		`professionTools.modules.${moduleKey}.label`,
		t('runtimeComponents.artifactHub.customModule', {
			module: humanizeKey(moduleKey),
		})
	);
}

function formatArtifactKindLabel(
	t: TFunction,
	kind: string | null | undefined
): string {
	if (!kind) {
		return t('runtimeComponents.artifactHub.defaultKind');
	}
	return translateWithFallback(
		t,
		`runtimeComponents.artifactHub.kinds.${kind}`,
		t('runtimeComponents.artifactHub.customKind', {
			kind: humanizeKey(kind),
		})
	);
}

function artifactDeepLink(artifact: ProfessionalArtifact): string | null {
	const link =
		artifact.export_metadata?.deep_link ?? artifact.export_metadata?.url;
	return typeof link === 'string' ? link : null;
}

function artifactHistory(
	artifact: ProfessionalArtifact,
	artifacts: ProfessionalArtifact[]
): ProfessionalArtifact[] {
	return artifacts
		.filter(
			(item) =>
				item.source_id === artifact.source_id &&
				item.module_key === artifact.module_key &&
				item.artifact_kind === artifact.artifact_kind
		)
		.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function downloadArtifact(artifact: ProfessionalArtifact) {
	const blob = new Blob([JSON.stringify(artifact, null, 2)], {
		type: 'application/json',
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${artifact.title || artifact.id}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

export function ArtifactHub({
	artifacts,
	onRegenerate,
	onQuickHandoff,
	onRemoveArtifact,
	quickHandoffActions = [],
	quickHandoffBusyKey = null,
	properties,
}: {
	artifacts: ProfessionalArtifact[];
	onRegenerate?: (artifact: ProfessionalArtifact) => void | Promise<void>;
	onQuickHandoff?: (
		artifact: ProfessionalArtifact,
		integrationKey: string
	) => void | Promise<void>;
	onRemoveArtifact?: (artifact: ProfessionalArtifact) => void;
	quickHandoffActions?: ArtifactQuickHandoffAction[];
	quickHandoffBusyKey?: string | null;
	properties: RealtorProperty[];
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [propertyId, setPropertyId] = useState('');
	const [moduleKey, setModuleKey] = useState('');
	const [artifactKind, setArtifactKind] = useState('');
	const [createdDate, setCreatedDate] = useState('');
	const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
		null
	);

	const propertyOptions = useMemo(
		() =>
			properties.map((property) => ({
				id: property.id,
				label: property.title,
			})),
		[properties]
	);
	const moduleOptions = useMemo(
		() => uniqueSorted(artifacts.map((artifact) => artifact.module_key)),
		[artifacts]
	);
	const kindOptions = useMemo(
		() => uniqueSorted(artifacts.map((artifact) => artifact.artifact_kind)),
		[artifacts]
	);
	const filteredArtifacts = useMemo(
		() =>
			artifacts.filter((artifact) => {
				if (propertyId && artifact.source_id !== propertyId) {
					return false;
				}
				if (moduleKey && artifact.module_key !== moduleKey) {
					return false;
				}
				if (artifactKind && artifact.artifact_kind !== artifactKind) {
					return false;
				}
				if (createdDate && toDateInput(artifact.created_at) !== createdDate) {
					return false;
				}
				return true;
			}),
		[artifactKind, artifacts, createdDate, moduleKey, propertyId]
	);

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('runtimeComponents.artifactHub.title')}
		>
			<div className="grid gap-2 md:grid-cols-4">
				<select
					aria-label={t('runtimeComponents.artifactHub.filterByProperty')}
					value={propertyId}
					onChange={(event) => setPropertyId(event.target.value)}
					className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-xs text-(--desktop-text-primary)"
				>
					<option value="">
						{t('runtimeComponents.artifactHub.allProperties')}
					</option>
					{propertyOptions.map((property) => (
						<option key={property.id} value={property.id}>
							{property.label}
						</option>
					))}
				</select>
				<select
					aria-label={t('runtimeComponents.artifactHub.filterByModule')}
					value={moduleKey}
					onChange={(event) => setModuleKey(event.target.value)}
					className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-xs text-(--desktop-text-primary)"
				>
					<option value="">
						{t('runtimeComponents.artifactHub.allModules')}
					</option>
					{moduleOptions.map((option) => (
						<option key={option} value={option}>
							{formatArtifactModuleLabel(t, option)}
						</option>
					))}
				</select>
				<select
					aria-label={t('runtimeComponents.artifactHub.filterByKind')}
					value={artifactKind}
					onChange={(event) => setArtifactKind(event.target.value)}
					className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-xs text-(--desktop-text-primary)"
				>
					<option value="">
						{t('runtimeComponents.artifactHub.allKinds')}
					</option>
					{kindOptions.map((option) => (
						<option key={option} value={option}>
							{formatArtifactKindLabel(t, option)}
						</option>
					))}
				</select>
				<input
					aria-label={t('runtimeComponents.artifactHub.filterByDate')}
					type="date"
					value={createdDate}
					onChange={(event) => setCreatedDate(event.target.value)}
					className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-xs text-(--desktop-text-primary)"
				/>
			</div>
			{filteredArtifacts.length === 0 ? (
				<DesktopAppEmptyState
					title={t('runtimeComponents.artifactHub.emptyTitle')}
					description={t('runtimeComponents.artifactHub.emptyDescription')}
				/>
			) : (
				<div className="grid gap-2">
					{filteredArtifacts.map((artifact) => (
						<ArtifactCard
							key={artifact.id}
							artifact={artifact}
							history={artifactHistory(artifact, artifacts)}
							historyExpanded={expandedHistoryId === artifact.id}
							onToggleHistory={() =>
								setExpandedHistoryId((current) =>
									current === artifact.id ? null : artifact.id
								)
							}
							onRegenerate={onRegenerate}
							onQuickHandoff={onQuickHandoff}
							onRemoveArtifact={onRemoveArtifact}
							quickHandoffActions={quickHandoffActions}
							quickHandoffBusyKey={quickHandoffBusyKey}
							t={t}
						/>
					))}
				</div>
			)}
		</ProfessionalWorldsWorkspacePanel>
	);
}

function ArtifactCard({
	artifact,
	history,
	historyExpanded,
	onRegenerate,
	onQuickHandoff,
	onRemoveArtifact,
	quickHandoffActions,
	quickHandoffBusyKey,
	onToggleHistory,
	t,
}: {
	artifact: ProfessionalArtifact;
	history: ProfessionalArtifact[];
	historyExpanded: boolean;
	onRegenerate?: (artifact: ProfessionalArtifact) => void | Promise<void>;
	onQuickHandoff?: (
		artifact: ProfessionalArtifact,
		integrationKey: string
	) => void | Promise<void>;
	onRemoveArtifact?: (artifact: ProfessionalArtifact) => void;
	quickHandoffActions: ArtifactQuickHandoffAction[];
	quickHandoffBusyKey: string | null;
	onToggleHistory: () => void;
	t: TFunction;
}) {
	const previous = history.find((item) => item.id !== artifact.id) ?? null;
	const deepLink = artifactDeepLink(artifact);
	const canQuickHandoff = artifactSupportsQuickHandoff(artifact);

	return (
		<article className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-sm">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<strong>{artifact.title}</strong>
				<span className="text-xs text-(--desktop-text-muted)">
					{toDateInput(artifact.created_at)}
				</span>
			</div>
			<p className="mt-1 text-xs text-(--desktop-text-muted)">
				{formatArtifactModuleLabel(t, artifact.module_key)} ·{' '}
				{formatArtifactKindLabel(
					t,
					artifact.artifact_kind ?? artifact.recipe_key
				)}
			</p>
			<p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-(--desktop-text-secondary)">
				{artifact.content}
			</p>
			{previous && (
				<div className="mt-3 grid gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-black/15 p-2 text-xs">
					<strong className="text-(--desktop-text-primary)">
						{t('runtimeComponents.artifactHub.previousComparison')}
					</strong>
					<div className="grid gap-2 md:grid-cols-2">
						<p className="line-clamp-3 whitespace-pre-wrap text-(--desktop-text-secondary)">
							{previous.content}
						</p>
						<p className="line-clamp-3 whitespace-pre-wrap text-(--desktop-text-secondary)">
							{artifact.content}
						</p>
					</div>
				</div>
			)}
			<div className="mt-3 flex flex-wrap gap-2">
				{canQuickHandoff && quickHandoffActions.length > 0 && onQuickHandoff
					? quickHandoffActions.map((action) => {
							const busyKey = `${artifact.id}:${action.integrationKey}`;
							return (
								<DesktopAppButton
									key={action.draftKind}
									size="sm"
									variant="accent"
									disabled={quickHandoffBusyKey === busyKey}
									onClick={() =>
										void onQuickHandoff(artifact, action.integrationKey)
									}
								>
									{t(action.labelKey)}
								</DesktopAppButton>
							);
						})
					: null}
				{!canQuickHandoff && quickHandoffActions.length > 0 ? (
					<p className="text-xs text-(--desktop-text-muted)">
						{t('runtimeComponents.artifactHub.quickHandoff.needsListingLink')}
					</p>
				) : null}
				<DesktopAppButton
					size="sm"
					variant="ghost"
					onClick={() =>
						void navigator.clipboard?.writeText(artifact.content ?? '')
					}
				>
					{t('runtimeComponents.artifactHub.copy')}
				</DesktopAppButton>
				{deepLink && (
					<DesktopAppButton
						size="sm"
						variant="ghost"
						onClick={() =>
							window.open(deepLink, '_blank', 'noopener,noreferrer')
						}
					>
						{t('runtimeComponents.artifactHub.openDraft')}
					</DesktopAppButton>
				)}
				{onRegenerate && (
					<DesktopAppButton
						size="sm"
						variant="accent"
						onClick={() => void onRegenerate(artifact)}
					>
						{t('runtimeComponents.artifactHub.regenerate')}
					</DesktopAppButton>
				)}
				{onRemoveArtifact ? (
					<DesktopAppButton
						size="sm"
						variant="ghost"
						onClick={() => onRemoveArtifact(artifact)}
					>
						{t('artifacts.deleteAction')}
					</DesktopAppButton>
				) : null}
				{history.length > 1 && (
					<DesktopAppButton size="sm" variant="ghost" onClick={onToggleHistory}>
						{historyExpanded
							? t('runtimeComponents.artifactHub.hideHistory')
							: t('runtimeComponents.artifactHub.showHistory')}
					</DesktopAppButton>
				)}
			</div>
			<SupportDetailsPanel className="mt-3">
				<p className="font-mono text-[10px] text-(--desktop-text-secondary)">
					{t('shared.recordIdLabel', { id: artifact.id })}
				</p>
				<DesktopAppButton
					size="sm"
					variant="ghost"
					className="mt-2"
					onClick={() => downloadArtifact(artifact)}
				>
					{t('runtimeComponents.artifactHub.exportJsonSupport')}
				</DesktopAppButton>
			</SupportDetailsPanel>
			{historyExpanded && (
				<ol className="mt-3 grid gap-2 border-l border-(--desktop-border-subtle) pl-3 text-xs text-(--desktop-text-secondary)">
					{history.map((item) => (
						<li key={item.id}>
							<strong className="text-(--desktop-text-primary)">
								{toDateInput(item.created_at)}
							</strong>{' '}
							{item.title}
						</li>
					))}
				</ol>
			)}
		</article>
	);
}
