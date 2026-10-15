/**
 * Unified Voice Core (Stack9) - shared types and entrypoint.
 */

export {
	DEFAULT_VOICE_SETTINGS,
	LIVE_VOICE_HISTORY_UPDATED_EVENT,
	LIVE_VOICE_SETTINGS_SAVED_EVENT,
	VOICE_SETTINGS_CHANGED_EVENT,
	VOICE_SETTINGS_STORAGE_KEY,
	apiToVoiceSettings,
	broadcastVoiceSettingsChanged,
	toVoiceError,
	voiceSettingsToApi,
} from './types';
export type { VoiceSettingsChangedDetail } from './types';
export type {
	PipelineStage,
	ProcessAudioRequest,
	ProcessAudioResponse,
	SynthesizeRequest,
	SynthesizeResult,
	TranscriptionResult,
	TranscriptionSegment,
	VoiceError,
	VoiceSessionState,
	VoiceSettings,
	VoiceSettingsApi,
} from './types';

export {
	VoiceSettingsProvider,
	useVoiceSettings,
	useVoiceSettingsOptional,
} from './VoiceSettingsContext';
export type { VoiceSettingsContextValue } from './VoiceSettingsContext';

export {
	getMicActive,
	MIC_ACTIVE_CHANGE_EVENT,
	registerMicActive,
	registerTtsPlaying,
	subscribeToMicActive,
} from './micActive';
export {
	useAudioPlayback,
	useMicRecorder,
	useUnifiedVoiceSession,
} from './hooks';
export type {
	UseAudioPlaybackReturn,
	UseMicRecorderOptions,
	UseMicRecorderReturn,
	UseUnifiedVoiceSessionOptions,
	UseUnifiedVoiceSessionReturn,
} from './hooks';
export { synthesize, transcribe, processTextToVoice } from './api';
export { resolveAudioUrlForPlayback } from './utils/resolveAudioUrlForPlayback';
export type {
	SynthesizeOptions,
	TextToVoiceResponse,
	TextToVoiceSettings,
	TranscribeOptions,
} from './api';
