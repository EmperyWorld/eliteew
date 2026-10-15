/**
 * Диалог с voice-gateway — контент вкладки «Диалог» в Студии ГУ.
 */

import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { cn } from '@/utils/cn';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { getDesktopShellContentPanelClassName } from '@/pages/Desktop/utils/desktopVisualSystem';
import { useVoiceGatewayDialog } from './hooks/useVoiceGatewayDialog';
import {
	ArrowPathIcon,
	CheckCircleIcon,
	ClockIcon,
	Cog6ToothIcon,
	ExclamationCircleIcon,
	MicrophoneIcon,
	PlayIcon,
	SparklesIcon,
	SpeakerWaveIcon,
	Square2StackIcon,
} from '@heroicons/react/24/outline';

const sw = DESKTOP_LUCIDE.stroke;
const ic = DESKTOP_LUCIDE.md;

export function VoiceDialogPanel(): React.ReactElement {
	const dialog = useVoiceGatewayDialog();
	const shellFrame = useDesktopShellFrame();

	const voiceStageShellClass = React.useMemo(
		() =>
			cn(
				'flex flex-col items-center px-4 py-6',
				getDesktopShellContentPanelClassName(shellFrame)
			),
		[shellFrame]
	);

	const micButtonIdleShell = React.useMemo(
		() =>
			cn(
				getDesktopShellContentPanelClassName(shellFrame),
				'rounded-full text-(--desktop-text-primary) shadow-(--desktop-shadow-panel) ring-1 ring-[color-mix(in_srgb,var(--desktop-text-primary)_12%,transparent)] hover:border-[rgb(var(--desktop-accent-rgb)/0.35)]'
			),
		[shellFrame]
	);

	const stageInfo = React.useMemo(() => {
		switch (dialog.pipelineStage) {
			case 'recording':
				return {
					text: 'Запись…',
					icon: (
						<MicrophoneIcon
							className={cn(ic, 'animate-pulse text-red-400')}
							strokeWidth={sw}
						/>
					),
				};
			case 'transcribing':
				return {
					text: 'Распознавание речи…',
					icon: (
						<ArrowPathIcon
							className={cn(ic, 'animate-spin text-(--desktop-text-muted)')}
							strokeWidth={sw}
						/>
					),
				};
			case 'generating':
				return {
					text: 'Генерация ответа…',
					icon: (
						<SparklesIcon
							className={cn(
								ic,
								'animate-pulse text-[rgb(var(--desktop-accent-rgb)/0.85)]'
							)}
							strokeWidth={sw}
						/>
					),
				};
			case 'synthesizing':
				return {
					text: 'Синтез речи…',
					icon: (
						<SpeakerWaveIcon
							className={cn(
								ic,
								'animate-pulse text-(--desktop-text-secondary)'
							)}
							strokeWidth={sw}
						/>
					),
				};
			case 'playing':
				return {
					text: 'Воспроизведение…',
					icon: (
						<PlayIcon
							className={cn(ic, 'text-[rgb(var(--desktop-accent-rgb)/0.9)]')}
							strokeWidth={sw}
						/>
					),
				};
			case 'completed':
				return {
					text: 'Готово',
					icon: (
						<CheckCircleIcon
							className={cn(ic, 'text-(--desktop-text-secondary)')}
							strokeWidth={sw}
						/>
					),
				};
			case 'error':
				return {
					text: 'Ошибка',
					icon: (
						<ExclamationCircleIcon
							className={cn(ic, 'text-red-400')}
							strokeWidth={sw}
						/>
					),
				};
			default:
				return {
					text: 'Нажмите для записи',
					icon: (
						<MicrophoneIcon
							className={cn(ic, 'text-(--desktop-text-muted)')}
							strokeWidth={sw}
						/>
					),
				};
		}
	}, [dialog.pipelineStage]);

	return (
		<div
			className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
			data-studio-gu-guide="dialog-root"
		>
			{dialog.isRecording && (
				<div
					className="flex items-center gap-2 rounded-(--desktop-radius-lg) border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-(--desktop-text-primary)"
					role="status"
					aria-live="polite"
				>
					<span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
					<span className="font-medium">Идёт запись</span>
					<span className="text-(--desktop-text-muted)">
						— нажмите стоп, чтобы отправить
					</span>
				</div>
			)}

			{dialog.isPlaying && (
				<div
					className="flex items-center gap-2 rounded-(--desktop-radius-lg) border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-(--desktop-surface-accent) px-3 py-2 text-sm"
					role="status"
				>
					<SpeakerWaveIcon className={DESKTOP_LUCIDE.lg} strokeWidth={sw} />
					<span
						className={cn(
							DESKTOP_TYPOGRAPHY.body,
							'text-(--desktop-text-primary)'
						)}
					>
						Воспроизведение ответа
					</span>
					<button
						type="button"
						onClick={dialog.stopPlayback}
						className={cn(
							'ml-auto text-xs font-medium underline-offset-2 hover:underline',
							DESKTOP_INTERACTIVE.focusRing
						)}
					>
						Остановить
					</button>
				</div>
			)}

			<div
				className="flex flex-wrap items-center justify-between gap-2"
				data-studio-gu-guide="dialog-settings"
			>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => dialog.setShowSettings(!dialog.showSettings)}
					aria-expanded={dialog.showSettings}
					className="gap-2"
				>
					<Cog6ToothIcon className="h-4 w-4" strokeWidth={sw} />
					<span className={DESKTOP_TYPOGRAPHY.caption}>Настройки голоса</span>
				</DesktopAppButton>
			</div>

			<AnimatePresence>
				{dialog.showSettings && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
						className={cn(
							DESKTOP_APP_STYLE_CONTRACT.softCard,
							'overflow-hidden p-3'
						)}
					>
						<div
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
								'mb-2 block'
							)}
						>
							Голос (UGS)
						</div>
						<DesktopNativeSelect
							value={dialog.selectedVoice}
							onChange={(e) => dialog.setSelectedVoice(e.target.value)}
							className="text-sm"
							title="Голос (UGS)"
							aria-label="Голос (UGS)"
						>
							<option
								value="auto"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								Авто
							</option>
							{dialog.voices.map((v) => (
								<option
									key={v.id}
									value={v.id}
									className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								>
									{v.name} {v.provider ? `(${v.provider})` : ''}
								</option>
							))}
						</DesktopNativeSelect>
					</motion.div>
				)}
			</AnimatePresence>

			<div className={voiceStageShellClass} data-studio-gu-guide="dialog-stage">
				<div className="mb-4 flex items-center gap-2 text-(--desktop-text-secondary)">
					{stageInfo.icon}
					<span className={DESKTOP_TYPOGRAPHY.body}>{stageInfo.text}</span>
				</div>

				<motion.button
					type="button"
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
					onClick={
						dialog.isRecording ? dialog.stopRecording : dialog.startRecording
					}
					disabled={
						dialog.pipelineStage !== 'idle' &&
						dialog.pipelineStage !== 'completed' &&
						dialog.pipelineStage !== 'error' &&
						!dialog.isRecording
					}
					className={cn(
						'relative flex h-28 w-28 items-center justify-center rounded-full border transition-all',
						dialog.isRecording
							? 'animate-pulse border-red-500/35 bg-red-600/90 text-white shadow-[0_20px_50px_rgba(0,0,0,0.45)]'
							: dialog.pipelineStage === 'idle' ||
									dialog.pipelineStage === 'completed' ||
									dialog.pipelineStage === 'error'
								? micButtonIdleShell
								: 'cursor-not-allowed border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)'
					)}
				>
					{dialog.isRecording ? (
						<Square2StackIcon
							className="h-10 w-10 text-white"
							strokeWidth={sw}
						/>
					) : (
						<MicrophoneIcon className="h-10 w-10" strokeWidth={sw} />
					)}
				</motion.button>

				{dialog.error && (
					<div className="mt-4 flex w-full max-w-md items-center gap-2 rounded-(--desktop-radius) border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
						<ExclamationCircleIcon className={ic} strokeWidth={sw} />
						<span className="flex-1">{dialog.error}</span>
						<button
							type="button"
							onClick={dialog.reset}
							className={cn(
								'rounded-lg p-1.5 text-red-200 hover:bg-red-500/15',
								DESKTOP_INTERACTIVE.focusRing
							)}
							aria-label="Сбросить"
						>
							<ArrowPathIcon className="h-4 w-4" strokeWidth={sw} />
						</button>
					</div>
				)}
			</div>

			<div
				className="min-h-0 flex-1 space-y-3 overflow-y-auto"
				data-studio-gu-guide="dialog-history"
			>
				<div className="flex items-center gap-2 text-(--desktop-text-muted)">
					<ClockIcon className={DESKTOP_LUCIDE.lg} strokeWidth={sw} />
					<span
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-(--desktop-text-secondary)'
						)}
					>
						История разговора
					</span>
				</div>

				{dialog.conversation.length === 0 ? (
					<div
						className={cn(
							DESKTOP_APP_STYLE_CONTRACT.softCard,
							'py-10 text-center text-(--desktop-text-muted)'
						)}
					>
						<MicrophoneIcon
							className="mx-auto mb-3 h-10 w-10 opacity-40"
							strokeWidth={sw}
						/>
						<p className={DESKTOP_TYPOGRAPHY.body}>
							Нажмите на микрофон, чтобы начать разговор
						</p>
					</div>
				) : (
					<div className="space-y-2">
						{dialog.conversation.map((item) => (
							<motion.div
								key={item.id}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								className={cn(
									'rounded-(--desktop-radius-lg) border p-3',
									item.type === 'user'
										? 'ml-6 border-(--desktop-border-subtle) bg-(--desktop-surface-soft)'
										: 'mr-6 border-[rgb(var(--desktop-accent-rgb)/0.22)] bg-(--desktop-surface-accent)'
								)}
							>
								<span
									className={cn(
										DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
										'mb-1 block'
									)}
								>
									{item.type === 'user' ? 'Вы' : 'AI'}
								</span>
								<p className={DESKTOP_TYPOGRAPHY.body}>{item.text}</p>
								{item.audioUrl ? (
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className="mt-2"
										onClick={() => dialog.playAudio(item.audioUrl as string)}
									>
										<PlayIcon className="h-4 w-4" strokeWidth={sw} />
										Воспроизвести
									</DesktopAppButton>
								) : null}
							</motion.div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
