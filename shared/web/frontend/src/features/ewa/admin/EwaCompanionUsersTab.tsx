/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin Users tab — per-principal companion progress, timeline, transcript, allowlisted patches,
 * soft namespace clear, hard wipe (first-meet), audit-note, and Task runs deep-link.
 *
 * Invariants:
 * - Mutations require write gate; JSON patch only for allowlisted namespaces.
 * - Wipe requires typed principal_id match and backend write + Qdrant probe.
 * - Soft clear requires typed namespace confirm; does not purge Qdrant.
 *
 * Related:
 * - src/features/ewa/admin/ewaCompanionAdminApi.ts
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_INTERACTIVE } from '@/pages/Desktop/constants';
import {
	clearEwaCompanionAdminUserNamespace,
	fetchEwaCompanionAdminUser,
	fetchEwaCompanionAdminUserTimeline,
	fetchEwaCompanionAdminUserTranscript,
	fetchEwaCompanionAdminUsers,
	patchEwaCompanionAdminUser,
	postEwaCompanionAdminUserAuditNote,
	wipeEwaCompanionAdminUser,
} from './ewaCompanionAdminApi';
import { EwaCompanionAdminCatalogFrame } from './ewaCompanionAdminCatalogFrame';
import {
	classifyWipeError,
	confirmNamespaceMatches,
	confirmPrincipalIdMatches,
	type WipeFeedbackTone,
} from './ewaCompanionAdminUserWipe';

const LEARNED_KEYS = [
	'companion_memory_v1',
	'companion_character_v1',
	'companion_context_anchor_v1',
	'companion_chat_condensed_v1',
	'companion_continuity_v1',
	'companion_meta_v1',
	'desktop_friend_chat_v1',
] as const;

export function EwaCompanionUsersTab({
	writeEnabled,
	onOpenTaskRuns,
}: {
	writeEnabled: boolean;
	onOpenTaskRuns?: (principalId: string) => void;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const qc = useQueryClient();
	const [q, setQ] = useState('');
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [seedDraft, setSeedDraft] = useState('');
	const [noteDraft, setNoteDraft] = useState('');
	const [namespaceKey, setNamespaceKey] = useState<
		(typeof LEARNED_KEYS)[number]
	>('companion_memory_v1');
	const [jsonDraft, setJsonDraft] = useState('{}');
	const [jsonError, setJsonError] = useState<string | null>(null);
	const [wipeOpen, setWipeOpen] = useState(false);
	const [wipeConfirm, setWipeConfirm] = useState('');
	const [wipeMessage, setWipeMessage] = useState<string | null>(null);
	const [wipeTone, setWipeTone] = useState<WipeFeedbackTone>('success');
	const [wipeCopied, setWipeCopied] = useState(false);
	const [clearOpen, setClearOpen] = useState(false);
	const [clearConfirm, setClearConfirm] = useState('');
	const wipeConfirmRef = useRef<HTMLInputElement>(null);

	const listQuery = useQuery({
		queryKey: ['ewa', 'admin', 'companion', 'users', q],
		queryFn: () => fetchEwaCompanionAdminUsers({ q, limit: 80 }),
		retry: false,
	});

	const detailQuery = useQuery({
		queryKey: ['ewa', 'admin', 'companion', 'users', selectedId, 'detail'],
		queryFn: () => fetchEwaCompanionAdminUser(selectedId ?? ''),
		enabled: Boolean(selectedId),
		retry: false,
	});

	const timelineQuery = useQuery({
		queryKey: ['ewa', 'admin', 'companion', 'users', selectedId, 'timeline'],
		queryFn: () => fetchEwaCompanionAdminUserTimeline(selectedId ?? ''),
		enabled: Boolean(selectedId),
		retry: false,
	});

	const transcriptQuery = useQuery({
		queryKey: ['ewa', 'admin', 'companion', 'users', selectedId, 'transcript'],
		queryFn: () => fetchEwaCompanionAdminUserTranscript(selectedId ?? ''),
		enabled: Boolean(selectedId),
		retry: false,
	});

	const selectUser = (principalId: string, seed: string) => {
		setSelectedId(principalId);
		setSeedDraft(seed);
		setNoteDraft('');
		setJsonDraft('{}');
		setJsonError(null);
		setWipeOpen(false);
		setWipeConfirm('');
		setWipeMessage(null);
		setWipeCopied(false);
		setClearOpen(false);
		setClearConfirm('');
	};

	useEffect(() => {
		if (!wipeOpen) return;
		wipeConfirmRef.current?.focus();
	}, [wipeOpen]);

	const copyPrincipalId = async () => {
		if (!selectedId) return;
		try {
			await navigator.clipboard.writeText(selectedId);
			setWipeCopied(true);
			window.setTimeout(() => setWipeCopied(false), 1800);
		} catch {
			setWipeCopied(false);
		}
	};

	const loadNamespaceIntoEditor = () => {
		const summary = detailQuery.data?.summary as
			| { namespaces?: { learned_preferences?: Record<string, unknown> } }
			| undefined;
		const blob = summary?.namespaces?.learned_preferences?.[namespaceKey];
		setJsonDraft(JSON.stringify(blob ?? {}, null, 2));
		setJsonError(null);
	};

	const patchMut = useMutation({
		mutationFn: async (mode: 'seed_note' | 'json') => {
			if (!selectedId || !detailQuery.data) throw new Error('no_user');
			if (mode === 'seed_note') {
				return patchEwaCompanionAdminUser(selectedId, {
					seed_persona_id: seedDraft.trim() || null,
					admin_note: noteDraft.trim() || null,
					expected_revision: detailQuery.data.companion_revision,
				});
			}
			let parsed: unknown;
			try {
				parsed = JSON.parse(jsonDraft);
			} catch {
				throw new Error('invalid_json');
			}
			return patchEwaCompanionAdminUser(selectedId, {
				learned_patch: { [namespaceKey]: parsed },
				expected_revision: detailQuery.data.companion_revision,
			});
		},
		onSuccess: async () => {
			setJsonError(null);
			await qc.invalidateQueries({
				queryKey: ['ewa', 'admin', 'companion', 'users'],
			});
		},
		onError: (err: Error) => {
			setJsonError(
				err.message === 'invalid_json'
					? t('ewaCompanionAdmin.usersInvalidJson')
					: String(err.message)
			);
		},
	});

	const auditNoteMut = useMutation({
		mutationFn: async () => {
			if (!selectedId) throw new Error('no_user');
			const note = noteDraft.trim();
			if (!note) throw new Error('empty_note');
			return postEwaCompanionAdminUserAuditNote(selectedId, note);
		},
		onSuccess: async () => {
			setWipeTone('success');
			setWipeMessage(t('ewaCompanionAdmin.usersAuditNoteSuccess'));
			setNoteDraft('');
			await qc.invalidateQueries({
				queryKey: ['ewa', 'admin', 'companion', 'users', selectedId],
			});
		},
		onError: (err: Error) => {
			setWipeTone('error');
			setWipeMessage(
				err.message === 'empty_note'
					? t('ewaCompanionAdmin.usersAuditNoteEmpty')
					: t('ewaCompanionAdmin.usersAuditNoteError', {
							detail: String(err.message),
						})
			);
		},
	});

	const clearNsMut = useMutation({
		mutationFn: async () => {
			if (!selectedId || !detailQuery.data) throw new Error('no_user');
			if (!confirmNamespaceMatches(namespaceKey, clearConfirm)) {
				throw new Error('confirm_mismatch');
			}
			return clearEwaCompanionAdminUserNamespace(selectedId, {
				namespace: namespaceKey,
				confirmNamespace: clearConfirm.trim(),
				expectedRevision: detailQuery.data.companion_revision,
			});
		},
		onSuccess: async () => {
			setClearOpen(false);
			setClearConfirm('');
			setWipeTone('success');
			setWipeMessage(
				t('ewaCompanionAdmin.usersClearSuccess', { namespace: namespaceKey })
			);
			setJsonDraft('{}');
			await qc.invalidateQueries({
				queryKey: ['ewa', 'admin', 'companion', 'users'],
			});
		},
		onError: (err: unknown) => {
			setWipeTone('error');
			const detail =
				err instanceof Error ? err.message : String(err ?? 'error');
			setWipeMessage(
				detail === 'confirm_mismatch'
					? t('ewaCompanionAdmin.usersClearMismatch')
					: t('ewaCompanionAdmin.usersClearError', { detail })
			);
		},
	});

	const wipeMut = useMutation({
		mutationFn: async () => {
			if (!selectedId) throw new Error('no_user');
			if (!confirmPrincipalIdMatches(selectedId, wipeConfirm)) {
				throw new Error('confirm_mismatch');
			}
			return wipeEwaCompanionAdminUser(selectedId, wipeConfirm.trim());
		},
		onSuccess: async (result) => {
			setWipeOpen(false);
			setWipeConfirm('');
			setSelectedId(null);
			setWipeTone('success');
			setWipeMessage(
				`${t('ewaCompanionAdmin.usersWipeSuccess', {
					count: result.qdrant_points_deleted,
				})} ${t('ewaCompanionAdmin.usersWipeSpaHint')}`
			);
			await qc.invalidateQueries({
				queryKey: ['ewa', 'admin', 'companion', 'users'],
			});
		},
		onError: (err: unknown) => {
			const kind = classifyWipeError(err);
			setWipeTone('error');
			const detail =
				err instanceof Error ? err.message : String(err ?? 'error');
			const mapped =
				kind === 'confirm_mismatch'
					? t('ewaCompanionAdmin.usersWipeMismatch')
					: kind === 'qdrant_unavailable'
						? t('ewaCompanionAdmin.usersWipeErrorQdrantUnavailable')
						: kind === 'qdrant_purge_failed'
							? t('ewaCompanionAdmin.usersWipeErrorQdrantPurge')
							: kind === 'not_found'
								? t('ewaCompanionAdmin.usersWipeErrorNotFound')
								: t('ewaCompanionAdmin.usersWipeError', { detail });
			setWipeMessage(mapped);
		},
	});

	const users = listQuery.data?.users ?? [];
	const summary = detailQuery.data?.summary as
		| Record<string, unknown>
		| undefined;

	return (
		<EwaCompanionAdminCatalogFrame
			isLoading={listQuery.isLoading}
			error={listQuery.error}
			empty={!listQuery.isLoading && !listQuery.error && users.length === 0}
			loadingLabel={t('ewaCompanionAdmin.loadingUsers')}
			emptyLabel={t('ewaCompanionAdmin.emptyUsers')}
		>
			<div className="mb-3 flex flex-wrap gap-2">
				<input
					className="min-w-[220px] flex-1 rounded border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-(--desktop-text-primary)"
					placeholder={t('ewaCompanionAdmin.usersSearch')}
					value={q}
					onChange={(e) => setQ(e.target.value)}
				/>
				{!writeEnabled ? (
					<p className="text-xs text-amber-200">
						{t('ewaCompanionAdmin.usersWriteOff')}
					</p>
				) : null}
			</div>
			{wipeMessage ? (
				<div
					className={`mb-3 flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
						wipeTone === 'success'
							? 'border-emerald-500/35 bg-emerald-950/35 text-emerald-100'
							: 'border-red-500/40 bg-red-950/40 text-red-100'
					}`}
					role="status"
				>
					<p className="min-w-0 flex-1">{wipeMessage}</p>
					<button
						type="button"
						className={`${DESKTOP_INTERACTIVE.btnRounded} shrink-0 border border-white/15 px-2 py-0.5 text-xs text-(--desktop-text-primary)`}
						onClick={() => setWipeMessage(null)}
					>
						{t('ewaCompanionAdmin.usersWipeDismiss')}
					</button>
				</div>
			) : null}
			<div className="grid gap-3 xl:grid-cols-[280px_1fr]">
				<div className="max-h-[560px] overflow-auto rounded-lg border border-white/10">
					<table className="min-w-full text-left text-sm text-(--desktop-text-primary)">
						<thead className="sticky top-0 bg-(--desktop-surface-panel) text-xs uppercase text-(--desktop-text-muted)">
							<tr>
								<th className="px-2 py-2">
									{t('ewaCompanionAdmin.colPrincipal')}
								</th>
								<th className="px-2 py-2">{t('ewaCompanionAdmin.colSeed')}</th>
								<th className="px-2 py-2">{t('ewaCompanionAdmin.colRuns')}</th>
							</tr>
						</thead>
						<tbody>
							{users.map((u) => (
								<tr
									key={u.principal_id}
									className={`cursor-pointer border-t border-white/5 hover:bg-white/[0.04] ${
										selectedId === u.principal_id
											? 'bg-[rgb(var(--desktop-accent-rgb)/0.2)]'
											: ''
									}`}
									onClick={() => selectUser(u.principal_id, u.seed_persona_id)}
								>
									<td className="max-w-[140px] truncate px-2 py-2 font-mono text-[11px]">
										{u.principal_id}
									</td>
									<td className="px-2 py-2 text-xs">{u.seed_persona_id}</td>
									<td className="px-2 py-2 text-xs">{u.run_count}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<div className="space-y-3">
					{selectedId && detailQuery.data ? (
						<>
							<div className="rounded-lg border border-white/10 p-3 text-sm text-(--desktop-text-primary)">
								<p className="font-mono text-xs text-(--desktop-text-muted)">
									{selectedId}
								</p>
								<p className="mt-1">
									{t('ewaCompanionAdmin.usersRev')}:{' '}
									{detailQuery.data.companion_revision} ·{' '}
									{t('ewaCompanionAdmin.usersMemory')}:{' '}
									{String(summary?.memory_entries ?? 0)} ·{' '}
									{t('ewaCompanionAdmin.usersTranscriptCount')}:{' '}
									{String(summary?.transcript_messages ?? 0)}
								</p>
								{onOpenTaskRuns ? (
									<button
										type="button"
										className={`${DESKTOP_INTERACTIVE.btnRounded} mt-2 border border-white/15 px-2 py-1 text-xs text-(--desktop-text-primary)`}
										onClick={() => onOpenTaskRuns(selectedId)}
									>
										{t('ewaCompanionAdmin.usersOpenTaskRuns')}
									</button>
								) : null}
								<div className="mt-3 flex flex-wrap gap-2">
									<input
										className="rounded border border-white/10 bg-black/30 px-2 py-1 text-sm"
										value={seedDraft}
										onChange={(e) => setSeedDraft(e.target.value)}
										disabled={!writeEnabled}
										placeholder="seed_persona_id"
									/>
									<input
										className="min-w-[200px] flex-1 rounded border border-white/10 bg-black/30 px-2 py-1 text-sm"
										value={noteDraft}
										onChange={(e) => setNoteDraft(e.target.value)}
										disabled={!writeEnabled}
										placeholder={t('ewaCompanionAdmin.usersAdminNote')}
									/>
									<button
										type="button"
										disabled={!writeEnabled || patchMut.isPending}
										className={`${DESKTOP_INTERACTIVE.btnRounded} bg-[rgb(var(--desktop-accent-rgb)/0.4)] px-3 py-1 text-sm text-white disabled:opacity-40`}
										onClick={() => patchMut.mutate('seed_note')}
									>
										{t('ewaCompanionAdmin.usersSaveSeedNote')}
									</button>
									<button
										type="button"
										disabled={
											!writeEnabled ||
											auditNoteMut.isPending ||
											!noteDraft.trim()
										}
										className={`${DESKTOP_INTERACTIVE.btnRounded} border border-white/15 px-3 py-1 text-sm text-(--desktop-text-primary) disabled:opacity-40`}
										onClick={() => auditNoteMut.mutate()}
									>
										{t('ewaCompanionAdmin.usersAuditNoteButton')}
									</button>
								</div>
							</div>
							<div className="rounded-lg border border-white/10 p-3">
								<div className="mb-2 flex flex-wrap items-center gap-2">
									<select
										className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-(--desktop-text-primary)"
										value={namespaceKey}
										onChange={(e) => {
											setNamespaceKey(
												e.target.value as (typeof LEARNED_KEYS)[number]
											);
											setClearOpen(false);
											setClearConfirm('');
										}}
									>
										{LEARNED_KEYS.map((k) => (
											<option key={k} value={k}>
												{k}
											</option>
										))}
									</select>
									<button
										type="button"
										className={`${DESKTOP_INTERACTIVE.btnRounded} border border-white/10 px-2 py-1 text-xs`}
										onClick={loadNamespaceIntoEditor}
									>
										{t('ewaCompanionAdmin.usersLoadNamespace')}
									</button>
									<button
										type="button"
										disabled={!writeEnabled || patchMut.isPending}
										className={`${DESKTOP_INTERACTIVE.btnRounded} bg-[rgb(var(--desktop-accent-rgb)/0.4)] px-2 py-1 text-xs text-white disabled:opacity-40`}
										onClick={() => patchMut.mutate('json')}
									>
										{t('ewaCompanionAdmin.usersSaveJson')}
									</button>
									{!clearOpen ? (
										<button
											type="button"
											disabled={!writeEnabled || clearNsMut.isPending}
											className={`${DESKTOP_INTERACTIVE.btnRounded} border border-amber-400/40 px-2 py-1 text-xs text-amber-100 disabled:opacity-40`}
											onClick={() => {
												setClearOpen(true);
												setClearConfirm('');
												setWipeOpen(false);
											}}
										>
											{t('ewaCompanionAdmin.usersClearButton')}
										</button>
									) : null}
								</div>
								{clearOpen ? (
									<div className="mb-2 space-y-2 rounded border border-amber-500/30 bg-amber-950/25 p-2">
										<p className="text-xs text-amber-100">
											{t('ewaCompanionAdmin.usersClearHint', {
												namespace: namespaceKey,
											})}
										</p>
										<input
											className="w-full rounded border border-amber-400/40 bg-black/40 px-2 py-1 font-mono text-xs text-(--desktop-text-primary)"
											placeholder={namespaceKey}
											value={clearConfirm}
											onChange={(e) => setClearConfirm(e.target.value)}
											disabled={!writeEnabled || clearNsMut.isPending}
										/>
										<div className="flex flex-wrap gap-2">
											<button
												type="button"
												disabled={
													!writeEnabled ||
													clearNsMut.isPending ||
													!confirmNamespaceMatches(namespaceKey, clearConfirm)
												}
												className={`${DESKTOP_INTERACTIVE.btnRounded} bg-amber-600/80 px-2 py-1 text-xs text-white disabled:opacity-40`}
												onClick={() => clearNsMut.mutate()}
											>
												{clearNsMut.isPending
													? t('ewaCompanionAdmin.usersClearPending')
													: t('ewaCompanionAdmin.usersClearConfirmSubmit')}
											</button>
											<button
												type="button"
												className={`${DESKTOP_INTERACTIVE.btnRounded} border border-white/15 px-2 py-1 text-xs text-(--desktop-text-primary)`}
												disabled={clearNsMut.isPending}
												onClick={() => {
													setClearOpen(false);
													setClearConfirm('');
												}}
											>
												{t('ewaCompanionAdmin.usersWipeCancel')}
											</button>
										</div>
									</div>
								) : null}
								<textarea
									className="min-h-[160px] w-full rounded border border-white/10 bg-black/40 p-2 font-mono text-[11px] text-(--desktop-text-primary)"
									value={jsonDraft}
									onChange={(e) => setJsonDraft(e.target.value)}
									disabled={!writeEnabled}
								/>
								{jsonError ? (
									<p className="mt-1 text-xs text-red-300">{jsonError}</p>
								) : null}
							</div>
							<div className="grid gap-3 lg:grid-cols-2">
								<div className="max-h-[240px] overflow-auto rounded-lg border border-white/10 p-2">
									<p className="mb-1 text-xs uppercase text-(--desktop-text-muted)">
										{t('ewaCompanionAdmin.usersTimeline')}
									</p>
									<ul className="space-y-1 text-[11px] text-(--desktop-text-secondary)">
										{(timelineQuery.data?.events ?? []).map((ev) => {
											const kind = String(ev.kind ?? ev.action ?? 'event');
											const created = String(ev.created_at ?? '');
											const detail = String(ev.intent_kind ?? ev.action ?? '');
											return (
												<li
													key={`${kind}|${created}|${detail}`}
													className="border-b border-white/5 pb-1"
												>
													<span className="text-(--desktop-text-dim)">
														{kind}
													</span>{' '}
													{detail}{' '}
													<span className="text-(--desktop-text-dim)">
														{created}
													</span>
												</li>
											);
										})}
									</ul>
								</div>
								<div className="max-h-[240px] overflow-auto rounded-lg border border-white/10 p-2">
									<p className="mb-1 text-xs uppercase text-(--desktop-text-muted)">
										{t('ewaCompanionAdmin.usersTranscript')}
									</p>
									<ul className="space-y-2 text-[11px] text-(--desktop-text-secondary)">
										{(transcriptQuery.data?.messages ?? []).map((m) => {
											const role = String(m.role ?? '?');
											const content = String(m.content ?? '');
											const created = String(m.created_at ?? m.ts ?? '');
											return (
												<li key={`${role}|${created}|${content.slice(0, 48)}`}>
													<span className="font-semibold text-[rgb(var(--desktop-accent-rgb)/0.9)]">
														{role}:
													</span>{' '}
													{content.slice(0, 280)}
												</li>
											);
										})}
									</ul>
								</div>
							</div>
							<div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3">
								<p className="text-sm font-medium text-red-100">
									{t('ewaCompanionAdmin.usersWipeTitle')}
								</p>
								<p className="mt-1 text-xs text-red-200/90">
									{t('ewaCompanionAdmin.usersWipeHint')}
								</p>
								{!writeEnabled ? (
									<p className="mt-2 text-xs text-amber-200">
										{t('ewaCompanionAdmin.usersWipeWriteRequired')}
									</p>
								) : null}
								{!wipeOpen ? (
									<button
										type="button"
										disabled={!writeEnabled || wipeMut.isPending}
										className={`${DESKTOP_INTERACTIVE.btnRounded} mt-3 bg-red-700/70 px-3 py-1.5 text-sm text-white disabled:opacity-40`}
										onClick={() => {
											setWipeOpen(true);
											setWipeConfirm('');
											setWipeMessage(null);
											setWipeCopied(false);
											setClearOpen(false);
											setClearConfirm('');
										}}
									>
										{t('ewaCompanionAdmin.usersWipeButton')}
									</button>
								) : (
									<div className="mt-3 space-y-2">
										<p className="text-xs text-red-100">
											{t('ewaCompanionAdmin.usersWipeConfirmBody')}
										</p>
										<div className="flex flex-wrap items-center gap-2">
											<code className="max-w-full truncate rounded border border-red-400/30 bg-black/50 px-2 py-1 font-mono text-[11px] text-red-50">
												{selectedId}
											</code>
											<button
												type="button"
												className={`${DESKTOP_INTERACTIVE.btnRounded} border border-white/15 px-2 py-1 text-xs text-(--desktop-text-primary)`}
												onClick={() => void copyPrincipalId()}
												disabled={wipeMut.isPending}
											>
												{wipeCopied
													? t('ewaCompanionAdmin.usersWipeCopied')
													: t('ewaCompanionAdmin.usersWipeCopyId')}
											</button>
										</div>
										<input
											ref={wipeConfirmRef}
											className="w-full rounded border border-red-400/40 bg-black/40 px-2 py-1.5 font-mono text-xs text-(--desktop-text-primary)"
											placeholder={t(
												'ewaCompanionAdmin.usersWipeConfirmPlaceholder'
											)}
											value={wipeConfirm}
											onChange={(e) => setWipeConfirm(e.target.value)}
											onKeyDown={(e) => {
												if (e.key !== 'Enter') return;
												if (
													!writeEnabled ||
													wipeMut.isPending ||
													!confirmPrincipalIdMatches(selectedId, wipeConfirm)
												) {
													return;
												}
												wipeMut.mutate();
											}}
											disabled={!writeEnabled || wipeMut.isPending}
											autoComplete="off"
											spellCheck={false}
											aria-label={t('ewaCompanionAdmin.usersWipeConfirmTitle')}
										/>
										<div className="flex flex-wrap gap-2">
											<button
												type="button"
												disabled={
													!writeEnabled ||
													wipeMut.isPending ||
													!confirmPrincipalIdMatches(selectedId, wipeConfirm)
												}
												className={`${DESKTOP_INTERACTIVE.btnRounded} bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-40`}
												onClick={() => wipeMut.mutate()}
											>
												{wipeMut.isPending
													? t('ewaCompanionAdmin.usersWipePending')
													: t('ewaCompanionAdmin.usersWipeConfirmSubmit')}
											</button>
											<button
												type="button"
												className={`${DESKTOP_INTERACTIVE.btnRounded} border border-white/15 px-3 py-1 text-sm text-(--desktop-text-primary)`}
												onClick={() => {
													setWipeOpen(false);
													setWipeConfirm('');
												}}
												disabled={wipeMut.isPending}
											>
												{t('ewaCompanionAdmin.usersWipeCancel')}
											</button>
										</div>
									</div>
								)}
							</div>
						</>
					) : (
						<p className="text-sm text-(--desktop-text-muted)">
							{t('ewaCompanionAdmin.selectUser')}
						</p>
					)}
				</div>
			</div>
		</EwaCompanionAdminCatalogFrame>
	);
}
