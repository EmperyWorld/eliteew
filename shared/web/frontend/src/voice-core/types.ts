/**
 * Shared voice domain types for Unified Voice Core (Stack9).
 * Single source of truth for settings, session state, transcription, synthesis, and errors.
 */

import voiceContract from '@/data/qwen3_tts_voice_contract.json';

// =============================================================================
// Settings (frontend + API contract)
// =============================================================================

export interface VoiceSettings {
	voice: string;
	language: string;
	llamaModel: string;
	whisperModel: string;
	speed: number;
	volume: number;
	enableArlekina: boolean;
}

/** Backend API shape for GET/PUT settings (snake_case). */
export interface VoiceSettingsApi {
	tts_voice?: string;
	language?: string;
	llama_model?: string;
	whisper_model?: string;
	tts_speed?: number;
	tts_volume?: number;
	enable_arlekina?: boolean;
}

/** Single localStorage key for voice settings (unified). */
export const VOICE_SETTINGS_STORAGE_KEY = 'eliteew_voice_settings';

/** Custom event name for settings change broadcast (use with window.addEventListener). */
export const VOICE_SETTINGS_CHANGED_EVENT = 'eliteew_voice_settings_changed';

/** Dispatched after settings are successfully saved to server; Live Voice WebSocket should reload. */
export const LIVE_VOICE_SETTINGS_SAVED_EVENT = 'liveVoiceSettingsSaved';

/** Dispatched when a live-voice pipeline completes; backend saves to history, ConversationHistory can refetch. */
export const LIVE_VOICE_HISTORY_UPDATED_EVENT = 'liveVoiceHistoryUpdated';

export interface VoiceSettingsChangedDetail {
	settings: VoiceSettings;
}

/** Dispatch a settings-changed event so other tabs/components can sync without polling. */
export function broadcastVoiceSettingsChanged(settings: VoiceSettings): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(
		new CustomEvent<VoiceSettingsChangedDetail>(VOICE_SETTINGS_CHANGED_EVENT, {
			detail: { settings },
		})
	);
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
	voice: voiceContract.default_profile || 'companion_ewa',
	language: 'ru',
	llamaModel: '',
	whisperModel: 'large-v3',
	speed: 1.0,
	volume: 1.0,
	enableArlekina: true,
};

// =============================================================================
// Session state (pipeline stages)
// =============================================================================

export type PipelineStage =
	| 'idle'
	| 'recording'
	| 'transcribing'
	| 'generating'
	| 'synthesizing'
	| 'playing'
	| 'completed'
	| 'error';

export interface VoiceSessionState {
	stage: PipelineStage;
	progress: number;
	transcription: string | null;
	aiResponse: string | null;
	audioUrl: string | null;
	error: VoiceError | null;
}

// =============================================================================
// Transcription (STT)
// =============================================================================

export interface TranscriptionSegment {
	text: string;
	start: number;
	end: number;
	confidence?: number;
}

export interface TranscriptionResult {
	text: string;
	language: string;
	duration_ms: number;
	confidence: number;
	segments: TranscriptionSegment[];
	audio_duration_sec?: number;
	file_size_bytes?: number;
	format?: string;
	timestamp?: string;
}

// =============================================================================
// Synthesis (TTS)
// =============================================================================

export interface SynthesizeRequest {
	text: string;
	voice?: string;
	speed?: number;
	volume?: number;
	language?: string;
}

export interface SynthesizeResult {
	audio_url: string;
	duration_ms?: number;
	duration?: number;
	voice?: string;
}

// =============================================================================
// Full pipeline (process: record → transcribe → LLM → TTS)
// =============================================================================

export interface ProcessAudioRequest {
	audio_base64?: string;
	file?: File;
	session_id?: string;
	language?: string;
	whisper_model?: string;
	llama_model?: string;
	tts_voice?: string;
	tts_speed?: number;
	tts_volume?: number;
	enable_arlekina?: boolean;
}

export interface ProcessAudioResponse {
	transcription: string;
	llm_response: string;
	audio_url: string;
	duration_ms: number;
	task_id?: string;
	stages?: {
		transcription?: { duration_ms: number };
		llm?: { duration_ms: number };
		tts?: { duration_ms: number };
	};
}

// =============================================================================
// Errors
// =============================================================================

export interface VoiceError {
	code: string;
	message: string;
	details?: unknown;
}

export function toVoiceError(err: unknown): VoiceError {
	if (
		err &&
		typeof err === 'object' &&
		'message' in err &&
		typeof (err as { message: unknown }).message === 'string'
	) {
		const e = err as { message: string; code?: string; details?: unknown };
		return {
			code: e.code ?? 'VOICE_ERROR',
			message: e.message,
			details: e.details,
		};
	}
	return {
		code: 'VOICE_ERROR',
		message: err instanceof Error ? err.message : String(err),
	};
}

// =============================================================================
// Helpers: settings <-> API
// =============================================================================

export function voiceSettingsToApi(s: VoiceSettings): VoiceSettingsApi {
	return {
		tts_voice: s.voice,
		language: s.language,
		llama_model: s.llamaModel,
		whisper_model: s.whisperModel,
		tts_speed: s.speed,
		tts_volume: s.volume,
		enable_arlekina: s.enableArlekina,
	};
}

export function apiToVoiceSettings(
	api: VoiceSettingsApi,
	defaults: VoiceSettings = DEFAULT_VOICE_SETTINGS
): VoiceSettings {
	return {
		voice: typeof api.tts_voice === 'string' ? api.tts_voice : defaults.voice,
		language:
			typeof api.language === 'string' ? api.language : defaults.language,
		llamaModel:
			typeof api.llama_model === 'string'
				? api.llama_model
				: defaults.llamaModel,
		whisperModel:
			typeof api.whisper_model === 'string'
				? api.whisper_model
				: defaults.whisperModel,
		speed: typeof api.tts_speed === 'number' ? api.tts_speed : defaults.speed,
		volume:
			typeof api.tts_volume === 'number' ? api.tts_volume : defaults.volume,
		enableArlekina:
			typeof api.enable_arlekina === 'boolean'
				? api.enable_arlekina
				: defaults.enableArlekina,
	};
}
