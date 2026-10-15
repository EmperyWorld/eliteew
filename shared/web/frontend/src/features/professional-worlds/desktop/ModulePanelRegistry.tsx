/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime renderer for module-key based Professional Worlds panels.
 *
 * Invariants:
 * - Missing registry entries render a visible fallback instead of throwing.
 * - Lazy panel loading is wrapped in Suspense to keep the desktop shell responsive.
 * - Lock/copy strings resolve via `professionalWorlds.modulePanel`; module keys remain technical for support.
 *
 * Related:
 * - runtimeModuleRegistry.tsx
 * - ProfessionalWorldsRuntimeShell.tsx
 */

import { Suspense } from 'react';
import type { TFunction } from 'i18next';

import {
	DesktopAppEmptyState,
	DesktopAppSkeleton,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { ProfessionalWorldsPanelErrorBoundary } from './components/ProfessionalWorldsPanelErrorBoundary';

import {
	getRuntimeModuleRegistryEntry,
	type RuntimeModuleRegistryEntry,
} from './runtimeModuleRegistry';
import { runtimeModuleKeysMatch } from './verticalModuleLogic';

import type {
	ProfessionalRuntimeModule,
	ProfessionalUserVerticalActivation,
	ProfessionalWorldsSnapshot,
} from './types';

import { useTranslation } from 'react-i18next';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

function MissingModulePanel() {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	return (
		<DesktopAppEmptyState
			title={t('modulePanel.missingTitle')}
			description={t('modulePanel.missingDescription')}
		/>
	);
}

function asStringList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}

function humanizeModuleKey(value: string): string {
	return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function translateModuleLabel(
	t: TFunction,
	moduleKey: string,
	fallback?: string | null
): string {
	const knownKey = `modulePanel.knownModules.${moduleKey}`;
	const knownLabel = t(knownKey);
	if (knownLabel !== knownKey) {
		return knownLabel;
	}
	const addonKey = `professionTools.modules.${moduleKey}.label`;
	const addonLabel = t(addonKey);
	if (addonLabel !== addonKey) {
		return addonLabel;
	}
	return fallback || humanizeModuleKey(moduleKey);
}

function moduleConfigList(
	runtimeModule: ProfessionalRuntimeModule | null,
	key: string
): string[] {
	return runtimeModule ? asStringList(runtimeModule.config?.[key]) : [];
}

function missingEntitlements(
	runtimeModule: ProfessionalRuntimeModule | null,
	activation: ProfessionalUserVerticalActivation | null
): string[] {
	const required = moduleConfigList(runtimeModule, 'capability_scopes');
	if (required.length === 0) {
		return [];
	}
	const entitlements = activation?.entitlements ?? {};
	return required.filter((scope) => entitlements[scope] !== true);
}

function missingDependencies(
	runtimeModule: ProfessionalRuntimeModule | null,
	snapshot: ProfessionalWorldsSnapshot,
	verticalSlug: string
): string[] {
	const dependencies = moduleConfigList(runtimeModule, 'depends_on');
	const runtimeConfig =
		snapshot.runtimeConfigs.find(
			(config) => config.vertical_slug === verticalSlug
		) ?? snapshot.runtimeConfig;
	const enabledModules = (runtimeConfig?.modules ?? []).filter(
		(module) => module.is_enabled
	);
	return dependencies.filter(
		(dependency) =>
			!enabledModules.some((module) =>
				runtimeModuleKeysMatch(module.module_key, dependency)
			)
	);
}

function ModuleLockedPanel({
	moduleLabel,
	reasonPayload,
}: {
	moduleLabel: string;
	reasonPayload: string[];
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const joined = reasonPayload.filter(Boolean).join(' ');
	const description =
		reasonPayload.length > 1
			? joined
			: (reasonPayload[0] ?? t('modulePanel.reasonDisabled'));
	return (
		<DesktopAppEmptyState
			title={t('modulePanel.lockedTitle')}
			description={t('modulePanel.lockedDescription', {
				module: moduleLabel,
				reason: description,
			})}
		/>
	);
}

export function ModulePanelRegistry({
	activation = null,
	entry,
	moduleKey,
	runtimeModule,
	snapshot,
	verticalSlug,
	onRetry,
}: {
	activation?: ProfessionalUserVerticalActivation | null;
	entry?: RuntimeModuleRegistryEntry;
	moduleKey: string;
	runtimeModule: ProfessionalRuntimeModule | null;
	snapshot: ProfessionalWorldsSnapshot;
	verticalSlug: string;
	onRetry?: () => void;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const resolvedEntry = entry ?? getRuntimeModuleRegistryEntry(moduleKey);
	const moduleLabel = translateModuleLabel(
		t,
		moduleKey,
		runtimeModule?.module_name ?? resolvedEntry?.label
	);
	if (!runtimeModule?.is_enabled) {
		return (
			<ModuleLockedPanel
				moduleLabel={moduleLabel}
				reasonPayload={[t('modulePanel.reasonDisabled')]}
			/>
		);
	}
	const entitlementGaps = missingEntitlements(runtimeModule, activation);
	if (entitlementGaps.length > 0) {
		return (
			<ModuleLockedPanel
				moduleLabel={moduleLabel}
				reasonPayload={[
					t('modulePanel.reasonEntitlements', {
						scopes: entitlementGaps.join(', '),
					}),
				]}
			/>
		);
	}
	const dependencyGaps = missingDependencies(
		runtimeModule,
		snapshot,
		verticalSlug
	);
	if (dependencyGaps.length > 0) {
		return (
			<ModuleLockedPanel
				moduleLabel={moduleLabel}
				reasonPayload={[
					t('modulePanel.reasonDependencies', {
						modules: dependencyGaps
							.map((dependency) => translateModuleLabel(t, dependency))
							.join(', '),
					}),
				]}
			/>
		);
	}
	if (!resolvedEntry) {
		return <MissingModulePanel />;
	}

	const Panel = resolvedEntry.panel;
	return (
		<ProfessionalWorldsPanelErrorBoundary
			moduleLabel={moduleLabel}
			onRetry={onRetry}
		>
			<Suspense fallback={<DesktopAppSkeleton className="h-72" />}>
				<Panel
					entry={resolvedEntry}
					runtimeModule={runtimeModule}
					snapshot={snapshot}
					verticalSlug={verticalSlug}
				/>
			</Suspense>
		</ProfessionalWorldsPanelErrorBoundary>
	);
}
