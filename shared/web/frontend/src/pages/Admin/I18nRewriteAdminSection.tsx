/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin section: plan and probe i18n copy rewrites via stack2 llama-chat.
 *
 * Invariants:
 * - Full locale writes happen via CLI on command-center; UI previews and test batches.
 *
 * Related:
 * - documentation/platform/I18N-REWRITE-STACK2.md
 * - api/routers/desktop_admin_i18n_rewrite.py
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	ClipboardDocumentIcon,
	PlayIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../../services/api/client';
import { log } from '../../utils/logger';
import { DESKTOP_TYPOGRAPHY } from '../Desktop/constants';
import { AdminSectionFrame } from './shell/AdminSectionFrame';
import { AdminSectionPanel } from './shell/AdminSectionPanel';
import { getAdminShellSectionMeta } from './shell/adminShellConfig';

const ADMIN_BASE = '/api/v1/desktop/admin/i18n-rewrite';

type MetaResponse = {
	enabled: boolean;
	repo_root: string | null;
	allow_write: boolean;
	specs: { id: string; path: string }[];
	targets: { id: string; path: string }[];
	stack2: { ok: boolean; url?: string; model?: string; error?: string };
	doc_path: string;
};

type PreviewResponse = {
	total_keys: number;
	pending_keys: number;
	batch_count: number;
	batch_size: number;
	batches: { index: number; size: number; keys: string[] }[];
	batches_truncated: boolean;
	cli_command: string;
	target_language?: string;
};

type RunBatchResponse = {
	batch_index: number;
	batch_count: number;
	model: string;
	keys: string[];
	before: Record<string, string>;
	after: Record<string, string>;
};

export function I18nRewriteAdminSection(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const metaShell = getAdminShellSectionMeta('i18nRewrite');
	const [meta, setMeta] = React.useState<MetaResponse | null>(null);
	const [specId, setSpecId] = React.useState('marketing-hall-ru');
	const [targetId, setTargetId] = React.useState('marketing-ru');
	const [onlyPrefix, setOnlyPrefix] = React.useState('');
	const [batchSize, setBatchSize] = React.useState(32);
	const [batchIndex, setBatchIndex] = React.useState(1);
	const [preview, setPreview] = React.useState<PreviewResponse | null>(null);
	const [batchResult, setBatchResult] = React.useState<RunBatchResponse | null>(
		null
	);
	const [msg, setMsg] = React.useState<string | null>(null);
	const [loading, setLoading] = React.useState(false);

	const loadMeta = React.useCallback(async () => {
		setLoading(true);
		setMsg(null);
		try {
			const res = await apiClient.get<MetaResponse>(`${ADMIN_BASE}/meta`);
			setMeta(res.data);
			if (res.data.specs[0]?.id) {
				setSpecId((prev) =>
					res.data.specs.some((s) => s.id === prev)
						? prev
						: res.data.specs[0].id
				);
			}
			if (res.data.targets[0]?.id) {
				setTargetId((prev) =>
					res.data.targets.some((tgt) => tgt.id === prev)
						? prev
						: res.data.targets[0].id
				);
			}
		} catch (e) {
			log.error(
				'I18nRewriteAdmin',
				'meta failed',
				e instanceof Error ? e : undefined
			);
			setMsg(e instanceof Error ? e.message : t('adminI18nRewrite.loadError'));
		} finally {
			setLoading(false);
		}
	}, [t]);

	React.useEffect(() => {
		void loadMeta();
	}, [loadMeta]);

	const runPreview = async () => {
		setMsg(null);
		setBatchResult(null);
		setLoading(true);
		try {
			const res = await apiClient.post<PreviewResponse>(
				`${ADMIN_BASE}/preview`,
				{
					spec_id: specId,
					target_id: targetId,
					only_prefix: onlyPrefix.trim() || null,
					batch_size: batchSize,
				}
			);
			setPreview(res.data);
		} catch (e) {
			setMsg(
				e instanceof Error ? e.message : t('adminI18nRewrite.previewError')
			);
		} finally {
			setLoading(false);
		}
	};

	const runBatch = async () => {
		setMsg(null);
		setLoading(true);
		try {
			const res = await apiClient.post<RunBatchResponse>(
				`${ADMIN_BASE}/run-batch`,
				{
					spec_id: specId,
					target_id: targetId,
					only_prefix: onlyPrefix.trim() || null,
					batch_size: batchSize,
					batch_index: batchIndex,
				}
			);
			setBatchResult(res.data);
			setMsg(t('adminI18nRewrite.batchOk', { count: res.data.keys.length }));
		} catch (e) {
			setMsg(e instanceof Error ? e.message : t('adminI18nRewrite.batchError'));
		} finally {
			setLoading(false);
		}
	};

	const copyCli = async () => {
		const cmd = preview?.cli_command;
		if (!cmd) return;
		try {
			await navigator.clipboard.writeText(cmd);
			setMsg(t('adminI18nRewrite.cliCopied'));
		} catch {
			setMsg(cmd);
		}
	};

	const stack2Ok = meta?.stack2?.ok === true;
	const enabled = meta?.enabled === true;

	return (
		<AdminSectionFrame variant="full">
			<p className="sr-only">{metaShell.description}</p>

			{!enabled ? (
				<div
					className={`mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 ${DESKTOP_TYPOGRAPHY.body} text-amber-100`}
				>
					{t('adminI18nRewrite.unavailableHost')}
				</div>
			) : null}

			<div className="mb-6 flex flex-wrap items-center gap-3">
				<span className={DESKTOP_TYPOGRAPHY.caption}>
					{t('adminI18nRewrite.stack2Label')}
				</span>
				<span
					className={`h-2 w-2 rounded-full ${stack2Ok ? 'bg-green-500' : 'bg-red-500'}`}
					title={
						stack2Ok
							? `${meta?.stack2?.url ?? ''} · ${meta?.stack2?.model ?? ''}`
							: (meta?.stack2?.error ?? t('adminI18nRewrite.stack2Down'))
					}
				/>
				{meta?.repo_root ? (
					<span className={`${DESKTOP_TYPOGRAPHY.meta} text-slate-400`}>
						{meta.repo_root}
					</span>
				) : null}
				<button
					type="button"
					onClick={() => void loadMeta()}
					disabled={loading}
					className="ml-auto inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/90 hover:bg-white/5 disabled:opacity-50"
				>
					<ArrowPathIcon className="h-4 w-4" />
					{t('adminI18nRewrite.refresh')}
				</button>
			</div>

			<AdminSectionPanel
				title={t('adminI18nRewrite.formTitle')}
				description={t('adminI18nRewrite.formDesc')}
			>
				<div className="grid gap-4 sm:grid-cols-2">
					<label className="flex flex-col gap-1">
						<span className={DESKTOP_TYPOGRAPHY.meta}>
							{t('adminI18nRewrite.specLabel')}
						</span>
						<select
							value={specId}
							onChange={(e) => setSpecId(e.target.value)}
							className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
						>
							{(meta?.specs ?? []).map((s) => (
								<option key={s.id} value={s.id}>
									{s.id}
								</option>
							))}
						</select>
					</label>
					<label className="flex flex-col gap-1">
						<span className={DESKTOP_TYPOGRAPHY.meta}>
							{t('adminI18nRewrite.targetLabel')}
						</span>
						<select
							value={targetId}
							onChange={(e) => setTargetId(e.target.value)}
							className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
						>
							{(meta?.targets ?? []).map((tgt) => (
								<option key={tgt.id} value={tgt.id}>
									{tgt.id}
								</option>
							))}
						</select>
					</label>
					<label className="flex flex-col gap-1 sm:col-span-2">
						<span className={DESKTOP_TYPOGRAPHY.meta}>
							{t('adminI18nRewrite.prefixLabel')}
						</span>
						<input
							type="text"
							value={onlyPrefix}
							onChange={(e) => setOnlyPrefix(e.target.value)}
							placeholder="sidebar"
							className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
						/>
					</label>
					<label className="flex flex-col gap-1">
						<span className={DESKTOP_TYPOGRAPHY.meta}>
							{t('adminI18nRewrite.batchSizeLabel')}
						</span>
						<input
							type="number"
							min={1}
							max={64}
							value={batchSize}
							onChange={(e) => setBatchSize(Number(e.target.value) || 32)}
							className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
						/>
					</label>
					<label className="flex flex-col gap-1">
						<span className={DESKTOP_TYPOGRAPHY.meta}>
							{t('adminI18nRewrite.batchIndexLabel')}
						</span>
						<input
							type="number"
							min={1}
							value={batchIndex}
							onChange={(e) => setBatchIndex(Number(e.target.value) || 1)}
							className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
						/>
					</label>
				</div>

				<div className="mt-4 flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => void runPreview()}
						disabled={loading || !enabled}
						className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
					>
						{t('adminI18nRewrite.previewAction')}
					</button>
					<button
						type="button"
						onClick={() => void runBatch()}
						disabled={loading || !enabled || !stack2Ok}
						className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-50"
					>
						<PlayIcon className="h-4 w-4" />
						{t('adminI18nRewrite.runBatchAction')}
					</button>
					{preview?.cli_command ? (
						<button
							type="button"
							onClick={() => void copyCli()}
							className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5"
						>
							<ClipboardDocumentIcon className="h-4 w-4" />
							{t('adminI18nRewrite.copyCli')}
						</button>
					) : null}
				</div>
			</AdminSectionPanel>

			{msg ? (
				<p className={`mt-4 ${DESKTOP_TYPOGRAPHY.body} text-slate-300`}>
					{msg}
				</p>
			) : null}

			{preview ? (
				<AdminSectionPanel
					title={t('adminI18nRewrite.previewTitle')}
					description={t('adminI18nRewrite.previewDesc', {
						total: preview.total_keys,
						batches: preview.batch_count,
						lang: preview.target_language ?? '—',
					})}
					className="mt-6"
				>
					<pre className="max-h-48 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-slate-300">
						{preview.batches
							.flatMap((b) => b.keys)
							.slice(0, 80)
							.join('\n')}
						{preview.batches_truncated ? '\n…' : ''}
					</pre>
					<p className={`mt-3 ${DESKTOP_TYPOGRAPHY.meta} text-slate-400`}>
						{t('adminI18nRewrite.cliHint')}
					</p>
					<pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-emerald-200/90">
						{preview.cli_command}
					</pre>
				</AdminSectionPanel>
			) : null}

			{batchResult ? (
				<AdminSectionPanel
					title={t('adminI18nRewrite.batchResultTitle', {
						index: batchResult.batch_index,
						total: batchResult.batch_count,
					})}
					description={t('adminI18nRewrite.batchResultDesc', {
						model: batchResult.model,
					})}
					className="mt-6"
				>
					<div className="max-h-96 space-y-3 overflow-auto">
						{batchResult.keys.map((key) => (
							<div
								key={key}
								className="rounded-lg border border-white/10 bg-black/30 p-3"
							>
								<div className="font-mono text-xs text-violet-300">{key}</div>
								<div className="mt-1 text-xs text-slate-500 line-through">
									{batchResult.before[key]}
								</div>
								<div className="mt-1 text-sm text-slate-200">
									{batchResult.after[key]}
								</div>
							</div>
						))}
					</div>
				</AdminSectionPanel>
			) : null}
		</AdminSectionFrame>
	);
}
