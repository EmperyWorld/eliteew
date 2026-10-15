/**
 * Транскрипция длинных файлов (Whisper async) — вкладка Студии ГУ, канон desktop.
 */

import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { cn } from '@/lib/utils';
import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { useStudioTranscription } from './hooks/useStudioTranscription';
import { SUPPORTED_FORMATS } from './transcription/studioTranscriptionConstants';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowUpTrayIcon,
	CheckIcon,
	ChevronDownIcon,
	ClockIcon,
	Cog6ToothIcon,
	CpuChipIcon,
	DocumentDuplicateIcon,
	DocumentTextIcon,
	GlobeAltIcon,
	MicrophoneIcon,
	MusicalNoteIcon,
	SparklesIcon,
	SpeakerWaveIcon,
	Square2StackIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

const sw = DESKTOP_LUCIDE.stroke;

export const StudioTranscriptionTab: React.FC = () => {
	const t = useStudioTranscription();
	const transcriptionFileInputId = React.useId();
	const shellFrame = useDesktopShellFrame();
	const panelClass = React.useMemo(
		() => cn('p-4', getDesktopShellContentPanelClassName(shellFrame)),
		[shellFrame]
	);
	const recordCtaClass = React.useMemo(
		() =>
			cn(
				DESKTOP_INTERACTIVE.btnRounded,
				'flex w-full items-center justify-center gap-2 py-3',
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				'hover:border-[rgb(var(--desktop-accent-rgb)/0.35)]'
			),
		[shellFrame]
	);

	return (
		<div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-1">
			<div
				className="flex flex-wrap items-center justify-end gap-2"
				data-studio-gu-guide="transcription-toolbar"
			>
				<button
					type="button"
					onClick={() => t.setShowHistory(!t.showHistory)}
					className={cn(
						'rounded-(--desktop-radius-md) p-2.5 text-(--desktop-text-secondary)',
						DESKTOP_INTERACTIVE.btnRounded,
						t.showHistory &&
							'border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-(--desktop-surface-accent)'
					)}
					title="История"
					aria-label="Показать историю"
				>
					<ClockIcon className={DESKTOP_LUCIDE.lg} strokeWidth={sw} />
				</button>
				<button
					type="button"
					onClick={() => t.setShowSettings(!t.showSettings)}
					className={cn(
						'rounded-(--desktop-radius-md) p-2.5 text-(--desktop-text-secondary)',
						DESKTOP_INTERACTIVE.btnRounded,
						t.showSettings &&
							'border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-(--desktop-surface-accent)'
					)}
					title="Настройки"
					aria-label="Показать настройки"
				>
					<Cog6ToothIcon className={DESKTOP_LUCIDE.lg} strokeWidth={sw} />
				</button>
			</div>

			<div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
				<div className="flex min-h-0 flex-col gap-4 lg:col-span-1">
					<AnimatePresence>
						{t.showSettings && (
							<motion.div
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: 'auto' }}
								exit={{ opacity: 0, height: 0 }}
								className={cn(panelClass, 'space-y-4')}
							>
								<h3 className="flex items-center gap-2 font-semibold text-(--desktop-text-primary)">
									<Cog6ToothIcon className="h-4 w-4" strokeWidth={sw} />
									Настройки
								</h3>
								<div>
									<label
										className="mb-2 block text-sm text-(--desktop-text-muted) antialiased"
										htmlFor="studio-gu-lang"
									>
										<GlobeAltIcon
											className="mr-1 inline h-4 w-4"
											strokeWidth={sw}
										/>
										Язык
									</label>
									<DesktopNativeSelect
										id="studio-gu-lang"
										value={t.language}
										onChange={(e) => t.setLanguage(e.target.value)}
										className="text-sm"
									>
										{t.LANGUAGES.map((l) => (
											<option
												key={l.value}
												value={l.value}
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{l.label}
											</option>
										))}
									</DesktopNativeSelect>
								</div>
								<div>
									<label
										className="mb-2 block text-sm text-(--desktop-text-muted) antialiased"
										htmlFor="studio-gu-stt-model"
									>
										<CpuChipIcon
											className="mr-1 inline h-4 w-4"
											strokeWidth={sw}
										/>
										Модель STT (сервер)
									</label>
									<p
										id="studio-gu-stt-model"
										className="rounded-(--desktop-radius-md) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)"
									>
										{t.sttModelLabel}
										<span className="mt-1 block text-xs text-(--desktop-text-muted)">
											Размер весов задаётся на сервере (stack9), не
											переключается из UI.
										</span>
									</p>
								</div>
							</motion.div>
						)}
					</AnimatePresence>

					<input
						id={transcriptionFileInputId}
						ref={t.fileInputRef}
						type="file"
						accept={SUPPORTED_FORMATS}
						onChange={t.handleFileSelect}
						className="sr-only"
						aria-label="Выбрать аудио файл"
					/>
					<label
						ref={t.dropZoneRef}
						htmlFor={transcriptionFileInputId}
						data-studio-gu-guide="transcription-upload"
						// biome-ignore lint/a11y/noNoninteractiveTabindex: dropzone needs keyboard focus for Enter/Space alongside drag-and-drop
						tabIndex={0}
						aria-label="Загрузка аудио: перетащите файл или нажмите Enter"
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								t.fileInputRef.current?.click();
							}
						}}
						onDrop={t.handleDrop}
						onDragOver={(e) => e.preventDefault()}
						className={cn(
							'relative block cursor-pointer rounded-(--desktop-radius-xl) border-2 border-dashed p-6 transition-colors',
							t.file
								? 'border-[rgb(var(--desktop-accent-rgb)/0.5)] bg-(--desktop-surface-accent)'
								: 'border-(--desktop-border-subtle) hover:border-[rgb(var(--desktop-accent-rgb)/0.35)] hover:bg-(--desktop-surface-soft)'
						)}
					>
						<div className="text-center">
							{t.file ? (
								<>
									<MusicalNoteIcon
										className="mx-auto mb-3 h-10 w-10 text-[rgb(var(--desktop-accent-rgb)/0.9)]"
										strokeWidth={sw}
									/>
									<p className="truncate font-medium text-(--desktop-text-primary)">
										{t.file.name}
									</p>
									<p className="text-sm text-(--desktop-text-muted) antialiased">
										{(t.file.size / 1024 / 1024).toFixed(2)} MB
									</p>
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											t.reset();
										}}
										className={cn(
											'mt-3 rounded-(--desktop-radius-md) px-3 py-1 text-sm',
											DESKTOP_INTERACTIVE.btnRounded,
											'bg-(--desktop-surface-panel-strong) text-(--desktop-text-primary)'
										)}
									>
										<XMarkIcon
											className="mr-1 inline h-4 w-4"
											strokeWidth={sw}
										/>
										Удалить
									</button>
								</>
							) : (
								<>
									<ArrowUpTrayIcon
										className="mx-auto mb-3 h-10 w-10 text-(--desktop-text-muted)"
										strokeWidth={sw}
									/>
									<p className="font-medium text-(--desktop-text-primary)">
										Перетащите файл сюда
									</p>
									<p className="text-sm text-(--desktop-text-muted) antialiased">
										или нажмите для выбора
									</p>
									<p className={cn('mt-2', DESKTOP_TYPOGRAPHY.meta)}>
										MP3, WAV, M4A, FLAC, OGG, MP4, AVI, MOV
									</p>
								</>
							)}
						</div>
					</label>

					<div className={cn(panelClass, 'space-y-3')}>
						<h3 className="flex items-center gap-2 font-semibold text-(--desktop-text-primary)">
							<MicrophoneIcon className="h-4 w-4" strokeWidth={sw} />
							Запись с микрофона
						</h3>
						{t.isRecording ? (
							<div className="space-y-3">
								<div className="h-2 overflow-hidden rounded-full bg-(--desktop-surface-panel-strong)">
									<motion.div
										className="h-full bg-[linear-gradient(90deg,color-mix(in_srgb,var(--desktop-surface-panel-strong)_60%,transparent)_0%,rgb(var(--desktop-accent-rgb))_100%)]"
										animate={{ width: `${t.audioLevel * 100}%` }}
										transition={{ duration: 0.1 }}
									/>
								</div>
								<div className="text-center">
									<span className="font-mono text-2xl text-red-400">
										{t.formatRecordingClock(t.recordingTime)}
									</span>
								</div>
								<button
									type="button"
									onClick={t.stopRecording}
									className="flex w-full items-center justify-center gap-2 rounded-(--desktop-radius-lg) bg-red-600 py-3 font-medium text-white hover:bg-red-500"
								>
									<Square2StackIcon className="h-5 w-5" />
									Остановить запись
								</button>
							</div>
						) : (
							<button
								type="button"
								onClick={t.startRecording}
								disabled={t.status === 'processing'}
								className={recordCtaClass}
							>
								<MicrophoneIcon className="h-5 w-5" strokeWidth={sw} />
								Начать запись
							</button>
						)}
					</div>

					<button
						type="button"
						onClick={t.transcribe}
						disabled={
							!t.file || t.status === 'processing' || t.status === 'recording'
						}
						data-studio-gu-guide="transcription-run"
						className={cn(
							DESKTOP_INTERACTIVE.btnRounded,
							'flex w-full items-center justify-center gap-2 border border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[color-mix(in_srgb,var(--desktop-surface-accent)_92%,transparent)] py-3.5 text-lg font-semibold text-(--desktop-text-primary) disabled:cursor-not-allowed disabled:opacity-50'
						)}
					>
						{t.status === 'processing' ? (
							<>
								<ArrowPathIcon className="h-5 w-5 motion-safe:animate-spin motion-reduce:animate-none" />
								Транскрибация… {t.progress}%
							</>
						) : (
							<>
								<SparklesIcon className="h-5 w-5" />
								Транскрибировать
							</>
						)}
					</button>

					{t.status === 'processing' && (
						<div className="h-2 overflow-hidden rounded-full bg-(--desktop-surface-panel-strong)">
							<motion.div
								className="h-full bg-[rgb(var(--desktop-accent-rgb)/0.85)]"
								initial={{ width: 0 }}
								animate={{ width: `${t.progress}%` }}
							/>
						</div>
					)}

					{t.error && (
						<div className="rounded-(--desktop-radius-lg) border border-[rgb(var(--desktop-danger-rgb,220_38_38)/0.45)] bg-[color-mix(in_srgb,rgb(var(--desktop-danger-rgb,220_38_38))_12%,transparent)] p-4 text-[rgb(var(--desktop-danger-rgb,220_38_38)/1)]">
							<p className="font-medium">Ошибка</p>
							<p className="text-sm">{t.error}</p>
							<button
								type="button"
								onClick={t.reset}
								className="mt-2 text-sm underline hover:no-underline"
							>
								Попробовать снова
							</button>
						</div>
					)}
				</div>

				<div className="min-h-0 lg:col-span-2">
					{t.result ? (
						<div
							className={cn(
								panelClass,
								'flex h-full min-h-[240px] flex-col border-(--desktop-border-subtle)'
							)}
						>
							<div className="mb-4 flex flex-wrap items-start justify-between gap-3">
								<div>
									<h3 className="font-semibold text-(--desktop-text-primary)">
										Результат транскрибации
									</h3>
									<div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-(--desktop-text-muted) antialiased">
										<span className="flex items-center gap-1">
											<GlobeAltIcon className="h-4 w-4" strokeWidth={sw} />
											{t.LANGUAGES.find((l) => l.value === t.result?.language)
												?.label || t.result.language}
										</span>
										<span className="flex items-center gap-1">
											<ClockIcon className="h-4 w-4" strokeWidth={sw} />
											{(t.result.duration_ms / 1000).toFixed(1)}s
										</span>
										<span className="flex items-center gap-1">
											<CheckIcon className="h-4 w-4" strokeWidth={sw} />
											{(t.result.confidence * 100).toFixed(0)}%
										</span>
									</div>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<button
										type="button"
										onClick={t.copyToClipboard}
										className={cn(
											'rounded-(--desktop-radius-md) p-2',
											DESKTOP_INTERACTIVE.btnRounded,
											'bg-(--desktop-surface-panel-strong)'
										)}
										title="Копировать"
									>
										{t.copied ? (
											<CheckIcon className="h-4 w-4 text-emerald-400" />
										) : (
											<DocumentDuplicateIcon className="h-4 w-4" />
										)}
									</button>
									<div className="group relative">
										<button
											type="button"
											title="Экспорт"
											aria-label="Экспорт результата"
											className={cn(
												'flex items-center gap-1 rounded-(--desktop-radius-md) p-2',
												DESKTOP_INTERACTIVE.btnRounded,
												'bg-(--desktop-surface-panel-strong)'
											)}
										>
											<ArrowDownTrayIcon className="h-4 w-4" />
											<ChevronDownIcon className="h-3 w-3" />
										</button>
										<div className="invisible absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-(--desktop-radius-md) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) py-1 opacity-0 shadow-(--desktop-shadow-soft) transition-opacity group-hover:visible group-hover:opacity-100">
											<button
												type="button"
												onClick={t.exportAsTxt}
												className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--desktop-surface-accent)"
											>
												<DocumentTextIcon className="h-4 w-4" /> TXT
											</button>
											<button
												type="button"
												onClick={t.exportAsSrt}
												className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--desktop-surface-accent)"
											>
												<SpeakerWaveIcon className="h-4 w-4" /> SRT
											</button>
											<button
												type="button"
												onClick={t.exportAsJson}
												className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--desktop-surface-accent)"
											>
												<DocumentTextIcon className="h-4 w-4" /> JSON
											</button>
										</div>
									</div>
									<button
										type="button"
										onClick={t.reset}
										className={cn(
											'rounded-(--desktop-radius-md) p-2',
											DESKTOP_INTERACTIVE.btnRounded,
											'bg-(--desktop-surface-panel-strong)'
										)}
										title="Новая транскрибация"
									>
										<ArrowPathIcon className="h-4 w-4" />
									</button>
								</div>
							</div>
							<div className="max-h-[min(50vh,420px)] flex-1 overflow-y-auto rounded-(--desktop-radius-md) bg-(--desktop-surface-panel-strong) p-4">
								<p className="whitespace-pre-wrap leading-relaxed text-(--desktop-text-primary)">
									{t.result.text}
								</p>
							</div>
							{t.result.segments && t.result.segments.length > 0 && (
								<div className="mt-4">
									<h4 className="mb-2 text-sm font-medium text-(--desktop-text-muted)">
										Сегменты с таймкодами
									</h4>
									<div className="max-h-40 space-y-2 overflow-y-auto">
										{t.result.segments.map((seg) => (
											<div
												key={`${seg.start}-${seg.end}-${seg.text.slice(0, 48)}`}
												className="flex gap-3 text-sm"
											>
												<span className="whitespace-nowrap font-mono text-(--desktop-text-muted)">
													{seg.start.toFixed(1)}s
												</span>
												<span className="text-(--desktop-text-primary)">
													{seg.text}
												</span>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					) : (
						<div
							className={cn(
								panelClass,
								'flex h-full min-h-[240px] flex-col items-center justify-center border-dashed text-center'
							)}
						>
							<MusicalNoteIcon className="mb-4 h-14 w-14 text-(--desktop-text-muted)" />
							<h3 className="mb-2 text-lg font-medium text-(--desktop-text-secondary)">
								Результат появится здесь
							</h3>
							<p className="max-w-md text-(--desktop-text-muted)">
								Загрузите аудио или видео, запишите с микрофона, затем нажмите
								«Транскрибировать».
							</p>
						</div>
					)}
				</div>
			</div>

			<AnimatePresence>
				{t.showHistory && t.history.length > 0 && (
					<motion.div
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 12 }}
						className={cn(panelClass, 'mt-2')}
						title="История только в этом браузере"
					>
						<div className="mb-4 flex items-center justify-between">
							<h3 className="flex items-center gap-2 font-semibold text-(--desktop-text-primary)">
								<ClockIcon className="h-4 w-4" strokeWidth={sw} />
								История
								<span className={cn(DESKTOP_TYPOGRAPHY.meta)}>локально</span>
							</h3>
							<button
								type="button"
								onClick={t.clearHistory}
								className="flex items-center gap-1 text-sm text-(--desktop-text-muted) antialiased hover:text-red-400"
							>
								<TrashIcon className="h-4 w-4" />
								Очистить
							</button>
						</div>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
							{t.history.map((item) => (
								<button
									key={item.id}
									type="button"
									className={cn(
										'rounded-(--desktop-radius-md) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) p-3 text-left transition-colors hover:border-[rgb(var(--desktop-accent-rgb)/0.35)]'
									)}
									onClick={() => t.restoreFromHistory(item)}
								>
									<p className="truncate text-sm font-medium text-(--desktop-text-primary)">
										{item.filename}
									</p>
									<p className={cn('mt-1 truncate', DESKTOP_TYPOGRAPHY.meta)}>
										{item.text}
									</p>
									<div
										className={cn(
											'mt-2 flex items-center gap-2',
											DESKTOP_TYPOGRAPHY.meta
										)}
									>
										<span>{new Date(item.timestamp).toLocaleDateString()}</span>
										<span>•</span>
										<span>{(item.duration_ms / 1000).toFixed(1)}s</span>
									</div>
								</button>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

export default StudioTranscriptionTab;
