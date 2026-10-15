/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profession tools section: enabled `{vertical_slug}_*` runtime addon modules via registry with user-facing localized guidance.
 *
 * Invariants:
 * - Only the selected addon module mounts and fetches data; other enabled modules stay idle until opened.
 * - Primary CRM addons stay visible; documents/marketing/insights/objections sit behind collapsed disclosure.
 *
 * Related:
 * - ModulePanelRegistry.tsx
 * - documentation/product/PROFESSIONAL-WORLDS.md
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import { useProfessionalWorldsWorkspace } from '../ProfessionalWorldsWorkspaceContext';
import { ModulePanelRegistry } from '../ModulePanelRegistry';
import { SupportDetailsPanel } from '../components/SupportDetailsPanel';
import {
	ProfessionalWorldsHeroPanel,
	ProfessionalWorldsProgressRail,
	ProfessionalWorldsTrustNote,
	ProfessionalWorldsWorkspacePanel,
	ProfessionalWorldsWorkspaceSection,
	ProfessionalWorldsWorkspaceSubtabs,
} from '../layout';
import { resolveRuntimeModuleNavLabel } from '../verticalModuleLogic';

const PROFESSION_TOOL_MODULE_KEYS = [
	'realtor_leads',
	'realtor_buyers',
	'realtor_sellers',
	'realtor_pipeline',
	'realtor_showings',
	'realtor_tasks',
	'realtor_documents',
	'realtor_marketing',
	'realtor_insights',
	'realtor_communications',
	'realtor_objections',
] as const;

const PRIMARY_PROFESSION_TOOL_MODULE_KEYS = new Set<string>([
	'realtor_leads',
	'realtor_buyers',
	'realtor_sellers',
	'realtor_pipeline',
	'realtor_showings',
	'realtor_tasks',
	'realtor_communications',
]);

const SECONDARY_PROFESSION_TOOL_MODULE_KEYS = new Set<string>([
	'realtor_documents',
	'realtor_marketing',
	'realtor_insights',
	'realtor_objections',
]);

const LOCALIZED_PROFESSION_TOOL_MODULE_KEYS = new Set<string>(
	PROFESSION_TOOL_MODULE_KEYS
);

export function ProfessionToolsWorkspacePanel() {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const {
		activeActivation,
		activeVertical,
		activeVerticalSlug,
		consumeProfessionToolFocus,
		professionToolFocusModuleKey,
		refresh,
		snapshot,
		verticalAddonModules,
	} = useProfessionalWorldsWorkspace();
	const professionNameKey = `professionTools.professionNames.${activeVerticalSlug}`;
	const localizedProfessionName = t(professionNameKey);
	const professionLabel =
		localizedProfessionName !== professionNameKey
			? localizedProfessionName
			: (activeVertical?.name ?? activeVerticalSlug);
	const moduleTabs = useMemo(
		() =>
			verticalAddonModules.map((addonModule) => {
				const moduleCopyKey = `professionTools.modules.${addonModule.module_key}`;
				const labelKey = `${moduleCopyKey}.label`;
				const descriptionKey = `${moduleCopyKey}.description`;
				const localizedLabel = t(labelKey);
				const localizedDescription = t(descriptionKey);
				const hasLocalizedCopy = LOCALIZED_PROFESSION_TOOL_MODULE_KEYS.has(
					addonModule.module_key
				);

				return {
					description:
						hasLocalizedCopy && localizedDescription !== descriptionKey
							? localizedDescription
							: t('professionTools.customModuleDescription'),
					id: addonModule.module_key,
					label:
						hasLocalizedCopy && localizedLabel !== labelKey
							? localizedLabel
							: resolveRuntimeModuleNavLabel(
									addonModule,
									addonModule.module_key
								),
				};
			}),
		[t, verticalAddonModules]
	);
	const primaryModuleTabs = useMemo(
		() =>
			moduleTabs.filter(
				(tab) =>
					PRIMARY_PROFESSION_TOOL_MODULE_KEYS.has(tab.id) ||
					(!PRIMARY_PROFESSION_TOOL_MODULE_KEYS.has(tab.id) &&
						!SECONDARY_PROFESSION_TOOL_MODULE_KEYS.has(tab.id))
			),
		[moduleTabs]
	);
	const secondaryModuleTabs = useMemo(
		() =>
			moduleTabs.filter((tab) =>
				SECONDARY_PROFESSION_TOOL_MODULE_KEYS.has(tab.id)
			),
		[moduleTabs]
	);
	const [activeModuleKey, setActiveModuleKey] = useState(
		() => primaryModuleTabs[0]?.id ?? moduleTabs[0]?.id ?? ''
	);

	useEffect(() => {
		if (moduleTabs.length === 0) {
			setActiveModuleKey('');
			return;
		}
		setActiveModuleKey((current) =>
			moduleTabs.some((tab) => tab.id === current)
				? current
				: (primaryModuleTabs[0]?.id ?? moduleTabs[0]?.id ?? '')
		);
	}, [moduleTabs, primaryModuleTabs]);

	useEffect(() => {
		if (!professionToolFocusModuleKey) return;
		if (
			verticalAddonModules.some(
				(mod) => mod.module_key === professionToolFocusModuleKey
			)
		) {
			setActiveModuleKey(professionToolFocusModuleKey);
		}
		consumeProfessionToolFocus();
	}, [
		consumeProfessionToolFocus,
		professionToolFocusModuleKey,
		verticalAddonModules,
	]);

	const activeAddonModule = verticalAddonModules.find(
		(mod) => mod.module_key === activeModuleKey
	);
	const activeModuleTab = moduleTabs.find((tab) => tab.id === activeModuleKey);
	const moduleCount = verticalAddonModules.length;
	const hasModules = moduleCount > 0;
	const heroCopy = useMemo(
		() =>
			hasModules
				? {
						title: t('professionTools.visible.readyTitle'),
						description: t('professionTools.visible.readyDescription'),
					}
				: {
						title: t('professionTools.visible.emptyTitle'),
						description: t('professionTools.visible.emptyDescription'),
					},
		[hasModules, t]
	);
	const progressItems = useMemo(
		() => [
			{
				id: 'tools',
				label: t('professionTools.visible.progressTools'),
				value: hasModules
					? String(moduleCount)
					: t('professionTools.visible.progressTodo'),
				complete: hasModules,
			},
		],
		[hasModules, moduleCount, t]
	);
	const heroPrimaryAction = useMemo(() => {
		if (!hasModules) {
			return undefined;
		}
		const firstTab = primaryModuleTabs[0] ?? moduleTabs[0];
		if (!firstTab) {
			return undefined;
		}
		return {
			label: t('professionTools.visible.actions.openFirstTask'),
			onClick: () => setActiveModuleKey(firstTab.id),
		};
	}, [hasModules, moduleTabs, primaryModuleTabs, t]);

	return (
		<ProfessionalWorldsWorkspaceSection
			title={t('professionTools.sectionTitle', { profession: professionLabel })}
			subtabs={
				primaryModuleTabs.length > 1 ? (
					<ProfessionalWorldsWorkspaceSubtabs
						active={activeModuleKey}
						ariaLabel={t('professionTools.moduleTabsAria')}
						items={primaryModuleTabs}
						onSelect={setActiveModuleKey}
					/>
				) : undefined
			}
		>
			<ProfessionalWorldsHeroPanel
				eyebrow={t('professionTools.visible.eyebrow')}
				title={heroCopy.title}
				description={heroCopy.description}
				primaryAction={
					heroPrimaryAction ? (
						<DesktopAppButton type="button" onClick={heroPrimaryAction.onClick}>
							{heroPrimaryAction.label}
						</DesktopAppButton>
					) : undefined
				}
				meta={
					<ProfessionalWorldsProgressRail
						title={t('overview.visible.progress.title')}
						items={progressItems}
					/>
				}
			/>
			<ProfessionalWorldsTrustNote
				title={t('professionTools.visible.trustTitle')}
			>
				{t('professionTools.visible.trustBody')}
			</ProfessionalWorldsTrustNote>
			{secondaryModuleTabs.length > 0 ? (
				<SupportDetailsPanel summary={t('professionTools.secondaryMoreTitle')}>
					<p className="mb-2 text-xs text-(--desktop-text-secondary)">
						{t('professionTools.secondaryMoreHint')}
					</p>
					<ProfessionalWorldsWorkspaceSubtabs
						active={activeModuleKey}
						ariaLabel={t('professionTools.secondaryTabsAria')}
						items={secondaryModuleTabs}
						onSelect={setActiveModuleKey}
					/>
				</SupportDetailsPanel>
			) : null}
			{activeModuleTab ? (
				<ProfessionalWorldsWorkspacePanel
					dense
					className="border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/55"
				>
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="grid gap-1">
							<span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-(--desktop-text-muted)">
								{t('professionTools.activeEyebrow')}
							</span>
							<p className="text-sm font-semibold text-(--desktop-text-primary)">
								{activeModuleTab.label}
							</p>
							<p className="max-w-3xl text-xs leading-relaxed text-(--desktop-text-secondary)">
								{activeModuleTab.description}
							</p>
						</div>
						<span className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface)/70 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-(--desktop-text-muted)">
							{t('professionTools.enabledCount', {
								count: verticalAddonModules.length,
							})}
						</span>
					</div>
				</ProfessionalWorldsWorkspacePanel>
			) : null}
			{activeAddonModule ? (
				<ModulePanelRegistry
					key={`${activeVerticalSlug}-${activeAddonModule.module_key}`}
					activation={activeActivation}
					moduleKey={activeAddonModule.module_key}
					runtimeModule={activeAddonModule}
					snapshot={snapshot}
					verticalSlug={activeVerticalSlug}
					onRetry={() =>
						void refresh({ verticalSlug: activeVerticalSlug, silent: true })
					}
				/>
			) : null}
			{verticalAddonModules.length === 0 ? (
				<ProfessionalWorldsWorkspacePanel dense>
					<p className="text-sm text-(--desktop-text-secondary)">
						{t('professionTools.emptyLead')}
					</p>
					<p className="text-xs text-(--desktop-text-muted)">
						{t('professionTools.empty')}
					</p>
				</ProfessionalWorldsWorkspacePanel>
			) : null}
		</ProfessionalWorldsWorkspaceSection>
	);
}
