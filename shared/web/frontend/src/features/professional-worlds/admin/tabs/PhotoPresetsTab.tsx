/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Photo preset catalog with create, edit, clone, disable and dry-run flows in admin.
 *
 * Invariants:
 * - Does not expose full prompt templates to non-admin runtime consumers.
 * - Does not import adminUiShared (Wave 3 New World tab).
 *
 * Related:
 * - src/features/professional-worlds/admin/api.ts
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useState, type ReactNode } from 'react';

import { UnifiedContentPickerModal } from '@/components/UnifiedContent/picker/UnifiedContentPickerModal';
import type { Content } from '@/components/UnifiedContent/types';
import {
	AdminButton,
	AdminField,
	AdminJsonPreview,
	AdminModal,
	AdminStatusBanner,
	AdminToggle,
	adminUiFieldClass,
} from '@/pages/Admin/ui';
import { cn } from '@/utils/cn';

import {
	createProfessionalWorldsPhotoPreset,
	testProfessionalWorldsPhotoPreset,
	updateProfessionalWorldsPhotoPreset,
} from '../api';
import { adminText } from '../adminI18n';
import { parseJsonObjectField } from '../adminJsonValidation';
import { validateAdminKey } from '../adminValidation';
import type {
	ProfessionalPhotoPreset,
	ProfessionalWorldsAdminSnapshot,
} from '../types';

type PresetDraft = {
	preset_key: string;
	display_name: string;
	description: string;
	category: string;
	action_type: string;
	ugs_type_key: string;
	prompt_template: string;
	parameters: string;
	is_active: boolean;
	sort_order: number;
};

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

function createEmptyPresetDraft(): PresetDraft {
	return {
		preset_key: '',
		display_name: '',
		description: '',
		category: 'enhance',
		action_type: 'image_edit',
		ugs_type_key: 'image_studio_image_edit',
		prompt_template: adminText('photoPresets.defaultPromptTemplate'),
		parameters:
			'{\n  "steps": 18,\n  "cfg": 3.6,\n  "denoise": 0.62,\n  "megapixels": 2.0,\n  "resolution_steps": 2\n}',
		is_active: true,
		sort_order: 0,
	};
}

function draftFromPreset(preset: ProfessionalPhotoPreset): PresetDraft {
	return {
		preset_key: preset.preset_key,
		display_name: preset.display_name,
		description: preset.description ?? '',
		category: preset.category,
		action_type: preset.action_type,
		ugs_type_key: preset.ugs_type_key,
		prompt_template: preset.prompt_template,
		parameters: JSON.stringify(preset.parameters ?? {}, null, 2),
		is_active: preset.is_active,
		sort_order: preset.sort_order,
	};
}

export function PhotoPresetsTab({
	snapshot,
	verticalSlug,
	onChanged,
}: {
	snapshot: ProfessionalWorldsAdminSnapshot;
	verticalSlug: string;
	onChanged: () => void | Promise<void>;
}) {
	const [editingPresetKey, setEditingPresetKey] = useState<string | null>(null);
	const [draft, setDraft] = useState<PresetDraft>(createEmptyPresetDraft);
	const [testDrawer, setTestDrawer] = useState<{
		presetKey: string;
		sampleContentId: string;
		parametersText: string;
	} | null>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [testError, setTestError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [testResult, setTestResult] = useState<Record<string, unknown> | null>(
		null
	);

	function resetForm() {
		setEditingPresetKey(null);
		setDraft(createEmptyPresetDraft());
		setError(null);
	}

	async function handleSave() {
		setSaving(true);
		setError(null);
		try {
			if (!editingPresetKey) {
				const keyError = validateAdminKey(draft.preset_key, 'preset_key');
				if (keyError) {
					setError(keyError);
					return;
				}
			}
			const parameters = parseJsonObjectField(
				draft.parameters,
				adminText('photoPresets.parametersLabel')
			);
			if (editingPresetKey) {
				await updateProfessionalWorldsPhotoPreset(
					verticalSlug,
					editingPresetKey,
					{
						display_name: draft.display_name,
						description: draft.description || null,
						category: draft.category,
						action_type: draft.action_type,
						ugs_type_key: draft.ugs_type_key,
						prompt_template: draft.prompt_template,
						parameters,
						is_active: draft.is_active,
						sort_order: draft.sort_order,
					}
				);
			} else {
				await createProfessionalWorldsPhotoPreset({
					vertical_slug: verticalSlug,
					preset_key: draft.preset_key,
					display_name: draft.display_name,
					description: draft.description || null,
					category: draft.category,
					action_type: draft.action_type,
					ugs_type_key: draft.ugs_type_key,
					prompt_template: draft.prompt_template,
					parameters,
					is_active: draft.is_active,
					sort_order: draft.sort_order,
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

	async function handleDisable(presetKey: string) {
		setSaving(true);
		setError(null);
		try {
			await updateProfessionalWorldsPhotoPreset(verticalSlug, presetKey, {
				is_active: false,
			});
			await onChanged();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : adminText('errors.disableFailed')
			);
		} finally {
			setSaving(false);
		}
	}

	async function handleTest(presetKey: string, sampleContentId?: string) {
		setSaving(true);
		setError(null);
		try {
			setTestResult(
				await testProfessionalWorldsPhotoPreset(
					presetKey,
					verticalSlug,
					sampleContentId
				)
			);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : adminText('errors.dryRunFailed')
			);
		} finally {
			setSaving(false);
		}
	}

	function openTestDrawer(preset: ProfessionalPhotoPreset) {
		setTestError(null);
		setTestDrawer({
			presetKey: preset.preset_key,
			sampleContentId: '',
			parametersText: JSON.stringify(preset.parameters ?? {}, null, 2),
		});
	}

	function handlePickerConfirm(items: Content[]) {
		const selected = items[0];
		if (!selected) {
			return;
		}
		setTestDrawer((current) =>
			current ? { ...current, sampleContentId: selected.id } : current
		);
	}

	async function runDrawerTest() {
		if (!testDrawer) {
			return;
		}
		try {
			parseJsonObjectField(
				testDrawer.parametersText,
				adminText('photoPresets.testParameters')
			);
			setTestError(null);
		} catch (err) {
			setTestError(
				err instanceof Error ? err.message : adminText('errors.dryRunFailed')
			);
			return;
		}
		await handleTest(
			testDrawer.presetKey,
			testDrawer.sampleContentId || undefined
		);
		setTestDrawer(null);
	}

	return (
		<div className="grid gap-4 xl:grid-cols-[1fr_420px]">
			<Panel title={adminText('tabs.photoPresets')}>
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					{snapshot.photoPresets.map((preset) => (
						<div
							key={preset.preset_key}
							className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-3"
						>
							<div className="flex items-center justify-between">
								<strong className="text-[var(--admin-ui-fg)]">
									{preset.display_name}
								</strong>
								<StatusPill active={preset.is_active} />
							</div>
							<p className="mt-1 text-sm text-[var(--admin-ui-fg-muted)]">
								{adminText('photoPresets.presetMetaLine', {
									category: preset.category,
									ugsTypeKey: preset.ugs_type_key,
								})}
							</p>
							<p className="mt-2 text-sm text-[var(--admin-ui-fg)]">
								{preset.description}
							</p>
							<div className="mt-3 flex flex-wrap gap-2">
								<AdminButton
									variant="secondary"
									onClick={() => openTestDrawer(preset)}
								>
									{adminText('photoPresets.testDrawer')}
								</AdminButton>
								<AdminButton
									variant="ghost"
									onClick={() => {
										setEditingPresetKey(preset.preset_key);
										setDraft(draftFromPreset(preset));
										setError(null);
									}}
								>
									{adminText('actions.edit')}
								</AdminButton>
								<AdminButton
									variant="secondary"
									onClick={() => {
										setEditingPresetKey(null);
										setDraft({
											...draftFromPreset(preset),
											preset_key: `${preset.preset_key}_copy`,
											display_name: adminText('photoPresets.cloneName', {
												name: preset.display_name,
											}),
										});
									}}
								>
									{adminText('actions.clone')}
								</AdminButton>
								<AdminButton
									variant="danger"
									onClick={() => void handleDisable(preset.preset_key)}
									disabled={saving || !preset.is_active}
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
					editingPresetKey
						? adminText('photoPresets.editTitle')
						: adminText('photoPresets.newTitle')
				}
			>
				<div className="grid gap-3">
					{error ? (
						<AdminStatusBanner tone="danger">{error}</AdminStatusBanner>
					) : null}
					<FieldBlock label={adminText('photoPresets.presetKeyLabel')}>
						<AdminField
							value={draft.preset_key}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									preset_key: event.target.value,
								}))
							}
							disabled={editingPresetKey !== null}
							placeholder={adminText(
								'photoPresets.presetKeyTechnicalPlaceholder'
							)}
							className="font-mono"
						/>
					</FieldBlock>
					<FieldBlock label={adminText('photoPresets.displayNameLabel')}>
						<AdminField
							value={draft.display_name}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									display_name: event.target.value,
								}))
							}
							placeholder={adminText('fields.name')}
						/>
					</FieldBlock>
					<div className="grid gap-2 md:grid-cols-2">
						<FieldBlock label={adminText('photoPresets.categoryLabel')}>
							<AdminField
								value={draft.category}
								onChange={(event) =>
									setDraft((current) => ({
										...current,
										category: event.target.value,
									}))
								}
							/>
						</FieldBlock>
						<FieldBlock label={adminText('photoPresets.ugsTypeLabel')}>
							<AdminField
								value={draft.ugs_type_key}
								onChange={(event) =>
									setDraft((current) => ({
										...current,
										ugs_type_key: event.target.value,
									}))
								}
							/>
						</FieldBlock>
					</div>
					<FieldBlock label={adminText('photoPresets.descriptionLabel')}>
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
					</FieldBlock>
					<FieldBlock label={adminText('photoPresets.promptTemplateLabel')}>
						<textarea
							value={draft.prompt_template}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									prompt_template: event.target.value,
								}))
							}
							className={cn(adminUiFieldClass, 'min-h-36')}
						/>
					</FieldBlock>
					<FieldBlock label={adminText('photoPresets.parametersLabel')}>
						<textarea
							value={draft.parameters}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									parameters: event.target.value,
								}))
							}
							aria-label={adminText('photoPresets.presetParametersAria')}
							className={cn(adminUiFieldClass, 'min-h-28 font-mono text-xs')}
						/>
					</FieldBlock>
					<AdminToggle
						checked={draft.is_active}
						onChange={(event) =>
							setDraft((current) => ({
								...current,
								is_active: event.target.checked,
							}))
						}
						label={adminText('fields.active')}
					/>
					<div className="flex flex-wrap gap-2">
						<AdminButton
							variant="primary"
							onClick={() => void handleSave()}
							disabled={saving || !draft.preset_key || !draft.display_name}
						>
							{editingPresetKey
								? adminText('photoPresets.savePreset')
								: adminText('photoPresets.createPreset')}
						</AdminButton>
						<AdminButton variant="secondary" onClick={resetForm}>
							{adminText('actions.reset')}
						</AdminButton>
					</div>
					{testResult ? (
						<AdminJsonPreview
							value={testResult}
							title={adminText('photoPresets.testResultTitle')}
							helper={adminText('photoPresets.testResultHelper')}
						/>
					) : null}
				</div>
			</Panel>
			<AdminModal
				open={testDrawer !== null}
				title={adminText('photoPresets.testDrawerTitle')}
				onClose={() => {
					setTestDrawer(null);
					setPickerOpen(false);
				}}
				footer={
					<AdminButton
						variant="primary"
						onClick={() => void runDrawerTest()}
						disabled={saving}
					>
						{adminText('photoPresets.runDryRun')}
					</AdminButton>
				}
			>
				{testDrawer ? (
					<div className="grid gap-4">
						<p className="text-sm text-[var(--admin-ui-fg-muted)]">
							{testDrawer.presetKey} · {verticalSlug}
						</p>
						<FieldBlock label={adminText('photoPresets.sampleContentId')}>
							<div className="grid gap-2 sm:grid-cols-[1fr_auto]">
								<AdminField
									value={testDrawer.sampleContentId}
									onChange={(event) =>
										setTestDrawer((current) =>
											current
												? {
														...current,
														sampleContentId: event.target.value.trim(),
													}
												: current
										)
									}
									placeholder={adminText(
										'photoPresets.sampleContentIdTechnicalPlaceholder'
									)}
								/>
								<AdminButton
									variant="secondary"
									onClick={() => setPickerOpen(true)}
								>
									{adminText('photoPresets.openUnifiedContentPicker')}
								</AdminButton>
							</div>
						</FieldBlock>
						<FieldBlock label={adminText('photoPresets.testParameters')}>
							<textarea
								value={testDrawer.parametersText}
								onChange={(event) =>
									setTestDrawer((current) =>
										current
											? { ...current, parametersText: event.target.value }
											: current
									)
								}
								className={cn(adminUiFieldClass, 'min-h-48 font-mono text-xs')}
							/>
						</FieldBlock>
						{testError ? (
							<AdminStatusBanner tone="danger">{testError}</AdminStatusBanner>
						) : null}
						<UnifiedContentPickerModal
							open={pickerOpen}
							onClose={() => setPickerOpen(false)}
							onConfirm={handlePickerConfirm}
							mode="single"
							maxFiles={1}
							title={adminText('photoPresets.openUnifiedContentPicker')}
							confirmLabel={adminText('photoPresets.useSelectedContent')}
						/>
					</div>
				) : null}
			</AdminModal>
		</div>
	);
}
