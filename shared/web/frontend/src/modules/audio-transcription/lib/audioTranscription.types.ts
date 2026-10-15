export interface TranscriptionSegment {
	readonly text: string;
	readonly start: number;
	readonly end: number;
	readonly confidence?: number;
	readonly speaker?: string;
}

export interface TranscriptionResponse {
	readonly text: string;
	readonly language: string;
	readonly confidence: number;
	readonly segments: readonly TranscriptionSegment[];
	readonly durationMs: number;
	readonly timestamp: string;
	readonly whisperModel: string;
	readonly fileSizeBytes: number;
	readonly format: string;
}

export interface TranscriptionOptions {
	readonly language?: string;
	readonly model?: string;
}

export interface UseAudioTranscriptionResult {
	readonly transcribe: (
		file: File,
		options?: TranscriptionOptions
	) => Promise<void>;
	readonly loading: boolean;
	readonly error: string | null;
	readonly result: TranscriptionResponse | null;
}
