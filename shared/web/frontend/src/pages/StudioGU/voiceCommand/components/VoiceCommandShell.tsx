/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentational shell for Voice Command Center (toolbar, feed, settings, modals).
 *
 * Invariants:
 * - Rendered only when `VoiceCommandCenter` is not in `backgroundOnly` mode.
 * - Macros/commands/feed scroll inside `data-vcc-scroll-body`; mic toolbar stays pinned.
 *
 * Related:
 * - `VoiceCommandCenter.tsx`, `hooks/useVoiceCommandSession.ts`
 * - `utils/voiceCommandSurfaceStyles.ts` (`VCC_SCROLL_BODY_CLASSNAME`)
 */

import {
	DESKTOP_APP_STYLE_CONTRACT,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSectionLabel,
	DesktopAppSurface,
	DesktopAppToolbar,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useState } from 'react';
import {
	DESKTOP_APP_ICON,
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { AddMacroForm } from '../components/AddMacroForm';
import { CommandHistoryPanel } from '../components/CommandHistoryPanel';
import { MessageBubble } from '../components/MessageBubble';
import { StatusBadge } from '../components/StatusBadge';
import { VoiceAuditPanel } from '../components/VoiceAuditPanel';
import {
	VOICE_COMMAND_CENTER_DOM_ID,
	VoiceCommandGuideModal,
} from '../components/VoiceCommandGuideModal';
import { VoiceCommandConfirmModal } from '../components/VoiceCommandConfirmModal';
import { COMMAND_CATALOG, getCommandById, isReversible } from '../engine';
import {
	saveMacros,
	validateMacro,
	type VoiceMacro,
} from '../macros/voiceMacros';
import type { ServiceStatus } from '../types';
import {
	catalogDescription,
	macroDisplayName,
} from '../utils/voiceCommandI18n';
import {
	VCC_FEED_IN_SCROLL_CLASSNAME,
	VCC_SCROLL_BODY_CLASSNAME,
} from '../utils/voiceCommandSurfaceStyles';
import type {
	UseVoiceCommandSessionReturn,
	VoiceCommandSessionSettings,
} from '../hooks/useVoiceCommandSession';
import {
	ArrowPathIcon,
	BoltIcon,
	ChevronDownIcon,
	ClipboardDocumentListIcon,
	ClockIcon,
	Cog6ToothIcon,
	CommandLineIcon,
	MicrophoneIcon,
	RadioIcon,
	SpeakerWaveIcon,
	SpeakerXMarkIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';

export interface VoiceCommandShellProps {
	embeddedInStudio: boolean;
	showGuide: boolean;
	setShowGuide: (open: boolean) => void;
	serviceStatus: ServiceStatus;
	settings: VoiceCommandSessionSettings;
	updatePersisted: (patch: {
		language?: string;
		voice?: string;
		llamaModel?: string;
	}) => void;
	setSoundFeedback: (value: boolean) => void;
	setWebsocketMode: (value: boolean) => void;
	setPushToTalk: (value: boolean) => void;
	session: UseVoiceCommandSessionReturn;
}

export function VoiceCommandShell({
	embeddedInStudio,
	showGuide,
	setShowGuide,
	serviceStatus,
	settings,
	updatePersisted,
	setSoundFeedback,
	setWebsocketMode,
	setPushToTalk,
	session,
}: VoiceCommandShellProps): React.ReactElement {
	const { t: tWorkspace } = useTranslation('desktopUi', {
		keyPrefix: 'workspace',
	});
	const { t } = useTranslation('desktopUi', { keyPrefix: 'voiceCommand' });

	const [showSettings, setShowSettings] = useState(false);
	const [showCommands, setShowCommands] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const [showAudit, setShowAudit] = useState(false);
	const [showMacros, setShowMacros] = useState(false);
	const [showAddMacro, setShowAddMacro] = useState(false);

	const {
		isListening,
		isProcessing,
		messages,
		setMessages,
		audioLevel,
		currentTranscript,
		commandHistory,
		isLocalOnly,
		clearCommandHistory,
		historySaveFailed,
		macros,
		setMacros,
		runningMacroId,
		runMacro,
		disambiguate,
		setDisambiguate,
		handleDisambiguateChoice,
		confirmTranscript,
		closeConfirm,
		confirmCommand,
		toggleListening,
		handleReplay,
		handleUndo,
		messagesEndRef,
	} = session;

	const sw = DESKTOP_LUCIDE.stroke;
	const micBtnBase = cn(
		'relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full transition-[box-shadow,transform,filter] duration-200 ease-out shadow-(--desktop-shadow-panel) ring-1 ring-[color-mix(in_srgb,var(--desktop-text-primary)_14%,transparent)] motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50',
		DESKTOP_INTERACTIVE.focusRing
	);

	return (
		<div
			id={VOICE_COMMAND_CENTER_DOM_ID}
			className={cn(
				DESKTOP_APP_STYLE_CONTRACT.shell,
				'flex h-full min-h-0 flex-col overflow-hidden'
			)}
			data-local-only="true"
		>
			<div data-vcc-scroll-body="" className={VCC_SCROLL_BODY_CLASSNAME}>
				{!embeddedInStudio ? (
					<div
						className="shrink-0 border-b border-(--desktop-border-subtle)/70 px-4 py-2 md:px-5"
						data-local-only="true"
						role="status"
					>
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'text-(--desktop-text-dim)'
							)}
						>
							{tWorkspace('localOnlyHint')}
						</p>
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.meta,
								'mt-0.5 text-(--desktop-text-dim)'
							)}
						>
							{tWorkspace('localOnlyVoiceDetail')}
						</p>
					</div>
				) : null}
				{!embeddedInStudio ? (
					<DesktopAppToolbar
						data-vcc-guide="toolbar"
						className="relative min-h-0 shrink-0 justify-between gap-3 px-4 py-3 md:px-5"
					>
						<div className="flex min-w-0 items-center gap-3">
							<div
								className={`${DESKTOP_APP_ICON.container} h-11 w-11 shrink-0 shadow-(--desktop-shadow-soft)`}
							>
								<div
									className={`${DESKTOP_APP_ICON.inner} text-[rgb(var(--desktop-accent-rgb))]/90`}
								>
									<RadioIcon
										className="h-6! w-6!"
										strokeWidth={sw}
										aria-hidden
									/>
								</div>
							</div>
							<div className="min-w-0">
								<h1 className={cn(DESKTOP_TYPOGRAPHY.subtitle, 'truncate')}>
									{t('title')}
								</h1>
								<p className={DESKTOP_TYPOGRAPHY.meta}>
									{t('subtitle')}
									<span
										className="ml-2 text-(--desktop-text-dim)"
										title={tWorkspace('localOnlyVoiceDetail')}
									>
										· {tWorkspace('localOnlyHint')}
									</span>
								</p>
							</div>
						</div>

						<div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-2.5">
							<section
								className="flex flex-wrap items-center gap-1.5 rounded-(--desktop-radius) bg-(--desktop-surface-soft)/50 px-2 py-1 ring-1 ring-[color-mix(in_srgb,var(--desktop-text-primary)_08%,transparent)]"
								aria-label={t('actions.serviceStatusAria')}
							>
								<StatusBadge
									label={t('services.stt')}
									active={serviceStatus.whisper}
									title={t('services.sttTitle')}
								/>
								<StatusBadge
									label={t('services.llm')}
									active={serviceStatus.llama}
									title={t('services.llmTitle')}
								/>
								<StatusBadge
									label={t('services.tts')}
									active={serviceStatus.tts}
									title={t('services.ttsTitle')}
								/>
							</section>

							<span
								className="hidden h-6 w-px shrink-0 bg-(--desktop-border-subtle) sm:block"
								aria-hidden
							/>

							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setShowAudit(true)}
								aria-label={t('actions.commandAudit')}
								className="min-w-0 px-2 transition-colors hover:bg-(--desktop-surface-soft-hover)"
							>
								<ClipboardDocumentListIcon
									className="h-4 w-4"
									strokeWidth={sw}
								/>
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setShowSettings(!showSettings)}
								aria-label={t('actions.voiceSettings')}
								className="min-w-0 px-2 transition-colors hover:bg-(--desktop-surface-soft-hover)"
							>
								<Cog6ToothIcon className="h-4 w-4" strokeWidth={sw} />
							</DesktopAppButton>
						</div>
					</DesktopAppToolbar>
				) : null}

				<AnimatePresence>
					{showSettings && (
						<motion.section
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: 'auto', opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: 0.2 }}
							className="overflow-hidden border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_40%,transparent)] shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]"
						>
							<div className="space-y-4 px-4 py-3 md:px-5 md:py-4">
								<div className="grid grid-cols-2 gap-3 md:gap-4">
									<div>
										<label htmlFor="vcc-settings-language" className="block">
											<DesktopAppSectionLabel className="mb-1.5 block">
												{t('settings.language')}
											</DesktopAppSectionLabel>
										</label>
										<DesktopNativeSelect
											id="vcc-settings-language"
											value={settings.language}
											onChange={(e) =>
												updatePersisted({ language: e.target.value })
											}
											className="text-sm"
										>
											<option
												value="ru"
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{t('settings.languageRu')}
											</option>
											<option
												value="en"
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{t('settings.languageEn')}
											</option>
											<option
												value="auto"
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{t('settings.languageAuto')}
											</option>
										</DesktopNativeSelect>
									</div>
									<div>
										<label htmlFor="vcc-settings-tts-voice" className="block">
											<DesktopAppSectionLabel className="mb-1.5 block">
												{t('settings.ttsVoice')}
											</DesktopAppSectionLabel>
										</label>
										<DesktopNativeSelect
											id="vcc-settings-tts-voice"
											value={settings.ttsVoice}
											onChange={(e) =>
												updatePersisted({ voice: e.target.value })
											}
											className="text-sm"
										>
											<option
												value="xenia"
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												Ксения (xenia)
											</option>
											<option
												value="baya"
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												Бая (baya)
											</option>
											<option
												value="eugene"
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												Евгений (eugene)
											</option>
											<option
												value="aidar"
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												Айдар (aidar)
											</option>
										</DesktopNativeSelect>
									</div>
								</div>
								<div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-0.5">
									<label
										className={cn(
											'flex cursor-pointer items-center gap-2',
											DESKTOP_TYPOGRAPHY.body
										)}
									>
										<input
											type="checkbox"
											checked={settings.soundFeedback}
											onChange={(e) => setSoundFeedback(e.target.checked)}
											className={cn(
												'rounded border-(--desktop-border-subtle) text-[rgb(var(--desktop-accent-rgb))]',
												DESKTOP_INTERACTIVE.focusRing
											)}
										/>
										{t('settings.soundFeedback')}
									</label>
									<label
										className={cn(
											'flex cursor-pointer items-center gap-2',
											DESKTOP_TYPOGRAPHY.body
										)}
									>
										<input
											type="checkbox"
											checked={settings.websocketMode}
											onChange={(e) => setWebsocketMode(e.target.checked)}
											className={cn(
												'rounded border-(--desktop-border-subtle) text-[rgb(var(--desktop-accent-rgb))]',
												DESKTOP_INTERACTIVE.focusRing
											)}
										/>
										{t('settings.websocketMode')}
									</label>
									<label
										className={cn(
											'flex cursor-pointer items-center gap-2',
											DESKTOP_TYPOGRAPHY.body
										)}
									>
										<input
											type="checkbox"
											checked={settings.pushToTalk}
											onChange={(e) => setPushToTalk(e.target.checked)}
											className={cn(
												'rounded border-(--desktop-border-subtle) text-[rgb(var(--desktop-accent-rgb))]',
												DESKTOP_INTERACTIVE.focusRing
											)}
										/>
										{t('settings.pushToTalk')}
									</label>
								</div>
							</div>
						</motion.section>
					)}
				</AnimatePresence>

				<div
					data-vcc-guide="shortcuts"
					className="shrink-0 divide-y divide-(--desktop-border-subtle)"
				>
					<section className="px-4 py-2.5 md:px-5 md:py-3">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setShowMacros(!showMacros)}
							className="gap-2 px-1 py-1 text-(--desktop-text-muted) transition-colors duration-200 hover:text-(--desktop-text-primary)"
						>
							<BoltIcon
								className="h-4 w-4 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
								strokeWidth={sw}
							/>
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('macros.title')}
							</span>
							<ChevronDownIcon
								strokeWidth={sw}
								className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${showMacros ? 'rotate-180' : ''}`}
							/>
						</DesktopAppButton>
						<AnimatePresence>
							{showMacros && (
								<motion.div
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: 'auto', opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									className="overflow-hidden"
								>
									<p
										className={cn(
											DESKTOP_TYPOGRAPHY.meta,
											'mt-2 text-(--desktop-text-dim)'
										)}
									>
										{t('macros.localOnlyCaption')}
									</p>
									<div className="flex flex-wrap gap-2 mt-3">
										{macros.map((macro) => (
											<DesktopAppButton
												key={macro.id}
												type="button"
												variant="neutral"
												size="sm"
												disabled={!!runningMacroId}
												onClick={() => runMacro(macro)}
												className="text-(--desktop-text-secondary)"
											>
												{runningMacroId === macro.id
													? t('macros.running')
													: macroDisplayName(macro, t)}
											</DesktopAppButton>
										))}
										<DesktopAppButton
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => setShowAddMacro(true)}
											className="border border-dashed border-(--desktop-border-subtle) text-(--desktop-text-muted) hover:border-[rgb(var(--desktop-accent-rgb))]/35 hover:text-(--desktop-text-primary)"
										>
											{t('macros.add')}
										</DesktopAppButton>
									</div>
									{showAddMacro && (
										<AddMacroForm
											onSave={(name, commandIds) => {
												const newMacro: VoiceMacro = {
													id: `macro-${Date.now()}`,
													name: name.trim(),
													commandIds,
												};
												if (validateMacro(newMacro)) {
													const next = [...macros, newMacro];
													saveMacros(next);
													setMacros(next);
													setShowAddMacro(false);
												}
											}}
											onCancel={() => setShowAddMacro(false)}
										/>
									)}
								</motion.div>
							)}
						</AnimatePresence>
					</section>

					<section className="px-4 py-2.5 md:px-5 md:py-3">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setShowCommands(!showCommands)}
							className="gap-2 px-1 py-1 text-(--desktop-text-muted) transition-colors duration-200 hover:text-(--desktop-text-primary)"
						>
							<CommandLineIcon
								className="h-4 w-4 text-[rgb(var(--desktop-accent-rgb)/0.78)]"
								strokeWidth={sw}
							/>
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('commands.title')}
							</span>
							<ChevronDownIcon
								strokeWidth={sw}
								className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${showCommands ? 'rotate-180' : ''}`}
							/>
						</DesktopAppButton>

						<AnimatePresence>
							{showCommands && (
								<motion.div
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: 'auto', opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									className="overflow-hidden"
								>
									<div className="mt-3 grid max-h-[min(52vh,22rem)] grid-cols-1 gap-2 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-color:color-mix(in_srgb,var(--desktop-text-primary)_20%,transparent)_transparent] scrollbar-thin sm:grid-cols-2">
										{COMMAND_CATALOG.map((cmd) => (
											<div
												key={cmd.id}
												className={cn(
													DESKTOP_APP_STYLE_CONTRACT.softCard,
													'flex items-center gap-2 p-2.5 text-sm'
												)}
											>
												<span className="text-lg leading-none">{cmd.icon}</span>
												<div className="min-w-0">
													<div className="truncate text-sm font-medium tracking-tight text-(--desktop-text-primary) antialiased">
														«{cmd.command}»
													</div>
													<div className={DESKTOP_TYPOGRAPHY.meta}>
														{catalogDescription(cmd.id, t)}
													</div>
												</div>
											</div>
										))}
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</section>
				</div>

				<div data-vcc-guide="messages" className={VCC_FEED_IN_SCROLL_CLASSNAME}>
					{messages.length === 0 ? (
						<DesktopAppEmptyState
							className="min-h-[200px] justify-center py-6"
							icon={
								<MicrophoneIcon
									className="h-8 w-8 text-[rgb(var(--desktop-accent-rgb)/0.82)]"
									strokeWidth={sw}
									aria-hidden
								/>
							}
							title={t('feed.emptyTitle')}
							description={t('feed.emptyDescription')}
						/>
					) : (
						messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
					)}
					<div ref={messagesEndRef} />
				</div>

				{currentTranscript && isProcessing && (
					<div className="border-t border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_52%,transparent)] px-4 py-2.5 md:px-5">
						<div
							className={cn(
								'flex items-center gap-2',
								DESKTOP_TYPOGRAPHY.body,
								'text-(--desktop-text-muted)'
							)}
							role="status"
							aria-live="polite"
						>
							<ArrowPathIcon
								className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
								strokeWidth={sw}
								aria-hidden
							/>
							<span className="truncate">«{currentTranscript}»</span>
						</div>
					</div>
				)}
			</div>

			<DesktopAppToolbar
				data-vcc-guide="controls"
				className="shrink-0 border-b-0 border-t border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_42%,transparent)] px-4 py-4 shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.07)] backdrop-blur-sm md:px-5 md:py-5"
			>
				<div className="flex items-center justify-center gap-3">
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => setSoundFeedback(!settings.soundFeedback)}
						aria-label={
							settings.soundFeedback
								? t('actions.muteResponses')
								: t('actions.unmuteResponses')
						}
						className={cn(
							'min-w-0 rounded-full p-3 transition-[color,background-color,box-shadow]',
							!settings.soundFeedback &&
								'ring-1 ring-[color-mix(in_srgb,var(--desktop-text-primary)_12%,var(--desktop-border-subtle))]'
						)}
					>
						{settings.soundFeedback ? (
							<SpeakerWaveIcon className="h-5 w-5" strokeWidth={sw} />
						) : (
							<SpeakerXMarkIcon
								className="h-5 w-5 text-(--desktop-text-muted)"
								strokeWidth={sw}
							/>
						)}
					</DesktopAppButton>

					<motion.button
						type="button"
						onClick={toggleListening}
						disabled={isProcessing}
						whileTap={{ scale: 0.97 }}
						transition={{
							type: 'tween',
							duration: 0.12,
							ease: 'easeOut',
						}}
						title={
							isListening
								? t('actions.stopRecording')
								: t('actions.startRecording')
						}
						aria-label={
							isListening
								? t('actions.stopRecording')
								: t('actions.startRecording')
						}
						aria-busy={isProcessing}
						className={cn(
							micBtnBase,
							isListening
								? 'border border-[color-mix(in_srgb,rgb(239_68_68)_40%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,rgb(239_68_68)_30%,var(--desktop-surface-soft))] text-white shadow-[0_12px_32px_color-mix(in_srgb,rgb(239_68_68)_28%,transparent)]'
								: isProcessing
									? 'border border-[rgb(var(--desktop-accent-rgb))]/32 bg-[color-mix(in_srgb,var(--desktop-surface-soft)_72%,rgb(var(--desktop-accent-rgb))_28%)] text-[rgb(var(--desktop-fg-primary-rgb))]'
									: 'bg-[rgb(var(--desktop-accent-rgb))] text-[rgb(var(--desktop-fg-primary-rgb))] hover:brightness-110 active:brightness-95'
						)}
					>
						{isListening ? (
							<motion.div
								className="pointer-events-none absolute inset-0 rounded-full border-[3px] border-[rgb(var(--desktop-fg-primary-rgb)/0.22)]"
								animate={{ scale: 1 + audioLevel * 0.28 }}
								transition={{ duration: 0.1 }}
							/>
						) : null}

						{isProcessing ? (
							<ArrowPathIcon
								className={cn(
									'h-8 w-8 animate-spin motion-reduce:animate-none',
									isListening
										? 'text-white'
										: 'text-[rgb(var(--desktop-fg-primary-rgb))]'
								)}
								strokeWidth={sw}
								aria-hidden
							/>
						) : isListening ? (
							<SpeakerXMarkIcon
								className="h-8 w-8 text-white"
								strokeWidth={sw}
							/>
						) : (
							<MicrophoneIcon
								className="h-8 w-8 text-[rgb(var(--desktop-fg-primary-rgb))]"
								strokeWidth={sw}
							/>
						)}
					</motion.button>

					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						onClick={() => setShowHistory(true)}
						aria-label={t('actions.commandHistory')}
						className="min-w-0 rounded-full p-3"
					>
						<ClockIcon className="h-5 w-5" strokeWidth={sw} />
					</DesktopAppButton>

					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						onClick={() => setMessages([])}
						aria-label={t('actions.clearFeed')}
						className="min-w-0 rounded-full p-3"
					>
						<TrashIcon className="h-5 w-5" strokeWidth={sw} />
					</DesktopAppButton>
				</div>

				<p className={cn('mt-3 text-center', DESKTOP_TYPOGRAPHY.meta)}>
					{isListening
						? t('feed.listening')
						: isProcessing
							? t('feed.processing')
							: t('feed.tapToRecord')}
				</p>
			</DesktopAppToolbar>

			<CommandHistoryPanel
				open={showHistory}
				onClose={() => setShowHistory(false)}
				items={commandHistory}
				showLocalOnlyBanner={isLocalOnly}
				showSaveFailed={historySaveFailed}
				onClearJournal={clearCommandHistory}
				onReplay={handleReplay}
				onUndo={handleUndo}
				isReversible={isReversible}
			/>
			<VoiceAuditPanel open={showAudit} onClose={() => setShowAudit(false)} />

			<AnimatePresence>
				{disambiguate && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className={cn(
							DESKTOP_APP_STYLE_CONTRACT.modalBackdrop,
							'z-50 p-4 backdrop-blur-md'
						)}
						onClick={() => setDisambiguate(null)}
					>
						<motion.div
							initial={{ scale: 0.98, opacity: 0.96 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.98, opacity: 0 }}
							transition={{ type: 'tween', duration: 0.18, ease: 'easeOut' }}
							onClick={(e) => e.stopPropagation()}
						>
							<DesktopAppSurface
								variant="panelStrong"
								className="w-full max-w-sm p-5"
							>
								<p
									className={cn(
										'mb-4 font-medium text-(--desktop-text-primary)',
										DESKTOP_TYPOGRAPHY.body
									)}
								>
									{disambiguate.intent === 'open_app'
										? t('disambiguation.openApp')
										: t('disambiguation.generic')}
								</p>
								<div className="max-h-[min(60vh,22rem)] space-y-2 overflow-y-auto pr-1">
									{disambiguate.candidates.map((id) => {
										const cmd = getCommandById(id);
										return (
											<DesktopAppButton
												key={id}
												type="button"
												variant="neutral"
												size="sm"
												onClick={() => handleDisambiguateChoice(id)}
												className="w-full justify-start gap-2"
											>
												{cmd?.icon ? (
													<span className="shrink-0">{cmd.icon}</span>
												) : null}
												<span className="truncate text-left">
													{catalogDescription(id, t)}
												</span>
											</DesktopAppButton>
										);
									})}
								</div>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setDisambiguate(null)}
									className="mt-4 w-full"
								>
									{t('disambiguation.cancel')}
								</DesktopAppButton>
							</DesktopAppSurface>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			<VoiceCommandConfirmModal
				open={confirmTranscript != null}
				transcript={confirmTranscript ?? ''}
				onClose={closeConfirm}
				onConfirm={confirmCommand}
			/>

			<VoiceCommandGuideModal
				open={showGuide}
				onClose={() => setShowGuide(false)}
				embeddedInStudio={embeddedInStudio}
			/>
		</div>
	);
}
