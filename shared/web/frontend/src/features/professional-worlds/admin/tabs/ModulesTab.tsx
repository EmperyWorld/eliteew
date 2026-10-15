/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Module catalog, assignment status and dependency/capability metadata editors for a vertical.
 *
 * Invariants:
 * - Dependency and capability metadata is stored in `default_config` to match the current backend contract.
 * - Mutations refresh the parent snapshot after successful API calls.
 * - Does not import adminUiShared (Wave 3 New World tab).
 *
 * Related:
 * - src/features/professional-worlds/admin/ProfessionalWorldsAdminSection.tsx
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import {
	useState,
	type Dispatch,
	type ReactNode,
	type SetStateAction,
} from 'react';

import {
	AdminButton,
	AdminField,
	AdminJsonPreview,
	AdminSelect,
	AdminStatusBanner,
	AdminToggle,
	adminUiFieldClass,
} from '@/pages/Admin/ui';
import { cn } from '@/utils/cn';

import { updateProfessionalWorldsModule } from '../api';
import { isModuleEnabledForVertical } from '../adminModuleAssignment';
import { adminText } from '../adminI18n';
import { parseJsonObjectField } from '../adminJsonValidation';
import type {
	ProfessionalModule,
	ProfessionalWorldsAdminSnapshot,
} from '../types';

type ModuleDraft = {
	module_key: string;
	name: string;
	category: string;
	description: string;
};

type AssignmentDraft = {
	module_key: string;
	sort_order: number;
};

type ModuleMetadataDraft = {
	module_key: string;
	name: string;
	category: string;
	description: string;
	icon_key: string;
	is_active: boolean;
	depends_on: string;
	capability_scopes: string;
	default_config: string;
};

function listFromConfig(value: unknown): string {
	return Array.isArray(value) ? value.map(String).join('\n') : '';
}

function splitLines(value: string): string[] {
	return value
		.split('\n')
		.map((item) => item.trim())
		.filter(Boolean);
}

function metadataDraftFromModule(
	module: ProfessionalModule
): ModuleMetadataDraft {
	return {
		module_key: module.module_key,
		name: module.name,
		category: module.category,
		description: module.description ?? '',
		icon_key: module.icon_key,
		is_active: module.is_active,
		depends_on: listFromConfig(module.default_config?.depends_on),
		capability_scopes: listFromConfig(module.default_config?.capability_scopes),
		default_config: JSON.stringify(module.default_config ?? {}, null, 2),
	};
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4">
			<h3 className="mb-3 text-sm font-semibold text-[var(--admin-ui-fg)]">
				{title}
			</h3>
			{children}
		</section>
	);
}

function StatusPill({ active }: { active: boolean }) {
	return (
		<span
			className={
				active
					? 'rounded-full bg-[var(--admin-ui-status-success-bg)] px-2 py-1 text-xs text-[var(--admin-ui-status-success)]'
					: 'rounded-full bg-[var(--admin-ui-surface-strong)] px-2 py-1 text-xs text-[var(--admin-ui-fg-muted)]'
			}
		>
			{active ? adminText('status.enabled') : adminText('status.disabled')}
		</span>
	);
}

function FieldBlock({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="grid gap-1 text-sm text-[var(--admin-ui-fg-muted)]">
			<span className="text-[var(--admin-ui-fg)]">{label}</span>
			{children}
		</div>
	);
}

export function ModulesTab({
	snapshot,
	verticalSlug,
	selectedVerticalName,
	moduleDraft,
	setModuleDraft,
	assignmentDraft,
	setAssignmentDraft,
	onCreateModule,
	onAssignModule,
	onToggleVerticalModule,
	onChanged,
}: {
	snapshot: ProfessionalWorldsAdminSnapshot;
	verticalSlug: string;
	selectedVerticalName: string | null;
	moduleDraft: ModuleDraft;
	setModuleDraft: Dispatch<SetStateAction<ModuleDraft>>;
	assignmentDraft: AssignmentDraft;
	setAssignmentDraft: Dispatch<SetStateAction<AssignmentDraft>>;
	onCreateModule: () => void | Promise<void>;
	onAssignModule: () => void | Promise<void>;
	onToggleVerticalModule: (
		moduleKey: string,
		enable: boolean
	) => void | Promise<void>;
	onChanged: () => void | Promise<void>;
}) {
	const [metadataDraft, setMetadataDraft] =
		useState<ModuleMetadataDraft | null>(null);
	const [metadataError, setMetadataError] = useState<string | null>(null);
	const [savingMetadata, setSavingMetadata] = useState(false);

	async function handleSaveMetadata() {
		if (!metadataDraft) {
			return;
		}
		setSavingMetadata(true);
		setMetadataError(null);
		try {
			const parsedConfig = parseJsonObjectField(
				metadataDraft.default_config,
				adminText('modules.defaultConfigLabel')
			);
			await updateProfessionalWorldsModule(metadataDraft.module_key, {
				name: metadataDraft.name,
				category: metadataDraft.category,
				description: metadataDraft.description || null,
				icon_key: metadataDraft.icon_key || 'squares',
				is_active: metadataDraft.is_active,
				default_config: {
					...parsedConfig,
					depends_on: splitLines(metadataDraft.depends_on),
					capability_scopes: splitLines(metadataDraft.capability_scopes),
				},
			});
			setMetadataDraft(null);
			await onChanged();
		} catch (err) {
			setMetadataError(
				err instanceof Error
					? err.message
					: adminText('errors.saveMetadataFailed')
			);
		} finally {
			setSavingMetadata(false);
		}
	}

	return (
		<div className="grid gap-4 xl:grid-cols-[1fr_360px]">
			<Panel title={adminText('modules.catalogTitle')}>
				<div className="grid gap-3">
					{snapshot.modules.map((module) => {
						const enabledForVertical = isModuleEnabledForVertical(
							snapshot.assignments,
							module.module_key
						);
						const defaultConfig = module.default_config ?? {};
						const dependsOn = Array.isArray(defaultConfig.depends_on)
							? defaultConfig.depends_on.map(String)
							: [];
						const capabilities = Array.isArray(defaultConfig.capability_scopes)
							? defaultConfig.capability_scopes.map(String)
							: [];
						return (
							<div
								key={module.module_key}
								className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-3"
							>
								<div className="flex items-center justify-between gap-3">
									<div>
										<strong className="text-[var(--admin-ui-fg)]">
											{module.name}
										</strong>
										<p className="text-sm text-[var(--admin-ui-fg-muted)]">
											{adminText('modules.moduleMetaLine', {
												moduleKey: module.module_key,
												category: module.category,
											})}
										</p>
									</div>
									<div className="flex shrink-0 flex-col items-end gap-2">
										<StatusPill active={enabledForVertical} />
										<AdminButton
											variant={enabledForVertical ? 'danger' : 'primary'}
											onClick={() =>
												void onToggleVerticalModule(
													module.module_key,
													!enabledForVertical
												)
											}
										>
											{enabledForVertical
												? adminText('modules.disableForVertical', {
														name: selectedVerticalName ?? verticalSlug,
													})
												: adminText('modules.enableForVertical', {
														name: selectedVerticalName ?? verticalSlug,
													})}
										</AdminButton>
									</div>
								</div>
								<div className="mt-3 grid gap-2 md:grid-cols-2">
									<div className="rounded-[var(--admin-ui-radius-sm)] bg-[var(--admin-ui-surface)] p-2 text-xs text-[var(--admin-ui-fg-muted)]">
										<p className="mb-1 text-[var(--admin-ui-fg-dim)]">
											{adminText('modules.dependencies')}
										</p>
										{dependsOn.length === 0 ? '—' : dependsOn.join(', ')}
									</div>
									<div className="rounded-[var(--admin-ui-radius-sm)] bg-[var(--admin-ui-surface)] p-2 text-xs text-[var(--admin-ui-fg-muted)]">
										<p className="mb-1 text-[var(--admin-ui-fg-dim)]">
											{adminText('modules.capabilityScopesLabel')}
										</p>
										{capabilities.length === 0 ? '—' : capabilities.join(', ')}
									</div>
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									<AdminButton
										variant="secondary"
										onClick={() =>
											setMetadataDraft(metadataDraftFromModule(module))
										}
									>
										{adminText('modules.metadata')}
									</AdminButton>
									<AdminJsonPreview
										value={module.default_config}
										title={adminText('jsonPreview.title')}
										helper={adminText('jsonPreview.helper')}
									/>
								</div>
							</div>
						);
					})}
				</div>
			</Panel>
			<div className="grid gap-4">
				<Panel title={adminText('modules.quickActions')}>
					<div className="grid gap-3">
						<AdminField
							value={moduleDraft.module_key}
							onChange={(event) =>
								setModuleDraft((draft) => ({
									...draft,
									module_key: event.target.value,
								}))
							}
							placeholder={adminText('modules.moduleKeyTechnicalPlaceholder')}
						/>
						<AdminField
							value={moduleDraft.name}
							onChange={(event) =>
								setModuleDraft((draft) => ({
									...draft,
									name: event.target.value,
								}))
							}
							placeholder={adminText('modules.namePlaceholder')}
						/>
						<AdminButton
							variant="primary"
							onClick={() => void onCreateModule()}
							disabled={!moduleDraft.module_key || !moduleDraft.name}
						>
							{adminText('modules.createModule')}
						</AdminButton>
						<AdminSelect
							value={assignmentDraft.module_key}
							onChange={(event) =>
								setAssignmentDraft((draft) => ({
									...draft,
									module_key: event.target.value,
								}))
							}
						>
							{snapshot.modules.map((module) => (
								<option key={module.module_key} value={module.module_key}>
									{adminText('modules.moduleOption', {
										name: module.name,
										moduleKey: module.module_key,
									})}
								</option>
							))}
						</AdminSelect>
						<AdminButton
							variant="secondary"
							onClick={() => void onAssignModule()}
						>
							{adminText('modules.assignFor', {
								name: selectedVerticalName ?? verticalSlug,
							})}
						</AdminButton>
					</div>
				</Panel>
				<Panel title={adminText('modules.metadataEditorTitle')}>
					{metadataDraft ? (
						<div className="grid gap-3">
							{metadataError ? (
								<AdminStatusBanner tone="danger">
									{metadataError}
								</AdminStatusBanner>
							) : null}
							<FieldBlock label={adminText('modules.metadataNameLabel')}>
								<AdminField
									value={metadataDraft.name}
									onChange={(event) =>
										setMetadataDraft((draft) =>
											draft ? { ...draft, name: event.target.value } : draft
										)
									}
								/>
							</FieldBlock>
							<FieldBlock label={adminText('modules.metadataCategoryLabel')}>
								<AdminField
									value={metadataDraft.category}
									onChange={(event) =>
										setMetadataDraft((draft) =>
											draft ? { ...draft, category: event.target.value } : draft
										)
									}
								/>
							</FieldBlock>
							<FieldBlock label={adminText('modules.metadataDescriptionLabel')}>
								<textarea
									value={metadataDraft.description}
									onChange={(event) =>
										setMetadataDraft((draft) =>
											draft
												? { ...draft, description: event.target.value }
												: draft
										)
									}
									placeholder={adminText('fields.description')}
									className={cn(adminUiFieldClass, 'min-h-20')}
								/>
							</FieldBlock>
							<FieldBlock label={adminText('modules.dependsOnLabel')}>
								<textarea
									value={metadataDraft.depends_on}
									onChange={(event) =>
										setMetadataDraft((draft) =>
											draft
												? { ...draft, depends_on: event.target.value }
												: draft
										)
									}
									placeholder={adminText('modules.dependsOnPlaceholder')}
									className={cn(
										adminUiFieldClass,
										'min-h-24 font-mono text-xs'
									)}
								/>
							</FieldBlock>
							<FieldBlock label={adminText('modules.capabilityScopesLabel')}>
								<textarea
									value={metadataDraft.capability_scopes}
									onChange={(event) =>
										setMetadataDraft((draft) =>
											draft
												? { ...draft, capability_scopes: event.target.value }
												: draft
										)
									}
									placeholder={adminText('modules.capabilityScopesPlaceholder')}
									className={cn(
										adminUiFieldClass,
										'min-h-24 font-mono text-xs'
									)}
								/>
							</FieldBlock>
							<FieldBlock label={adminText('modules.defaultConfigLabel')}>
								<textarea
									value={metadataDraft.default_config}
									onChange={(event) =>
										setMetadataDraft((draft) =>
											draft
												? { ...draft, default_config: event.target.value }
												: draft
										)
									}
									aria-label={adminText('modules.defaultConfigAria')}
									className={cn(
										adminUiFieldClass,
										'min-h-32 font-mono text-xs'
									)}
								/>
							</FieldBlock>
							<AdminToggle
								id="pw-module-meta-active"
								checked={metadataDraft.is_active}
								label={adminText('fields.active')}
								onChange={(event) =>
									setMetadataDraft((draft) =>
										draft
											? { ...draft, is_active: event.target.checked }
											: draft
									)
								}
							/>
							<div className="flex flex-wrap gap-2">
								<AdminButton
									variant="primary"
									onClick={() => void handleSaveMetadata()}
									disabled={savingMetadata || !metadataDraft.name}
								>
									{adminText('modules.saveMetadata')}
								</AdminButton>
								<AdminButton
									variant="secondary"
									onClick={() => {
										setMetadataDraft(null);
										setMetadataError(null);
									}}
								>
									{adminText('actions.cancel')}
								</AdminButton>
							</div>
						</div>
					) : (
						<p className="text-sm text-[var(--admin-ui-fg-muted)]">
							{adminText('modules.metadataHint')}
						</p>
					)}
				</Panel>
			</div>
		</div>
	);
}
