/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Evidence and findings explorer for Kursorina: filter by source kind, search,
 * link preview, and authenticated PNG chart previews from Content Manager.
 *
 * Invariants:
 * - External URLs opened securely (target="_blank" rel="noreferrer").
 * - Library images load via Bearer download path only (no raw remote img src).
 *
 * Related:
 * - shared/web/frontend/src/pages/Desktop/apps/kursorina/types.ts
 * - shared/web/frontend/src/pages/Desktop/apps/kursorina/kursorinaMedia.ts
 */

import { useState, type ReactElement } from 'react';
import {
	ArrowTopRightOnSquareIcon,
	BanknotesIcon,
	BookOpenIcon,
	BuildingOffice2Icon,
	CalculatorIcon,
	CalendarDaysIcon,
	ChartBarIcon,
	CommandLineIcon,
	DocumentChartBarIcon,
	DocumentTextIcon,
	ExclamationTriangleIcon,
	FolderIcon,
	GlobeAltIcon,
	MagnifyingGlassIcon,
	ShieldCheckIcon,
	SparklesIcon,
	TableCellsIcon,
} from '@heroicons/react/24/outline';
import { AuthenticatedContentDownloadImage } from '@/features/desktop-ai-chat/DesktopAiChatMarkdown.media';
import { cn } from '@/utils/cn';
import {
	contentDownloadApiPath,
	isLibraryImageResult,
	libraryImageTitle,
} from './kursorinaMedia';
import {
	KURSORINA_CONTENT_PAD,
	KURSORINA_CONTENT_SHELL,
	KURSORINA_FINDINGS_GRID,
} from './kursorinaLayout';
import type { MissionResultItem } from './types';

interface KursorinaFindingsViewProps {
	results: MissionResultItem[];
}

function isHttpRef(ref: string): boolean {
	return /^https?:\/\//i.test(ref.trim());
}

function getHostName(ref: string): string {
	try {
		return new URL(ref).hostname;
	} catch {
		return '';
	}
}

function KindIcon({ kind }: { kind: string }): ReactElement {
	switch (kind) {
		case 'web':
			return <GlobeAltIcon className="h-4 w-4 text-sky-400" />;
		case 'library':
		case 'library_hit':
		case 'folder':
			return <BookOpenIcon className="h-4 w-4 text-emerald-400" />;
		case 'python':
			return <CommandLineIcon className="h-4 w-4 text-amber-400" />;
		case 'kbsew':
			return <DocumentTextIcon className="h-4 w-4 text-purple-400" />;
		case 'project':
			return <FolderIcon className="h-4 w-4 text-indigo-400" />;
		case 'diagram':
			return <DocumentChartBarIcon className="h-4 w-4 text-cyan-400" />;
		case 'table':
			return <TableCellsIcon className="h-4 w-4 text-teal-400" />;
		case 'finance':
			return <BanknotesIcon className="h-4 w-4 text-emerald-400" />;
		case 'swot':
			return <SparklesIcon className="h-4 w-4 text-amber-300" />;
		case 'company':
			return <BuildingOffice2Icon className="h-4 w-4 text-blue-400" />;
		case 'entities':
			return <MagnifyingGlassIcon className="h-4 w-4 text-rose-400" />;
		case 'html_report':
			return <DocumentChartBarIcon className="h-4 w-4 text-orange-400" />;
		case 'risk':
			return <ExclamationTriangleIcon className="h-4 w-4 text-rose-400" />;
		case 'benchmark':
			return <ChartBarIcon className="h-4 w-4 text-fuchsia-400" />;
		case 'roadmap':
			return <CalendarDaysIcon className="h-4 w-4 text-sky-400" />;
		case 'compliance':
			return <ShieldCheckIcon className="h-4 w-4 text-emerald-400" />;
		case 'statistics':
			return <CalculatorIcon className="h-4 w-4 text-amber-400" />;
		default:
			return <DocumentTextIcon className="h-4 w-4 text-zinc-400" />;
	}
}

function kindLabel(kind: string): string {
	switch (kind) {
		case 'web':
			return 'Веб-источник';
		case 'library':
		case 'library_hit':
		case 'folder':
			return 'Библиотека';
		case 'python':
			return 'Модель Python';
		case 'kbsew':
			return 'База знаний';
		case 'project':
			return 'Проект';
		case 'diagram':
			return 'Диаграмма';
		case 'table':
			return 'Таблица';
		case 'finance':
			return 'Финансы';
		case 'swot':
			return 'SWOT-матрица';
		case 'company':
			return 'Организация';
		case 'entities':
			return 'Сущности';
		case 'html_report':
			return 'HTML-досье';
		case 'risk':
			return 'Риск-матрица';
		case 'benchmark':
			return 'Бенчмарк';
		case 'roadmap':
			return 'Дорожная карта';
		case 'compliance':
			return 'Комплаенс';
		case 'statistics':
			return 'Статистика';
		default:
			return 'Материал';
	}
}

export function KursorinaFindingsView({
	results,
}: KursorinaFindingsViewProps): ReactElement {
	const [activeKind, setActiveKind] = useState<string>('all');
	const [searchQuery, setSearchQuery] = useState('');

	const kinds = ['all', ...Array.from(new Set(results.map((r) => r.kind)))];

	const filtered = results.filter((r) => {
		if (activeKind !== 'all' && r.kind !== activeKind) return false;
		if (!searchQuery.trim()) return true;
		const q = searchQuery.toLowerCase();
		return (
			r.title.toLowerCase().includes(q) ||
			r.ref.toLowerCase().includes(q) ||
			r.snippet.toLowerCase().includes(q)
		);
	});

	return (
		<div
			className={cn(
				'flex h-full min-h-0 flex-1 flex-col overflow-y-auto',
				KURSORINA_CONTENT_PAD
			)}
		>
			<div className={cn(KURSORINA_CONTENT_SHELL, 'gap-5')}>
				{/* Top Controls: Filter Tabs & Search */}
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--desktop-border-subtle) pb-4">
					<div className="flex flex-wrap items-center gap-1.5">
						{kinds.map((k) => {
							const count =
								k === 'all'
									? results.length
									: results.filter((r) => r.kind === k).length;
							const label = k === 'all' ? 'Все' : kindLabel(k);
							const isActive = activeKind === k;

							return (
								<button
									key={k}
									type="button"
									onClick={() => setActiveKind(k)}
									className={cn(
										'flex items-center gap-1.5 rounded-(--desktop-radius) border px-2.5 py-1 text-xs font-medium transition-colors',
										isActive
											? 'border-[rgb(var(--desktop-accent-rgb))]/40 bg-[rgb(var(--desktop-accent-rgb))]/18 text-[rgb(var(--desktop-accent-rgb))]'
											: 'border-transparent bg-(--desktop-surface-soft) text-(--desktop-text-secondary) hover:text-(--desktop-text-primary)'
									)}
								>
									<span>{label}</span>
									<span className="opacity-75 text-[10px]">({count})</span>
								</button>
							);
						})}
					</div>

					{/* Search in Findings */}
					<div className="relative w-full sm:w-72">
						<MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-(--desktop-text-dim)" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Поиск по источникам…"
							className="h-8 w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) pl-8 pr-2.5 text-xs text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) outline-none transition-colors focus:border-[rgb(var(--desktop-accent-rgb))]/60"
						/>
					</div>
				</div>

				{/* Findings Grid / List */}
				{filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-(--desktop-radius-lg) border border-dashed border-(--desktop-border-subtle) p-10 text-center">
						<DocumentTextIcon className="h-10 w-10 text-(--desktop-text-dim) mb-2" />
						<p className="text-sm font-medium text-(--desktop-text-secondary)">
							{results.length === 0
								? 'Источники еще не собраны'
								: 'По заданному фильтру ничего не найдено'}
						</p>
						<p className="text-xs text-(--desktop-text-muted) max-w-sm mt-1">
							{results.length === 0
								? 'Курсорина добавит ссылки и выдержки из документов по мере прохождения расследования.'
								: 'Попробуйте изменить запрос или выбрать другую категорию источников.'}
						</p>
					</div>
				) : (
					<div className={KURSORINA_FINDINGS_GRID}>
						{filtered.map((item) => {
							const hasUrl = isHttpRef(item.ref);
							const host = hasUrl ? getHostName(item.ref) : '';
							const imagePath = isLibraryImageResult(item)
								? contentDownloadApiPath(item.ref)
								: null;
							const itemKey = `${item.kind}-${item.ref || item.title}-${item.snippet.slice(0, 30)}`;

							return (
								<div
									key={itemKey}
									className="flex flex-col gap-2 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/35 p-4 transition-colors hover:border-[rgb(var(--desktop-accent-rgb))]/35 hover:bg-(--desktop-surface-soft)/70"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-center gap-2 overflow-hidden">
											<KindIcon kind={item.kind} />
											<span className="rounded bg-(--desktop-surface-soft) px-1.5 py-0.5 text-[10px] font-medium text-(--desktop-text-muted)">
												{kindLabel(item.kind)}
											</span>
											{imagePath ? (
												<span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
													График
												</span>
											) : null}
											{host ? (
												<span className="truncate text-xs font-mono text-sky-400/80">
													{host}
												</span>
											) : null}
										</div>

										{hasUrl ? (
											<a
												href={item.ref}
												target="_blank"
												rel="noreferrer"
												className="flex items-center gap-1 text-xs text-(--desktop-text-muted) hover:text-(--desktop-text-primary) transition-colors shrink-0"
												title="Открыть источник в новой вкладке"
											>
												<span>Открыть</span>
												<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
											</a>
										) : null}
									</div>

									<div>
										<h4 className="text-sm font-medium text-(--desktop-text-primary) leading-snug">
											{hasUrl ? (
												<a
													href={item.ref}
													target="_blank"
													rel="noreferrer"
													className="hover:underline hover:text-[rgb(var(--desktop-accent-rgb))] transition-colors"
												>
													{item.title || item.ref}
												</a>
											) : imagePath ? (
												libraryImageTitle(item)
											) : (
												item.title || item.ref
											)}
										</h4>

										{imagePath ? (
											<div className="mt-2 max-w-xl overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/60 p-2">
												<AuthenticatedContentDownloadImage
													apiPath={imagePath}
													alt={libraryImageTitle(item)}
												/>
											</div>
										) : item.snippet ? (
											<p className="mt-1.5 text-xs text-(--desktop-text-secondary) leading-relaxed line-clamp-3">
												{item.snippet}
											</p>
										) : null}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
