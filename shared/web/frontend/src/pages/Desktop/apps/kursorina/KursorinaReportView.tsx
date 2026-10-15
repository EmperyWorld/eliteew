/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Analytical report reader and active investigation progress view for Kursorina.
 *
 * Invariants:
 * - Markdown is sanitized and hierarchy-rendered via KursorinaReportMarkdown.
 * - Live states reflect backend snapshot without synthetic kitchen.
 *
 * Related:
 * - shared/web/frontend/src/pages/Desktop/apps/kursorina/KursorinaReportMarkdown.tsx
 * - shared/web/frontend/src/pages/Desktop/apps/kursorina/types.ts
 */

import { useState, type ReactElement } from 'react';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	CheckIcon,
	ClipboardDocumentIcon,
	ClockIcon,
	ExclamationTriangleIcon,
	StopIcon,
} from '@heroicons/react/24/outline';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { AuthenticatedContentDownloadImage } from '@/features/desktop-ai-chat/DesktopAiChatMarkdown.media';
import { cn } from '@/utils/cn';
import { KursorinaReportMarkdown } from './KursorinaReportMarkdown';
import {
	contentDownloadApiPath,
	libraryImageTitle,
	listLibraryImageResults,
} from './kursorinaMedia';
import {
	KURSORINA_CONTENT_PAD,
	KURSORINA_CONTENT_SHELL,
} from './kursorinaLayout';
import {
	copyToClipboard,
	downloadMarkdownFile,
	extractTopicFromGoal,
	formatFullDate,
} from './kursorinaUtils';
import type { MissionPublicView } from './types';

interface KursorinaReportViewProps {
	mission: MissionPublicView;
	onCancel: () => Promise<void>;
	onRetry?: () => void;
}

export function KursorinaReportView({
	mission,
	onCancel,
	onRetry,
}: KursorinaReportViewProps): ReactElement {
	const [copied, setCopied] = useState(false);

	const topic = extractTopicFromGoal(mission.goal);
	const resultsCount = mission.results?.length ?? 0;
	const chartResults = listLibraryImageResults(mission.results);
	const isQueued = mission.status === 'queued';
	const isRunning = mission.status === 'running';
	const isCompleted = mission.status === 'completed';
	const isBlocked = mission.status === 'blocked';
	const isCancelled = mission.status === 'cancelled';

	const handleCopy = async (): Promise<void> => {
		if (!mission.answer) return;
		const ok = await copyToClipboard(mission.answer);
		if (ok) {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const handleDownload = (): void => {
		if (!mission.answer) return;
		downloadMarkdownFile(`Курсорина - ${topic}.md`, mission.answer);
	};

	// Word count and estimated reading time
	const wordsCount = mission.answer ? mission.answer.split(/\s+/).length : 0;
	const readMinutes = Math.max(1, Math.ceil(wordsCount / 180));

	return (
		<div
			className={cn(
				'flex h-full min-h-0 flex-1 flex-col overflow-y-auto',
				KURSORINA_CONTENT_PAD
			)}
		>
			<div className={cn(KURSORINA_CONTENT_SHELL, 'gap-5')}>
				{/* Honest status stages — not invent «Поиск/Анализ» from result count */}
				<div
					className="rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/35 px-3 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
					data-kursorina-progress="honest"
				>
					<div className="grid grid-cols-3 gap-2 text-center">
						{(
							[
								{
									id: 'queue',
									label: 'Очередь',
									active: isQueued,
									done: isRunning || isCompleted || isBlocked || isCancelled,
								},
								{
									id: 'work',
									label:
										isRunning && resultsCount > 0
											? `В работе · ${resultsCount}`
											: 'В работе',
									active: isRunning,
									done: isCompleted || isBlocked || isCancelled,
								},
								{
									id: 'end',
									label: isBlocked
										? 'Остановка'
										: isCancelled
											? 'Отмена'
											: 'Готово',
									active: isCompleted || isBlocked || isCancelled,
									done: isCompleted,
								},
							] as const
						).map((stage) => (
							<div
								key={stage.id}
								className={cn(
									'flex flex-col items-center gap-1.5 rounded-(--desktop-radius) px-2 py-2 text-xs transition-colors',
									stage.active
										? 'bg-[rgb(var(--desktop-accent-rgb)/0.14)] font-semibold text-[rgb(var(--desktop-accent-rgb))]'
										: stage.done
											? 'text-(--desktop-text-secondary)'
											: 'text-(--desktop-text-muted)'
								)}
							>
								<div
									className={cn(
										'h-2 w-2 rounded-full',
										stage.active
											? 'bg-[rgb(var(--desktop-accent-rgb))] motion-safe:animate-pulse'
											: stage.done
												? 'bg-emerald-400'
												: 'bg-zinc-600'
									)}
								/>
								<span>{stage.label}</span>
							</div>
						))}
					</div>
					{mission.progress ? (
						<p className="mt-2 text-center text-[11px] leading-snug text-(--desktop-text-dim)">
							{mission.progress}
						</p>
					) : null}
				</div>

				{/* In-Flight Queued State */}
				{isQueued ? (
					<div className="flex flex-col items-center justify-center gap-4 rounded-(--desktop-radius-lg) border border-amber-500/30 bg-amber-500/5 p-8 text-center">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
							<ClockIcon className="h-6 w-6 motion-safe:animate-pulse" />
						</div>
						<div className="space-y-1">
							<h2 className="text-base font-semibold text-(--desktop-text-primary)">
								Задача поставлена в очередь
							</h2>
							<p className="max-w-md text-xs text-(--desktop-text-muted) leading-relaxed">
								{mission.progress ||
									'Фоновый процесс распределяет ресурсы. Исследование начнется через несколько секунд.'}
							</p>
						</div>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							onClick={() => void onCancel()}
							className="gap-1.5 text-xs text-rose-300 hover:text-rose-200"
						>
							<StopIcon className="h-4 w-4" />
							<span>Отменить</span>
						</DesktopAppButton>
					</div>
				) : null}

				{/* In-Flight Running State */}
				{isRunning ? (
					<div className="flex flex-col gap-4 rounded-(--desktop-radius-lg) border border-sky-500/30 bg-sky-500/5 p-6">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
									<ArrowPathIcon className="h-5 w-5 motion-safe:animate-spin" />
								</div>
								<div>
									<h2 className="text-sm font-semibold text-(--desktop-text-primary)">
										Идет расследование
									</h2>
									<p className="text-xs text-sky-200/80">
										{mission.progress || 'Собираю первоисточники и факты…'}
									</p>
								</div>
							</div>

							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								onClick={() => void onCancel()}
								className="gap-1.5 text-xs text-rose-300 hover:text-rose-200"
							>
								<StopIcon className="h-4 w-4" />
								<span>Остановить</span>
							</DesktopAppButton>
						</div>

						{/* Live evidence hint while running */}
						<div className="space-y-2 pt-2">
							{resultsCount > 0 ? (
								<p className="text-xs text-(--desktop-text-secondary)">
									Находок в журнале: <strong>{resultsCount}</strong>. Полный
									список — во вкладке источников.
								</p>
							) : (
								<>
									<div className="h-4 w-2/3 motion-safe:animate-pulse rounded bg-sky-500/10" />
									<div className="h-3 w-full motion-safe:animate-pulse rounded bg-(--desktop-surface-soft)" />
									<div className="h-3 w-5/6 motion-safe:animate-pulse rounded bg-(--desktop-surface-soft)" />
								</>
							)}
						</div>
					</div>
				) : null}

				{/* Blocked or Cancelled State */}
				{isBlocked || isCancelled ? (
					<div
						className={cn(
							'flex flex-col gap-3 rounded-(--desktop-radius-lg) border p-6',
							isBlocked
								? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
								: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 text-(--desktop-text-secondary)'
						)}
					>
						<div className="flex items-center gap-3">
							<ExclamationTriangleIcon className="h-5 w-5 text-amber-400 shrink-0" />
							<div>
								<h3 className="font-semibold text-sm text-(--desktop-text-primary)">
									{isBlocked
										? 'Не удалось закрыть цель'
										: 'Расследование отменено'}
								</h3>
								<p className="text-xs text-(--desktop-text-secondary) mt-0.5 leading-relaxed">
									{mission.block_reason ||
										(isBlocked
											? 'По найденным источникам не хватило данных для ответа. Уточните цель или повторите позже.'
											: 'Можно запустить снова с той же или уточнённой целью.')}
								</p>
								{isBlocked && resultsCount > 0 ? (
									<p className="text-[11px] text-(--desktop-text-dim) mt-1">
										Уже собрано находок: {resultsCount} — посмотрите вкладку
										источников.
									</p>
								) : null}
							</div>
						</div>
						{onRetry ? (
							<div className="pt-2">
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									onClick={onRetry}
								>
									{isBlocked ? 'Уточнить цель и повторить' : 'Запустить снова'}
								</DesktopAppButton>
							</div>
						) : null}
					</div>
				) : null}

				{/* Final Report Card */}
				{isCompleted && mission.answer ? (
					<article className="overflow-hidden rounded-(--desktop-radius-xl) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) shadow-[0_8px_32px_rgba(0,0,0,0.14)]">
						{/* Report Header Bar */}
						<header className="flex flex-wrap items-center justify-between gap-4 border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_55%,transparent)] px-5 py-4 sm:px-8 lg:px-10">
							<div className="min-w-0 space-y-1">
								<p className="text-[11px] font-medium uppercase tracking-wide text-(--desktop-text-dim)">
									Аналитический отчет
								</p>
								<h2 className="truncate text-base font-semibold tracking-tight text-(--desktop-text-primary)">
									{topic}
								</h2>
								<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--desktop-text-muted)">
									<span>{formatFullDate(mission.updated_at)}</span>
									<span aria-hidden className="opacity-40">
										·
									</span>
									<span>{wordsCount} слов</span>
									<span aria-hidden className="opacity-40">
										·
									</span>
									<span>~{readMinutes} мин</span>
									<span aria-hidden className="opacity-40">
										·
									</span>
									<span className="font-medium text-emerald-400/90">
										{resultsCount} источников
									</span>
								</div>
							</div>

							<div className="flex items-center gap-2 shrink-0">
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									onClick={() => void handleCopy()}
									className="gap-1.5 text-xs"
									title="Скопировать отчет в буфер обмена"
								>
									{copied ? (
										<>
											<CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
											<span className="text-emerald-400">Скопировано!</span>
										</>
									) : (
										<>
											<ClipboardDocumentIcon className="h-3.5 w-3.5" />
											<span>Копировать</span>
										</>
									)}
								</DesktopAppButton>

								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									onClick={handleDownload}
									className="gap-1.5 text-xs"
									title="Скачать файл отчета в формате Markdown"
								>
									<ArrowDownTrayIcon className="h-3.5 w-3.5" />
									<span>Экспорт .MD</span>
								</DesktopAppButton>
							</div>
						</header>

						{/* Charts from library evidence (PNG via Content Manager) */}
						{chartResults.length > 0 ? (
							<section
								aria-label="Графики расследования"
								className="space-y-3 border-b border-(--desktop-border-subtle) px-5 py-5 sm:px-8 lg:px-10"
							>
								<h3 className="text-xs font-semibold uppercase tracking-wide text-(--desktop-text-muted)">
									Графики и визуализации
								</h3>
								<div className="grid gap-4 sm:grid-cols-1 xl:grid-cols-2">
									{chartResults.map((item) => {
										const path = contentDownloadApiPath(item.ref);
										if (!path) return null;
										const title = libraryImageTitle(item);
										return (
											<figure
												key={item.ref}
												className="overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/50 p-3"
											>
												<figcaption className="mb-2 text-xs font-medium text-(--desktop-text-secondary)">
													{title}
												</figcaption>
												<AuthenticatedContentDownloadImage
													apiPath={path}
													alt={title}
												/>
											</figure>
										);
									})}
								</div>
							</section>
						) : null}

						{/* Markdown Content Area — explicit hierarchy, no raw ### */}
						<div className="px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
							<KursorinaReportMarkdown content={mission.answer} />
						</div>
					</article>
				) : null}
			</div>
		</div>
	);
}
