/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin tab for listing, creating, editing and dry-running Professional Worlds AI playbooks.
 *
 * Invariants:
 * - Persists through `POST/PATCH …/admin/playbooks`; runtime users never see prompt templates here.
 * - Step payloads always carry JSON object `input_mapping` before save.
 * - Does not import adminUiShared (Wave 3 New World tab).
 *
 * Related:
 * - src/features/professional-worlds/admin/api.ts
 * - src/features/professional-worlds/admin/tabs/PlaybookStepBuilder.tsx
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import {
	AdminButton,
	AdminField,
	AdminJsonPreview,
	AdminStatusBanner,
	AdminToggle,
	adminUiFieldClass,
} from '@/pages/Admin/ui';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { cn } from '@/utils/cn';

import { validateAdminKey } from '../adminValidation';
import {
	createAdminProfessionalPlaybook,
	listAdminProfessionalPlaybooks,
	updateAdminProfessionalPlaybook,
} from '../api';
import { adminText } from '../adminI18n';
import type {
	AdminProfessionalPlaybook,
	ProfessionalWorldsAdminSnapshot,
} from '../types';

import { PlaybookDryRunDrawer } from './PlaybookDryRunDrawer';
import {
	PlaybookStepBuilder,
	type PlaybookStepDraft,
} from './PlaybookStepBuilder';

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

function clonePlaybook(pb: AdminProfessionalPlaybook): {
	key: string;
	display_name: string;
	description: string;
	sort_order: number;
	is_active: boolean;
	steps: PlaybookStepDraft[];
	isNew: boolean;
} {
	return {
		key: pb.playbook_key,
		display_name: pb.display_name,
		description: pb.description ?? '',
		sort_order: pb.sort_order,
		is_active: pb.is_active,
		steps: (pb.steps ?? []).map((s) => ({
			step_order: s.step_order,
			action_key: s.action_key,
			input_mapping: { ...(s.input_mapping ?? {}) },
			stop_on_error: s.stop_on_error ?? true,
		})),
		isNew: false,
	};
}

export function PlaybooksTab({
	verticalSlug,
	snapshot,
	onChanged,
}: {
	verticalSlug: string;
	snapshot: ProfessionalWorldsAdminSnapshot;
	onChanged: () => void | Promise<void>;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [rows, setRows] = useState<AdminProfessionalPlaybook[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const [draft, setDraft] = useState<{
		key: string;
		display_name: string;
		description: string;
		sort_order: number;
		is_active: boolean;
		steps: PlaybookStepDraft[];
		isNew: boolean;
	} | null>(null);
	const [saving, setSaving] = useState(false);
	const [dryRun, setDryRun] = useState<{
		token: number;
		mode: 'draft' | 'saved';
		steps: PlaybookStepDraft[];
	} | null>(null);

	const availableActionOptions = useMemo(() => {
		const actions = snapshot.aiActions
			.filter((a) => a.vertical_slug === verticalSlug && a.is_active)
			.map((a) => ({
				action_key: a.action_key,
				display_name: a.display_name || a.action_key,
			}));
		return [...new Map(actions.map((a) => [a.action_key, a])).values()].sort(
			(left, right) => left.display_name.localeCompare(right.display_name)
		);
	}, [snapshot.aiActions, verticalSlug]);

	const refreshRows = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const list = await listAdminProfessionalPlaybooks(verticalSlug);
			setRows(list);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('admin.errors.operationFailed')
			);
		} finally {
			setLoading(false);
		}
	}, [t, verticalSlug]);

	useEffect(() => {
		void refreshRows();
	}, [refreshRows]);

	function selectPlaybook(key: string | null, isNew: boolean) {
		setDryRun(null);
		setMessage(null);
		setError(null);
		if (isNew || key === null) {
			setSelectedKey(null);
			setDraft({
				key: '',
				display_name: '',
				description: '',
				sort_order: 100,
				is_active: true,
				steps: [],
				isNew: true,
			});
			return;
		}
		const pb = rows.find((r) => r.playbook_key === key);
		if (!pb) {
			return;
		}
		setSelectedKey(key);
		setDraft(clonePlaybook(pb));
	}

	async function handleSave() {
		if (!draft) {
			return;
		}
		setMessage(null);
		setError(null);
		const keyError = draft.isNew
			? validateAdminKey(draft.key, t('admin.playbooks.fieldPlaybookKey'))
			: null;
		if (keyError) {
			setError(keyError);
			return;
		}
		if (!draft.display_name.trim()) {
			setError(t('admin.playbooks.nameRequired'));
			return;
		}
		setSaving(true);
		try {
			if (draft.isNew) {
				await createAdminProfessionalPlaybook(verticalSlug, {
					playbook_key: draft.key.trim(),
					display_name: draft.display_name.trim(),
					description: draft.description.trim() || null,
					sort_order: draft.sort_order,
					is_active: draft.is_active,
					steps: draft.steps.map((s) => ({
						step_order: s.step_order,
						action_key: s.action_key,
						input_mapping: s.input_mapping ?? {},
						stop_on_error: s.stop_on_error,
					})),
				});
				setMessage(t('admin.playbooks.created', { key: draft.key.trim() }));
			} else {
				await updateAdminProfessionalPlaybook(verticalSlug, draft.key.trim(), {
					display_name: draft.display_name.trim(),
					description: draft.description.trim() || null,
					sort_order: draft.sort_order,
					is_active: draft.is_active,
					steps: draft.steps.map((s) => ({
						step_order: s.step_order,
						action_key: s.action_key,
						input_mapping: s.input_mapping ?? {},
						stop_on_error: s.stop_on_error,
					})),
				});
				setMessage(t('admin.playbooks.saved', { key: draft.key.trim() }));
			}
			setSelectedKey(draft.key.trim());
			setDraft({ ...draft, key: draft.key.trim(), isNew: false });
			await refreshRows();
			await onChanged();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : t('admin.errors.saveFailed')
			);
		} finally {
			setSaving(false);
		}
	}

	if (loading && rows.length === 0) {
		return (
			<div className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-6 text-[var(--admin-ui-fg-muted)]">
				{t('admin.status.loadingConfig')}
			</div>
		);
	}

	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
			<Panel title={t('admin.playbooks.listTitle')}>
				<div className="mb-3 grid gap-2">
					<AdminButton onClick={() => selectPlaybook(null, true)}>
						{t('admin.playbooks.newPlaybook')}
					</AdminButton>
					<AdminButton variant="secondary" onClick={() => void refreshRows()}>
						{t('actions.refresh')}
					</AdminButton>
				</div>
				<div className="max-h-128 space-y-1 overflow-auto">
					{rows.map((row) => (
						<button
							type="button"
							key={row.playbook_key}
							onClick={() => selectPlaybook(row.playbook_key, false)}
							className={cn(
								'flex w-full flex-col items-start rounded-[var(--admin-ui-radius-sm)] border px-3 py-2 text-left text-xs',
								selectedKey === row.playbook_key && !draft?.isNew
									? 'border-[var(--admin-ui-accent)] bg-[var(--admin-ui-accent-muted)] text-[var(--admin-ui-fg)]'
									: 'border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] text-[var(--admin-ui-fg-muted)] hover:bg-[var(--admin-ui-surface)]'
							)}
						>
							<span className="font-semibold text-[var(--admin-ui-fg)]">
								{row.display_name}
							</span>
							<span className="font-mono text-[10px] text-[var(--admin-ui-fg-muted)]">
								{row.playbook_key}
							</span>
							<div className="mt-1 flex flex-wrap items-center gap-2">
								<StatusPill active={row.is_active} />
								<span className="text-[var(--admin-ui-fg-muted)]">
									{(row.steps ?? []).length} {t('admin.playbooks.stepsCount')}
								</span>
							</div>
						</button>
					))}
					{rows.length === 0 && (
						<p className="text-xs text-[var(--admin-ui-fg-muted)]">
							{t('admin.playbooks.emptyList')}
						</p>
					)}
				</div>
			</Panel>

			<div className="grid gap-4">
				{message ? (
					<AdminStatusBanner tone="success">{message}</AdminStatusBanner>
				) : null}
				{error ? (
					<AdminStatusBanner tone="danger">{error}</AdminStatusBanner>
				) : null}

				{draft ? (
					<>
						<Panel title={t('admin.playbooks.editorTitle')}>
							<div className="grid gap-3 md:grid-cols-2">
								<FieldBlock label={t('admin.playbooks.fieldPlaybookKey')}>
									<AdminField
										value={draft.key}
										disabled={!draft.isNew}
										onChange={(e) =>
											setDraft({ ...draft, key: e.target.value })
										}
										placeholder={t('admin.playbooks.playbookKeyPlaceholder')}
										className="font-mono"
									/>
								</FieldBlock>
								<FieldBlock label={t('admin.fields.name')}>
									<AdminField
										value={draft.display_name}
										onChange={(e) =>
											setDraft({ ...draft, display_name: e.target.value })
										}
									/>
								</FieldBlock>
								<FieldBlock label={t('admin.fields.description')}>
									<textarea
										rows={2}
										value={draft.description}
										onChange={(e) =>
											setDraft({ ...draft, description: e.target.value })
										}
										className={cn(adminUiFieldClass, 'md:col-span-2')}
									/>
								</FieldBlock>
								<FieldBlock label={t('admin.playbooks.sortOrder')}>
									<AdminField
										type="number"
										value={draft.sort_order}
										onChange={(e) =>
											setDraft({
												...draft,
												sort_order: Number.parseInt(e.target.value, 10) || 0,
											})
										}
									/>
								</FieldBlock>
								<AdminToggle
									checked={draft.is_active}
									onChange={(e) =>
										setDraft({ ...draft, is_active: e.target.checked })
									}
									label={t('admin.fields.active')}
								/>
							</div>
							<div className="mt-4 flex flex-wrap gap-2">
								<AdminButton
									disabled={saving || (draft.isNew ? !draft.key.trim() : false)}
									onClick={() => void handleSave()}
								>
									{saving ? t('admin.status.loading') : t('admin.actions.save')}
								</AdminButton>
								<AdminButton
									variant="secondary"
									onClick={() =>
										setDryRun({
											token: Date.now(),
											mode: 'draft',
											steps: draft.steps.map((s) => ({ ...s })),
										})
									}
								>
									{t('admin.playbooks.dryRunDraft')}
								</AdminButton>
								<AdminButton
									variant="ghost"
									disabled={draft.isNew}
									onClick={() =>
										setDryRun({
											token: Date.now(),
											mode: 'saved',
											steps: [],
										})
									}
								>
									{t('admin.playbooks.dryRunSaved')}
								</AdminButton>
							</div>
						</Panel>

						<PlaybookStepBuilder
							steps={draft.steps}
							availableActions={
								availableActionOptions.length > 0
									? availableActionOptions
									: Array.from(
											new Set(
												draft.steps.map((s) => s.action_key).filter(Boolean)
											)
										).map((actionKey) => ({
											action_key: actionKey,
											display_name: actionKey,
										}))
							}
							onChange={(next) => setDraft({ ...draft, steps: next })}
						/>

						<Panel title={t('admin.playbooks.liveJsonTitle')}>
							<AdminJsonPreview
								title={t('admin.playbooks.liveJsonTitle')}
								helper={t('admin.playbooks.liveJsonHelper')}
								value={{
									playbook_key: draft.key,
									display_name: draft.display_name,
									steps: draft.steps,
								}}
							/>
						</Panel>
					</>
				) : (
					<p className="text-sm text-[var(--admin-ui-fg-muted)]">
						{t('admin.playbooks.pickOrCreate')}
					</p>
				)}
			</div>

			{draft && (
				<PlaybookDryRunDrawer
					key={dryRun?.token ?? 'closed'}
					open={dryRun !== null}
					verticalSlug={verticalSlug}
					playbookKey={draft.key.trim() || '__preview__'}
					mode={dryRun?.mode ?? 'saved'}
					draftSteps={dryRun?.steps ?? []}
					onClose={() => setDryRun(null)}
				/>
			)}
		</div>
	);
}
