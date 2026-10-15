/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin desktop app for the separate MusicForge backend-first song generation flow.
 *
 * Invariants:
 * - The UI submits only user intent and renders backend snapshots; no raw workflow/model/sampler controls.
 * - Active progress uses `monitorMusicForgeRun` (SSE first, backoff GET poll; pauses when tab hidden).
 *
 * Related:
 * - src/services/musicForge/musicForgeApi.ts
 * - src/pages/MusicForge/musicForgeUiHelpers.ts
 */

import {
	type FormEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppContentWrapper,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	cancelMusicForgeRun,
	createMusicForgeRun,
	fetchMusicForgeCapabilities,
	fetchMusicForgeRun,
	rewriteMusicForgeLyrics,
	isMusicForgeRunTerminalStatus,
	monitorMusicForgeRun,
	type MusicForgeCapabilities,
	type MusicForgeLanguage,
	type MusicForgeRun,
	type MusicForgeRunCreate,
} from '@/services/musicForge/musicForgeApi';
import {
	clampDurationSeconds,
	ideaNeedsMinLengthHint,
	mapMusicForgeApiError,
	musicForgeConstraintsForVocal,
	musicForgeExtraConstraintsFromPayload,
	parseMusicForgeVocalFromConstraints,
	type MusicForgeVocal,
} from './musicForgeUiHelpers';
import { MusicForgeCreatePanel } from './MusicForgeCreatePanel';
import { MusicForgeResultCard } from './MusicForgeResultCard';
import { MusicForgeStudioIdlePanel } from './MusicForgeStudioIdlePanel';
import { MusicForgeWorkflow } from './MusicForgeWorkflow';
import {
	musicForgeHeaderStatusTextTone,
	musicForgeHeaderStatusTone,
} from './musicForgeStatusTone';

const DEFAULT_CAPABILITIES: MusicForgeCapabilities = {
	default_language: 'auto',
	languages: [
		{ value: 'auto', label_ru: 'Авто' },
		{ value: 'ru', label_ru: 'Русский' },
		{ value: 'en', label_ru: 'English' },
	],
	duration_seconds_default: 220,
	duration_seconds_min: 60,
	duration_seconds_max: 240,
	mvp_lane: 'SFT XL (default) | BASE XL | TURBO XL',
	frontend_role: 'thin_client',
	modes: [],
	default_mode_key: null,
	taste_profile_like_count: 0,
	taste_profile_dislike_count: 0,
};

type MusicForgeAppProps = {
	embedded?: boolean;
	initialRunId?: string | null;
};

export function MusicForgeApp({
	embedded = false,
	initialRunId = null,
}: MusicForgeAppProps) {
	const { t } = useTranslation('desktopUi');
	const [capabilities, setCapabilities] = useState(DEFAULT_CAPABILITIES);
	const [capabilitiesWarning, setCapabilitiesWarning] = useState(false);
	const [idea, setIdea] = useState('');
	const [language, setLanguage] = useState<MusicForgeLanguage>('auto');
	const [modeKey, setModeKey] = useState('');
	const [styleHint, setStyleHint] = useState('');
	const [vocal, setVocal] = useState<MusicForgeVocal>('female');
	const [constraints, setConstraints] = useState('');
	const [duration, setDuration] = useState(
		DEFAULT_CAPABILITIES.duration_seconds_default
	);
	const [runId, setRunId] = useState<string | null>(initialRunId);
	const [run, setRun] = useState<MusicForgeRun | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [rewriteLyricsBusy, setRewriteLyricsBusy] = useState(false);
	const [cancelPending, setCancelPending] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [monitorError, setMonitorError] = useState<string | null>(null);
	const lastSubmitRef = useRef<MusicForgeRunCreate | null>(null);

	const runActive = run?.status === 'queued' || run?.status === 'running';
	const runCompleted = run?.status === 'completed';
	const runFailed = run?.status === 'failed';
	const runCancelled = run?.status === 'cancelled';
	const runTerminal = runFailed || runCancelled;
	const canSubmit = idea.trim().length >= 3 && !submitting && !runActive;
	const ideaHintVisible = ideaNeedsMinLengthHint(idea);
	const statusText = useMemo(() => {
		if (!run) return t('musicForge.status.idle');
		if (cancelPending) return t('musicForge.status.cancelPending');
		if (run.status === 'completed') return t('musicForge.status.completed');
		if (run.status === 'failed') return t('musicForge.status.failed');
		if (run.status === 'cancelled') return t('musicForge.status.cancelled');
		return t('musicForge.status.active');
	}, [cancelPending, run, t]);

	const resolveLanguageLabel = useCallback(
		(value: MusicForgeLanguage, fallbackLabel: string) => {
			const key = `musicForge.languages.${value}`;
			const translated = t(key);
			return translated === key ? fallbackLabel : translated;
		},
		[t]
	);

	const loadCapabilities = useCallback(() => {
		setCapabilitiesWarning(false);
		return fetchMusicForgeCapabilities()
			.then((data) => {
				setCapabilities(data);
				setLanguage(data.default_language);
				setDuration(data.duration_seconds_default);
				const modes = data.modes ?? [];
				const preferred =
					data.default_mode_key ||
					modes.find((m) => m.is_default)?.mode_key ||
					modes[0]?.mode_key ||
					'';
				setModeKey(preferred);
			})
			.catch(() => {
				setCapabilities(DEFAULT_CAPABILITIES);
				setCapabilitiesWarning(true);
			});
	}, []);

	useEffect(() => {
		let alive = true;
		void loadCapabilities().finally(() => {
			if (!alive) return;
		});
		return () => {
			alive = false;
		};
	}, [loadCapabilities]);

	useEffect(() => {
		if (!initialRunId) return;
		setRunId(initialRunId);
	}, [initialRunId]);

	useEffect(() => {
		if (!runId) return;
		const controller = new AbortController();
		let stopped = false;

		void monitorMusicForgeRun({
			runId,
			signal: controller.signal,
			onRunSnapshot: (next) => {
				if (stopped) return;
				setRun(next);
				if (isMusicForgeRunTerminalStatus(next.status)) {
					setCancelPending(false);
					setMonitorError(null);
				}
			},
			onError: (exc) => {
				if (stopped) return;
				const offline = typeof navigator !== 'undefined' && !navigator.onLine;
				setMonitorError(
					offline
						? t('musicForge.errors.offline')
						: mapMusicForgeApiError(exc, t, 'musicForge.errors.pollFailed')
				);
			},
		}).catch(() => {
			/* abort / monitor end — UI keeps last snapshot */
		});

		return () => {
			stopped = true;
			controller.abort();
		};
	}, [runId, t]);

	const applyLastPayloadToForm = useCallback(
		(payload: MusicForgeRunCreate) => {
			setIdea(payload.idea);
			setLanguage(payload.language ?? 'auto');
			setModeKey(payload.mode_key ?? capabilities.default_mode_key ?? '');
			setStyleHint(payload.style_hint ?? '');
			setVocal(parseMusicForgeVocalFromConstraints(payload.constraints));
			setConstraints(
				musicForgeExtraConstraintsFromPayload(payload.constraints)
			);
			setDuration(
				clampDurationSeconds(
					payload.duration_seconds ?? capabilities.duration_seconds_default,
					capabilities.duration_seconds_min,
					capabilities.duration_seconds_max
				)
			);
		},
		[
			capabilities.default_mode_key,
			capabilities.duration_seconds_default,
			capabilities.duration_seconds_max,
			capabilities.duration_seconds_min,
		]
	);

	const submitPayload = useCallback(
		async (payload: MusicForgeRunCreate) => {
			lastSubmitRef.current = payload;
			setSubmitting(true);
			setFormError(null);
			setRun(null);
			try {
				const created = await createMusicForgeRun(payload);
				setRunId(created.run_id);
				const snapshot = await fetchMusicForgeRun(created.run_id);
				setRun(snapshot);
			} catch (exc) {
				setFormError(
					mapMusicForgeApiError(exc, t, 'musicForge.errors.submitFailed')
				);
			} finally {
				setSubmitting(false);
			}
		},
		[t]
	);

	const submitRun = useCallback(
		async (event?: FormEvent) => {
			event?.preventDefault();
			if (!canSubmit) return;
			const clampedDuration = clampDurationSeconds(
				duration,
				capabilities.duration_seconds_min,
				capabilities.duration_seconds_max
			);
			if (clampedDuration !== duration) setDuration(clampedDuration);
			const payload: MusicForgeRunCreate = {
				idea: idea.trim(),
				language,
				style_hint: styleHint.trim() || null,
				constraints:
					musicForgeConstraintsForVocal(vocal, language, constraints.trim()) ||
					null,
				duration_seconds: clampedDuration,
				mode_key: modeKey.trim() || null,
				idempotency_key: crypto.randomUUID(),
			};
			await submitPayload(payload);
		},
		[
			canSubmit,
			capabilities.duration_seconds_max,
			capabilities.duration_seconds_min,
			constraints,
			duration,
			idea,
			language,
			modeKey,
			styleHint,
			vocal,
			submitPayload,
		]
	);

	const restoreLastRequest = useCallback(() => {
		const last = lastSubmitRef.current;
		if (!last || runActive) return;
		applyLastPayloadToForm(last);
	}, [applyLastPayloadToForm, runActive]);

	const retryGeneration = useCallback(async () => {
		const last = lastSubmitRef.current;
		if (!last || runActive) return;
		applyLastPayloadToForm(last);
		await submitPayload({
			...last,
			idempotency_key: crypto.randomUUID(),
		});
	}, [applyLastPayloadToForm, runActive, submitPayload]);

	const startNewSong = useCallback(() => {
		setRunId(null);
		setRun(null);
		setFormError(null);
		setMonitorError(null);
		setCancelPending(false);
	}, []);

	const rewriteLyrics = useCallback(async () => {
		if (!run?.id || runActive || rewriteLyricsBusy) return;
		setRewriteLyricsBusy(true);
		setFormError(null);
		setMonitorError(null);
		try {
			const created = await rewriteMusicForgeLyrics(run.id);
			setRunId(created.run_id);
			const snapshot = await fetchMusicForgeRun(created.run_id);
			setRun(snapshot);
		} catch (exc) {
			setFormError(
				mapMusicForgeApiError(exc, t, 'musicForge.errors.submitFailed')
			);
		} finally {
			setRewriteLyricsBusy(false);
		}
	}, [rewriteLyricsBusy, run?.id, runActive, t]);

	const cancelRun = useCallback(async () => {
		if (!runId || !runActive || cancelPending) return;
		setCancelPending(true);
		try {
			const next = await cancelMusicForgeRun(runId);
			setRun(next);
		} catch (exc) {
			setFormError(
				mapMusicForgeApiError(exc, t, 'musicForge.errors.cancelFailed')
			);
		} finally {
			setCancelPending(false);
		}
	}, [cancelPending, runActive, runId, t]);

	const handleDurationBlur = useCallback(() => {
		setDuration((current) =>
			clampDurationSeconds(
				current,
				capabilities.duration_seconds_min,
				capabilities.duration_seconds_max
			)
		);
	}, [capabilities.duration_seconds_max, capabilities.duration_seconds_min]);

	return (
		<DesktopAppContentWrapper
			appComponent="MusicForgeApp"
			mode={embedded ? 'passthrough' : 'standard'}
			className="h-full min-h-0 overflow-hidden"
		>
			<div
				className="flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_10%_0%,rgba(217,70,239,0.18),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(251,191,36,0.14),transparent_30%)]"
				data-testid="music-forge-root"
			>
				<header
					className={
						embedded
							? 'shrink-0 border-b border-white/10 px-4 py-2'
							: 'shrink-0 border-b border-white/10 px-5 py-4'
					}
					data-testid="music-forge-header"
					data-embedded={embedded ? 'true' : 'false'}
				>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="min-w-0">
							<h1
								className={
									embedded
										? 'truncate text-lg font-semibold text-white'
										: 'truncate text-2xl font-bold text-white'
								}
							>
								{t('musicForge.title')}
							</h1>
							{embedded ? null : (
								<p className="mt-1 max-w-3xl text-sm text-(--desktop-text-secondary)">
									{t('musicForge.subtitle')}
								</p>
							)}
						</div>
						<div className="flex flex-wrap items-center gap-3">
							<div
								className={`rounded-2xl border px-4 py-3 text-right ${musicForgeHeaderStatusTone(run, cancelPending)}`}
							>
								<p className="text-xs uppercase tracking-[0.18em] text-fuchsia-100/75">
									{t('musicForge.statusLabel')}
								</p>
								<p
									className={`text-sm font-semibold ${musicForgeHeaderStatusTextTone(run, cancelPending)}`}
									role="status"
									aria-live="polite"
								>
									{statusText}
								</p>
							</div>
							{runCompleted || runTerminal ? (
								<DesktopAppButton
									type="button"
									variant="accent"
									onClick={startNewSong}
								>
									{t('musicForge.actions.newSong')}
								</DesktopAppButton>
							) : null}
						</div>
					</div>
				</header>

				<div
					className={
						embedded
							? 'min-h-0 flex-1 overflow-y-auto px-4 py-4'
							: 'min-h-0 flex-1 overflow-y-auto px-5 py-5'
					}
				>
					<div className="grid gap-5 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.4fr)]">
						<MusicForgeCreatePanel
							capabilities={capabilities}
							capabilitiesWarning={capabilitiesWarning}
							onRetryCapabilities={() => void loadCapabilities()}
							idea={idea}
							onIdeaChange={setIdea}
							ideaHintVisible={ideaHintVisible}
							language={language}
							onLanguageChange={setLanguage}
							resolveLanguageLabel={resolveLanguageLabel}
							modeKey={modeKey}
							onModeKeyChange={setModeKey}
							styleHint={styleHint}
							onStyleHintChange={setStyleHint}
							vocal={vocal}
							onVocalChange={setVocal}
							constraints={constraints}
							onConstraintsChange={setConstraints}
							duration={duration}
							onDurationChange={setDuration}
							onDurationBlur={handleDurationBlur}
							runActive={runActive}
							activeIdeaLabel={run?.idea ?? idea}
							activeStatusLabel={statusText}
							activeProgressCurrent={run?.progress_current ?? 0}
							activeProgressTotal={run?.progress_total ?? 0}
							activeRunStatus={run?.status === 'queued' ? 'queued' : 'running'}
							activeVocal={
								run
									? parseMusicForgeVocalFromConstraints(run.constraints)
									: vocal
							}
							activeStyleHint={run?.style_hint ?? styleHint}
							activeLanguage={run?.language ?? language}
							activeDurationSeconds={run?.duration_seconds ?? duration}
							canSubmit={canSubmit}
							submitting={submitting}
							cancelPending={cancelPending}
							canRestoreLast={Boolean(lastSubmitRef.current) && !runActive}
							formError={formError}
							onSubmit={(event) => void submitRun(event)}
							onCancel={() => void cancelRun()}
							onRestoreLast={restoreLastRequest}
							completedHintVisible={runCompleted}
							onStartNewSong={startNewSong}
							terminalHintVisible={runTerminal}
							terminalStatus={
								runFailed ? 'failed' : runCancelled ? 'cancelled' : undefined
							}
							canRetryGeneration={Boolean(lastSubmitRef.current) && !runActive}
							onRetryGeneration={() => void retryGeneration()}
						/>

						<div className="space-y-5">
							{run ? (
								<>
									<MusicForgeWorkflow
										run={run}
										compact={run.status === 'completed'}
										cancelPending={cancelPending}
										monitorError={monitorError}
										onRetry={() => void retryGeneration()}
										onNewSong={startNewSong}
										canRetry={Boolean(lastSubmitRef.current) && !runActive}
									/>
									<MusicForgeResultCard
										run={run}
										onRewriteLyrics={
											run.status === 'completed' && !runActive
												? () => void rewriteLyrics()
												: undefined
										}
										rewriteLyricsBusy={rewriteLyricsBusy}
									/>
								</>
							) : (
								<MusicForgeStudioIdlePanel />
							)}
						</div>
					</div>
				</div>
			</div>
		</DesktopAppContentWrapper>
	);
}

export default MusicForgeApp;
