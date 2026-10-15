/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Synthesize tab UI for VoiceTranscriptionPanel (TTS controls, history, insert).
 *
 * Invariants:
 * - Silero/UGS model options from hook vm; synth disabled when processing or empty text.
 *
 * Related:
 * - useVoiceTranscriptionPanel.ts, VoiceTranscriptionPanel.tsx
 */

import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	BoltIcon,
	PlayIcon,
	SpeakerWaveIcon,
} from '@heroicons/react/24/outline';
import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
	DesktopNativeSelect,
} from '../../../../pages/Desktop/components/DesktopAppChrome';
import type { VoiceTranscriptionPanelVm } from './useVoiceTranscriptionPanel';
import type { Language } from './voiceTranscriptionTypes';

export function VoiceTranscriptionSynthTab({
	vm,
}: {
	vm: VoiceTranscriptionPanelVm;
}) {
	const {
		t,
		isProcessing,
		selectedLanguage,
		setSelectedLanguage,
		selectedVoice,
		setSelectedVoice,
		inputText,
		setInputText,
		languages,
		voiceModels,
		synthesizedAudios,
		synthesizeSpeech,
		playAudio,
		insertAudioElement,
	} = vm;

	return (
		<div className="flex h-full min-w-0 flex-col">
			<div className="shrink-0 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-6">
				<div className="mb-6 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
					<div className="min-w-0">
						<label
							htmlFor="voice-synth-language"
							className="mb-2 block text-sm text-(--desktop-text-secondary)"
						>
							{t('voice.synth.languageLabel')}
						</label>
						<DesktopNativeSelect
							id="voice-synth-language"
							value={selectedLanguage}
							onChange={(e) => setSelectedLanguage(e.target.value as Language)}
							className="text-sm"
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

					<div className="min-w-0">
						<label
							htmlFor="voice-synth-model"
							className="mb-2 block text-sm text-(--desktop-text-secondary)"
						>
							{t('voice.synth.voiceModelLabel')}
						</label>
						<DesktopNativeSelect
							id="voice-synth-model"
							value={selectedVoice}
							onChange={(e) => setSelectedVoice(e.target.value)}
							className="text-sm"
						>
							{voiceModels.map((model) => (
								<option
									key={model.id}
									value={model.id}
									className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								>
									{model.name} {model.gpu && '🚀'}
								</option>
							))}
						</DesktopNativeSelect>
					</div>

					<div className="min-w-0">
						<label
							htmlFor="voice-synth-voice"
							className="mb-2 block text-sm text-(--desktop-text-secondary)"
						>
							{t('voice.synth.voicePresetLabel')}
						</label>
						<DesktopNativeSelect
							id="voice-synth-voice"
							value={selectedVoice}
							onChange={(e) => setSelectedVoice(e.target.value)}
							className="text-sm"
						>
							<option
								value="default"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('voice.synth.presetDefault')}
							</option>
							<option
								value="male"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('voice.synth.presetMale')}
							</option>
							<option
								value="female"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('voice.synth.presetFemale')}
							</option>
							<option
								value="child"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('voice.synth.presetChild')}
							</option>
						</DesktopNativeSelect>
					</div>
				</div>

				<textarea
					value={inputText}
					onChange={(e) => setInputText(e.target.value)}
					placeholder={t('voice.synth.inputPlaceholder')}
					className="h-32 min-w-0 w-full resize-none rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-app) p-4 text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim)"
				/>

				<div className="flex justify-center mt-4">
					<DesktopAppButton
						onClick={() => void synthesizeSpeech()}
						disabled={isProcessing || !inputText.trim()}
						variant="accent"
						className="gap-2 px-8 py-3"
					>
						<BoltIcon width={20} height={20} />
						{isProcessing
							? t('voice.synth.synthesizing')
							: t('voice.synth.synthesize')}
					</DesktopAppButton>
				</div>
			</div>

			<div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
				<h3 className="mb-4 font-medium text-(--desktop-text-primary)">
					{t('voice.synth.historyTitle')}
				</h3>
				<div className="space-y-3">
					{synthesizedAudios.map((audio) => (
						<DesktopAppPanel key={audio.id} className="min-w-0 p-4">
							<div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
								<div className="flex min-w-0 items-center gap-3">
									<div className="p-2 bg-purple-500/20 rounded-lg">
										<SpeakerWaveIcon
											width={16}
											height={16}
											className="text-purple-400"
										/>
									</div>
									<div className="min-w-0">
										<p className="truncate text-sm font-medium text-(--desktop-text-primary)">
											{languages.find((l) => l.code === audio.language)?.flag}{' '}
											{audio.voice}
										</p>
										<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
											{audio.timestamp.toLocaleTimeString()}
										</p>
									</div>
								</div>
								<div className="flex shrink-0 gap-2">
									<DesktopAppButton
										onClick={() => void playAudio(audio.audioUrl)}
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
										onClick={() => insertAudioElement(audio)}
										variant="accent"
										size="sm"
									>
										{t('voice.actions.insert')}
									</DesktopAppButton>
								</div>
							</div>

							<p className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3 text-sm leading-relaxed text-(--desktop-text-secondary)">
								"{audio.text}"
							</p>
						</DesktopAppPanel>
					))}
					{synthesizedAudios.length === 0 && (
						<DesktopAppPanel className="border-dashed bg-transparent">
							<DesktopAppEmptyState
								icon={
									<SpeakerWaveIcon
										width={32}
										height={32}
										className="text-purple-400/80"
									/>
								}
								title={t('voice.empty.synthListTitle')}
								description={t('voice.empty.synthListDesc')}
								className="py-10"
							/>
						</DesktopAppPanel>
					)}
				</div>
			</div>
		</div>
	);
}
