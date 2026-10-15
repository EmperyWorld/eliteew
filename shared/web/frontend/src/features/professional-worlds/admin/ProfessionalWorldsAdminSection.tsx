/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Admin section for configuring Professional Worlds vertical packs, modules, AI actions and integrations.
 *
 * Invariants:
 * - The section is admin-only and edits product configuration, not user-owned realtor objects.
 * - Prompt templates are editable here but never rendered in runtime user config.
 * - Module/assignment/AI/integration/test mutations propagate backend `detail` via `APIError` into the section-level error banner (`formatMutationError`).
 * - Does not import adminUiShared (Wave 3 New World shell).
 *
 * Related:
 * - src/pages/Admin/UnifiedAdminPage.tsx
 * - src/features/professional-worlds/admin/api.ts
 * - src/features/professional-worlds/admin/tabs/*
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { APIError } from '@/services/api/client';

import {
	assignProfessionalWorldsModule,
	disableProfessionalWorldsModuleAssignment,
	createProfessionalWorldsAiAction,
	createProfessionalWorldsModule,
	loadProfessionalWorldsAdminSnapshot,
	testProfessionalWorldsAiAction,
	updateProfessionalWorldsIntegration,
} from './api';
import {
	findVerticalModuleAssignment,
	setAssignmentEnabledInSnapshot,
	upsertAssignmentInSnapshot,
} from './adminModuleAssignment';
import {
	normalizeAdminModuleKey,
	validateAdminKey,
	validateAdminModuleKey,
} from './adminValidation';
import {
	ADMIN_UI_ROOT_CLASS,
	AdminButton,
	AdminSectionTabs,
	AdminSelect,
	AdminStatusBanner,
} from '@/pages/Admin/ui';

import { EMPTY_SNAPSHOT, TABS, type AdminTab } from './adminTabContract';
import { AiActionsTab } from './tabs/AiActionsTab';
import { AuditTab } from './tabs/AuditTab';
import { EvaluationsTab } from './tabs/EvaluationsTab';
import { IntegrationsTab } from './tabs/IntegrationsTab';
import { ModulesTab } from './tabs/ModulesTab';
import { OpsTab } from './tabs/OpsTab';
import { OverviewTab } from './tabs/OverviewTab';
import { PacksTab } from './tabs/PacksTab';
import { PhotoPresetsTab } from './tabs/PhotoPresetsTab';
import { PlaybooksTab } from './tabs/PlaybooksTab';
import { RolloutsTab } from './tabs/RolloutsTab';
import { SchemasTab } from './tabs/SchemasTab';
import { VerticalsTab } from './tabs/VerticalsTab';
import type { ProfessionalWorldsAdminSnapshot } from './types';

export function ProfessionalWorldsAdminSection() {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [tab, setTab] = useState<AdminTab>('overview');
	const [verticalSlug, setVerticalSlug] = useState('realtor');
	const [snapshot, setSnapshot] =
		useState<ProfessionalWorldsAdminSnapshot>(EMPTY_SNAPSHOT);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [moduleDraft, setModuleDraft] = useState({
		module_key: '',
		name: '',
		category: 'workspace',
		description: '',
	});
	const [assignmentDraft, setAssignmentDraft] = useState({
		module_key: 'objects',
		sort_order: 20,
	});
	const [aiActionDraft, setAiActionDraft] = useState({
		module_key: 'objects',
		action_key: '',
		display_name: '',
		prompt_template: t('admin.defaults.aiPromptTemplate', {
			property: '{{property}}',
			instruction: '{{instruction}}',
		}),
	});

	const selectedVertical = useMemo(
		() =>
			snapshot.verticals.find((vertical) => vertical.slug === verticalSlug) ??
			snapshot.verticals[0] ??
			null,
		[snapshot.verticals, verticalSlug]
	);

	function formatMutationError(error: unknown) {
		if (error instanceof APIError) return error.message;
		if (error instanceof Error) return error.message;
		return t('admin.errors.operationFailed');
	}

	function selectAndFocusTab(nextTab: AdminTab) {
		setTab(nextTab);
	}

	const refresh = useCallback(
		async (options?: { silent?: boolean }) => {
			if (!options?.silent) {
				setLoading(true);
			}
			setError(null);
			try {
				const next = await loadProfessionalWorldsAdminSnapshot(verticalSlug);
				setSnapshot(next);
				if (
					!next.verticals.some((vertical) => vertical.slug === verticalSlug)
				) {
					setVerticalSlug(next.verticals[0]?.slug ?? 'realtor');
				}
			} catch (err) {
				setError(
					err instanceof Error ? err.message : t('admin.errors.loadAdmin')
				);
			} finally {
				if (!options?.silent) {
					setLoading(false);
				}
			}
		},
		[t, verticalSlug]
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	async function handleCreateModule() {
		setMessage(null);
		setError(null);
		const keyError = validateAdminModuleKey(
			moduleDraft.module_key,
			'module_key'
		);
		if (keyError) {
			setError(keyError);
			return;
		}
		const moduleKey = normalizeAdminModuleKey(moduleDraft.module_key);
		try {
			const module = await createProfessionalWorldsModule({
				module_key: moduleKey,
				name: moduleDraft.name,
				category: moduleDraft.category,
				description: moduleDraft.description || null,
				icon_key: 'squares',
				default_config: {},
				is_active: true,
			});
			setMessage(t('admin.messages.moduleSaved', { key: module.module_key }));
			setModuleDraft({
				module_key: '',
				name: '',
				category: 'workspace',
				description: '',
			});
			await refresh();
		} catch (err) {
			setError(formatMutationError(err));
		}
	}

	async function handleAssignModule() {
		setMessage(null);
		setError(null);
		const moduleKey = assignmentDraft.module_key.trim();
		const keyError = validateAdminModuleKey(moduleKey, 'module_key');
		if (keyError) {
			setError(keyError);
			return;
		}
		try {
			const assignment = await assignProfessionalWorldsModule(
				verticalSlug,
				moduleKey,
				{
					config: {},
					sort_order: assignmentDraft.sort_order,
					is_enabled: true,
				}
			);
			setMessage(
				t('admin.messages.moduleAssigned', { key: assignment.module_key })
			);
			await refresh();
		} catch (err) {
			setError(formatMutationError(err));
		}
	}

	async function handleToggleVerticalModule(
		moduleKey: string,
		enable: boolean
	) {
		setMessage(null);
		setError(null);
		const key = moduleKey.trim();
		if (!key) {
			return;
		}
		try {
			if (enable) {
				const existing = findVerticalModuleAssignment(
					snapshot.assignments,
					key
				);
				const assignment = await assignProfessionalWorldsModule(
					verticalSlug,
					key,
					{
						config: existing?.config ?? {},
						sort_order: existing?.sort_order ?? 0,
						is_enabled: true,
					}
				);
				setSnapshot((previous) =>
					upsertAssignmentInSnapshot(previous, assignment)
				);
				setMessage(
					t('admin.messages.moduleAssigned', { key: assignment.module_key })
				);
			} else {
				await disableProfessionalWorldsModuleAssignment(verticalSlug, key);
				setSnapshot((previous) =>
					setAssignmentEnabledInSnapshot(previous, key, false)
				);
				setMessage(t('admin.messages.moduleDisabled', { key }));
			}
			await refresh({ silent: true });
		} catch (err) {
			setError(formatMutationError(err));
		}
	}

	async function handleCreateAiAction() {
		setMessage(null);
		setError(null);
		const keyError = validateAdminKey(aiActionDraft.action_key, 'action_key');
		if (keyError) {
			setError(keyError);
			return;
		}
		try {
			const action = await createProfessionalWorldsAiAction({
				vertical_slug: verticalSlug,
				module_key: aiActionDraft.module_key,
				action_key: aiActionDraft.action_key,
				display_name: aiActionDraft.display_name,
				description: null,
				ugs_type_key: aiActionDraft.action_key
					? `professional_worlds_${verticalSlug}_${aiActionDraft.action_key}`
					: 'professional_worlds_realtor_sales_copy',
				workflow_slug: null,
				prompt_template: aiActionDraft.prompt_template,
				input_schema: {},
				output_schema: {},
				safety_rules: [t('admin.defaults.noFabrication')],
				artifact_kind: 'text',
				billing_hint: { type: 'text' },
				is_active: true,
				sort_order: 100,
			});
			setMessage(t('admin.messages.aiActionSaved', { key: action.action_key }));
			setAiActionDraft({
				module_key: 'objects',
				action_key: '',
				display_name: '',
				prompt_template: t('admin.defaults.aiPromptTemplate', {
					property: '{{property}}',
					instruction: '{{instruction}}',
				}),
			});
			await refresh();
		} catch (err) {
			setError(formatMutationError(err));
		}
	}

	async function handleTestAction(actionKey: string) {
		setMessage(null);
		setError(null);
		try {
			const result = await testProfessionalWorldsAiAction(
				actionKey,
				verticalSlug
			);
			setMessage(
				t('admin.messages.aiActionDryRun', {
					actionKey,
					result: JSON.stringify(result),
				})
			);
		} catch (err) {
			setError(formatMutationError(err));
		}
	}

	async function handleToggleIntegration(
		integrationKey: string,
		enabled: boolean
	) {
		setError(null);
		const current = snapshot.integrations.find(
			(binding) => binding.integration_key === integrationKey
		);
		try {
			await updateProfessionalWorldsIntegration(verticalSlug, integrationKey, {
				display_name: current?.display_name,
				config: current?.config ?? {},
				is_enabled: enabled,
			});
			setMessage(
				t('admin.messages.integrationToggled', {
					key: integrationKey,
					status: enabled
						? t('admin.status.enabled')
						: t('admin.status.disabled'),
				})
			);
			await refresh();
		} catch (err) {
			setError(formatMutationError(err));
		}
	}

	return (
		<div className={ADMIN_UI_ROOT_CLASS}>
			<div className="mb-6 flex flex-wrap items-center justify-end gap-3">
				<div className="flex items-center gap-2">
					<AdminSelect
						value={verticalSlug}
						onChange={(event) => setVerticalSlug(event.target.value)}
					>
						{snapshot.verticals.map((vertical) => (
							<option key={vertical.slug} value={vertical.slug}>
								{t('admin.verticalOption', {
									name: vertical.name,
									slug: vertical.slug,
								})}
							</option>
						))}
					</AdminSelect>
					<AdminButton variant="primary" onClick={() => void refresh()}>
						{t('actions.refresh')}
					</AdminButton>
				</div>
			</div>

			<AdminSectionTabs
				className="mb-5"
				tabs={TABS.map((item) => ({
					id: item.id,
					label: t(item.labelKey),
				}))}
				activeId={tab}
				onChange={(id) => selectAndFocusTab(id as AdminTab)}
			/>

			{message ? (
				<AdminStatusBanner tone="success" className="mb-4">
					{message}
				</AdminStatusBanner>
			) : null}
			{error ? (
				<AdminStatusBanner tone="danger" className="mb-4">
					{error}
				</AdminStatusBanner>
			) : null}
			{loading ? (
				<div className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-8 text-[var(--admin-ui-fg-muted)]">
					{t('admin.status.loadingConfig')}
				</div>
			) : (
				<div
					aria-labelledby={`professional-worlds-admin-tab-${tab}`}
					className="grid gap-4"
					id={`professional-worlds-admin-panel-${tab}`}
					role="tabpanel"
				>
					{tab === 'overview' && (
						<OverviewTab
							snapshot={snapshot}
							onNavigateTab={selectAndFocusTab}
						/>
					)}
					{tab === 'ops' && <OpsTab />}
					{tab === 'verticals' && (
						<VerticalsTab snapshot={snapshot} onChanged={refresh} />
					)}
					{tab === 'modules' && (
						<ModulesTab
							snapshot={snapshot}
							verticalSlug={verticalSlug}
							selectedVerticalName={selectedVertical?.name ?? null}
							moduleDraft={moduleDraft}
							setModuleDraft={setModuleDraft}
							assignmentDraft={assignmentDraft}
							setAssignmentDraft={setAssignmentDraft}
							onCreateModule={handleCreateModule}
							onAssignModule={handleAssignModule}
							onToggleVerticalModule={handleToggleVerticalModule}
							onChanged={refresh}
						/>
					)}
					{tab === 'schemas' && (
						<SchemasTab
							snapshot={snapshot}
							verticalSlug={verticalSlug}
							onChanged={refresh}
						/>
					)}
					{tab === 'ai-actions' && (
						<AiActionsTab
							snapshot={snapshot}
							verticalSlug={verticalSlug}
							aiActionDraft={aiActionDraft}
							setAiActionDraft={setAiActionDraft}
							onCreateAiAction={handleCreateAiAction}
							onTestAction={handleTestAction}
							onChanged={refresh}
						/>
					)}
					{tab === 'playbooks' && (
						<PlaybooksTab
							verticalSlug={verticalSlug}
							snapshot={snapshot}
							onChanged={refresh}
						/>
					)}
					{tab === 'evaluation' && (
						<EvaluationsTab verticalSlug={verticalSlug} />
					)}
					{tab === 'photo-presets' && (
						<PhotoPresetsTab
							snapshot={snapshot}
							verticalSlug={verticalSlug}
							onChanged={refresh}
						/>
					)}
					{tab === 'integrations' && (
						<IntegrationsTab
							snapshot={snapshot}
							onToggleIntegration={handleToggleIntegration}
						/>
					)}
					{tab === 'packs' && (
						<PacksTab verticalSlug={verticalSlug} onChanged={refresh} />
					)}
					{tab === 'rollouts' && (
						<RolloutsTab verticalSlug={verticalSlug} onChanged={refresh} />
					)}
					{tab === 'audit' && <AuditTab snapshot={snapshot} />}
				</div>
			)}
		</div>
	);
}
