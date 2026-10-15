/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Record tab UI for VoiceTranscriptionPanel (mic controls, transcription, history).
 *
 * Invariants:
 * - Recording level bar uses VoiceProgressBarFill; transcribe/play wired from hook vm.
 *
 * Related:
 * - useVoiceTranscriptionPanel.ts, VoiceTranscriptionPanel.tsx
 */

import type { VoiceTranscriptionPanelVm } from './useVoiceTranscriptionPanel';
import { VoiceProgressBarFill } from './VoiceProgressBarFill';
import {
	ArrowPathIcon,
	LanguageIcon,
	MicrophoneIcon,
	PlayIcon,
	Square2StackIcon,
} from '@heroicons/react/24/outline';
import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopNativeSelect,
} from '../../../../pages/Desktop/components/DesktopAppChrome';
import type { Language } from './voiceTranscriptionTypes';

export function VoiceTranscriptionRecordTab({
	vm,
}: {
	vm: VoiceTranscriptionPanelVm;
}) {
	const {
		t,
		isRecording,
		isProcessing,
		audioLevel,
		currentRecording,
		recordings,
		selectedLanguage,
		setSelectedLanguage,
		languages,
		startRecording,
		stopRecording,
		transcribeAudio,
		playAudio,
		insertTranscription,
	} = vm;

	return (
		<div className="flex h-full min-w-0 flex-col">
			<div className="shrink-0 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-6">
				<div className="mb-6 flex min-w-0 flex-wrap items-center justify-center gap-4">
					{isProcessing ? (
						<button
							type="button"
							disabled
							aria-pressed="false"
							aria-busy="true"
							aria-label={t('voice.aria.processingNoRecord')}
							className="cursor-not-allowed rounded-full bg-(--desktop-surface-panel) p-4 text-(--desktop-text-muted) transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-soft)"
						>
							<ArrowPathIcon
								width={24}
								height={24}
								className="animate-spin text-(--desktop-text-secondary)"
							/>
						</button>
					) : isRecording ? (
						<button
							type="button"
							onClick={stopRecording}
							aria-pressed="true"
							aria-busy="false"
							aria-label={t('voice.aria.stopRecording')}
							className="animate-pulse rounded-full bg-red-600 p-4 transition-all hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-soft)"
						>
							<Square2StackIcon width={24} height={24} className="text-white" />
						</button>
					) : (
						<button
							type="button"
							onClick={() => void startRecording()}
							aria-pressed="false"
							aria-busy="false"
							aria-label={t('voice.aria.startRecording')}
							className="rounded-full bg-[rgb(var(--desktop-accent-rgb))] p-4 transition-all hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-soft)"
						>
							<MicrophoneIcon width={24} height={24} className="text-white" />
						</button>
					)}

					{isProcessing ? (
						<div
							className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 sm:max-w-md"
							aria-hidden="true"
						>
							<div className="h-2 min-h-[8px] w-full min-w-32 max-w-xs overflow-hidden rounded-full bg-(--desktop-surface-panel)">
								<VoiceProgressBarFill
									widthPct={audioLevel}
									isRecording={isRecording}
								/>
							</div>
							<span className="shrink-0 text-sm text-(--desktop-text-muted) antialiased">
								{t('voice.status.processing')}
							</span>
						</div>
					) : (
						<div className="flex min-h-[48px] min-w-0 flex-1 items-center gap-3 sm:max-w-md">
							<div className="h-2 min-h-[8px] w-full min-w-32 max-w-xs overflow-hidden rounded-full bg-(--desktop-surface-panel)">
								<VoiceProgressBarFill
									widthPct={audioLevel}
									isRecording={isRecording}
								/>
							</div>
							<span className="shrink-0 text-sm text-(--desktop-text-muted) antialiased">
								{isRecording
									? t('voice.status.recording')
									: t('voice.status.idle')}
							</span>
						</div>
					)}
				</div>

				<div className="flex min-w-0 flex-wrap items-center justify-center gap-4">
					<LanguageIcon
						width={20}
						height={20}
						className="shrink-0 text-(--desktop-text-muted)"
					/>
					<DesktopNativeSelect
						value={selectedLanguage}
						onChange={(e) => setSelectedLanguage(e.target.value as Language)}
						aria-label={t('voice.languageSelectAria')}
						className="max-w-full text-sm sm:max-w-xs"
					>
						{languages.map((lang) => (
							<option
								key={lang.code}
								value={lang.code}
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{lang.flag} {lang.name}
							</option>
						))}
					</DesktopNativeSelect>
				</div>
			</div>

			{currentRecording && (
				<div className="shrink-0 border-b border-(--desktop-border-subtle) p-6">
					<DesktopAppPanel className="min-w-0 p-4">
						<div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2">
							<h3 className="min-w-0 font-medium text-(--desktop-text-primary)">
								{t('voice.labels.currentRecording')}
							</h3>
							<div className="flex shrink-0 gap-2">
								<DesktopAppButton
									onClick={() =>
										void playAudio(URL.createObjectURL(currentRecording.blob))
									}
									variant="ghost"
									size="icon"
								>
									<PlayIcon
										width={16}
										height={16}
										className="text-(--desktop-text-muted)"
									/>
								</DesktopAppButton>
								<DesktopAppButton
									onClick={() => void transcribeAudio(currentRecording)}
									disabled={isProcessing}
									variant="accent"
								>
									{isProcessing
										? t('voice.status.processing')
										: t('voice.actions.transcribe')}
								</DesktopAppButton>
							</div>
						</div>

						{currentRecording.transcription && (
							<div className="mb-4 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4">
								<h4 className="mb-2 text-sm text-(--desktop-text-secondary)">
									{t('voice.labels.transcription')}:
								</h4>
								<p className="text-sm leading-relaxed text-(--desktop-text-primary)">
									{currentRecording.transcription}
								</p>
								<DesktopAppButton
									onClick={() => {
										const text = currentRecording.transcription;
										if (text) insertTranscription(text);
									}}
									variant="accent"
									size="sm"
									className="mt-3"
								>
									{t('voice.actions.insertToDocument')}
								</DesktopAppButton>
							</div>
						)}
					</DesktopAppPanel>
				</div>
			)}

			<div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
				<h3 className="mb-4 font-medium text-(--desktop-text-primary)">
					{t('voice.history.recordings')}
				</h3>
				<div className="space-y-3">
					{recordings.map((recording) => (
						<DesktopAppPanel key={recording.id} className="min-w-0 p-4">
							<div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
								<span className="text-sm text-(--desktop-text-secondary)">
									{recording.timestamp.toLocaleTimeString()}
								</span>
								<div className="flex gap-2">
									<DesktopAppButton
										onClick={() =>
											void playAudio(URL.createObjectURL(recording.blob))
										}
										variant="ghost"
										size="icon"
										className="h-8 w-8"
									>
										<PlayIcon
											width={14}
											height={14}
											className="text-(--desktop-text-muted)"
										/>
									</DesktopAppButton>
									{!recording.transcription && (
										<DesktopAppButton
											onClick={() => void transcribeAudio(recording)}
											disabled={isProcessing}
											variant="accent"
											size="sm"
										>
											{isProcessing
												? t('voice.status.processing')
												: t('voice.actions.transcribe')}
										</DesktopAppButton>
									)}
								</div>
							</div>

							{recording.transcription && (
								<div className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3">
									<p className="text-sm leading-relaxed text-(--desktop-text-primary)">
										{recording.transcription}
									</p>
									<DesktopAppButton
										onClick={() => {
											if (recording.transcription) {
												insertTranscription(recording.transcription);
											}
										}}
										variant="accent"
										size="sm"
										className="mt-2"
									>
										{t('voice.actions.insert')}
									</DesktopAppButton>
								</div>
							)}
						</DesktopAppPanel>
					))}
					{recordings.length === 0 && (
						<DesktopAppPanel className="border-dashed bg-transparent">
							<DesktopAppEmptyState
								icon={
									<MicrophoneIcon
										width={32}
										height={32}
										className="text-purple-400/80"
									/>
								}
								title={t('voice.empty.recordingsTitle')}
								description={t('voice.empty.recordingsDesc')}
								className="py-10"
							/>
						</DesktopAppPanel>
					)}
				</div>
			</div>
		</div>
	);
}
