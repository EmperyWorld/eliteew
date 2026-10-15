/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * AI action catalog with create, edit, clone, disable and dry-run flows for Professional Worlds admin.
 *
 * Invariants:
 * - Prompt templates edited here are admin-only; runtime redaction applies on user config.
 * - Does not import adminUiShared (Wave 3 New World tab).
 *
 * Related:
 * - src/features/professional-worlds/admin/api.ts
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
	AdminModal,
	AdminSelect,
	AdminStatusBanner,
	adminUiFieldClass,
} from '@/pages/Admin/ui';
import { cn } from '@/utils/cn';

import { updateProfessionalWorldsAiAction } from '../api';
import { adminText } from '../adminI18n';
import { parseJsonObjectField } from '../adminJsonValidation';
import type { ProfessionalWorldsAdminSnapshot } from '../types';

type AiActionDraft = {
	module_key: string;
	action_key: string;
	display_name: string;
	prompt_template: string;
};

function sampleActionPayload(verticalSlug: string, actionKey: string) {
	if (verticalSlug.includes('realtor')) {
		return {
			vertical_slug: verticalSlug,
			action_key: actionKey,
			property: {
				title: 'Ocean-view apartment',
				district: 'Vladivostok center',
				price: 18400000,
				rooms: 3,
			},
			client: {
				name: 'Anna',
				need: 'Family apartment near school and cafes',
			},
			instruction: 'Draft a concise expert response with verified facts only.',
		};
	}

	return {
		vertical_slug: verticalSlug,
		action_key: actionKey,
		context: {
			title: 'Sample professional object',
			audience: 'Warm lead',
		},
		instruction: 'Generate a short operator-review draft.',
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

export function AiActionsTab({
	snapshot,
	verticalSlug,
	aiActionDraft,
	setAiActionDraft,
	onCreateAiAction,
	onTestAction,
	onChanged,
}: {
	snapshot: ProfessionalWorldsAdminSnapshot;
	verticalSlug: string;
	aiActionDraft: AiActionDraft;
	setAiActionDraft: Dispatch<SetStateAction<AiActionDraft>>;
	onCreateAiAction: () => void | Promise<void>;
	onTestAction: (actionKey: string) => void | Promise<void>;
	onChanged: () => void | Promise<void>;
}) {
	const [editingActionKey, setEditingActionKey] = useState<string | null>(null);
	const [testDrawer, setTestDrawer] = useState<{
		actionKey: string;
		payloadText: string;
	} | null>(null);
	const [payloadError, setPayloadError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSaveAction() {
		if (!editingActionKey) {
			await onCreateAiAction();
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await updateProfessionalWorldsAiAction(verticalSlug, editingActionKey, {
				module_key: aiActionDraft.module_key,
				display_name: aiActionDraft.display_name,
				prompt_template: aiActionDraft.prompt_template,
			});
			setEditingActionKey(null);
			setAiActionDraft({
				module_key: 'objects',
				action_key: '',
				display_name: '',
				prompt_template: adminText('defaults.aiPromptTemplate', {
					property: '{{property}}',
					instruction: '{{instruction}}',
				}),
			});
			await onChanged();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : adminText('errors.saveFailed')
			);
		} finally {
			setSaving(false);
		}
	}

	async function handleDisableAction(actionKey: string) {
		setSaving(true);
		setError(null);
		try {
			await updateProfessionalWorldsAiAction(verticalSlug, actionKey, {
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

	function openTestDrawer(actionKey: string) {
		setPayloadError(null);
		setTestDrawer({
			actionKey,
			payloadText: JSON.stringify(
				sampleActionPayload(verticalSlug, actionKey),
				null,
				2
			),
		});
	}

	function validateTestPayload() {
		if (!testDrawer) {
			return null;
		}
		try {
			const parsed = parseJsonObjectField(
				testDrawer.payloadText,
				adminText('aiActions.testPayload')
			);
			setPayloadError(null);
			return parsed;
		} catch (err) {
			setPayloadError(
				err instanceof Error ? err.message : adminText('errors.dryRunFailed')
			);
			return null;
		}
	}

	return (
		<div className="grid gap-4 xl:grid-cols-[1fr_420px]">
			<Panel title={adminText('aiActions.catalogTitle')}>
				<div className="grid gap-3">
					{snapshot.aiActions.map((action) => (
						<div
							key={action.action_key}
							className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-3"
						>
							<div className="flex items-center justify-between gap-3">
								<div>
									<strong className="text-[var(--admin-ui-fg)]">
										{action.display_name}
									</strong>
									<p className="text-sm text-[var(--admin-ui-fg-muted)]">
										{adminText('aiActions.actionMetaLine', {
											moduleKey: action.module_key,
											actionKey: action.action_key,
											ugsTypeKey: action.ugs_type_key,
										})}
									</p>
								</div>
								<div className="flex flex-wrap justify-end gap-2">
									<AdminButton
										variant="secondary"
										onClick={() => openTestDrawer(action.action_key)}
									>
										{adminText('aiActions.testDrawer')}
									</AdminButton>
									<AdminButton
										variant="secondary"
										onClick={() => {
											setEditingActionKey(action.action_key);
											setAiActionDraft({
												module_key: action.module_key,
												action_key: action.action_key,
												display_name: action.display_name,
												prompt_template: action.prompt_template,
											});
										}}
									>
										{adminText('actions.edit')}
									</AdminButton>
									<AdminButton
										variant="secondary"
										onClick={() => {
											setEditingActionKey(null);
											setAiActionDraft({
												module_key: action.module_key,
												action_key: `${action.action_key}_copy`,
												display_name: `${action.display_name} (copy)`,
												prompt_template: action.prompt_template,
											});
										}}
									>
										{adminText('actions.clone')}
									</AdminButton>
									<AdminButton
										variant="danger"
										onClick={() => void handleDisableAction(action.action_key)}
										disabled={saving || !action.is_active}
									>
										{adminText('actions.disable')}
									</AdminButton>
								</div>
							</div>
							<p className="mt-2 text-sm text-[var(--admin-ui-fg-muted)]">
								{action.description}
							</p>
						</div>
					))}
				</div>
			</Panel>
			<Panel
				title={
					editingActionKey
						? adminText('aiActions.editTitle')
						: adminText('aiActions.newTitle')
				}
			>
				<div className="grid gap-3">
					{error ? (
						<AdminStatusBanner tone="danger">{error}</AdminStatusBanner>
					) : null}
					<FieldBlock label={adminText('aiActions.moduleLabel')}>
						<AdminSelect
							value={aiActionDraft.module_key}
							onChange={(event) =>
								setAiActionDraft((draft) => ({
									...draft,
									module_key: event.target.value,
								}))
							}
							aria-label={adminText('aiActions.moduleSelectAria')}
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
					</FieldBlock>
					<FieldBlock label={adminText('aiActions.actionKeyLabel')}>
						<AdminField
							value={aiActionDraft.action_key}
							onChange={(event) =>
								setAiActionDraft((draft) => ({
									...draft,
									action_key: event.target.value,
								}))
							}
							disabled={editingActionKey !== null}
							placeholder={adminText('aiActions.actionKeyTechnicalPlaceholder')}
						/>
					</FieldBlock>
					<FieldBlock label={adminText('aiActions.displayNameLabel')}>
						<AdminField
							value={aiActionDraft.display_name}
							onChange={(event) =>
								setAiActionDraft((draft) => ({
									...draft,
									display_name: event.target.value,
								}))
							}
							placeholder={adminText('fields.name')}
						/>
					</FieldBlock>
					<FieldBlock label={adminText('aiActions.promptTemplateLabel')}>
						<textarea
							value={aiActionDraft.prompt_template}
							onChange={(event) =>
								setAiActionDraft((draft) => ({
									...draft,
									prompt_template: event.target.value,
								}))
							}
							className={cn(adminUiFieldClass, 'min-h-36')}
						/>
					</FieldBlock>
					<AdminButton
						variant="primary"
						onClick={() => void handleSaveAction()}
						disabled={
							saving ||
							!aiActionDraft.action_key ||
							!aiActionDraft.display_name ||
							!aiActionDraft.prompt_template
						}
					>
						{editingActionKey
							? adminText('aiActions.saveAction')
							: adminText('aiActions.createAction')}
					</AdminButton>
					{editingActionKey ? (
						<AdminButton
							variant="secondary"
							onClick={() => {
								setEditingActionKey(null);
								setError(null);
								setAiActionDraft({
									module_key: 'objects',
									action_key: '',
									display_name: '',
									prompt_template: adminText('defaults.aiPromptTemplate', {
										property: '{{property}}',
										instruction: '{{instruction}}',
									}),
								});
							}}
						>
							{adminText('actions.cancel')}
						</AdminButton>
					) : null}
				</div>
			</Panel>
			<AdminModal
				open={Boolean(testDrawer)}
				title={adminText('aiActions.testDrawerTitle')}
				onClose={() => setTestDrawer(null)}
				panelClassName="max-w-2xl"
				footer={
					testDrawer ? (
						<>
							<AdminButton
								variant="secondary"
								onClick={() =>
									setTestDrawer({
										actionKey: testDrawer.actionKey,
										payloadText: JSON.stringify(
											sampleActionPayload(verticalSlug, testDrawer.actionKey),
											null,
											2
										),
									})
								}
							>
								{adminText('aiActions.useSamplePayload')}
							</AdminButton>
							<AdminButton variant="secondary" onClick={validateTestPayload}>
								{adminText('aiActions.validatePayload')}
							</AdminButton>
							<AdminButton
								variant="primary"
								onClick={() => {
									if (!validateTestPayload()) {
										return;
									}
									void onTestAction(testDrawer.actionKey);
									setTestDrawer(null);
								}}
							>
								{adminText('aiActions.runDryRun')}
							</AdminButton>
						</>
					) : null
				}
			>
				{testDrawer ? (
					<div className="grid gap-3">
						<p className="text-sm text-[var(--admin-ui-fg-muted)]">
							{adminText('aiActions.testDrawerMeta', {
								actionKey: testDrawer.actionKey,
								verticalSlug,
							})}
						</p>
						<p className="text-xs text-[var(--admin-ui-fg-dim)]">
							{adminText('aiActions.testPayloadHint')}
						</p>
						<textarea
							value={testDrawer.payloadText}
							onChange={(event) =>
								setTestDrawer((drawer) =>
									drawer
										? { ...drawer, payloadText: event.target.value }
										: drawer
								)
							}
							aria-label={adminText('aiActions.testPayloadAria')}
							className={cn(adminUiFieldClass, 'min-h-72 font-mono text-xs')}
						/>
						{payloadError ? (
							<AdminStatusBanner tone="danger">
								{payloadError}
							</AdminStatusBanner>
						) : null}
					</div>
				) : null}
			</AdminModal>
		</div>
	);
}
