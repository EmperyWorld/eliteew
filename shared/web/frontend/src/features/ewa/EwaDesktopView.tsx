/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * **EWA** desktop window body: consumer-first companion UX (workspace-aware send, readable outcomes, step timeline)
 * with an optional **advanced** debug panel (raw JSON, shell hints, streamed journal) for operators.
 *
 * Invariants:
 * - Observations match `OBSERVATION-CATALOG.md`; envelopes match `ewaDesktopOrchApi.ts` / `DESKTOP-ORCHESTRATION.md`.
 * - With **`orchestrationCompanionHints`**, orchestration envelopes include **`metadata.companion`** (`seed_persona_id`, optional `expect_companion_revision`).
 * - **`hidePersonaSection`** hides the tone picker when **`seed_persona_id`** is locked server-side (companion shell).
 *
 * Related:
 * - src/features/ewa/EwaDesktopApp.tsx
 * - src/services/ewa/ewaDesktopUserFacing.ts
 * - shared/api/ewa_platform/docs/DESKTOP-ORCHESTRATION.md
 */
import {
	EWA_DESKTOP_OBS_PRESETS,
	EwaDesktopAdvancedDebugPanel,
	type ObservationBuilderKind,
} from '@/features/ewa/EwaDesktopAdvancedDebugPanel';
import { EwaDesktopPersonaSection } from '@/features/ewa/EwaDesktopPersonaSection';
import {
	buildActiveAppObservationFromShellState,
	buildWindowListObservationFromShellState,
} from '@/features/ewa/amkaShellObservations';
import {
	patchEwaShellHintsSubtree,
	type EwaShellHintsSubtreeV1,
} from '@/features/ewa/ewaShellHints';
import type { EwaPersonaId } from '@/features/ewa/ewaPersonaCatalog';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import { useEwaDesktopOrchestrationTurn } from '@/hooks/api/useAmka';
import { useNotifications } from '@/notifications';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { getDesktopShellState } from '@/pages/Desktop/services/desktopApi';
import {
	buildDesktopOrchestrationSignalEnvelope,
	consumeDesktopOrchestrationSessionSse,
	extractLastIntentKindFromTurnEnvelope,
	type EwaDesktopOrchTurnResponseEnvelope,
} from '@/services/ewa/ewaDesktopOrchApi';
import {
	extractTimelineFromEnvelope,
	persistenceNeedsFriendlyWarning,
	summarizeObservationForUser,
	summarizeTurnOutcomeFromSession,
	timelineRowsFromSseLogText,
	type TurnOutcomeUserFacing,
	type UserFacingMessageRef,
	type UserFacingTimelineRow,
} from '@/services/ewa/ewaDesktopUserFacing';
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const ADVANCED_LOCAL_STORAGE_KEY = 'ewaDesktopAdvancedDebug.v1';

const DEFAULT_OBSERVATION_JSON = JSON.stringify(
	EWA_DESKTOP_OBS_PRESETS.window_list_snapshot,
	null,
	2
);

const SSE_LINE_CAP = 140;

function orchTurnErrorMessage(err: unknown): string {
	if (
		err &&
		typeof err === 'object' &&
		'message' in err &&
		typeof (err as { message: unknown }).message === 'string'
	) {
		return (err as { message: string }).message;
	}
	return String(err);
}

function trimSseLog(prev: string, line: string): string {
	const next = prev ? `${prev}\n${line}` : line;
	const lines = next.split('\n');
	if (lines.length <= SSE_LINE_CAP) {
		return next;
	}
	return lines.slice(-SSE_LINE_CAP).join('\n');
}

function integerOrNull(raw: string): number | null {
	const n = Number.parseInt(raw.trim(), 10);
	return Number.isFinite(n) && n >= 0 ? n : null;
}

function safeSessionRecord(
	payload: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
	const raw = payload?.session;
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return undefined;
	}
	return raw as Record<string, unknown>;
}

function renderTimelineRowText(
	t: TFunction<'marketing', undefined>,
	row: UserFacingTimelineRow
): string {
	const p = row.params;
	if (
		p &&
		typeof p.intentSummaryKey === 'string' &&
		p.intentSummaryKey.length > 0
	) {
		return t(row.messageKey, { intent: t(p.intentSummaryKey) });
	}
	return t(row.messageKey, { ...(p ?? {}) });
}

function renderUserFacingLine(
	t: TFunction<'marketing', undefined>,
	ref: UserFacingMessageRef
): string {
	return t(ref.messageKey, { ...(ref.params ?? {}) });
}

export function EwaDesktopView({
	sessionId,
	onSessionIdChange,
	personaId,
	onPersonaIdChange,
	hidePersonaSection = false,
	orchestrationCompanionHints,
}: {
	sessionId: string;
	onSessionIdChange: (next: string) => void;
	personaId: EwaPersonaId;
	onPersonaIdChange: (next: EwaPersonaId) => void;
	/** When true (companion locked server-side), persona picker is omitted — seed comes from profile only. */
	hidePersonaSection?: boolean;
	orchestrationCompanionHints?: {
		seedPersonaId: EwaPersonaId;
		expectCompanionRevision?: number;
	};
}) {
	const { t, i18n } = useTranslation('marketing');
	const { error, success } = useNotifications();
	const turn = useEwaDesktopOrchestrationTurn();

	const [showAdvanced, setShowAdvanced] = useState(false);

	const [observationJson, setObservationJson] = useState(
		DEFAULT_OBSERVATION_JSON
	);
	const [lastResponseJson, setLastResponseJson] = useState<string | null>(null);
	const [lastEnvelope, setLastEnvelope] =
		useState<EwaDesktopOrchTurnResponseEnvelope | null>(null);
	const [lastIntentKind, setLastIntentKind] = useState<string | null>(null);
	const [shellBusy, setShellBusy] = useState(false);
	const [sseBusy, setSseBusy] = useState(false);
	const [sseLive, setSseLive] = useState(false);
	const [sseLog, setSseLog] = useState('');
	const [hintsJson, setHintsJson] = useState('{}');
	const [hintDocCount, setHintDocCount] = useState('');
	const [hintDocId, setHintDocId] = useState('');
	const [hintContentRoot, setHintContentRoot] = useState('');
	const [hintsBusy, setHintsBusy] = useState(false);
	const [observationBuilderKind, setObservationBuilderKind] =
		useState<ObservationBuilderKind>('window_list_snapshot');
	const [builderAppComponent, setBuilderAppComponent] = useState('EwaApp');
	const [builderWindowId, setBuilderWindowId] = useState('app:EwaApp:0');
	const [builderReason, setBuilderReason] = useState('operator_preview');
	const [builderIntentKind, setBuilderIntentKind] = useState('noop');

	const [consumerTimelineRows, setConsumerTimelineRows] = useState<
		UserFacingTimelineRow[]
	>([]);
	const [lastSentObservationSummary, setLastSentObservationSummary] =
		useState<UserFacingMessageRef | null>(null);
	const [lastOutcome, setLastOutcome] = useState<TurnOutcomeUserFacing | null>(
		null
	);
	const [persistWarning, setPersistWarning] = useState(false);

	const sseAbortRef = useRef<AbortController | null>(null);
	const sseAccumRef = useRef('');
	const observationBuilderKindRef = useRef<ObservationBuilderKind>(
		observationBuilderKind
	);

	observationBuilderKindRef.current = observationBuilderKind;

	useEffect(() => {
		try {
			setShowAdvanced(localStorage.getItem(ADVANCED_LOCAL_STORAGE_KEY) === '1');
		} catch (err) {
			ewaCompanionDegradeDebug(
				'ewa_desktop_advanced_pref_load',
				'localStorage advanced panel pref load failed',
				err
			);
			setShowAdvanced(false);
		}
	}, []);

	const setAdvancedPersisted = (next: boolean) => {
		setShowAdvanced(next);
		try {
			localStorage.setItem(ADVANCED_LOCAL_STORAGE_KEY, next ? '1' : '0');
		} catch (err) {
			ewaCompanionDegradeDebug(
				'ewa_desktop_advanced_pref_save',
				'localStorage advanced panel pref save failed',
				err
			);
		}
	};

	const stopSse = () => {
		sseAbortRef.current?.abort();
		sseAbortRef.current = null;
		setSseLive(false);
	};

	useEffect(() => {
		return () => {
			sseAbortRef.current?.abort();
			sseAbortRef.current = null;
		};
	}, []);

	const applyPreset = (key: ObservationBuilderKind) => {
		const preset = EWA_DESKTOP_OBS_PRESETS[key];
		if (!preset) return;
		setObservationBuilderKind(key);
		setObservationJson(JSON.stringify(preset, null, 2));
	};

	const applyStarterPrompt = (prompt: string) => {
		if (navigator.clipboard?.writeText) {
			void navigator.clipboard.writeText(prompt);
		}
		success(t('ewaDesktop.personaStarterCopiedToast'));
		const builderKindNow = observationBuilderKindRef.current;
		if (
			builderKindNow === 'user_cancelled' ||
			builderKindNow === 'intent_execution_failed'
		) {
			setBuilderReason(prompt);
		}
	};

	const handleApplyHintsBuilder = () => {
		const subtree: EwaShellHintsSubtreeV1 = {};
		const count = integerOrNull(hintDocCount);
		const docId = hintDocId.trim();
		if (count !== null || docId) {
			subtree.documents_workspace = {
				open_document_count: count ?? (docId ? 1 : 0),
				items: docId ? [{ doc_id: docId }] : [],
			};
		}
		const root = hintContentRoot.trim();
		if (root) {
			subtree.content_manager = { roots: [root] };
		}
		setHintsJson(JSON.stringify(subtree, null, 2));
	};

	const handleApplyObservationBuilder = () => {
		const kind = observationBuilderKind;
		let next: Record<string, unknown>;
		if (kind === 'active_app_changed') {
			next = {
				observation_kind: kind,
				app_component: builderAppComponent.trim() || 'EwaApp',
				window_id: builderWindowId.trim() || 'app:EwaApp:0',
			};
		} else if (kind === 'user_cancelled') {
			next = {
				observation_kind: kind,
				reason: builderReason.trim() || 'operator_preview',
			};
		} else if (kind === 'intent_execution_failed') {
			next = {
				observation_kind: kind,
				intent_kind: builderIntentKind.trim() || 'noop',
				reason: builderReason.trim() || 'operator_simulated',
				detail: {},
			};
		} else {
			next = { observation_kind: 'window_list_snapshot', windows: [] };
		}
		setObservationJson(JSON.stringify(next, null, 2));
	};

	const handleSaveShellHints = async () => {
		let subtree: Record<string, unknown>;
		try {
			const parsed: unknown = JSON.parse(hintsJson);
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
				error(t('ewaDesktop.shellHintsInvalidJson'));
				return;
			}
			subtree = parsed as Record<string, unknown>;
		} catch (err) {
			ewaCompanionDegradeDebug(
				'ewa_desktop_shell_hints_json_parse',
				'shell hints JSON parse failed',
				err
			);
			error(t('ewaDesktop.shellHintsInvalidJson'));
			return;
		}
		setHintsBusy(true);
		try {
			await patchEwaShellHintsSubtree(subtree as EwaShellHintsSubtreeV1);
			success(t('ewaDesktop.shellHintsSaved'));
		} catch (e) {
			error(
				`${t('ewaDesktop.shellHintsSaveFailed')}: ${orchTurnErrorMessage(e)}`
			);
		} finally {
			setHintsBusy(false);
		}
	};

	const handleLoadShellHints = async () => {
		setHintsBusy(true);
		try {
			const { state: shell } = await getDesktopShellState();
			const raw = shell.ewa_hints;
			const obj =
				raw && typeof raw === 'object' && !Array.isArray(raw)
					? (raw as Record<string, unknown>)
					: {};
			setHintsJson(JSON.stringify(obj, null, 2));
			success(t('ewaDesktop.shellHintsLoaded'));
		} catch (e) {
			error(
				`${t('ewaDesktop.desktopShellLoadError')}: ${orchTurnErrorMessage(e)}`
			);
		} finally {
			setHintsBusy(false);
		}
	};

	const sendTurnWithObservation = async (
		observation: Record<string, unknown>
	) => {
		const correlationId =
			typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: `corr-${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const orchMeta =
			orchestrationCompanionHints &&
			orchestrationCompanionHints.seedPersonaId.trim().length > 0
				? {
						companion: {
							seed_persona_id: orchestrationCompanionHints.seedPersonaId,
							...(typeof orchestrationCompanionHints.expectCompanionRevision ===
								'number' &&
							orchestrationCompanionHints.expectCompanionRevision >= 1
								? {
										expect_companion_revision:
											orchestrationCompanionHints.expectCompanionRevision,
									}
								: {}),
						},
					}
				: undefined;

		const body = buildDesktopOrchestrationSignalEnvelope({
			correlationId,
			sessionId: sessionId.trim(),
			observation,
			...(orchMeta ? { metadata: orchMeta } : {}),
		});

		try {
			const res = await turn.mutateAsync(body);
			setLastResponseJson(JSON.stringify(res, null, 2));
			setLastEnvelope(res);
			setLastIntentKind(extractLastIntentKindFromTurnEnvelope(res));

			const payload =
				res.payload &&
				typeof res.payload === 'object' &&
				!Array.isArray(res.payload)
					? (res.payload as Record<string, unknown>)
					: undefined;
			setConsumerTimelineRows(extractTimelineFromEnvelope(res));
			setLastOutcome(
				summarizeTurnOutcomeFromSession(safeSessionRecord(payload))
			);
			setPersistWarning(persistenceNeedsFriendlyWarning(payload?.persistence));
			return res;
		} catch (e) {
			error(orchTurnErrorMessage(e));
			return null;
		}
	};

	const handleSendTurn = async () => {
		let observation: Record<string, unknown>;
		try {
			const parsed: unknown = JSON.parse(observationJson);
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
				error(t('ewaDesktop.invalidJson'));
				return;
			}
			observation = parsed as Record<string, unknown>;
		} catch (err) {
			ewaCompanionDegradeDebug(
				'ewa_desktop_observation_json_parse',
				'observation JSON parse failed',
				err
			);
			error(t('ewaDesktop.invalidJson'));
			return;
		}
		setLastSentObservationSummary(summarizeObservationForUser(observation));
		await sendTurnWithObservation(observation);
	};

	const handleConsumerSendFromWorkspace = async () => {
		if (!sessionId.trim()) {
			error(t('ewaDesktop.sessionRequiredForPrimary'));
			return;
		}
		setShellBusy(true);
		try {
			const { state: shell } = await getDesktopShellState();
			const obs = buildWindowListObservationFromShellState(shell);
			setLastSentObservationSummary(summarizeObservationForUser(obs));
			setObservationJson(JSON.stringify(obs, null, 2));
			await sendTurnWithObservation(obs);
		} catch (e) {
			error(
				`${t('ewaDesktop.desktopShellLoadError')}: ${orchTurnErrorMessage(e)}`
			);
		} finally {
			setShellBusy(false);
		}
	};

	const handleConsumerSendFocusedWindow = async () => {
		if (!sessionId.trim()) {
			error(t('ewaDesktop.sessionRequiredForPrimary'));
			return;
		}
		setShellBusy(true);
		try {
			const { state: shell } = await getDesktopShellState();
			const obs = buildActiveAppObservationFromShellState(shell);
			if (!obs) {
				error(t('ewaDesktop.noFocusedWindow'));
				return;
			}
			setLastSentObservationSummary(summarizeObservationForUser(obs));
			setObservationJson(JSON.stringify(obs, null, 2));
			await sendTurnWithObservation(obs);
		} catch (e) {
			error(
				`${t('ewaDesktop.desktopShellLoadError')}: ${orchTurnErrorMessage(e)}`
			);
		} finally {
			setShellBusy(false);
		}
	};

	const handleNewSession = () => {
		stopSse();
		const next =
			typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		onSessionIdChange(next);
		setLastResponseJson(null);
		setLastEnvelope(null);
		setLastIntentKind(null);
		setSseLog('');
		sseAccumRef.current = '';
		setConsumerTimelineRows([]);
		setLastSentObservationSummary(null);
		setLastOutcome(null);
		setPersistWarning(false);
	};

	const handlePrefillIntentFailedFromLastTurn = () => {
		const ik = (lastIntentKind ?? 'noop').trim() || 'noop';
		setObservationJson(
			JSON.stringify(
				{
					observation_kind: 'intent_execution_failed',
					intent_kind: ik,
					reason: 'operator_simulated',
					detail: {},
				},
				null,
				2
			)
		);
	};

	const finalizeSseTimelineFromAccum = () => {
		setConsumerTimelineRows(timelineRowsFromSseLogText(sseAccumRef.current));
	};

	const handleSseSnapshot = async () => {
		const sid = sessionId.trim();
		if (!sid) {
			error(t('ewaDesktop.sessionRequiredForHistory'));
			return;
		}
		stopSse();
		setSseBusy(true);
		sseAccumRef.current = '';
		setSseLog('');
		try {
			await consumeDesktopOrchestrationSessionSse({
				sessionId: sid,
				follow: false,
				onDataLine: (line) => {
					sseAccumRef.current = trimSseLog(sseAccumRef.current, line);
					setSseLog(sseAccumRef.current);
				},
			});
			finalizeSseTimelineFromAccum();
		} catch (e) {
			error(
				`${t('ewaDesktop.historyLoadErrorPrefix')}: ${orchTurnErrorMessage(e)}`
			);
		} finally {
			setSseBusy(false);
		}
	};

	const handleSseLiveToggle = async () => {
		const sid = sessionId.trim();
		if (!sid) {
			error(t('ewaDesktop.sessionRequiredForHistory'));
			return;
		}
		if (sseLive) {
			stopSse();
			finalizeSseTimelineFromAccum();
			return;
		}
		stopSse();
		const ac = new AbortController();
		sseAbortRef.current = ac;
		setSseLive(true);
		sseAccumRef.current = '';
		setSseLog('');
		try {
			await consumeDesktopOrchestrationSessionSse({
				sessionId: sid,
				follow: true,
				signal: ac.signal,
				onDataLine: (line) => {
					sseAccumRef.current = trimSseLog(sseAccumRef.current, line);
					setSseLog(sseAccumRef.current);
				},
			});
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') {
				finalizeSseTimelineFromAccum();
				return;
			}
			error(
				`${t('ewaDesktop.historyLoadErrorPrefix')}: ${orchTurnErrorMessage(e)}`
			);
		} finally {
			setSseLive(false);
			sseAbortRef.current = null;
			finalizeSseTimelineFromAccum();
		}
	};

	const handleFillWindowsFromShell = async () => {
		setShellBusy(true);
		try {
			const { state: shell } = await getDesktopShellState();
			const obs = buildWindowListObservationFromShellState(shell);
			setObservationJson(JSON.stringify(obs, null, 2));
		} catch (e) {
			error(
				`${t('ewaDesktop.desktopShellLoadError')}: ${orchTurnErrorMessage(e)}`
			);
		} finally {
			setShellBusy(false);
		}
	};

	const handleFillFocusFromShell = async () => {
		setShellBusy(true);
		try {
			const { state: shell } = await getDesktopShellState();
			const obs = buildActiveAppObservationFromShellState(shell);
			if (!obs) {
				error(t('ewaDesktop.noFocusedWindow'));
				return;
			}
			setObservationJson(JSON.stringify(obs, null, 2));
		} catch (e) {
			error(
				`${t('ewaDesktop.desktopShellLoadError')}: ${orchTurnErrorMessage(e)}`
			);
		} finally {
			setShellBusy(false);
		}
	};

	const copySupportRef = async () => {
		const sid = sessionId.trim();
		if (!sid) return;
		try {
			await navigator.clipboard?.writeText(sid);
			success(t('ewaDesktop.supportRefCopied'));
		} catch (err) {
			ewaCompanionDegradeDebug(
				'ewa_desktop_support_ref_copy',
				'clipboard write for support ref failed',
				err
			);
			error(t('ewaDesktop.supportRefCopyFailed'));
		}
	};

	return (
		<div className="flex h-full min-h-0 flex-col gap-4">
			<div className="shrink-0 space-y-2">
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'text-(--desktop-text-secondary)'
					)}
				>
					{t('ewaDesktop.consumerIntro')}
				</p>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'text-(--desktop-text-secondary)'
					)}
				>
					{t('ewaDesktop.consumerPersonaHint')}
				</p>
			</div>

			{hidePersonaSection ? null : (
				<EwaDesktopPersonaSection
					personaId={personaId}
					onPersonaIdChange={onPersonaIdChange}
					onStarterSnippetActivate={applyStarterPrompt}
					i18n={i18n}
					t={t}
				/>
			)}

			<div
				className={cn(
					DESKTOP_APP_STYLE_CONTRACT.panel,
					'shrink-0 space-y-3 p-3'
				)}
			>
				<DesktopAppSectionLabel>
					{t('ewaDesktop.consumerActionsSection')}
				</DesktopAppSectionLabel>
				<div className="flex flex-wrap gap-2">
					<DesktopAppButton
						type="button"
						variant="accent"
						size="sm"
						className="gap-2"
						disabled={shellBusy || turn.isPending || !sessionId.trim()}
						onClick={() => void handleConsumerSendFromWorkspace()}
						aria-label={t('ewaDesktop.primarySendAria')}
					>
						{shellBusy || turn.isPending ? (
							<ArrowPathIcon
								className="size-4 motion-safe:animate-spin motion-reduce:animate-none"
								aria-hidden
							/>
						) : null}
						{t('ewaDesktop.primarySendButton')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						disabled={shellBusy || turn.isPending || !sessionId.trim()}
						onClick={() => void handleConsumerSendFocusedWindow()}
						aria-label={t('ewaDesktop.secondaryFocusSendAria')}
					>
						{t('ewaDesktop.secondaryFocusSendButton')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="gap-1"
						onClick={handleNewSession}
						aria-label={t('ewaDesktop.newSessionAria')}
					>
						<ArrowPathIcon className="size-4" aria-hidden />
						{t('ewaDesktop.newSessionButton')}
					</DesktopAppButton>
				</div>

				<details className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated)/40 px-2 py-1.5">
					<summary
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'cursor-pointer select-none text-(--desktop-text-secondary)'
						)}
					>
						{t('ewaDesktop.supportRefToggle')}
					</summary>
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<code
							className={cn(
								'max-w-full truncate rounded px-1.5 py-0.5 font-mono text-[11px]',
								'bg-(--desktop-surface-muted) text-(--desktop-text-primary)'
							)}
							title={sessionId.trim() || undefined}
						>
							{sessionId.trim() || t('ewaDesktop.supportRefEmpty')}
						</code>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="gap-1"
							disabled={!sessionId.trim()}
							onClick={() => void copySupportRef()}
							aria-label={t('ewaDesktop.supportRefCopyAria')}
						>
							<ClipboardDocumentIcon className="size-4" aria-hidden />
							{t('ewaDesktop.supportRefCopyButton')}
						</DesktopAppButton>
					</div>
				</details>
			</div>

			{lastSentObservationSummary ? (
				<div className="shrink-0 space-y-1">
					<DesktopAppSectionLabel>
						{t('ewaDesktop.lastContextSection')}
					</DesktopAppSectionLabel>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-(--desktop-text-primary)'
						)}
					>
						{renderUserFacingLine(t, lastSentObservationSummary)}
					</p>
				</div>
			) : null}

			{lastOutcome ? (
				<div
					className={cn(
						DESKTOP_APP_STYLE_CONTRACT.panel,
						'shrink-0 space-y-2 p-3'
					)}
				>
					<DesktopAppSectionLabel>
						{t('ewaDesktop.outcomeSection')}
					</DesktopAppSectionLabel>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'font-medium text-(--desktop-text-primary)'
						)}
					>
						{renderUserFacingLine(t, lastOutcome.headline)}
					</p>
					{lastOutcome.intentLine ? (
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'text-(--desktop-text-secondary)'
							)}
						>
							{renderUserFacingLine(t, lastOutcome.intentLine)}
						</p>
					) : null}
					{persistWarning ? (
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'text-amber-600 dark:text-amber-400'
							)}
						>
							{t('ewaDesktop.persistenceEphemeralHint')}
						</p>
					) : null}
				</div>
			) : (
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'shrink-0 text-(--desktop-text-secondary)'
					)}
				>
					{t('ewaDesktop.emptyOutcomeHint')}
				</p>
			)}

			<div className="flex min-h-0 flex-1 flex-col gap-2">
				<DesktopAppSectionLabel>
					{t('ewaDesktop.timelineSection')}
				</DesktopAppSectionLabel>
				<div className="flex flex-wrap gap-1">
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="text-xs"
						disabled={sseBusy || sseLive || !sessionId.trim()}
						onClick={() => void handleSseSnapshot()}
						aria-label={t('ewaDesktop.historyLoadOnceAria')}
					>
						{sseBusy ? (
							<ArrowPathIcon
								className="mr-1 inline size-3 motion-safe:animate-spin motion-reduce:animate-none"
								aria-hidden
							/>
						) : null}
						{t('ewaDesktop.historyLoadOnceButton')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="text-xs"
						disabled={sseBusy || !sessionId.trim()}
						onClick={() => void handleSseLiveToggle()}
						aria-label={
							sseLive
								? t('ewaDesktop.historyLiveStopAria')
								: t('ewaDesktop.historyLiveStartAria')
						}
					>
						{sseLive
							? t('ewaDesktop.historyLiveStopButton')
							: t('ewaDesktop.historyLiveStartButton')}
					</DesktopAppButton>
				</div>
				{consumerTimelineRows.length ? (
					<ul
						className={cn(
							DESKTOP_APP_STYLE_CONTRACT.panel,
							'max-h-[min(45vh,22rem)] list-disc space-y-1.5 overflow-auto py-2 ps-5 pe-3 text-[11px] leading-snug text-(--desktop-text-primary)'
						)}
					>
						{consumerTimelineRows.map((row) => (
							<li key={row.id}>{renderTimelineRowText(t, row)}</li>
						))}
					</ul>
				) : (
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-(--desktop-text-secondary)'
						)}
					>
						{t('ewaDesktop.timelineEmptyHint')}
					</p>
				)}
			</div>

			<div className="shrink-0 border-t border-(--desktop-border-subtle) pt-3">
				<label className="flex cursor-pointer items-center gap-2 text-xs text-(--desktop-text-secondary)">
					<input
						type="checkbox"
						className={DESKTOP_CHROME_FOCUS_VISIBLE}
						checked={showAdvanced}
						onChange={(e) => setAdvancedPersisted(e.target.checked)}
						aria-label={t('ewaDesktop.advancedToggleAria')}
					/>
					<span>{t('ewaDesktop.advancedToggleLabel')}</span>
				</label>
				{showAdvanced ? (
					<EwaDesktopAdvancedDebugPanel
						t={t}
						sessionId={sessionId}
						onSessionIdChange={onSessionIdChange}
						turnIsPending={turn.isPending}
						shellBusy={shellBusy}
						hintsBusy={hintsBusy}
						sseBusy={sseBusy}
						sseLive={sseLive}
						sseLog={sseLog}
						lastResponseJson={lastResponseJson}
						lastEnvelope={lastEnvelope}
						observationJson={observationJson}
						setObservationJson={setObservationJson}
						hintsJson={hintsJson}
						setHintsJson={setHintsJson}
						hintDocCount={hintDocCount}
						setHintDocCount={setHintDocCount}
						hintDocId={hintDocId}
						setHintDocId={setHintDocId}
						hintContentRoot={hintContentRoot}
						setHintContentRoot={setHintContentRoot}
						observationBuilderKind={observationBuilderKind}
						setObservationBuilderKind={setObservationBuilderKind}
						builderAppComponent={builderAppComponent}
						setBuilderAppComponent={setBuilderAppComponent}
						builderWindowId={builderWindowId}
						setBuilderWindowId={setBuilderWindowId}
						builderReason={builderReason}
						setBuilderReason={setBuilderReason}
						builderIntentKind={builderIntentKind}
						setBuilderIntentKind={setBuilderIntentKind}
						onApplyPreset={applyPreset}
						onApplyHintsBuilder={handleApplyHintsBuilder}
						onLoadShellHints={handleLoadShellHints}
						onSaveShellHints={handleSaveShellHints}
						onApplyObservationBuilder={handleApplyObservationBuilder}
						onFillWindowsFromShell={handleFillWindowsFromShell}
						onFillFocusFromShell={handleFillFocusFromShell}
						onPrefillIntentFailedFromLastTurn={
							handlePrefillIntentFailedFromLastTurn
						}
						onSendTurn={handleSendTurn}
						onSseSnapshot={handleSseSnapshot}
						onSseLiveToggle={handleSseLiveToggle}
					/>
				) : null}
			</div>
		</div>
	);
}
