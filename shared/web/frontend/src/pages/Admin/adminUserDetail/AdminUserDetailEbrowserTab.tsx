/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin user-detail tab — edit per-user EBrowser HTTPS navigation policy.
 *
 * Invariants:
 * - Modes exclusive; inactive list cleared on save for the active mode.
 * - Validation errors mapped to human copy (no raw codes as primary UX).
 * - New World Admin atoms (`AdminButton` / `AdminSelect` / `AdminStatusBanner`).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-EBROWSER.md
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 * - features/ebrowser/ebrowserPolicyApi.ts
 */

import * as React from 'react';
import type { TFunction } from 'i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	adminGetEBrowserPolicy,
	adminPutEBrowserPolicy,
} from '@/features/ebrowser/ebrowserPolicyApi';
import {
	validatePolicyForSave,
	type PolicyMode,
} from '@/features/ebrowser/navPolicy';
import { AdminButton, AdminSelect, AdminStatusBanner } from '../ui';
import { ebrowserAdminErrorI18nKey } from './ebrowserAdminErrors';

type Props = {
	userId: string;
	t: TFunction;
};

const MODES: readonly PolicyMode[] = ['open', 'allowlist', 'denylist'];

const uiCaption =
	'text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]';
const uiLabel =
	'block space-y-1 text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg)]';

function listFromText(raw: string): string[] {
	return raw
		.split(/[\n,]+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

function listsEqual(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((v, i) => v === b[i]);
}

export function AdminUserDetailEbrowserTab({
	userId,
	t,
}: Props): React.ReactElement {
	const qc = useQueryClient();
	const qk = ['ebrowser', 'admin', 'policy', userId] as const;
	const query = useQuery({
		queryKey: qk,
		queryFn: () => adminGetEBrowserPolicy(userId),
	});

	const [mode, setMode] = React.useState<PolicyMode>('allowlist');
	const [allowText, setAllowText] = React.useState('');
	const [denyText, setDenyText] = React.useState('');
	const [localError, setLocalError] = React.useState<string | null>(null);
	const [savedOk, setSavedOk] = React.useState(false);
	const [isDefault, setIsDefault] = React.useState(false);

	React.useEffect(() => {
		if (!query.data) return;
		setMode(query.data.mode);
		setAllowText((query.data.allow ?? []).join('\n'));
		setDenyText((query.data.deny ?? []).join('\n'));
		setIsDefault(Boolean(query.data.is_default));
		setLocalError(null);
		setSavedOk(false);
	}, [query.data]);

	const dirty = React.useMemo(() => {
		if (!query.data) return false;
		// Synthetic default must be saved once to persist a real row (even empty allowlist).
		if (query.data.is_default) return true;
		const allow = mode === 'allowlist' ? listFromText(allowText) : [];
		const deny = mode === 'denylist' ? listFromText(denyText) : [];
		return (
			mode !== query.data.mode ||
			!listsEqual(allow, query.data.allow ?? []) ||
			!listsEqual(deny, query.data.deny ?? [])
		);
	}, [query.data, mode, allowText, denyText]);

	const saveMut = useMutation({
		mutationFn: async () => {
			const allow = listFromText(allowText);
			const deny = listFromText(denyText);
			const cleanedAllow = mode === 'allowlist' ? allow : [];
			const cleanedDeny = mode === 'denylist' ? deny : [];
			const err = validatePolicyForSave(mode, cleanedAllow, cleanedDeny);
			if (err) {
				throw new Error(err);
			}
			return adminPutEBrowserPolicy(userId, {
				mode,
				allow: cleanedAllow,
				deny: cleanedDeny,
			});
		},
		onSuccess: async () => {
			setLocalError(null);
			setIsDefault(false);
			setSavedOk(true);
			await qc.invalidateQueries({ queryKey: qk });
		},
		onError: (e: unknown) => {
			setSavedOk(false);
			const raw = e instanceof Error ? e.message : '';
			const key = ebrowserAdminErrorI18nKey(raw);
			setLocalError(
				t(key, {
					defaultValue:
						raw ||
						t('adminUserDetail.ebrowser.saveFailed', {
							defaultValue: 'Could not save EBrowser policy',
						}),
				})
			);
		},
	});

	const modeHint = t(`adminUserDetail.ebrowser.modeHint.${mode}`, {
		defaultValue:
			mode === 'open'
				? 'Any HTTPS host (shared scheme deny still applies).'
				: mode === 'allowlist'
					? 'Only listed domains / IPs / CIDR. Empty list blocks all HTTPS.'
					: 'All HTTPS except listed domains / IPs / CIDR. List cannot be empty.',
	});

	return (
		<section className="space-y-4" aria-labelledby="admin-ebrowser-title">
			<div>
				<h2
					id="admin-ebrowser-title"
					className="text-sm font-semibold text-[var(--admin-ui-fg)]"
				>
					{t('adminUserDetail.ebrowser.title', {
						defaultValue: 'EBrowser navigation policy',
					})}
				</h2>
				<p className={`mt-1 ${uiCaption}`}>
					{t('adminUserDetail.ebrowser.help', {
						defaultValue:
							'HTTPS only. Choose one mode. Domains, IPs, and CIDR — one entry per line.',
					})}
				</p>
			</div>

			{query.isLoading ? (
				<p className={uiCaption} role="status">
					{t('adminUserDetail.ebrowser.loading', {
						defaultValue: 'Loading policy…',
					})}
				</p>
			) : null}

			{query.isError ? (
				<AdminStatusBanner
					tone="error"
					title={t('adminUserDetail.ebrowser.loadFailed', {
						defaultValue: 'Could not load policy',
					})}
				>
					<AdminButton
						type="button"
						variant="secondary"
						className="mt-2"
						onClick={() => void query.refetch()}
					>
						{t('adminUserDetail.ebrowser.retry', {
							defaultValue: 'Retry',
						})}
					</AdminButton>
				</AdminStatusBanner>
			) : null}

			{isDefault && query.data && !query.isError ? (
				<AdminStatusBanner
					tone="warning"
					title={t('adminUserDetail.ebrowser.defaultDenyNotice', {
						defaultValue:
							'No saved policy yet — all HTTPS is blocked until you save.',
					})}
				>
					<p className={uiCaption}>
						{t('adminUserDetail.ebrowser.defaultDenyHint', {
							defaultValue:
								'Save open, a populated allowlist, or a non-empty denylist to unlock browsing for this user.',
						})}
					</p>
				</AdminStatusBanner>
			) : null}

			{savedOk && !localError ? (
				<AdminStatusBanner
					tone="success"
					title={t('adminUserDetail.ebrowser.saved', {
						defaultValue: 'Policy saved',
					})}
				/>
			) : null}

			{!query.isLoading && !query.isError ? (
				<>
					<label className={uiLabel}>
						<span>
							{t('adminUserDetail.ebrowser.mode', {
								defaultValue: 'Mode',
							})}
						</span>
						<AdminSelect
							value={mode}
							aria-describedby="admin-ebrowser-mode-hint"
							onChange={(e) => {
								setMode(e.target.value as PolicyMode);
								setSavedOk(false);
								setLocalError(null);
							}}
						>
							{MODES.map((m) => (
								<option key={m} value={m}>
									{t(`adminUserDetail.ebrowser.modes.${m}`, {
										defaultValue: m,
									})}
								</option>
							))}
						</AdminSelect>
						<p id="admin-ebrowser-mode-hint" className={`mt-1 ${uiCaption}`}>
							{modeHint}
						</p>
					</label>

					{mode === 'allowlist' ? (
						<label className={uiLabel}>
							<span>
								{t('adminUserDetail.ebrowser.allow', {
									defaultValue: 'Allow list (one per line)',
								})}
							</span>
							<textarea
								className="min-h-[8rem] w-full rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] px-3 py-2 font-mono text-sm text-[var(--admin-ui-fg)]"
								value={allowText}
								placeholder={t('adminUserDetail.ebrowser.listPlaceholder', {
									defaultValue: 'example.com\n10.0.0.0/8',
								})}
								onChange={(e) => {
									setAllowText(e.target.value);
									setSavedOk(false);
									setLocalError(null);
								}}
							/>
						</label>
					) : null}

					{mode === 'denylist' ? (
						<label className={uiLabel}>
							<span>
								{t('adminUserDetail.ebrowser.deny', {
									defaultValue: 'Deny list (one per line)',
								})}
							</span>
							<textarea
								className="min-h-[8rem] w-full rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] px-3 py-2 font-mono text-sm text-[var(--admin-ui-fg)]"
								value={denyText}
								placeholder={t('adminUserDetail.ebrowser.listPlaceholder', {
									defaultValue: 'example.com\n10.0.0.0/8',
								})}
								onChange={(e) => {
									setDenyText(e.target.value);
									setSavedOk(false);
									setLocalError(null);
								}}
							/>
						</label>
					) : null}

					{localError ? (
						<AdminStatusBanner tone="error" title={localError} />
					) : null}

					<div className="flex flex-wrap items-center gap-2">
						<AdminButton
							type="button"
							variant="primary"
							disabled={saveMut.isPending || query.isLoading || !dirty}
							onClick={() => saveMut.mutate()}
						>
							{saveMut.isPending
								? t('adminUserDetail.ebrowser.saving', {
										defaultValue: 'Saving…',
									})
								: t('adminUserDetail.ebrowser.save', {
										defaultValue: 'Save policy',
									})}
						</AdminButton>
						{!dirty && query.data && !query.data.is_default ? (
							<span className={uiCaption}>
								{t('adminUserDetail.ebrowser.noChanges', {
									defaultValue: 'No unsaved changes',
								})}
							</span>
						) : null}
					</div>
				</>
			) : null}
		</section>
	);
}
