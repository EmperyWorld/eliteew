/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * MusicForge create form with progressive disclosure and honest taste-profile copy.
 *
 * Invariants:
 * - Idea + primary CTA stay visible; mode/style/constraints live in disclosed section.
 * - During an active run the panel shows a read-only summary instead of editable fields.
 *
 * Related:
 * - src/pages/MusicForge/MusicForgeApp.tsx
 */

import {
	ArrowPathIcon,
	MusicalNoteIcon,
	SparklesIcon,
	StopIcon,
} from '@heroicons/react/24/outline';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppPanel,
	DesktopAppSectionLabel,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type {
	MusicForgeCapabilities,
	MusicForgeLanguage,
} from '@/services/musicForge/musicForgeApi';
import { cn } from '@/utils/cn';
import { MusicForgeActiveRunProgress } from './MusicForgeActiveRunProgress';
import { MusicForgeCompletedHint } from './MusicForgeCompletedHint';
import { MusicForgeDurationPicker } from './MusicForgeDurationPicker';
import { MusicForgeGenrePicker } from './MusicForgeGenrePicker';
import { MusicForgeIdeaStarters } from './MusicForgeIdeaStarters';
import { MusicForgeLanguagePicker } from './MusicForgeLanguagePicker';
import { MusicForgeRunMetaChips } from './MusicForgeRunMetaChips';
import { MusicForgeSubmitRecap } from './MusicForgeSubmitRecap';
import { MusicForgeTerminalHint } from './MusicForgeTerminalHint';
import { MusicForgeVocalPicker } from './MusicForgeVocalPicker';
import type { MusicForgeVocal } from './musicForgeUiHelpers';

export type MusicForgeCreatePanelProps = {
	capabilities: MusicForgeCapabilities;
	capabilitiesWarning: boolean;
	onRetryCapabilities: () => void;
	idea: string;
	onIdeaChange: (value: string) => void;
	ideaHintVisible: boolean;
	language: MusicForgeLanguage;
	onLanguageChange: (value: MusicForgeLanguage) => void;
	resolveLanguageLabel: (value: MusicForgeLanguage, fallback: string) => string;
	modeKey: string;
	onModeKeyChange: (value: string) => void;
	styleHint: string;
	onStyleHintChange: (value: string) => void;
	vocal: MusicForgeVocal;
	onVocalChange: (value: MusicForgeVocal) => void;
	constraints: string;
	onConstraintsChange: (value: string) => void;
	duration: number;
	onDurationChange: (value: number) => void;
	onDurationBlur: () => void;
	runActive: boolean;
	activeIdeaLabel?: string;
	activeStatusLabel?: string;
	activeProgressCurrent?: number;
	activeProgressTotal?: number;
	activeRunStatus?: 'queued' | 'running';
	activeVocal?: MusicForgeVocal | null;
	activeStyleHint?: string | null;
	activeLanguage?: string | null;
	activeDurationSeconds?: number | null;
	canSubmit: boolean;
	submitting: boolean;
	cancelPending: boolean;
	canRestoreLast: boolean;
	formError: string | null;
	onSubmit: (event?: FormEvent) => void;
	onCancel: () => void;
	onRestoreLast: () => void;
	completedHintVisible?: boolean;
	onStartNewSong?: () => void;
	terminalHintVisible?: boolean;
	terminalStatus?: 'failed' | 'cancelled';
	canRetryGeneration?: boolean;
	onRetryGeneration?: () => void;
};

export function MusicForgeCreatePanel({
	capabilities,
	capabilitiesWarning,
	onRetryCapabilities,
	idea,
	onIdeaChange,
	ideaHintVisible,
	language,
	onLanguageChange,
	resolveLanguageLabel,
	modeKey,
	onModeKeyChange,
	styleHint,
	onStyleHintChange,
	vocal,
	onVocalChange,
	constraints,
	onConstraintsChange,
	duration,
	onDurationChange,
	onDurationBlur,
	runActive,
	activeIdeaLabel,
	activeStatusLabel,
	activeProgressCurrent = 0,
	activeProgressTotal = 0,
	activeRunStatus = 'running',
	activeVocal,
	activeStyleHint,
	activeLanguage,
	activeDurationSeconds,
	canSubmit,
	submitting,
	cancelPending,
	canRestoreLast,
	formError,
	onSubmit,
	onCancel,
	onRestoreLast,
	completedHintVisible = false,
	onStartNewSong,
	terminalHintVisible = false,
	terminalStatus,
	canRetryGeneration = false,
	onRetryGeneration,
}: MusicForgeCreatePanelProps) {
	const { t } = useTranslation('desktopUi');
	const tasteLikes = capabilities.taste_profile_like_count ?? 0;

	return (
		<DesktopAppPanel className="space-y-4 p-4">
			{capabilitiesWarning ? (
				<div
					className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-50"
					role="status"
				>
					<p>{t('musicForge.capabilities.loadFailed')}</p>
					<DesktopAppButton
						type="button"
						variant="ghost"
						className="mt-2"
						onClick={onRetryCapabilities}
					>
						<ArrowPathIcon className="size-4" />
						{t('musicForge.capabilities.retry')}
					</DesktopAppButton>
				</div>
			) : null}

			{!runActive ? (
				terminalHintVisible && terminalStatus && onStartNewSong ? (
					<MusicForgeTerminalHint
						status={terminalStatus}
						canRetry={canRetryGeneration}
						onRetry={onRetryGeneration}
						onStartNewSong={onStartNewSong}
					/>
				) : completedHintVisible && onStartNewSong ? (
					<MusicForgeCompletedHint onStartNewSong={onStartNewSong} />
				) : (
					<div className="rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/10 px-4 py-3">
						<div className="flex items-start gap-3">
							<div className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20 text-fuchsia-100">
								<SparklesIcon className="size-5" />
							</div>
							<div className="min-w-0">
								<p className="text-sm font-semibold text-white">
									{t('musicForge.hero.title')}
								</p>
								<p className="mt-1 text-sm leading-relaxed text-(--desktop-text-secondary)">
									{t('musicForge.hero.subtitle')}
								</p>
							</div>
						</div>
					</div>
				)
			) : null}

			{tasteLikes > 0 && !runActive ? (
				<p
					className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm leading-relaxed text-emerald-50"
					role="status"
				>
					{t('musicForge.tasteProfile.active', { count: tasteLikes })}
				</p>
			) : null}

			{runActive ? (
				<div
					className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
					role="status"
					aria-live="polite"
				>
					<p className="text-xs uppercase tracking-[0.16em] text-fuchsia-100/75">
						{t('musicForge.createPanel.activeRunLabel')}
					</p>
					<p className="mt-2 text-sm font-semibold text-white wrap-break-word">
						{activeIdeaLabel || idea}
					</p>
					<MusicForgeRunMetaChips
						className="mt-2"
						vocal={activeVocal}
						styleHint={activeStyleHint}
						language={activeLanguage}
						durationSeconds={activeDurationSeconds}
						resolveLanguageLabel={(value) =>
							resolveLanguageLabel(value as MusicForgeLanguage, value)
						}
					/>
					{activeStatusLabel ? (
						<p className="mt-1 text-xs text-(--desktop-text-secondary)">
							{activeStatusLabel}
						</p>
					) : null}
					<div className="mt-3">
						<MusicForgeActiveRunProgress
							progressCurrent={activeProgressCurrent}
							progressTotal={activeProgressTotal}
							status={activeRunStatus}
						/>
					</div>
				</div>
			) : (
				<form className="space-y-4" onSubmit={(event) => onSubmit(event)}>
					<div>
						<DesktopAppSectionLabel>
							{t('musicForge.form.ideaLabel')}
						</DesktopAppSectionLabel>
						<DesktopAppInput
							id="music-forge-idea"
							value={idea}
							onChange={(event) => onIdeaChange(event.target.value)}
							placeholder={t('musicForge.form.ideaPlaceholder')}
							aria-invalid={ideaHintVisible || undefined}
							aria-describedby={
								ideaHintVisible ? 'music-forge-idea-hint' : undefined
							}
						/>
						{ideaHintVisible ? (
							<p
								id="music-forge-idea-hint"
								className="mt-1 text-xs text-amber-100/90"
							>
								{t('musicForge.form.ideaMinLength')}
							</p>
						) : null}
					</div>

					{!idea.trim() ? (
						<MusicForgeIdeaStarters onPickIdea={onIdeaChange} />
					) : null}

					<MusicForgeGenrePicker
						styleHint={styleHint}
						onStyleHintChange={onStyleHintChange}
					/>

					<MusicForgeVocalPicker vocal={vocal} onVocalChange={onVocalChange} />

					<MusicForgeLanguagePicker
						language={language}
						onLanguageChange={onLanguageChange}
						languages={capabilities.languages ?? []}
						resolveLanguageLabel={resolveLanguageLabel}
					/>

					<details className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
						<summary className="cursor-pointer list-none text-sm font-medium text-(--desktop-text-primary) [&::-webkit-details-marker]:hidden">
							{t('musicForge.createPanel.advancedToggle')}
						</summary>
						<div className="mt-3 space-y-4 border-t border-white/10 pt-3">
							{(capabilities.modes?.length ?? 0) > 0 ? (
								<div>
									<DesktopAppSectionLabel>
										{t('musicForge.form.modeLabel')}
									</DesktopAppSectionLabel>
									<DesktopNativeSelect
										id="music-forge-mode"
										value={modeKey}
										onChange={(event) => onModeKeyChange(event.target.value)}
										aria-describedby="music-forge-mode-hint"
									>
										{(capabilities.modes ?? []).map((mode) => (
											<option key={mode.mode_key} value={mode.mode_key}>
												{language === 'en' ? mode.label_en : mode.label_ru}
											</option>
										))}
									</DesktopNativeSelect>
									<p
										id="music-forge-mode-hint"
										className="mt-1 text-xs text-(--desktop-text-dim)"
									>
										{t('musicForge.form.modeHint')}
									</p>
								</div>
							) : null}
							<MusicForgeDurationPicker
								duration={duration}
								min={capabilities.duration_seconds_min}
								max={capabilities.duration_seconds_max}
								onDurationChange={onDurationChange}
								onDurationBlur={onDurationBlur}
							/>
							<div>
								<DesktopAppSectionLabel>
									{t('musicForge.form.styleHintLabel')}
								</DesktopAppSectionLabel>
								<DesktopAppInput
									value={styleHint}
									onChange={(event) => onStyleHintChange(event.target.value)}
									placeholder={t('musicForge.form.styleHintPlaceholder')}
								/>
							</div>
							<div>
								<DesktopAppSectionLabel>
									{t('musicForge.form.constraintsExtraLabel')}
								</DesktopAppSectionLabel>
								<textarea
									value={constraints}
									onChange={(event) => onConstraintsChange(event.target.value)}
									placeholder={t('musicForge.form.constraintsExtraPlaceholder')}
									className={cn(
										'min-h-28 w-full rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2.5 text-sm text-(--desktop-text-primary) outline-none [&::placeholder]:text-(--desktop-text-dim)',
										'focus:border-(--desktop-border-strong) focus:bg-(--desktop-surface-soft-hover)'
									)}
								/>
							</div>
						</div>
					</details>

					{formError ? (
						<div
							className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
							role="alert"
						>
							{formError}
						</div>
					) : null}

					{idea.trim().length >= 3 ? (
						<MusicForgeSubmitRecap
							vocal={vocal}
							styleHint={styleHint}
							language={language}
							durationSeconds={duration}
							resolveLanguageLabel={resolveLanguageLabel}
						/>
					) : null}

					<div className="flex flex-wrap gap-2">
						<DesktopAppButton
							type="submit"
							variant="accent"
							disabled={!canSubmit}
						>
							{submitting ? (
								<ArrowPathIcon className="size-4 motion-reduce:animate-none animate-spin" />
							) : (
								<MusicalNoteIcon className="size-4" />
							)}
							{t('musicForge.actions.createSong')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							disabled={!canRestoreLast}
							onClick={onRestoreLast}
						>
							{t('musicForge.actions.restoreLastRequest')}
						</DesktopAppButton>
					</div>
				</form>
			)}

			{runActive ? (
				<div className="flex flex-wrap gap-2">
					<DesktopAppButton
						type="button"
						variant="neutral"
						disabled={cancelPending}
						onClick={onCancel}
					>
						<StopIcon className="size-4" />
						{t('musicForge.actions.cancel')}
					</DesktopAppButton>
				</div>
			) : null}
		</DesktopAppPanel>
	);
}
