/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * SSE and local UI contracts for Desktop AI Chat ensemble turns.
 *
 * Invariants:
 * - Blueprint metadata remains serializable and safe to persist with assistant messages.
 *
 * Related:
 * - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
 */
/** Типы SSE и сообщений для режима «Команда» (ensemble). */

/** Wave F1: one turn in the persisted council mini-chat. */
export type DesktopCouncilTurnKind =
	| 'orchestrator_brief'
	| 'speaker_reply'
	| 'closing';

export type DesktopCouncilTurn = {
	kind: DesktopCouncilTurnKind;
	text: string;
	at_ms: number;
	hero_id?: string;
	label?: string;
	index?: number;
};

export type DesktopCouncilTranscript = {
	version: number;
	mode: 'joint_document' | 'discussion';
	roster: string[];
	turns: DesktopCouncilTurn[];
	closing?: { decision?: string; notes?: string } | null;
};

/** SSE `council_turn` — live append toward Process tab (Wave F2). */
export type DesktopCouncilTurnSsePayload = {
	event?: string;
	turn?: DesktopCouncilTurn;
	transcript_version?: number;
	mode?: DesktopCouncilTranscript['mode'];
	turns_count?: number;
	roster?: string[];
	closing?: DesktopCouncilTranscript['closing'];
};

export type DesktopEnsembleSpeakerStartPayload = {
	event?: string;
	desktop_hero_id?: string;
	index?: number;
	/** Режим «один пузырь» — следующие `speaker_start` дополняют тот же локальный message id. */
	delivery_mode?: 'joint' | 'separate';
};

/** Блок раскладки оркестратора (контракт зоны ответа героя). */
export type DesktopEnsembleTaskBlockPayload = {
	id?: string;
	hero_id?: string;
	title?: string;
	objective?: string;
	phase?: string;
};

/** Одна строка предпросмотра шага режима blueprint. */
export type DesktopEnsembleBlueprintStepPreview = {
	step_id?: string;
	title?: string;
	hero_id?: string;
	fallback?: boolean;
};

/** Событие `ensemble_plan`: план оркестратора на один ход (эфемерный UI). */
export type DesktopEnsemblePlanPayload = {
	event?: string;
	/** Режим шаблонного плана (иначе legacy JSON-оркестратор). */
	blueprint?: boolean;
	plan_template_id?: string;
	plan_template_title?: string;
	artifact_type?: string;
	quality_status?: Record<string, unknown>;
	document_outline?: Array<{
		id?: string;
		heading?: string;
		step_ids?: string[];
		subsections?: Array<{ heading?: string; step_id?: string }>;
	}>;
	steps_preview?: DesktopEnsembleBlueprintStepPreview[];
	speakers?: string[];
	delivery_mode?: 'joint' | 'separate';
	reason?: string;
	task_blocks?: DesktopEnsembleTaskBlockPayload[];
	focus?: Array<{ id?: string; brief?: string }>;
	huddle_lines?: string[];
	roster_size?: number;
	max_speakers_this_turn?: number;
	deferred_plan_templates?: Array<{
		plan_template_id?: string;
		title?: string;
		reason?: string;
		score?: string;
	}>;
	roster_coverage?: {
		roster_len?: number;
		steps_active?: number;
		unique_speakers?: number;
	};
};

export type DesktopEnsembleCouncilUiState = {
	phase: 'deliberating' | 'speaking';
	speakers: string[];
	reason: string;
	huddle_lines: string[];
	roster_size: number;
	max_speakers_this_turn: number;
	/** Hero currently writing (set on `speaker_start`); panel stays rich for full stream. */
	active_speaker_id?: string;
	/** Режим blueprint: выбранный шаблон и очередь шагов (до стрима тела). */
	blueprint?: boolean;
	plan_template_title?: string;
	artifact_type?: string;
	quality_status?: Record<string, unknown>;
	document_outline?: Array<{
		id?: string;
		heading?: string;
		step_ids?: string[];
		subsections?: Array<{ heading?: string; step_id?: string }>;
	}>;
	steps_preview?: DesktopEnsembleBlueprintStepPreview[];
	/** Legacy freeform: блоки задач оркестратора (отображаются в панели «Советуются»). */
	task_blocks?: DesktopEnsembleTaskBlockPayload[];
	deferred_plan_templates?: Array<{
		plan_template_id?: string;
		title?: string;
		reason?: string;
		score?: string;
	}>;
};
