/**
 * UserStatistics Component
 * Display user statistics — premium graphite / zinc system (aligned with desktop chrome)
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import type { UserStatistics as UserStatisticsType } from '../../types/profile';
import { formatDate } from '../../types/profile';
import {
	DesktopAppPanel,
	DesktopAppSectionLabel,
} from '../../pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '../../pages/Desktop/context/DesktopShellFrameContext';
import { getDesktopShellContentPanelClassName } from '../../pages/Desktop/utils/desktopVisualSystem';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	ArrowRightEndOnRectangleIcon,
	ArrowTrendingUpIcon,
	BoltIcon,
	CalendarIcon,
	ChatBubbleLeftRightIcon,
	CheckCircleIcon,
	DocumentTextIcon,
	ServerIcon,
	SignalIcon,
	SparklesIcon,
	XCircleIcon,
} from '@heroicons/react/24/outline';

interface UserStatisticsProps {
	statistics: UserStatisticsType;
	embedded?: boolean;
}

export default function UserStatistics({
	statistics,
	embedded = false,
}: UserStatisticsProps): JSX.Element {
	const shellFrame = useDesktopShellFrame();
	const shellPanel = embedded
		? getDesktopShellContentPanelClassName(shellFrame)
		: '';
	const quotaMb = Math.max(statistics.storage_quota_mb || 1, 0.000001);
	const storagePercentage = Math.min(
		100,
		(statistics.storage_used_mb / quotaMb) * 100
	);
	// Bars: share among terminal outcomes (success + fail); if none yet, scale by total (e.g. all pending).
	const terminalAi =
		statistics.completed_ai_generations + statistics.failed_ai_generations;
	const aiBarDenominator = Math.max(
		1,
		terminalAi > 0 ? terminalAi : statistics.total_ai_generations
	);

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
				<StatCard
					panelClassName={shellPanel}
					icon={
						<CalendarIcon
							className={DESKTOP_LUCIDE.lg}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					}
					label="Возраст аккаунта"
					value={`${statistics.account_age_days} дней`}
					delay={0}
				/>

				<StatCard
					panelClassName={shellPanel}
					icon={
						<ArrowRightEndOnRectangleIcon
							className={DESKTOP_LUCIDE.lg}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					}
					label="Всего входов"
					value={statistics.total_logins.toLocaleString()}
					subtitle={`Последний: ${formatDate(statistics.last_login)}`}
					delay={0.05}
				/>

				<StatCard
					panelClassName={shellPanel}
					icon={
						<ChatBubbleLeftRightIcon
							className={DESKTOP_LUCIDE.lg}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					}
					label="Чат-сессии"
					value={statistics.total_chat_sessions.toLocaleString()}
					subtitle={`Активных: ${statistics.active_chat_sessions}`}
					delay={0.1}
				/>

				<StatCard
					panelClassName={shellPanel}
					icon={
						<SignalIcon
							className={DESKTOP_LUCIDE.lg}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					}
					label="Сообщений в чате"
					value={statistics.total_chat_messages.toLocaleString()}
					subtitle={`Токенов: ${statistics.total_chat_tokens.toLocaleString()}`}
					delay={0.15}
				/>

				<StatCard
					panelClassName={shellPanel}
					icon={
						<SparklesIcon
							className={DESKTOP_LUCIDE.lg}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					}
					label="AI генераций"
					value={statistics.total_ai_generations.toLocaleString()}
					subtitle={`Завершено: ${statistics.completed_ai_generations}`}
					delay={0.2}
				/>

				<StatCard
					panelClassName={shellPanel}
					icon={
						<DocumentTextIcon
							className={DESKTOP_LUCIDE.lg}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					}
					label="Контент"
					value={statistics.total_content_items.toLocaleString()}
					subtitle="Всего элементов"
					delay={0.25}
				/>
			</div>

			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.3 }}
				className="rounded-xl"
			>
				<DesktopAppPanel className={cn(shellPanel, 'p-6')}>
					<div className="mb-6 flex items-center gap-3">
						<span className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)">
							<ArrowTrendingUpIcon
								className={DESKTOP_LUCIDE.lg}
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						</span>
						<h2 className="text-lg font-semibold tracking-tight text-(--desktop-text-primary)">
							Эффективность AI
						</h2>
					</div>

					<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
						<div className="flex flex-col items-center justify-center">
							<div className="relative mb-4 h-32 w-32">
								<svg
									className="h-full w-full -rotate-90 transform"
									role="img"
									aria-label="Доля успешных ответов AI"
								>
									<title>Доля успешных ответов AI</title>
									<circle
										cx="64"
										cy="64"
										r="56"
										fill="none"
										stroke="rgba(255,255,255,0.06)"
										strokeWidth="8"
									/>
									<circle
										cx="64"
										cy="64"
										r="56"
										fill="none"
										stroke="url(#successGradient)"
										strokeWidth="8"
										strokeLinecap="round"
										strokeDasharray={`${2 * Math.PI * 56}`}
										strokeDashoffset={`${2 * Math.PI * 56 * (1 - statistics.ai_success_rate / 100)}`}
										className="transition-all duration-1000"
									/>
									<defs>
										<linearGradient
											id="successGradient"
											x1="0%"
											y1="0%"
											x2="100%"
											y2="100%"
										>
											<stop offset="0%" stopColor="rgb(52 211 153 / 0.9)" />
											<stop offset="100%" stopColor="rgb(100 116 139 / 0.85)" />
										</linearGradient>
									</defs>
								</svg>

								<div className="absolute inset-0 flex items-center justify-center">
									<div className="text-center">
										<p className="text-3xl font-semibold tracking-tight text-(--desktop-text-primary)">
											{statistics.ai_success_rate.toFixed(1)}%
										</p>
										<p className={DESKTOP_TYPOGRAPHY.meta}>успех</p>
									</div>
								</div>
							</div>

							<p className="text-center text-sm text-(--desktop-text-secondary)">
								Успешные из завершённых (успех и ошибка), без учёта ожидающих;
								чат и студии генераций
							</p>
						</div>

						<div className="space-y-4 md:col-span-2">
							<div className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4">
								<div className="mb-2 flex items-center justify-between">
									<div className="flex items-center gap-2 text-emerald-400/85">
										<CheckCircleIcon
											className={DESKTOP_LUCIDE.lg}
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										<span className="text-sm font-medium text-(--desktop-text-primary)">
											Успешных генераций
										</span>
									</div>
									<span className="text-lg font-semibold tabular-nums text-(--desktop-text-primary)">
										{statistics.completed_ai_generations}
									</span>
								</div>
								<div className="relative h-1.5 overflow-hidden rounded-full bg-white/6">
									<motion.div
										initial={{ width: 0 }}
										animate={{
											width: `${(statistics.completed_ai_generations / aiBarDenominator) * 100}%`,
										}}
										transition={{ duration: 1, delay: 0.5 }}
										className="absolute h-full rounded-full bg-linear-to-r from-emerald-600/55 to-emerald-700/40"
									/>
								</div>
							</div>

							<div className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4">
								<div className="mb-2 flex items-center justify-between">
									<div className="flex items-center gap-2 text-rose-400/85">
										<XCircleIcon
											className={DESKTOP_LUCIDE.lg}
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										<span className="text-sm font-medium text-(--desktop-text-primary)">
											Неудачных генераций
										</span>
									</div>
									<span className="text-lg font-semibold tabular-nums text-(--desktop-text-primary)">
										{statistics.failed_ai_generations}
									</span>
								</div>
								<div className="relative h-1.5 overflow-hidden rounded-full bg-white/6">
									<motion.div
										initial={{ width: 0 }}
										animate={{
											width: `${(statistics.failed_ai_generations / aiBarDenominator) * 100}%`,
										}}
										transition={{ duration: 1, delay: 0.5 }}
										className="absolute h-full rounded-full bg-linear-to-r from-rose-600/45 to-rose-700/35"
									/>
								</div>
							</div>

							<div className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-slate-400">
										<BoltIcon
											className={DESKTOP_LUCIDE.lg}
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										<span className="text-sm font-medium text-(--desktop-text-primary)">
											Всего AI операций
										</span>
									</div>
									<span className="text-xl font-semibold tabular-nums text-(--desktop-text-primary)">
										{statistics.total_ai_generations}
									</span>
								</div>
							</div>
						</div>
					</div>
				</DesktopAppPanel>
			</motion.div>

			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.35 }}
				className="rounded-xl"
			>
				<DesktopAppPanel className={cn(shellPanel, 'p-6')}>
					<div className="mb-6 flex items-center gap-3">
						<span className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)">
							<ServerIcon
								className={DESKTOP_LUCIDE.lg}
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						</span>
						<h2 className="text-lg font-semibold tracking-tight text-(--desktop-text-primary)">
							Использование хранилища
						</h2>
					</div>

					<div className="space-y-4">
						<div>
							<div className="mb-2 flex items-center justify-between">
								<span className="text-sm text-(--desktop-text-secondary)">
									{statistics.storage_used_mb.toFixed(2)} MB
								</span>
								<span className="text-sm text-(--desktop-text-muted) antialiased">
									из {statistics.storage_quota_mb} MB
								</span>
							</div>

							<div className="relative h-3 overflow-hidden rounded-full bg-white/6">
								<motion.div
									initial={{ width: 0 }}
									animate={{ width: `${storagePercentage}%` }}
									transition={{ duration: 1, delay: 0.5 }}
									className={`absolute h-full rounded-full ${
										storagePercentage > 90
											? 'bg-linear-to-r from-rose-600/70 to-rose-700/55'
											: storagePercentage > 70
												? 'bg-linear-to-r from-amber-600/65 to-amber-700/50'
												: 'bg-linear-to-r from-slate-500/80 to-zinc-600/70'
									}`}
								/>
							</div>

							<div className="mt-2 flex items-center justify-between">
								<span className={DESKTOP_TYPOGRAPHY.meta}>
									{storagePercentage.toFixed(1)}% использовано
								</span>
								<span className={DESKTOP_TYPOGRAPHY.meta}>
									{(
										statistics.storage_quota_mb - statistics.storage_used_mb
									).toFixed(2)}{' '}
									MB свободно
								</span>
							</div>
						</div>

						<div className="mt-6 grid grid-cols-2 gap-4">
							<div className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4">
								<div className="mb-2 flex items-center gap-2 text-(--desktop-text-muted)">
									<DocumentTextIcon
										className={DESKTOP_LUCIDE.md}
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
									<span className="text-xs uppercase tracking-wider">
										Элементов контента
									</span>
								</div>
								<p className="text-2xl font-semibold tabular-nums text-(--desktop-text-primary)">
									{statistics.total_content_items}
								</p>
							</div>

							<div className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4">
								<div className="mb-2 flex items-center gap-2 text-(--desktop-text-muted)">
									<ServerIcon
										className={DESKTOP_LUCIDE.md}
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
									<span className="text-xs uppercase tracking-wider">
										Размер (МБ)
									</span>
								</div>
								<p className="text-2xl font-semibold tabular-nums text-(--desktop-text-primary)">
									{(statistics.storage_used_bytes / 1024 / 1024).toFixed(2)}
								</p>
							</div>
						</div>

						{statistics.storage_used_mb === 0 &&
							statistics.total_content_items === 0 && (
								<p className="mt-2 text-sm text-(--desktop-text-dim)">
									Данные появятся после загрузки файлов в контент (документы,
									медиа).
								</p>
							)}

						{storagePercentage > 80 && (
							<motion.div
								initial={{ opacity: 0, scale: 0.98 }}
								animate={{ opacity: 1, scale: 1 }}
								className={cn(
									'flex items-center gap-3 rounded-lg border p-4',
									storagePercentage > 90
										? 'border-rose-500/35 bg-rose-500/[0.07] text-rose-200/90'
										: 'border-amber-500/30 bg-amber-500/6 text-amber-200/90'
								)}
							>
								<SignalIcon
									className="h-5 w-5 shrink-0"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
								<div>
									<p className="text-sm font-medium">
										{storagePercentage > 90
											? 'Хранилище почти заполнено'
											: 'Хранилище заполнено более чем на 80%'}
									</p>
									<p className="mt-1 text-xs opacity-90">
										Рекомендуем удалить неиспользуемые файлы или обратиться к
										администратору для увеличения квоты.
									</p>
								</div>
							</motion.div>
						)}
					</div>
				</DesktopAppPanel>
			</motion.div>
		</div>
	);
}

interface StatCardProps {
	icon: React.ReactNode;
	label: string;
	value: string | number;
	subtitle?: string;
	delay: number;
	panelClassName?: string;
}

function StatCard({
	icon,
	label,
	value,
	subtitle,
	delay,
	panelClassName,
}: StatCardProps): JSX.Element {
	return (
		<motion.div
			initial={{ opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay, duration: 0.35 }}
			className="group rounded-xl"
		>
			<DesktopAppPanel
				className={cn(
					panelClassName,
					'p-6 transition-colors group-hover:border-(--desktop-border-strong)'
				)}
			>
				<div className="mb-4 flex items-start justify-between">
					<div className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3 text-slate-400 saturate-[0.85]">
						{icon}
					</div>
				</div>

				<div>
					<DesktopAppSectionLabel className="mb-1 block text-[11px] font-medium normal-case tracking-[0.14em] text-(--desktop-text-muted)">
						{label}
					</DesktopAppSectionLabel>
					<p className="mb-1 text-3xl font-semibold tabular-nums tracking-tight text-(--desktop-text-primary)">
						{value}
					</p>
					{subtitle ? (
						<p className="text-xs text-(--desktop-text-dim)">{subtitle}</p>
					) : null}
				</div>
			</DesktopAppPanel>
		</motion.div>
	);
}
