/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Create, edit, disable and inspect configured Professional Worlds verticals.
 *
 * Invariants:
 * - JSON template fields are parsed before API calls.
 * - Disable is a soft-disable route, never a hard delete.
 * - Does not import adminUiShared (Wave 3 New World tab).
 *
 * Related:
 * - src/features/professional-worlds/admin/api.ts
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useState, type ReactNode } from 'react';

import {
	AdminButton,
	AdminField,
	AdminJsonPreview,
	AdminStatusBanner,
	AdminToggle,
	adminUiFieldClass,
} from '@/pages/Admin/ui';
import { cn } from '@/utils/cn';

import {
	createProfessionalWorldsVertical,
	disableProfessionalWorldsVertical,
	updateProfessionalWorldsVertical,
} from '../api';
import { adminText } from '../adminI18n';
import { parseJsonObjectField } from '../adminJsonValidation';
import type {
	AdminProfessionVertical,
	ProfessionalWorldsAdminSnapshot,
} from '../types';

type VerticalDraft = {
	slug: string;
	name: string;
	description: string;
	icon_key: string;
	is_active: boolean;
	profile_schema: string;
	workspace_template: string;
};

const EMPTY_VERTICAL_DRAFT: VerticalDraft = {
	slug: '',
	name: '',
	description: '',
	icon_key: 'briefcase',
	is_active: true,
	profile_schema: '{}',
	workspace_template: '{}',
};

function draftFromVertical(vertical: AdminProfessionVertical): VerticalDraft {
	return {
		slug: vertical.slug,
		name: vertical.name,
		description: vertical.description ?? '',
		icon_key: vertical.icon_key,
		is_active: vertical.is_active,
		profile_schema: JSON.stringify(vertical.profile_schema ?? {}, null, 2),
		workspace_template: JSON.stringify(
			vertical.workspace_template ?? {},
			null,
			2
		),
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

function FieldLabel({
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

export function VerticalsTab({
	snapshot,
	onChanged,
}: {
	snapshot: ProfessionalWorldsAdminSnapshot;
	onChanged: () => void | Promise<void>;
}) {
	const [editingSlug, setEditingSlug] = useState<string | null>(null);
	const [draft, setDraft] = useState<VerticalDraft>(EMPTY_VERTICAL_DRAFT);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function resetForm() {
		setEditingSlug(null);
		setDraft(EMPTY_VERTICAL_DRAFT);
		setError(null);
	}

	async function handleSubmit() {
		setSaving(true);
		setError(null);
		try {
			const profileSchema = parseJsonObjectField(
				draft.profile_schema,
				adminText('verticals.profileSchemaLabel')
			);
			const workspaceTemplate = parseJsonObjectField(
				draft.workspace_template,
				adminText('verticals.workspaceTemplateLabel')
			);
			if (editingSlug) {
				await updateProfessionalWorldsVertical(editingSlug, {
					name: draft.name,
					description: draft.description || null,
					icon_key: draft.icon_key || 'briefcase',
					is_active: draft.is_active,
					profile_schema: profileSchema,
					workspace_template: workspaceTemplate,
				});
			} else {
				await createProfessionalWorldsVertical({
					slug: draft.slug,
					name: draft.name,
					description: draft.description || null,
					icon_key: draft.icon_key || 'briefcase',
					is_active: draft.is_active,
					profile_schema: profileSchema,
					workspace_template: workspaceTemplate,
				});
			}
			resetForm();
			await onChanged();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : adminText('errors.saveFailed')
			);
		} finally {
			setSaving(false);
		}
	}

	async function handleDisable(slug: string) {
		setSaving(true);
		setError(null);
		try {
			await disableProfessionalWorldsVertical(slug);
			if (editingSlug === slug) {
				resetForm();
			}
			await onChanged();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : adminText('errors.disableFailed')
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="grid gap-4 xl:grid-cols-[1fr_420px]">
			<Panel title={adminText('tabs.verticals')}>
				<div className="grid gap-3">
					{snapshot.verticals.map((vertical) => (
						<div
							key={vertical.slug}
							className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-3"
						>
							<div className="flex items-center justify-between gap-3">
								<div>
									<strong className="text-[var(--admin-ui-fg)]">
										{vertical.name}
									</strong>
									<p className="text-sm text-[var(--admin-ui-fg-muted)]">
										{adminText('verticals.slugMeta', { slug: vertical.slug })}
									</p>
								</div>
								<StatusPill active={vertical.is_active} />
							</div>
							<p className="mt-2 text-sm text-[var(--admin-ui-fg-muted)]">
								{vertical.description}
							</p>
							<div className="mt-3 grid gap-2 md:grid-cols-2">
								<AdminJsonPreview value={vertical.profile_schema} />
								<AdminJsonPreview value={vertical.workspace_template} />
							</div>
							<div className="mt-3 flex flex-wrap gap-2">
								<AdminButton
									variant="secondary"
									onClick={() => {
										setEditingSlug(vertical.slug);
										setDraft(draftFromVertical(vertical));
										setError(null);
									}}
								>
									{adminText('actions.edit')}
								</AdminButton>
								<AdminButton
									variant="danger"
									onClick={() => void handleDisable(vertical.slug)}
									disabled={saving || !vertical.is_active}
								>
									{adminText('actions.disable')}
								</AdminButton>
							</div>
						</div>
					))}
				</div>
			</Panel>

			<Panel
				title={
					editingSlug
						? adminText('verticals.editTitle')
						: adminText('verticals.newTitle')
				}
			>
				<div className="grid gap-3">
					{error ? (
						<AdminStatusBanner tone="danger">{error}</AdminStatusBanner>
					) : null}
					<FieldLabel label={adminText('verticals.slugLabel')}>
						<AdminField
							value={draft.slug}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									slug: event.target.value,
								}))
							}
							disabled={editingSlug !== null}
							placeholder={adminText('verticals.slugTechnicalPlaceholder')}
						/>
					</FieldLabel>
					<FieldLabel label={adminText('verticals.nameLabel')}>
						<AdminField
							value={draft.name}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									name: event.target.value,
								}))
							}
							placeholder={adminText('fields.name')}
						/>
					</FieldLabel>
					<FieldLabel label={adminText('verticals.iconKeyLabel')}>
						<AdminField
							value={draft.icon_key}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									icon_key: event.target.value,
								}))
							}
							placeholder={adminText('verticals.iconKeyTechnicalPlaceholder')}
						/>
					</FieldLabel>
					<FieldLabel label={adminText('verticals.descriptionLabel')}>
						<textarea
							value={draft.description}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									description: event.target.value,
								}))
							}
							placeholder={adminText('fields.description')}
							className={cn(adminUiFieldClass, 'min-h-20')}
						/>
					</FieldLabel>
					<AdminToggle
						id="pw-vertical-active"
						checked={draft.is_active}
						label={adminText('fields.active')}
						onChange={(event) =>
							setDraft((current) => ({
								...current,
								is_active: event.target.checked,
							}))
						}
					/>
					<FieldLabel label={adminText('verticals.profileSchemaLabel')}>
						<textarea
							value={draft.profile_schema}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									profile_schema: event.target.value,
								}))
							}
							aria-label={adminText('verticals.profileSchemaAria')}
							className={cn(adminUiFieldClass, 'min-h-32 font-mono text-xs')}
						/>
					</FieldLabel>
					<FieldLabel label={adminText('verticals.workspaceTemplateLabel')}>
						<textarea
							value={draft.workspace_template}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									workspace_template: event.target.value,
								}))
							}
							aria-label={adminText('verticals.workspaceTemplateAria')}
							className={cn(adminUiFieldClass, 'min-h-32 font-mono text-xs')}
						/>
					</FieldLabel>
					<div className="flex flex-wrap gap-2">
						<AdminButton
							variant="primary"
							onClick={() => void handleSubmit()}
							disabled={saving || !draft.slug || !draft.name}
						>
							{editingSlug
								? adminText('actions.save')
								: adminText('actions.create')}
						</AdminButton>
						<AdminButton variant="secondary" onClick={resetForm}>
							{adminText('actions.reset')}
						</AdminButton>
					</div>
				</div>
			</Panel>
		</div>
	);
}
