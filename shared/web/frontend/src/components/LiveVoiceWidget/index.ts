/**
 * LiveVoiceWidget - Экспорты компонентов
 */

export { LiveVoiceWidget } from './LiveVoiceWidget';
export { WidgetMinimized } from './WidgetMinimized';
export { WidgetExpanded } from './WidgetExpanded';
export { RecordingButton } from './RecordingButton';
export { VoiceSettings } from './VoiceSettings';
export { ConversationHistory } from './ConversationHistory';
export { PipelineStatus } from './PipelineStatus';
export { TextToVoicePanel } from './TextToVoicePanel';
export { useLiveVoice } from './hooks/useLiveVoice';
export { useTextToVoice } from './hooks/useTextToVoice';
export { designTokens } from './designTokens';

export type {
	PipelineStage,
	UseLiveVoiceReturn,
	UseLiveVoiceOptions,
} from './hooks/useLiveVoice';

// Re-export default export from LiveVoiceWidget
export { default } from './LiveVoiceWidget';
