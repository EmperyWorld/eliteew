/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Prompt composer: textarea, voice/send/save controls, voice status meter.
 *
 * Related:
 * - useAIAssistantVoice.ts, useAIAssistantCompose.ts
 */

import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	MicrophoneIcon,
	PaperAirplaneIcon,
	SpeakerXMarkIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import type {
	AIAssistantActionMode,
	AIAssistantContextScope,
	AIGenerationMeta,
} from '@/components/UltimateDocEditor/Panels/aiAssistant/aiAssistantTypes';

type AIAssistantComposerProps = {
	t: TFunction<'docEditorPanels'>;
	footerStripClass: string;
	composerTextareaClass: string;
	prompt: string;
	setPrompt: Dispatch<SetStateAction<string>>;
	setVoiceError: Dispatch<SetStateAction<string | null>>;
	isStreaming: boolean;
	isTranscribing: boolean;
	isRecording: boolean;
	voiceBusy: boolean;
	voiceStatusText: string;
	voiceStatusTone: string;
	voiceMeterRef: RefObject<HTMLDivElement | null>;
	selectedText?: string;
	actionMode: AIAssistantActionMode;
	contextScope: AIAssistantContextScope;
	latestAiMeta: AIGenerationMeta | null;
	onSubmit: () => void;
	onStopStreaming: () => void;
	onVoiceToggle: () => void;
	onSavePrompt: () => void;
};

export function AIAssistantComposer({
	t,
	footerStripClass,
	composerTextareaClass,
	prompt,
	setPrompt,
	setVoiceError,
	isStreaming,
	isTranscribing,
	isRecording,
	voiceBusy,
	voiceStatusText,
	voiceStatusTone,
	voiceMeterRef,
	selectedText,
	actionMode,
	contextScope,
	latestAiMeta,
	onSubmit,
	onStopStreaming,
	onVoiceToggle,
	onSavePrompt,
}: AIAssistantComposerProps) {
	return (
		<div className={cn('shrink-0 px-3 py-2', footerStripClass)}>
			<div className="flex gap-2">
				<textarea
					value={prompt}
					onChange={(e) => {
						setVoiceError(null);
						setPrompt(e.target.value);
					}}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
							e.preventDefault();
							void onSubmit();
						}
					}}
					placeholder={t('ai.composer.placeholder')}
					className={composerTextareaClass}
					rows={2}
					disabled={isStreaming || isTranscribing}
				/>
				<div className="flex flex-col gap-1">
					{isStreaming ? (
						<DesktopAppButton
							onClick={onStopStreaming}
							variant="danger"
							size="sm"
							className="gap-1 px-3 py-1.5 text-xs font-medium"
						>
							{t('ai.composer.stop')}
						</DesktopAppButton>
					) : null}
					<DesktopAppButton
						onClick={() => void onVoiceToggle()}
						disabled={isStreaming}
						variant={voiceBusy ? 'danger' : 'neutral'}
						size="icon"
						className={cn('min-h-11 min-w-11', isRecording && 'animate-pulse')}
						title={
							isTranscribing
								? t('ai.composer.transcribingShort')
								: isRecording
									? t('ai.composer.stopRecording')
									: t('ai.composer.voiceInput')
						}
						aria-label={
							isTranscribing
								? t('ai.composer.transcribingShort')
								: isRecording
									? t('ai.composer.stopRecording')
									: t('ai.composer.voiceInput')
						}
					>
						{isTranscribing ? (
							<ArrowPathIcon width={12} height={12} className="animate-spin" />
						) : isRecording ? (
							<SpeakerXMarkIcon width={12} height={12} />
						) : (
							<MicrophoneIcon
								width={12}
								height={12}
								className="text-(--desktop-text-muted)"
							/>
						)}
					</DesktopAppButton>
					<DesktopAppButton
						onClick={() => void onSubmit()}
						disabled={
							!prompt.trim() || isStreaming || isTranscribing || isRecording
						}
						variant="accent"
						size="sm"
						className="min-h-11 gap-1 px-3 py-2 text-xs font-medium"
					>
						{isStreaming ? (
							<ArrowPathIcon width={12} height={12} className="animate-spin" />
						) : (
							<PaperAirplaneIcon width={12} height={12} />
						)}
						<span>{isStreaming ? '…' : t('ai.composer.sendShort')}</span>
					</DesktopAppButton>
					<DesktopAppButton
						onClick={() => onSavePrompt()}
						disabled={!prompt.trim()}
						variant="neutral"
						size="icon"
						className="min-h-11 min-w-11"
						title={t('ai.savePrompt.confirm')}
						aria-label={t('ai.savePrompt.confirm')}
					>
						<ArrowDownTrayIcon
							width={12}
							height={12}
							className="text-(--desktop-text-muted)"
						/>
					</DesktopAppButton>
				</div>
			</div>
			<div className="mt-1.5 flex items-center justify-between gap-3">
				<p className={`min-w-0 truncate text-[10px] ${voiceStatusTone}`}>
					{voiceStatusText}
				</p>
				{voiceBusy ? (
					<div
						ref={voiceMeterRef}
						className="h-1.5 w-24 overflow-hidden rounded-full bg-(--desktop-surface-app) [--voice-fill:0%]"
					>
						<div
							className={cn(
								'h-full w-(--voice-fill) rounded-full transition-all duration-150',
								isTranscribing
									? 'bg-[rgb(var(--desktop-accent-rgb))]/55'
									: 'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_65%,transparent)]'
							)}
						/>
					</div>
				) : null}
			</div>
			{selectedText && (
				<p className="mt-1 text-[10px] text-(--desktop-text-dim)">
					{t('ai.footer.selectionChars', { count: selectedText.length })}
				</p>
			)}
			{latestAiMeta ? (
				<p className="mt-1 text-[10px] text-(--desktop-text-dim)">
					{t('ai.footer.latestReply', {
						model: latestAiMeta.model ?? 'auto',
						action: t(
							`ai.actionShort.${latestAiMeta.actionMode ?? actionMode}`
						),
						context: t(
							`ai.scopeShort.${latestAiMeta.contextScope ?? contextScope}`
						),
					})}
				</p>
			) : null}
		</div>
	);
}
