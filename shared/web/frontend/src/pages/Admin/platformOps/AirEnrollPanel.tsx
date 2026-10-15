/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Platform Ops workspace for one-code Air enrollment intent, reveal-once, and history.
 *
 * Invariants:
 * - Plaintext access code is shown only once after reveal; never reconstructed from GET.
 * - Does not log or persist the access code in localStorage.
 *
 * Related:
 * - pages/Admin/platformOps/platformOpsApi.ts
 * - documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md
 */

import * as React from 'react';
import type { TFunction } from 'i18next';
import { DESKTOP_INTERACTIVE } from '../../Desktop/constants';
import {
	cancelPlatformOpsAirEnrollSession,
	createPlatformOpsAirEnrollSession,
	getPlatformOpsAirEnrollSession,
	listPlatformOpsAirEnrollSessions,
	reissuePlatformOpsAirEnrollSession,
	revealPlatformOpsAirEnrollCode,
	type PlatformOpsAirEnrollMode,
	type PlatformOpsAirEnrollSession,
} from './platformOpsApi';
import { PLATFORM_OPS_PANEL } from './platformOpsPanelChrome';

const PANEL = PLATFORM_OPS_PANEL;
const INPUT =
	'w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white';

function newIdempotencyKey(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return `air-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AirEnrollPanel({
	t,
	busy,
	setBusy,
	setError,
}: {
	t: TFunction;
	busy: boolean;
	setBusy: (v: boolean) => void;
	setError: (v: string | null) => void;
}): React.ReactElement {
	const [mode, setMode] = React.useState<PlatformOpsAirEnrollMode>('offline');
	const [label, setLabel] = React.useState('');
	const [slug, setSlug] = React.useState('');
	const [allowedEmail, setAllowedEmail] = React.useState('');
	const [allowFofline, setAllowFofline] = React.useState(false);
	const [sessions, setSessions] = React.useState<PlatformOpsAirEnrollSession[]>(
		[]
	);
	const [total, setTotal] = React.useState(0);
	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const [selected, setSelected] =
		React.useState<PlatformOpsAirEnrollSession | null>(null);
	const [revealedCode, setRevealedCode] = React.useState<string | null>(null);
	const [loading, setLoading] = React.useState(false);

	const refresh = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const body = await listPlatformOpsAirEnrollSessions({
				limit: 50,
				offset: 0,
			});
			setSessions(body.sessions);
			setTotal(body.total);
			if (selectedId) {
				const match = body.sessions.find((row) => row.id === selectedId);
				if (match) {
					setSelected(match);
				}
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [selectedId, setError]);

	React.useEffect(() => {
		void refresh();
	}, [refresh]);

	const loadDetail = React.useCallback(
		async (sessionId: string) => {
			setBusy(true);
			setError(null);
			try {
				const row = await getPlatformOpsAirEnrollSession(sessionId);
				setSelectedId(row.id);
				setSelected(row);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(false);
			}
		},
		[setBusy, setError]
	);

	const onCreate = React.useCallback(async () => {
		setBusy(true);
		setError(null);
		setRevealedCode(null);
		try {
			const row = await createPlatformOpsAirEnrollSession({
				idempotency_key: newIdempotencyKey(),
				mode,
				label: label.trim() || null,
				slug: slug.trim() || null,
				allowed_email: allowedEmail.trim() || null,
				allow_fofline: allowFofline,
			});
			setSelectedId(row.id);
			setSelected(row);
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}, [
		allowFofline,
		allowedEmail,
		label,
		mode,
		refresh,
		setBusy,
		setError,
		slug,
	]);

	const onReveal = React.useCallback(async () => {
		if (!selectedId) {
			return;
		}
		if (!window.confirm(t('adminPlatformOps.airEnroll.confirmReveal'))) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const result = await revealPlatformOpsAirEnrollCode(selectedId);
			setSelected(result.session);
			setRevealedCode(result.access_code);
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}, [refresh, selectedId, setBusy, setError, t]);

	const onCancel = React.useCallback(async () => {
		if (!selectedId) {
			return;
		}
		if (!window.confirm(t('adminPlatformOps.airEnroll.confirmCancel'))) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const row = await cancelPlatformOpsAirEnrollSession(selectedId);
			setSelected(row);
			setRevealedCode(null);
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}, [refresh, selectedId, setBusy, setError, t]);

	const onReissue = React.useCallback(async () => {
		if (!selectedId) {
			return;
		}
		if (!window.confirm(t('adminPlatformOps.airEnroll.confirmReissue'))) {
			return;
		}
		setBusy(true);
		setError(null);
		setRevealedCode(null);
		try {
			const row = await reissuePlatformOpsAirEnrollSession({
				sessionId: selectedId,
				idempotency_key: newIdempotencyKey(),
			});
			setSelectedId(row.id);
			setSelected(row);
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}, [refresh, selectedId, setBusy, setError, t]);

	const copyRevealed = React.useCallback(async () => {
		if (!revealedCode) {
			return;
		}
		try {
			await navigator.clipboard.writeText(revealedCode);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, [revealedCode, setError]);

	return (
		<section className="space-y-4" data-testid="platform-ops-air-enroll">
			<header className={`${PANEL} space-y-2 p-4`}>
				<h3 className="text-base font-medium text-white">
					{t('adminPlatformOps.airEnroll.title')}
				</h3>
				<p className="text-sm text-slate-400">
					{t('adminPlatformOps.airEnroll.hint')}
				</p>
			</header>

			{revealedCode ? (
				<div
					className={`${PANEL} space-y-2 border-amber-500/30 p-4`}
					role="status"
				>
					<p className="text-sm font-medium text-amber-200">
						{t('adminPlatformOps.airEnroll.secretsOnce')}
					</p>
					<code className="block break-all rounded bg-black/40 p-3 font-mono text-sm text-amber-50">
						{revealedCode}
					</code>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							className={DESKTOP_INTERACTIVE.button}
							onClick={() => void copyRevealed()}
						>
							{t('adminPlatformOps.airEnroll.copyCode')}
						</button>
						<button
							type="button"
							className={DESKTOP_INTERACTIVE.button}
							onClick={() => setRevealedCode(null)}
						>
							{t('adminPlatformOps.airEnroll.dismissSecrets')}
						</button>
					</div>
				</div>
			) : null}

			<div className={`${PANEL} space-y-3 p-4`}>
				<h4 className="text-sm font-medium text-white">
					{t('adminPlatformOps.airEnroll.createTitle')}
				</h4>
				<label className="block space-y-1 text-sm text-slate-300">
					<span>{t('adminPlatformOps.airEnroll.mode')}</span>
					<select
						className={INPUT}
						value={mode}
						disabled={busy}
						onChange={(event) =>
							setMode(event.target.value as PlatformOpsAirEnrollMode)
						}
					>
						<option value="offline">offline</option>
						<option value="cloud">cloud</option>
						<option value="both">both</option>
					</select>
				</label>
				<label className="block space-y-1 text-sm text-slate-300">
					<span>{t('adminPlatformOps.airEnroll.label')}</span>
					<input
						className={INPUT}
						value={label}
						disabled={busy}
						onChange={(event) => setLabel(event.target.value)}
					/>
				</label>
				<label className="block space-y-1 text-sm text-slate-300">
					<span>{t('adminPlatformOps.airEnroll.slug')}</span>
					<input
						className={INPUT}
						value={slug}
						disabled={busy}
						onChange={(event) => setSlug(event.target.value)}
					/>
				</label>
				<label className="block space-y-1 text-sm text-slate-300">
					<span>{t('adminPlatformOps.airEnroll.allowedEmail')}</span>
					<input
						className={INPUT}
						value={allowedEmail}
						disabled={busy}
						onChange={(event) => setAllowedEmail(event.target.value)}
					/>
				</label>
				<label className="flex items-center gap-2 text-sm text-slate-300">
					<input
						type="checkbox"
						checked={allowFofline}
						disabled={busy}
						onChange={(event) => setAllowFofline(event.target.checked)}
					/>
					<span>{t('adminPlatformOps.airEnroll.allowFofline')}</span>
				</label>
				<button
					type="button"
					className={DESKTOP_INTERACTIVE.button}
					disabled={busy}
					onClick={() => void onCreate()}
				>
					{t('adminPlatformOps.airEnroll.create')}
				</button>
			</div>

			<div className={`${PANEL} space-y-3 p-4`}>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h4 className="text-sm font-medium text-white">
						{t('adminPlatformOps.airEnroll.historyTitle')}
					</h4>
					<button
						type="button"
						className={DESKTOP_INTERACTIVE.button}
						disabled={busy || loading}
						onClick={() => void refresh()}
					>
						{t('adminPlatformOps.airEnroll.refresh')}
					</button>
				</div>
				<p className="text-xs text-slate-500">
					{t('adminPlatformOps.airEnroll.total', { count: total })}
				</p>
				<ul className="divide-y divide-white/5">
					{sessions.map((row) => (
						<li key={row.id} className="flex flex-wrap items-center gap-2 py-2">
							<button
								type="button"
								className={`${DESKTOP_INTERACTIVE.button} text-left ${
									selectedId === row.id ? 'border-emerald-400/40' : ''
								}`}
								onClick={() => void loadDetail(row.id)}
							>
								<span className="font-mono text-xs text-slate-200">
									{row.id.slice(0, 8)}
								</span>
								<span className="ml-2 text-xs text-slate-400">
									:{row.port} · {row.lifecycle}/{row.cleanup_state}
								</span>
							</button>
						</li>
					))}
					{sessions.length === 0 ? (
						<li className="py-2 text-sm text-slate-500">
							{t('adminPlatformOps.airEnroll.empty')}
						</li>
					) : null}
				</ul>
			</div>

			{selected ? (
				<div className={`${PANEL} space-y-3 p-4`}>
					<h4 className="text-sm font-medium text-white">
						{t('adminPlatformOps.airEnroll.detailTitle')}
					</h4>
					<dl className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
						<div>
							<dt className="text-slate-500">
								{t('adminPlatformOps.airEnroll.lifecycle')}
							</dt>
							<dd className="font-mono">{selected.lifecycle}</dd>
						</div>
						<div>
							<dt className="text-slate-500">
								{t('adminPlatformOps.airEnroll.cleanup')}
							</dt>
							<dd className="font-mono">{selected.cleanup_state}</dd>
						</div>
						<div>
							<dt className="text-slate-500">
								{t('adminPlatformOps.airEnroll.port')}
							</dt>
							<dd className="font-mono">{selected.port}</dd>
						</div>
						<div>
							<dt className="text-slate-500">
								{t('adminPlatformOps.airEnroll.lastError')}
							</dt>
							<dd className="font-mono">{selected.last_error_code ?? '—'}</dd>
						</div>
					</dl>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							className={DESKTOP_INTERACTIVE.button}
							disabled={busy || selected.lifecycle !== 'ready'}
							onClick={() => void onReveal()}
						>
							{t('adminPlatformOps.airEnroll.reveal')}
						</button>
						<button
							type="button"
							className={DESKTOP_INTERACTIVE.button}
							disabled={busy || selected.cleanup_state === 'closed'}
							onClick={() => void onCancel()}
						>
							{t('adminPlatformOps.airEnroll.cancel')}
						</button>
						<button
							type="button"
							className={DESKTOP_INTERACTIVE.button}
							disabled={
								busy ||
								selected.cleanup_state !== 'closed' ||
								!(
									selected.lifecycle === 'delivery_uncertain' ||
									selected.lifecycle === 'issue_failed'
								)
							}
							onClick={() => void onReissue()}
						>
							{t('adminPlatformOps.airEnroll.reissue')}
						</button>
					</div>
					<ul className="max-h-64 space-y-1 overflow-auto text-xs text-slate-400">
						{(selected.events ?? []).map((event) => (
							<li key={`${event.sequence}-${event.created_at}`}>
								<span className="font-mono text-slate-500">
									#{event.sequence}
								</span>{' '}
								{event.event} · {event.lifecycle}/{event.cleanup_state}
								{event.reason ? ` · ${event.reason}` : ''}
							</li>
						))}
					</ul>
				</div>
			) : null}
		</section>
	);
}
