/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime UI to launch multi-step professional AI scenarios (playbooks), watch SSE progress, and skim recent runs without surfacing internal keys to casual users.
 *
 * Invariants:
 * - Uses `/api/v1/professional-worlds` playbook stream and run listing; no admin-only prompts are shown here.
 * - Primary UI shows human titles (`display_name`) and friendly run status labels; technical keys and raw JSON live behind optional disclosure.
 * - Variables payload must be a JSON object; default `{}` when the operator does not open advanced options.
 *
 * Related:
 * - src/features/professional-worlds/desktop/api.ts
 * - runtimePanels/PlaybooksWorkspacePanel.tsx
 * - layout/ProfessionalWorldsStatusBanner.tsx
 * - ProfessionalToast.ts
 * - shared/api/routers/professional_worlds.py
 */

import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	DesktopAppButton,
	DesktopAppSectionLabel,
	DesktopAppSurface,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';

import { ProfessionalWorldsQuotaEstimate } from './components/ProfessionalWorldsQuotaEstimate';

import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsTextarea,
} from './layout';
import { SupportDetailsPanel } from './components/SupportDetailsPanel';
import { PW_TONE_LABEL_CLASS } from './layout/professionalWorldsLayoutTokens';

import {
	getProfessionalPlaybookRun,
	listProfessionalPlaybookRuns,
	resumeProfessionalPlaybookStream,
	streamProfessionalPlaybook,
} from './api';
import type {
	ProfessionalPlaybookRun,
	ProfessionalPlaybookRuntime,
} from './types';
import { formatProfessionalWorldsApiError } from './professionalWorldsApiError';
import { useProfessionalToasts } from './ProfessionalToast';
import { useProfessionalWorldsQuota } from './hooks/useProfessionalWorldsQuota';
import { PROFESSIONAL_WORLDS_VERTICAL_REALTOR } from './types';

const RESUMABLE_PLAYBOOK_STATUSES = new Set(['failed', 'cancelled']);
const USER_CANCELLED_EVENT = 'user_cancelled';

export function isResumablePlaybookRun(status: string): boolean {
	return RESUMABLE_PLAYBOOK_STATUSES.has(status);
}

function isAbortError(err: unknown): boolean {
	return err instanceof DOMException
		? err.name === 'AbortError'
		: err instanceof Error && err.name === 'AbortError';
}

function createIdempotencyKey(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function playbookDisplayName(
	playbooks: ProfessionalPlaybookRuntime[],
	key: string
): string {
	const row = playbooks.find((p) => p.playbook_key === key);
	const name = row?.display_name?.trim();
	return name || key;
}

function formatRunWhen(iso: string, locale: string): string {
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
	} catch {
		return iso;
	}
}

export type PlaybookTimelineEntry = {
	id: string;
	event: string;
	label: string;
	detail?: string;
	at: number;
	tone: 'neutral' | 'ok' | 'warn' | 'err';
};

export function ProfessionalPlaybooksRuntimePanel({
	verticalSlug,
	playbooks,
}: {
	verticalSlug: string;
	playbooks: ProfessionalPlaybookRuntime[];
}) {
	const { t, i18n } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError } = useProfessionalToasts();
	const quotaEnabled = verticalSlug === PROFESSIONAL_WORLDS_VERTICAL_REALTOR;
	const playbookVariablesFieldId = useId();
	const activeStreamAbortRef = useRef<AbortController | null>(null);
	const [selectedKey, setSelectedKey] = useState<string>(
		playbooks[0]?.playbook_key ?? ''
	);
	const {
		summary,
		loading: quotaLoading,
		error: quotaError,
		estimateForPlaybook,
	} = useProfessionalWorldsQuota({ enabled: quotaEnabled });
	const playbookQuotaEstimate = useMemo(
		() => estimateForPlaybook(selectedKey),
		[estimateForPlaybook, selectedKey]
	);
	const [variablesText, setVariablesText] = useState('');
	const [runBusy, setRunBusy] = useState(false);
	const [runError, setRunError] = useState<string | null>(null);
	const [historyError, setHistoryError] = useState<string | null>(null);
	const [cancelNotice, setCancelNotice] = useState<string | null>(null);
	const [timeline, setTimeline] = useState<PlaybookTimelineEntry[]>([]);
	const [runs, setRuns] = useState<ProfessionalPlaybookRun[]>([]);
	const [detailId, setDetailId] = useState<string | null>(null);
	const [detail, setDetail] = useState<ProfessionalPlaybookRun | null>(null);

	useEffect(() => {
		const next = playbooks[0]?.playbook_key ?? '';
		setSelectedKey((current) =>
			playbooks.some((p) => p.playbook_key === current) ? current : next
		);
	}, [playbooks]);

	const loadHistory = useCallback(async () => {
		try {
			setHistoryError(null);
			const list = await listProfessionalPlaybookRuns();
			const keys = new Set(playbooks.map((p) => p.playbook_key));
			setRuns(
				list.filter(
					(r) => r.vertical_slug === verticalSlug && keys.has(r.playbook_key)
				)
			);
		} catch (err: unknown) {
			setRuns([]);
			setHistoryError(formatProfessionalWorldsApiError(err, (key) => t(key)));
		}
	}, [verticalSlug, playbooks, t]);

	useEffect(() => {
		void loadHistory();
	}, [loadHistory]);

	useEffect(() => {
		return () => {
			activeStreamAbortRef.current?.abort();
		};
	}, []);

	useEffect(() => {
		if (!detailId) {
			setDetail(null);
			return;
		}
		void getProfessionalPlaybookRun(detailId)
			.then(setDetail)
			.catch(() => setDetail(null));
	}, [detailId]);

	const selectedPlaybook = useMemo(
		() => playbooks.find((p) => p.playbook_key === selectedKey) ?? null,
		[playbooks, selectedKey]
	);

	const runStatusLabel = useCallback(
		(status: string) => {
			const key = `playbooksPanel.runStatus.${status}`;
			const v = t(key);
			return v === key ? t('playbooksPanel.runStatus.other', { status }) : v;
		},
		[t]
	);

	function pushTimeline(entry: Omit<PlaybookTimelineEntry, 'id' | 'at'>) {
		setTimeline((cur) => {
			const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			return [...cur, { ...entry, id, at: Date.now() }];
		});
	}

	function createStreamAbortController(): AbortController {
		activeStreamAbortRef.current?.abort();
		const controller = new AbortController();
		activeStreamAbortRef.current = controller;
		return controller;
	}

	function handleStopWaiting() {
		if (!activeStreamAbortRef.current) {
			return;
		}
		activeStreamAbortRef.current.abort();
		setRunBusy(false);
		setCancelNotice(t('playbooksPanel.cancelNotice'));
		pushTimeline({
			event: USER_CANCELLED_EVENT,
			label: t('playbooksPanel.cancelledTimeline'),
			detail: t('playbooksPanel.cancelNotice'),
			tone: 'warn',
		});
	}

	function applyPlaybookStreamEvent(
		event: string,
		data: Record<string, unknown>
	) {
		if (event === 'run_started') {
			pushTimeline({
				event,
				label: t('stream.starting'),
				tone: 'neutral',
			});
		} else if (event === 'step_start') {
			pushTimeline({
				event,
				label: `${t('playbooksPanel.stepLabel')} ${String(data.step)}`,
				detail: t('playbooksPanel.stepWorking'),
				tone: 'neutral',
			});
		} else if (event === 'warning') {
			pushTimeline({
				event,
				label: String(data.message ?? 'warning'),
				tone: 'warn',
			});
		} else if (event === 'step_result') {
			const preview = String(data.preview ?? '');
			pushTimeline({
				event,
				label: `${t('playbooksPanel.stepLabel')} ${String(data.step)}`,
				detail: preview.slice(0, 240),
				tone: 'ok',
			});
		} else if (event === 'done') {
			pushTimeline({
				event,
				label: data.replayed
					? t('playbooksPanel.replayNotice')
					: t('stream.done'),
				tone: 'ok',
			});
		} else if (event === 'error') {
			const msg = String(data.error ?? t('stream.error'));
			pushTimeline({
				event,
				label: t('stream.error'),
				detail: msg,
				tone: 'err',
			});
		}
	}

	function parsePlaybookVariables():
		| { ok: true; variables: Record<string, unknown> }
		| { ok: false } {
		try {
			const parsed: unknown = JSON.parse(variablesText.trim() || '{}');
			if (
				parsed === null ||
				typeof parsed !== 'object' ||
				Array.isArray(parsed)
			) {
				throw new Error('not_object');
			}
			return { ok: true, variables: parsed as Record<string, unknown> };
		} catch {
			setRunError(t('playbooksPanel.variablesInvalid'));
			return { ok: false };
		}
	}

	async function handleLaunch() {
		if (!selectedKey) {
			return;
		}
		const parsedVariables = parsePlaybookVariables();
		if (!parsedVariables.ok) {
			return;
		}
		setRunError(null);
		setCancelNotice(null);
		setRunBusy(true);
		setTimeline([]);
		const idem = createIdempotencyKey(`pb-${verticalSlug}-${selectedKey}`);
		const controller = createStreamAbortController();
		try {
			await streamProfessionalPlaybook(
				verticalSlug,
				selectedKey,
				{
					variables: parsedVariables.variables,
					idempotency_key: idem,
				},
				applyPlaybookStreamEvent,
				(msg) => {
					setRunError(msg);
					pushTimeline({
						event: 'error',
						label: t('stream.error'),
						detail: msg,
						tone: 'err',
					});
				},
				{ signal: controller.signal }
			);
		} catch (err: unknown) {
			if (isAbortError(err)) {
				return;
			}
			const message = formatProfessionalWorldsApiError(err, (key) => t(key));
			setRunError(message);
			notifyApiError(err, t, t('playbooksPanel.runFailed'));
		} finally {
			if (activeStreamAbortRef.current === controller) {
				activeStreamAbortRef.current = null;
				setRunBusy(false);
			}
			void loadHistory();
		}
	}

	async function handleResume(run: ProfessionalPlaybookRun) {
		const parsedVariables = parsePlaybookVariables();
		if (!parsedVariables.ok) {
			return;
		}
		setSelectedKey(run.playbook_key);
		setRunError(null);
		setCancelNotice(null);
		setRunBusy(true);
		setTimeline([]);
		const idem = createIdempotencyKey(`pb-resume-${run.id}`);
		const controller = createStreamAbortController();
		try {
			await resumeProfessionalPlaybookStream(
				run.id,
				{
					variables: parsedVariables.variables,
					idempotency_key: idem,
				},
				applyPlaybookStreamEvent,
				(msg) => {
					setRunError(msg);
					pushTimeline({
						event: 'error',
						label: t('stream.error'),
						detail: msg,
						tone: 'err',
					});
				},
				{ signal: controller.signal }
			);
		} catch (err: unknown) {
			if (isAbortError(err)) {
				return;
			}
			const message = formatProfessionalWorldsApiError(err, (key) => t(key));
			setRunError(message);
			notifyApiError(err, t, t('playbooksPanel.resumeFailed'));
		} finally {
			if (activeStreamAbortRef.current === controller) {
				activeStreamAbortRef.current = null;
				setRunBusy(false);
			}
			void loadHistory();
		}
	}

	if (playbooks.length === 0) {
		return (
			<DesktopAppSurface variant="soft" padding="md">
				<p className="text-sm text-(--desktop-text-secondary)">
					{t('playbooksPanel.emptyPlaybooks')}
				</p>
			</DesktopAppSurface>
		);
	}

	return (
		<div className="grid gap-3">
			<DesktopAppSurface variant="soft" padding="md" className="grid gap-3">
				<div className="grid gap-1">
					<span className="text-xs font-medium text-(--desktop-text-secondary)">
						{t('playbooksPanel.pick')}
					</span>
					<DesktopNativeSelect
						value={selectedKey}
						onChange={(e) => setSelectedKey(e.target.value)}
						aria-label={t('playbooksPanel.pick')}
					>
						{playbooks.map((p) => (
							<option key={p.playbook_key} value={p.playbook_key}>
								{p.display_name?.trim() || p.playbook_key}
							</option>
						))}
					</DesktopNativeSelect>
				</div>

				{selectedPlaybook?.description ? (
					<p className="text-xs text-(--desktop-text-secondary)">
						{selectedPlaybook.description}
					</p>
				) : null}

				<SupportDetailsPanel
					className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/35 px-3 py-2"
					summaryClassName="text-xs font-medium text-(--desktop-text-secondary)"
					contentClassName="grid gap-2"
					summary={t('playbooksPanel.advancedSummary')}
				>
					<p className="text-[11px] leading-relaxed text-(--desktop-text-muted)">
						{t('playbooksPanel.advancedHint')}
					</p>
					<ProfessionalWorldsFormField
						htmlFor={playbookVariablesFieldId}
						label={t('playbooksPanel.variablesLabel')}
					>
						<ProfessionalWorldsTextarea
							id={playbookVariablesFieldId}
							rows={4}
							spellCheck={false}
							className="font-mono text-xs"
							placeholder={t('playbooksPanel.variablesPlaceholder')}
							value={variablesText}
							onChange={(e) => setVariablesText(e.target.value)}
						/>
					</ProfessionalWorldsFormField>
				</SupportDetailsPanel>

				{runError ? (
					<ProfessionalWorldsStatusBanner kind="error" role="alert">
						{runError}
					</ProfessionalWorldsStatusBanner>
				) : null}
				{cancelNotice ? (
					<ProfessionalWorldsStatusBanner kind="warning" role="status">
						{cancelNotice}
					</ProfessionalWorldsStatusBanner>
				) : null}

				{quotaEnabled ? (
					<ProfessionalWorldsQuotaEstimate
						loading={quotaLoading}
						error={quotaError}
						summary={summary}
						playbookEstimate={playbookQuotaEstimate}
					/>
				) : null}

				<div className="flex flex-wrap items-center gap-2">
					<DesktopAppButton
						type="button"
						onClick={() => void handleLaunch()}
						disabled={runBusy || !selectedKey}
					>
						{runBusy ? t('playbooksPanel.running') : t('playbooksPanel.launch')}
					</DesktopAppButton>
					{runBusy ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							onClick={handleStopWaiting}
						>
							{t('playbooksPanel.stopWaiting')}
						</DesktopAppButton>
					) : null}
				</div>
				<p className="text-[11px] leading-relaxed text-(--desktop-text-muted)">
					{runBusy
						? t('playbooksPanel.runningContract')
						: t('playbooksPanel.idleContract')}
				</p>
			</DesktopAppSurface>

			<DesktopAppSurface variant="soft" padding="md" className="grid gap-2">
				<DesktopAppSectionLabel>
					{t('playbooksPanel.timelineTitle')}
				</DesktopAppSectionLabel>
				{timeline.length === 0 ? (
					<p className="text-xs text-(--desktop-text-muted)">
						{t('ai.waiting')}
					</p>
				) : (
					<ol className="grid gap-2 border-l border-(--desktop-border-subtle) pl-3">
						{timeline.map((item) => (
							<li key={item.id} className="grid gap-0.5 text-xs">
								<span className={PW_TONE_LABEL_CLASS[item.tone]}>
									{item.label}
								</span>
								{item.detail ? (
									<span className="whitespace-pre-wrap text-(--desktop-text-secondary)">
										{item.detail}
									</span>
								) : null}
							</li>
						))}
					</ol>
				)}
			</DesktopAppSurface>

			<DesktopAppSurface variant="soft" padding="md" className="grid gap-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<DesktopAppSectionLabel>
						{t('playbooksPanel.historyTitle')}
					</DesktopAppSectionLabel>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="ghost"
						onClick={() => void loadHistory()}
					>
						{t('actions.refresh')}
					</DesktopAppButton>
				</div>
				{historyError ? (
					<ProfessionalWorldsStatusBanner kind="warning" role="status">
						{t('playbooksPanel.historyLoadFailed', {
							error: historyError,
						})}
					</ProfessionalWorldsStatusBanner>
				) : runs.length === 0 ? (
					<p className="text-xs text-(--desktop-text-muted)">
						{t('playbooksPanel.emptyRuns')}
					</p>
				) : (
					<ul className="grid gap-2">
						{runs.slice(0, 12).map((run) => (
							<li
								key={run.id}
								className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) px-3 py-2"
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div>
										<p className="text-sm font-medium text-(--desktop-text-primary)">
											{playbookDisplayName(playbooks, run.playbook_key)}
										</p>
										<p className="text-[10px] text-(--desktop-text-muted)">
											{formatRunWhen(run.created_at, i18n.language)}
										</p>
									</div>
									<div className="flex items-center gap-2">
										<span className="rounded-full bg-(--desktop-surface-accent) px-2 py-0.5 text-[10px] font-medium text-(--desktop-text-secondary)">
											{runStatusLabel(run.status)}
										</span>
										{RESUMABLE_PLAYBOOK_STATUSES.has(run.status) ? (
											<DesktopAppButton
												type="button"
												size="sm"
												disabled={runBusy}
												onClick={() => void handleResume(run)}
											>
												{runBusy
													? t('playbooksPanel.resuming')
													: t('playbooksPanel.resume')}
											</DesktopAppButton>
										) : null}
										<DesktopAppButton
											type="button"
											size="sm"
											variant="ghost"
											onClick={() =>
												setDetailId((cur) => (cur === run.id ? null : run.id))
											}
										>
											{t('playbooksPanel.openRun')}
										</DesktopAppButton>
									</div>
								</div>
								{detailId === run.id && detail?.id === run.id ? (
									<SupportDetailsPanel
										className="mt-2"
										summaryClassName="text-[11px] font-medium text-(--desktop-text-muted)"
									>
										<pre className="max-h-48 overflow-auto rounded-lg bg-(--desktop-surface-elevated) p-2 text-[10px] text-(--desktop-text-secondary)">
											{JSON.stringify(
												{
													status: detail.status,
													error: detail.error,
													step_logs: detail.step_logs,
													artifacts: detail.artifacts,
												},
												null,
												2
											)}
										</pre>
									</SupportDetailsPanel>
								) : null}
							</li>
						))}
					</ul>
				)}
			</DesktopAppSurface>
		</div>
	);
}
