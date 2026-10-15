/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * SSE event handler factory for Desktop AI Chat stream (ensemble, tools, done,
 * document replace) — extracted from runStream for atomization.
 *
 * Invariants:
 * - Mutates runState acc/currentAsstId/stagedReplacement in place; stale() short-circuits.
 *
 * Related:
 * - hooks/desktopAiChatStream/useDesktopAiChatStreamRun.ts
 * - api/desktopChatClient.ts streamDesktopAiChat
 * - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
 */
import type { TFunction } from 'i18next';
import type * as React from 'react';
import type { DesktopAiMessage } from '../../api/desktopChatClient';
import type {
	DesktopCouncilTurnSsePayload,
	DesktopEnsembleCouncilUiState,
	DesktopEnsemblePlanPayload,
	DesktopEnsembleSpeakerStartPayload,
} from '../../ensemble';
import {
	applyDesktopAiDocumentReplacement,
	normalizeDesktopCouncilTranscript,
} from '../../desktopChatDocumentReplacement';
import { extractDoneStreamContext } from '../../desktopChatSsePayload';
import { getDesktopAiHero } from '../../desktopAiHeroes';
import {
	webSearchSourcesFromDonePayload,
	type DesktopAiWebSearchSource,
} from '../../desktopWebSearchSources';
import type { DesktopAiChatTokenBatch } from '../../desktopAiChatTokenBatch';
import { markDesktopAiChatStreamDone } from '../useDesktopAiChatStreamMetrics';
import { formatToolsTraceSummary } from './helpers';
import type {
	DesktopAiChatStreamRefs,
	RunStreamOptions,
	StreamRunMutableState,
} from './types';
export type DesktopAiChatStreamEventHandlerDeps = {
	stale: () => boolean;
	opts: RunStreamOptions;
	runState: StreamRunMutableState;
	tokenBatch: DesktopAiChatTokenBatch;
	flushTokenPaint: () => void;
	refs: Pick<
		DesktopAiChatStreamRefs,
		'pendingContextRef' | 'ensembleDeliveryModeRef' | 'ensembleJointBubbleIdRef'
	>;
	setSending: React.Dispatch<React.SetStateAction<boolean>>;
	setComposerHint: React.Dispatch<React.SetStateAction<string | null>>;
	setEnsembleDocConfirm: React.Dispatch<
		React.SetStateAction<{ userMessageId: string; reason: string } | null>
	>;
	setEnsembleCouncilUi: React.Dispatch<
		React.SetStateAction<DesktopEnsembleCouncilUiState | null>
	>;
	setMessages: React.Dispatch<React.SetStateAction<DesktopAiMessage[]>>;
	setToolsHistory: React.Dispatch<
		React.SetStateAction<
			Array<{
				at: number;
				summary: string;
				sources: DesktopAiWebSearchSource[];
			}>
		>
	>;
	setWebSearchSourcesByMessageId: React.Dispatch<
		React.SetStateAction<Record<string, DesktopAiWebSearchSource[]>>
	>;
	t: TFunction<'desktopAiChat'>;
};

export function createDesktopAiChatStreamEventHandler(
	deps: DesktopAiChatStreamEventHandlerDeps
): (ev: string, payload: unknown) => void {
	const {
		stale,
		opts,
		runState,
		tokenBatch,
		flushTokenPaint,
		refs,
		setSending,
		setComposerHint,
		setEnsembleDocConfirm,
		setEnsembleCouncilUi,
		setMessages,
		setToolsHistory,
		setWebSearchSourcesByMessageId,
		t,
	} = deps;
	const {
		pendingContextRef,
		ensembleDeliveryModeRef,
		ensembleJointBubbleIdRef,
	} = refs;

	return (ev, payload) => {
		if (stale()) {
			tokenBatch.cancel();
			return;
		}
		if (ev === 'error') {
			flushTokenPaint();
			tokenBatch.cancel();
			runState.stagedReplacement = null;
			setSending(false);
			setComposerHint(null);
			if (opts.isEnsemble) {
				setEnsembleCouncilUi(null);
				ensembleJointBubbleIdRef.current = null;
				ensembleDeliveryModeRef.current = 'separate';
			}
		}
		if (ev === 'planning') {
			const det =
				payload &&
				typeof payload === 'object' &&
				'detail' in payload &&
				typeof (payload as { detail?: unknown }).detail === 'string'
					? String((payload as { detail: string }).detail).trim()
					: '';
			setComposerHint(
				det === 'blueprint_template'
					? t('hintPlanningBlueprint')
					: t('hintPlanningOrder')
			);
		}
		if (
			ev === 'ensemble_document_confirm' &&
			opts.isEnsemble &&
			!opts.documentConfirm &&
			payload &&
			typeof payload === 'object'
		) {
			const uid = (payload as { user_message_id?: unknown }).user_message_id;
			const reason = (payload as { reason?: unknown }).reason;
			if (typeof uid === 'string' && uid.trim()) {
				setEnsembleDocConfirm({
					userMessageId: uid.trim(),
					reason: typeof reason === 'string' ? reason : '',
				});
			}
		}
		if (
			ev === 'ensemble_plan' &&
			opts.isEnsemble &&
			payload &&
			typeof payload === 'object'
		) {
			const p = payload as DesktopEnsemblePlanPayload;
			const sp = Array.isArray(p.speakers)
				? p.speakers.filter((x): x is string => typeof x === 'string')
				: [];
			const hl = Array.isArray(p.huddle_lines)
				? p.huddle_lines
						.filter((x): x is string => typeof x === 'string')
						.slice(0, 6)
				: [];
			const reason = typeof p.reason === 'string' ? p.reason.trim() : '';
			const rosterSize =
				typeof p.roster_size === 'number' && Number.isFinite(p.roster_size)
					? p.roster_size
					: sp.length;
			const maxSp =
				typeof p.max_speakers_this_turn === 'number' &&
				Number.isFinite(p.max_speakers_this_turn)
					? p.max_speakers_this_turn
					: sp.length;
			const dm = p.delivery_mode === 'joint' ? 'joint' : 'separate';
			ensembleDeliveryModeRef.current = dm;
			ensembleJointBubbleIdRef.current = null;
			const planTitle =
				typeof p.plan_template_title === 'string'
					? p.plan_template_title.trim()
					: '';
			const prevSteps = Array.isArray(p.steps_preview)
				? p.steps_preview
				: undefined;
			const tb = Array.isArray(p.task_blocks) ? p.task_blocks : undefined;
			const deferred = Array.isArray(p.deferred_plan_templates)
				? p.deferred_plan_templates
				: undefined;
			setEnsembleCouncilUi({
				phase: 'deliberating',
				speakers: sp,
				reason,
				huddle_lines: hl,
				roster_size: rosterSize,
				max_speakers_this_turn: maxSp,
				blueprint: p.blueprint === true,
				plan_template_title: planTitle || undefined,
				artifact_type:
					typeof p.artifact_type === 'string' ? p.artifact_type : undefined,
				quality_status:
					p.quality_status && typeof p.quality_status === 'object'
						? p.quality_status
						: undefined,
				document_outline: Array.isArray(p.document_outline)
					? p.document_outline
					: undefined,
				steps_preview: prevSteps,
				task_blocks: tb,
				deferred_plan_templates: deferred,
			});
			if (runState.currentAsstId && sp.length > 0) {
				const targetId = runState.currentAsstId;
				setMessages((rows) =>
					rows.map((row) => {
						if (row.id !== targetId) return row;
						const prev = row.metadata?.council_transcript;
						return {
							...row,
							metadata: {
								...row.metadata,
								council_transcript: {
									version: prev?.version ?? 1,
									mode: prev?.mode ?? 'joint_document',
									roster: sp,
									turns: prev?.turns ?? [],
									closing: prev?.closing ?? null,
								},
							},
						};
					})
				);
			}
			setComposerHint(null);
		}
		if (
			ev === 'council_turn' &&
			opts.isEnsemble &&
			payload &&
			typeof payload === 'object' &&
			runState.currentAsstId
		) {
			const p = payload as DesktopCouncilTurnSsePayload;
			const turn = p.turn;
			if (turn && typeof turn.text === 'string' && turn.text.trim()) {
				const targetId = runState.currentAsstId;
				const mode =
					p.mode === 'discussion' || p.mode === 'joint_document'
						? p.mode
						: 'joint_document';
				const rosterFromEvent = Array.isArray(p.roster)
					? p.roster.filter(
							(x): x is string => typeof x === 'string' && x.trim().length > 0
						)
					: [];
				setMessages((rows) =>
					rows.map((row) => {
						if (row.id !== targetId) return row;
						const prev = row.metadata?.council_transcript;
						const turns = [...(prev?.turns ?? []), turn];
						const roster =
							rosterFromEvent.length > 0
								? rosterFromEvent
								: prev?.roster && prev.roster.length > 0
									? prev.roster
									: [];
						return {
							...row,
							metadata: {
								...row.metadata,
								council_transcript: {
									version:
										typeof p.transcript_version === 'number'
											? p.transcript_version
											: (prev?.version ?? 1),
									mode,
									roster,
									turns,
									closing:
										p.closing && typeof p.closing === 'object'
											? p.closing
											: (prev?.closing ?? null),
								},
							},
						};
					})
				);
			}
		}
		if (
			ev === 'ensemble_chair_done' &&
			opts.isEnsemble &&
			payload &&
			typeof payload === 'object'
		) {
			const prev = (payload as { preview?: string }).preview;
			if (typeof prev === 'string' && prev.trim()) {
				const short = prev.length > 140 ? `${prev.slice(0, 140)}…` : prev;
				setComposerHint(t('hintEnsembleChair', { preview: short }));
			}
		}
		if (ev === 'ensemble_joint_polish_start' && opts.isEnsemble) {
			setComposerHint(t('hintEnsemblePolish'));
		}
		if (ev === 'ensemble_joint_polish_done' && opts.isEnsemble) {
			setComposerHint(null);
		}
		if (ev === 'ensemble_action_start' && opts.isEnsemble && payload) {
			const total =
				typeof (payload as { total?: unknown }).total === 'number'
					? (payload as { total: number }).total
					: 0;
			setComposerHint(t('hintEnsembleActionsStart', { count: total || 1 }));
		}
		if (ev === 'ensemble_action_progress' && opts.isEnsemble && payload) {
			const p = payload as {
				kind?: string;
				index?: number;
				total?: number;
				status?: string;
			};
			const kind = typeof p.kind === 'string' ? p.kind : 'probe';
			const index = typeof p.index === 'number' ? p.index : 0;
			const total = typeof p.total === 'number' ? p.total : 0;
			setComposerHint(
				t('hintEnsembleActionsProgress', {
					kind,
					index,
					total: total || index || 1,
				})
			);
		}
		if (ev === 'ensemble_action_done' && opts.isEnsemble) {
			const ran = (payload as { ran?: unknown } | null)?.ran === true;
			const skipped = String(
				(payload as { skipped_reason?: unknown } | null)?.skipped_reason || ''
			);
			if (ran) {
				setComposerHint(t('hintEnsembleActionsDone'));
			} else if (skipped && skipped !== 'not_in_scope') {
				setComposerHint(t('hintEnsembleActionsSkipped'));
			} else {
				setComposerHint(null);
			}
		}
		if (
			ev === 'assistant_document_replace' &&
			opts.isEnsemble &&
			runState.currentAsstId &&
			payload &&
			typeof payload === 'object'
		) {
			const replacement = payload as Parameters<
				typeof applyDesktopAiDocumentReplacement
			>[2];
			const finalizedContent =
				typeof replacement.content === 'string' && replacement.content.trim()
					? replacement.content
					: null;
			if (finalizedContent) {
				flushTokenPaint();
				runState.acc = finalizedContent;
				runState.stagedReplacement = replacement;
				const targetMessageId = runState.currentAsstId;
				setMessages(
					(rows) =>
						applyDesktopAiDocumentReplacement(
							rows,
							targetMessageId,
							replacement,
							{ mode: 'stage' }
						).messages
				);
				setComposerHint(t('hintEnsembleFinalized'));
			}
		}
		if (ev === 'done' && opts.isEnsemble) {
			const fullCt = normalizeDesktopCouncilTranscript(
				(payload as { council_transcript?: unknown } | null)?.council_transcript
			);
			if (fullCt && runState.currentAsstId) {
				const targetId = runState.currentAsstId;
				setMessages((rows) =>
					rows.map((row) =>
						row.id === targetId
							? {
									...row,
									metadata: {
										...row.metadata,
										council_transcript: fullCt,
									},
								}
							: row
					)
				);
			}
			setEnsembleCouncilUi(null);
			ensembleJointBubbleIdRef.current = null;
			ensembleDeliveryModeRef.current = 'separate';
		}
		if (ev === 'speaker_start' && opts.isEnsemble) {
			flushTokenPaint();
			const p = payload as DesktopEnsembleSpeakerStartPayload;
			const hid =
				typeof p.desktop_hero_id === 'string' ? p.desktop_hero_id : undefined;
			const speakerLabel = hid
				? (getDesktopAiHero(hid)?.shortLabel ?? hid)
				: t('participantLabel');
			const isJointTurn =
				p.delivery_mode === 'joint' ||
				ensembleDeliveryModeRef.current === 'joint';
			const jointBubbleId = ensembleJointBubbleIdRef.current;
			const reuseJointBubble = isJointTurn && jointBubbleId;
			if (reuseJointBubble) {
				runState.currentAsstId = jointBubbleId;
				setComposerHint(t('hintSection', { speaker: speakerLabel }));
				if (jointBubbleId) {
					setMessages((rows) =>
						rows.map((row) =>
							row.id === jointBubbleId
								? {
										...row,
										metadata: {
											...row.metadata,
											...(hid ? { desktop_hero_id: hid } : {}),
											desktop_ensemble_joint: true,
										},
									}
								: row
						)
					);
				}
			} else {
				setComposerHint(t('hintWriting', { speaker: speakerLabel }));
			}
			setEnsembleCouncilUi((prev) =>
				prev
					? {
							...prev,
							phase: 'speaking',
							...(hid ? { active_speaker_id: hid } : {}),
						}
					: prev
			);
			if (!reuseJointBubble) {
				const newId = `local-a-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
				runState.currentAsstId = newId;
				if (isJointTurn) {
					ensembleJointBubbleIdRef.current = newId;
				}
				setMessages((m) => [
					...m,
					{
						id: newId,
						role: 'assistant',
						content: '',
						metadata: hid ? { desktop_hero_id: hid } : {},
						created_at: new Date().toISOString(),
					},
				]);
			}
		}
		if (ev === 'tools_progress' && payload && typeof payload === 'object') {
			const ugs = (payload as { ugs?: Record<string, unknown> }).ugs;
			if (ugs && typeof ugs === 'object') {
				const pm = ugs.progress_message;
				const st = ugs.stage ?? ugs.status;
				const line =
					typeof pm === 'string' && pm.trim()
						? pm.trim()
						: typeof st === 'string' && st.trim()
							? String(st)
							: '';
				if (line) {
					setComposerHint(t('hintUgsLine', { line }));
				}
			}
		}
		if (ev === 'tools' && payload) {
			const { summary, sources } = formatToolsTraceSummary(payload, t);
			setToolsHistory((h) =>
				[{ at: Date.now(), summary, sources }, ...h].slice(0, 6)
			);
			setComposerHint(t('hintToolsRunning'));
		}
		if (ev === 'done' && payload && typeof payload === 'object') {
			flushTokenPaint();
			markDesktopAiChatStreamDone();
			pendingContextRef.current = extractDoneStreamContext(payload);
			const doneSources = webSearchSourcesFromDonePayload(payload);
			if (doneSources.length > 0 && runState.currentAsstId) {
				setWebSearchSourcesByMessageId((prev) => ({
					...prev,
					[runState.currentAsstId as string]: doneSources,
				}));
			}
		}
	};
}
