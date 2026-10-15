/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared types for VoiceTranscriptionPanel atomization (modes, recordings, synth audio).
 *
 * Invariants:
 * - VoiceTranscriptionPanelProps stays in editor.types; re-exported from facade only.
 *
 * Related:
 * - useVoiceTranscriptionPanel.ts, VoiceTranscriptionPanel.tsx
 */

export type ProcessingMode = 'record' | 'upload' | 'synthesize';

export type VoiceModel = 'silero';

export type Language = 'ru' | 'en' | 'es' | 'fr' | 'de';

export interface VoiceRecording {
	id: string;
	blob: Blob;
	duration: number;
	timestamp: Date;
	transcription?: string;
}

export interface SynthesizedAudio {
	id: string;
	text: string;
	audioUrl: string;
	duration: number;
	voice: string;
	language: Language;
	timestamp: Date;
}

export interface VoiceModelOption {
	id: VoiceModel;
	name: string;
	description: string;
	gpu: boolean;
}

export interface LanguageOption {
	code: Language;
	name: string;
	flag: string;
}
