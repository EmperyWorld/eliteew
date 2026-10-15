/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * JSON schema editor with validation and preview diff for the active vertical.
 *
 * Invariants:
 * - Schema JSON and UI schema must parse to objects before API calls.
 * - Diff preview is client-side and advisory; backend remains the source of truth.
 * - Does not import adminUiShared (Wave 3 New World tab).
 *
 * Related:
 * - src/features/professional-worlds/admin/api.ts
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useMemo, useState, type ReactNode } from 'react';

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
	activateProfessionalWorldsSchema,
	createProfessionalWorldsSchema,
	updateProfessionalWorldsSchema,
} from '../api';
import { adminText } from '../adminI18n';
import { parseJsonObjectField } from '../adminJsonValidation';
import type {
	ProfessionalVerticalSchema,
	ProfessionalWorldsAdminSnapshot,
} from '../types';

type SchemaDraft = {
	id: string | null;
	schema_key: string;
	version: number;
	title: string;
	schema_json: string;
	ui_schema: string;
	is_active: boolean;
};

const EMPTY_SCHEMA_DRAFT: SchemaDraft = {
	id: null,
	schema_key: '',
	version: 1,
	title: '',
	schema_json: '{\n  "type": "object",\n  "properties": {}\n}',
	ui_schema: '{}',
	is_active: false,
};

function draftFromSchema(schema: ProfessionalVerticalSchema): SchemaDraft {
	return {
		id: schema.id,
		schema_key: schema.schema_key,
		version: schema.version,
		title: schema.title,
		schema_json: JSON.stringify(schema.schema_json ?? {}, null, 2),
		ui_schema: JSON.stringify(schema.ui_schema ?? {}, null, 2),
		is_active: schema.is_active,
	};
}

function propertyKeys(schema: Record<string, unknown>): Set<string> {
	const properties = schema.properties;
	if (
		properties &&
		typeof properties === 'object' &&
		!Array.isArray(properties)
	) {
		return new Set(Object.keys(properties));
	}
	return new Set(Object.keys(schema));
}

function schemaDiff(
	before: Record<string, unknown> | null,
	after: Record<string, unknown> | null
) {
	if (!before || !after) {
		return { added: [], removed: [], changed: [] };
	}
	const beforeKeys = propertyKeys(before);
	const afterKeys = propertyKeys(after);
	const added = [...afterKeys].filter((key) => !beforeKeys.has(key));
	const removed = [...beforeKeys].filter((key) => !afterKeys.has(key));
	const changed = [...afterKeys].filter(
		(key) =>
			beforeKeys.has(key) &&
			JSON.stringify((before.properties as Record<string, unknown>)?.[key]) !==
				JSON.stringify((after.properties as Record<string, unknown>)?.[key])
	);
	return { added, removed, changed };
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

export function SchemasTab({
	snapshot,
	verticalSlug,
	onChanged,
}: {
	snapshot: ProfessionalWorldsAdminSnapshot;
	verticalSlug: string;
	onChanged: () => void | Promise<void>;
}) {
	const [draft, setDraft] = useState<SchemaDraft>(EMPTY_SCHEMA_DRAFT);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const selectedSchema = useMemo(
		() => snapshot.schemas.find((schema) => schema.id === draft.id) ?? null,
		[snapshot.schemas, draft.id]
	);

	const parsedDraftSchema = useMemo(() => {
		try {
			return parseJsonObjectField(
				draft.schema_json,
				adminText('schemas.schemaJsonLabel')
			);
		} catch {
			return null;
		}
	}, [draft.schema_json]);

	const previewDiff = schemaDiff(
		selectedSchema?.schema_json ?? null,
		parsedDraftSchema
	);

	async function handleSubmit() {
		setSaving(true);
		setError(null);
		try {
			const schemaJson = parseJsonObjectField(
				draft.schema_json,
				adminText('schemas.schemaJsonLabel')
			);
			const uiSchema = parseJsonObjectField(
				draft.ui_schema,
				adminText('schemas.uiSchemaLabel')
			);
			if (draft.id) {
				await updateProfessionalWorldsSchema(draft.id, {
					title: draft.title,
					schema_json: schemaJson,
					ui_schema: uiSchema,
					is_active: draft.is_active,
				});
			} else {
				await createProfessionalWorldsSchema(verticalSlug, {
					schema_key: draft.schema_key,
					version: draft.version,
					title: draft.title,
					schema_json: schemaJson,
					ui_schema: uiSchema,
					is_active: draft.is_active,
				});
			}
			setDraft(EMPTY_SCHEMA_DRAFT);
			await onChanged();
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: adminText('errors.saveSchemaFailed')
			);
		} finally {
			setSaving(false);
		}
	}

	async function handleActivate(schemaId: string) {
		setSaving(true);
		setError(null);
		try {
			await activateProfessionalWorldsSchema(schemaId);
			await onChanged();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : adminText('errors.activateFailed')
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="grid gap-4 xl:grid-cols-[1fr_460px]">
			<Panel title={adminText('schemas.activeTitle')}>
				<div className="grid gap-3 md:grid-cols-2">
					{snapshot.schemas.map((schema) => (
						<div
							key={schema.id}
							className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-3"
						>
							<div className="mb-2 flex items-center justify-between">
								<div>
									<strong className="text-[var(--admin-ui-fg)]">
										{schema.title}
									</strong>
									<p className="text-xs text-[var(--admin-ui-fg-muted)]">
										{adminText('schemas.schemaMetaLine', {
											schemaKey: schema.schema_key,
											version: schema.version,
										})}
									</p>
								</div>
								<StatusPill active={schema.is_active} />
							</div>
							<AdminJsonPreview
								value={schema.schema_json}
								title={adminText('jsonPreview.title')}
								helper={adminText('jsonPreview.helper')}
							/>
							<div className="mt-3 flex flex-wrap gap-2">
								<AdminButton
									variant="secondary"
									onClick={() => {
										setDraft(draftFromSchema(schema));
										setError(null);
									}}
								>
									{adminText('actions.edit')}
								</AdminButton>
								<AdminButton
									variant="primary"
									onClick={() => void handleActivate(schema.id)}
									disabled={saving || schema.is_active}
								>
									{adminText('actions.activate')}
								</AdminButton>
							</div>
						</div>
					))}
				</div>
			</Panel>
			<Panel
				title={
					draft.id
						? adminText('schemas.editTitle')
						: adminText('schemas.newTitle')
				}
			>
				<div className="grid gap-3">
					{error ? (
						<AdminStatusBanner tone="danger">{error}</AdminStatusBanner>
					) : null}
					<FieldBlock label={adminText('schemas.schemaKeyLabel')}>
						<AdminField
							value={draft.schema_key}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									schema_key: event.target.value,
								}))
							}
							disabled={draft.id !== null}
							placeholder={adminText('schemas.schemaKeyTechnicalPlaceholder')}
						/>
					</FieldBlock>
					<FieldBlock label={adminText('schemas.versionLabel')}>
						<AdminField
							type="number"
							min={1}
							value={draft.version}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									version: Number(event.target.value || 1),
								}))
							}
							disabled={draft.id !== null}
						/>
					</FieldBlock>
					<FieldBlock label={adminText('schemas.titleLabel')}>
						<AdminField
							value={draft.title}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									title: event.target.value,
								}))
							}
							placeholder={adminText('schemas.titlePlaceholder')}
						/>
					</FieldBlock>
					<FieldBlock label={adminText('schemas.schemaJsonLabel')}>
						<textarea
							value={draft.schema_json}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									schema_json: event.target.value,
								}))
							}
							aria-label={adminText('schemas.schemaJsonAria')}
							className={cn(adminUiFieldClass, 'min-h-48 font-mono text-xs')}
						/>
					</FieldBlock>
					<FieldBlock label={adminText('schemas.uiSchemaLabel')}>
						<textarea
							value={draft.ui_schema}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									ui_schema: event.target.value,
								}))
							}
							aria-label={adminText('schemas.uiSchemaAria')}
							className={cn(adminUiFieldClass, 'min-h-28 font-mono text-xs')}
						/>
					</FieldBlock>
					<AdminToggle
						id="pw-schema-active"
						checked={draft.is_active}
						label={adminText('schemas.makeActive')}
						onChange={(event) =>
							setDraft((current) => ({
								...current,
								is_active: event.target.checked,
							}))
						}
					/>
					<div className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-3 text-xs text-[var(--admin-ui-fg-muted)]">
						<p className="mb-2 text-sm font-medium text-[var(--admin-ui-fg)]">
							{adminText('schemas.diffPreviewTitle')}
						</p>
						<p>
							{adminText('schemas.diffAdded')}:{' '}
							{previewDiff.added.join(', ') || '—'}
						</p>
						<p>
							{adminText('schemas.diffRemoved')}:{' '}
							{previewDiff.removed.join(', ') || '—'}
						</p>
						<p>
							{adminText('schemas.diffChanged')}:{' '}
							{previewDiff.changed.join(', ') || '—'}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<AdminButton
							variant="primary"
							onClick={() => void handleSubmit()}
							disabled={saving || !draft.schema_key || !draft.title}
						>
							{draft.id
								? adminText('actions.save')
								: adminText('actions.create')}
						</AdminButton>
						<AdminButton
							variant="secondary"
							onClick={() => {
								setDraft(EMPTY_SCHEMA_DRAFT);
								setError(null);
							}}
						>
							{adminText('actions.reset')}
						</AdminButton>
					</div>
				</div>
			</Panel>
		</div>
	);
}
