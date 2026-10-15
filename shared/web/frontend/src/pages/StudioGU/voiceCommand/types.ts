/**
 * Voice Command Center – shared types.
 */

export interface VoiceMessage {
	id: string;
	type: 'user' | 'assistant' | 'system' | 'command';
	text: string;
	timestamp: Date;
	audioUrl?: string;
	command?: string;
	status?: 'success' | 'error' | 'pending';
}

export interface ServiceStatus {
	whisper: boolean;
	llama: boolean;
	tts: boolean;
}

export interface VoiceCenterUIPrefs {
	soundFeedback: boolean;
	autoListen: boolean;
	websocketMode: boolean;
	pushToTalk: boolean;
}

export interface DisambiguateState {
	transcript: string;
	intent: string;
	candidates: string[];
}

/** Синхронизация UI штаба после изменения prefs из commandExecutor (фон + окно). */
export const VOICE_CENTER_UI_SYNC_EVENT = 'eliteew-voice-center-ui-sync';

export const VOICE_CENTER_UI_STORAGE_KEY = 'voice_command_center_ui';
export const HISTORY_STORAGE_KEY = 'voice_command_center_history';
export const MAX_PERSISTED_HISTORY = 20;
export const VOICE_HOTKEY = 'Space';
