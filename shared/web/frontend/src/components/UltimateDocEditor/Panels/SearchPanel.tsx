/**
 * 🔥💎 MagnifyingGlassIcon Panel 💎🔥
 *
 * Document search panel with Elasticsearch + ChromaDB
 *
 * Features:
 * - Full-text search (Elasticsearch - keyword-based)
 * - Semantic search (ChromaDB - meaning-based with AI embeddings)
 * - MagnifyingGlassIcon history
 * - Result highlighting
 * - Quick filters (by date, type, tags)
 * - Sort options (relevance, date, title)
 *
 * Created: 2025-10-18
 */

import { motion } from 'framer-motion';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocEditorSidePanelZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
	DesktopAppPanel,
	DesktopAppStatusBadge,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { useDocumentSearch } from '../hooks/useDocumentSearch';
import type { SearchPanelProps } from '../types/editor.types';
import { sanitizeSearchHighlightHtml } from '@/utils/sanitizeUserHtml';
import {
	ArrowPathIcon,
	CalendarIcon,
	ClockIcon,
	DocumentTextIcon,
	MagnifyingGlassIcon,
	SparklesIcon,
	TagIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

type SearchTypeOption = {
	value: 'fulltext' | 'semantic';
	label: string;
	description: string;
};

export const SearchPanel: React.FC<SearchPanelProps> = ({
	isOpen,
	onClose,
	onSelectResult,
}) => {
	const { t, i18n } = useTranslation('docEditorPanels');
	const docSidePanelZ = useDocEditorSidePanelZIndex();
	const searchTypeOptions: SearchTypeOption[] = useMemo(
		() => [
			{
				value: 'fulltext',
				label: t('panels.search.typeFulltextLabel'),
				description: t('panels.search.typeFulltextDesc'),
			},
			{
				value: 'semantic',
				label: t('panels.search.typeSemanticLabel'),
				description: t('panels.search.typeSemanticDesc'),
			},
		],
		[t]
	);
	const { results, isSearching, error, search, clearResults } =
		useDocumentSearch();
	const resultItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

	const [query, setQuery] = useState('');
	const [searchType, setSearchType] = useState<'fulltext' | 'semantic'>(
		'fulltext'
	);
	const [searchHistory, setSearchHistory] = useState<string[]>([]);
	const [activeResultId, setActiveResultId] = useState<string | null>(null);

	// Close on Escape
	useEffect(() => {
		if (!isOpen) return;
		const onKeyDown = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				onClose();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [isOpen, onClose]);

	// Load search history from localStorage
	useEffect(() => {
		const history = localStorage.getItem('doc-search-history');
		if (history) {
			try {
				const parsed = JSON.parse(history) as string[];
				if (Array.isArray(parsed)) {
					setSearchHistory(parsed);
				}
			} catch {
				// Ignore parse errors
			}
		}
	}, []);

	useEffect(() => {
		if (results.length === 0) {
			setActiveResultId(null);
			return;
		}
		const firstId = results[0]?.document.id ?? null;
		setActiveResultId((prev) =>
			prev && results.some((r) => r.document.id === prev) ? prev : firstId
		);
	}, [results]);

	useEffect(() => {
		if (!activeResultId) {
			return;
		}
		const node = resultItemRefs.current.get(activeResultId);
		node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}, [activeResultId]);

	useEffect(() => {
		if (!isOpen || results.length === 0) {
			return;
		}
		const onKeyDown = (e: KeyboardEvent): void => {
			const target = e.target as HTMLElement | null;
			if (
				target?.closest('input, textarea, select, [contenteditable="true"]')
			) {
				return;
			}
			const idx = results.findIndex((r) => r.document.id === activeResultId);
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				const nextIndex = idx < 0 ? 0 : Math.min(results.length - 1, idx + 1);
				const nextId = results[nextIndex]?.document.id;
				if (nextId) setActiveResultId(nextId);
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				const nextIndex = idx <= 0 ? 0 : idx - 1;
				const nextId = results[nextIndex]?.document.id;
				if (nextId) setActiveResultId(nextId);
				return;
			}
			if (e.key === 'Enter' && activeResultId) {
				const hit = results.find((r) => r.document.id === activeResultId);
				if (hit) {
					e.preventDefault();
					void onSelectResult(hit.document);
				}
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [isOpen, results, activeResultId, onSelectResult]);

	const handleSearch = async (): Promise<void> => {
		if (!query.trim()) {
			return;
		}

		await search(query.trim(), searchType);

		// Add to search history
		const newHistory = [
			query.trim(),
			...searchHistory.filter((h) => h !== query.trim()),
		].slice(0, 10);
		setSearchHistory(newHistory);
		localStorage.setItem('doc-search-history', JSON.stringify(newHistory));
	};

	const handleKeyPress = (e: React.KeyboardEvent): void => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSearch();
		}
	};

	const handleSelectHistory = (historyQuery: string): void => {
		setQuery(historyQuery);
	};

	const handleClearHistory = (): void => {
		setSearchHistory([]);
		localStorage.removeItem('doc-search-history');
	};

	const formatDate = useCallback(
		(dateString: string): string => {
			const date = new Date(dateString);
			const now = new Date();
			const diff = now.getTime() - date.getTime();
			const days = Math.floor(diff / (1000 * 60 * 60 * 24));

			if (days === 0) {
				return t('panels.search.date.today');
			}
			if (days === 1) {
				return t('panels.search.date.yesterday');
			}
			if (days < 7) {
				return t('panels.search.date.daysAgo', { count: days });
			}
			if (days < 30) {
				return t('panels.search.date.weeksAgo', {
					count: Math.floor(days / 7),
				});
			}
			if (days < 365) {
				return t('panels.search.date.monthsAgo', {
					count: Math.floor(days / 30),
				});
			}
			return date.toLocaleDateString(
				i18n.language.startsWith('ru') ? 'ru-RU' : 'en-US'
			);
		},
		[t, i18n.language]
	);

	if (!isOpen) {
		return null;
	}

	return (
		<motion.div
			role="dialog"
			aria-modal="true"
			aria-labelledby="search-panel-title"
			initial={{ opacity: 0, x: 100 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: 100 }}
			transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] as const }}
			className="search-panel fixed bottom-0 right-0 top-0 flex min-h-0 w-[520px] max-w-[calc(100vw-1rem)] flex-col border-l border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel) backdrop-blur-2xl"
			style={{ zIndex: docSidePanelZ }}
		>
			{/* Header — shared chrome typography with other doc editor panels */}
			<div className="shrink-0 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div className="flex min-w-0 items-center gap-3">
						<div className="shrink-0 rounded-xl border border-teal-400/30 bg-linear-to-br from-teal-500/30 to-indigo-500/30 p-2">
							<MagnifyingGlassIcon
								className="text-teal-300"
								width={18}
								height={18}
								aria-hidden
							/>
						</div>
						<div className="min-w-0">
							<h3
								id="search-panel-title"
								className="truncate text-base font-semibold leading-tight tracking-tight text-(--desktop-text-primary)"
							>
								{t('panels.search.title')}
							</h3>
							<p className="text-xs leading-snug text-(--desktop-text-muted)">
								{t('panels.search.subtitle')}
							</p>
						</div>
					</div>
					<DesktopAppButton
						type="button"
						onClick={onClose}
						variant="ghost"
						size="icon"
						title={t('panels.search.closeTitle')}
						aria-label={t('panels.search.closeAria')}
					>
						<XMarkIcon width={18} height={18} />
					</DesktopAppButton>
				</div>
			</div>

			{/* MagnifyingGlassIcon Input */}
			<div className="space-y-3 border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-panel)_88%,transparent)] p-4">
				{/* MagnifyingGlassIcon Type Selection */}
				<div className="flex gap-2">
					{searchTypeOptions.map((option) => (
						<DesktopAppButton
							key={option.value}
							onClick={() => {
								const value = option.value;
								if (value === 'fulltext' || value === 'semantic') {
									setSearchType(value);
								}
							}}
							variant={searchType === option.value ? 'accent' : 'neutral'}
							active={searchType === option.value}
							className="flex-1"
							title={option.description}
						>
							{option.label}
						</DesktopAppButton>
					))}
				</div>

				{/* MagnifyingGlassIcon Input */}
				<div className="relative">
					<DesktopAppInput
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyPress={handleKeyPress}
						placeholder={
							searchType === 'semantic'
								? t('panels.search.placeholderSemantic')
								: t('panels.search.placeholderFulltext')
						}
						className="w-full py-2 pl-10 pr-4 focus-visible:border-teal-400/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-400/35"
						disabled={isSearching}
					/>
					<MagnifyingGlassIcon
						className="absolute left-3 top-2.5 text-(--desktop-text-dim)"
						width={18}
						height={18}
					/>
				</div>

				{/* MagnifyingGlassIcon Button */}
				<DesktopAppButton
					onClick={handleSearch}
					disabled={!query.trim() || isSearching}
					variant="accent"
					className="w-full py-2.5 font-semibold"
				>
					{isSearching ? (
						<>
							<ArrowPathIcon
								width={18}
								height={18}
								className="animate-spin motion-reduce:animate-none motion-reduce:opacity-80"
							/>
							<span>{t('panels.search.searchingButton')}</span>
						</>
					) : (
						<>
							{searchType === 'semantic' ? (
								<SparklesIcon width={18} height={18} />
							) : (
								<MagnifyingGlassIcon width={18} height={18} />
							)}
							<span>{t('panels.search.searchButton')}</span>
						</>
					)}
				</DesktopAppButton>
			</div>

			{/* MagnifyingGlassIcon History */}
			{searchHistory.length > 0 && results.length === 0 && !isSearching && (
				<div className="border-b border-(--desktop-border-subtle) bg-purple-500/10 p-4">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2 text-sm font-semibold text-(--desktop-text-secondary)">
							<ClockIcon width={16} height={16} className="text-purple-300" />
							<span>{t('panels.search.recentHeading')}</span>
						</div>
						<DesktopAppButton
							onClick={handleClearHistory}
							variant="ghost"
							size="sm"
						>
							{t('panels.search.clearHistory')}
						</DesktopAppButton>
					</div>
					<div className="flex flex-wrap gap-2">
						{searchHistory.map((historyItem) => (
							<button
								type="button"
								key={historyItem}
								onClick={() => handleSelectHistory(historyItem)}
								className="rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-1 text-xs text-(--desktop-text-secondary) transition-all hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)"
							>
								{historyItem}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Results — scroll lives in list + empty/error; flex min-h-0 avoids clipping */}
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
				{/* Error */}
				{error && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						className="mb-4 rounded-lg border border-red-400/30 bg-red-500/20 p-3 text-sm text-red-200"
					>
						❌ {error}
					</motion.div>
				)}

				{/* Results List */}
				{results.length > 0 && (
					<div className="flex min-h-0 flex-1 flex-col gap-3">
						<div className="flex shrink-0 items-center justify-between">
							<div className="text-sm text-(--desktop-text-secondary)">
								{t('panels.search.resultsCount', { count: results.length })}
							</div>
							<DesktopAppButton
								onClick={() => {
									clearResults();
									setActiveResultId(null);
								}}
								variant="ghost"
								size="sm"
							>
								{t('panels.search.clearResults')}
							</DesktopAppButton>
						</div>
						<p className="text-xs text-(--desktop-text-dim)">
							{t('panels.search.keyboardHint')}
						</p>

						<ul
							className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]"
							aria-label={t('panels.search.resultsLabel')}
						>
							{results.map((result) => {
								const isActive = activeResultId === result.document.id;
								return (
									<li key={result.document.id} role="none">
										<motion.button
											type="button"
											ref={(node) => {
												const id = result.document.id;
												if (node) {
													resultItemRefs.current.set(id, node);
												} else {
													resultItemRefs.current.delete(id);
												}
											}}
											initial={{ opacity: 0, scale: 0.95 }}
											animate={{ opacity: 1, scale: 1 }}
											transition={{ duration: 0.2 }}
											onClick={() => {
												setActiveResultId(result.document.id);
												void onSelectResult(result.document);
											}}
											aria-current={isActive ? 'true' : undefined}
											className={`w-full rounded-xl border p-4 text-left transition-all backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] ${
												isActive
													? 'border-[rgb(var(--desktop-accent-rgb))]/45 bg-[color-mix(in_srgb,var(--desktop-surface-accent)_40%,transparent)] shadow-[0_0_0_1px_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_28%,transparent)] hover:bg-[color-mix(in_srgb,var(--desktop-surface-accent)_55%,transparent)]'
													: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft-hover)'
											}`}
										>
											<div className="flex items-start justify-between mb-2">
												<div className="flex items-center gap-2 flex-1">
													<DocumentTextIcon
														width={16}
														height={16}
														className="text-[rgb(var(--desktop-accent-rgb))] shrink-0 mt-0.5"
													/>
													<h4 className="line-clamp-1 font-semibold text-(--desktop-text-primary)">
														{result.document.title}
													</h4>
												</div>
												<DesktopAppStatusBadge className="ml-2 shrink-0 border-[rgb(var(--desktop-accent-rgb))]/35 bg-[color-mix(in_srgb,var(--desktop-surface-accent)_55%,transparent)] text-(--desktop-text-primary)">
													{Math.round(result.score * 100)}%
												</DesktopAppStatusBadge>
											</div>

											{/* Highlights */}
											{result.highlights && result.highlights.length > 0 && (
												<div className="mb-2 line-clamp-2 text-sm text-(--desktop-text-secondary)">
													{result.highlights.map((highlight) => (
														<span
															key={`${result.document.id}-${highlight}`}
															// biome-ignore lint/security/noDangerouslySetInnerHtml: highlight HTML is sanitized via sanitizeSearchHighlightHtml before render
															dangerouslySetInnerHTML={{
																__html: sanitizeSearchHighlightHtml(highlight),
															}}
														/>
													))}
												</div>
											)}

											{/* Content Preview */}
											{!result.highlights && (
												<div className="mb-2 line-clamp-2 text-sm text-(--desktop-text-muted) antialiased">
													{result.document.content
														.replace(/<[^>]*>/g, '')
														.substring(0, 150)}
													...
												</div>
											)}

											{/* Metadata */}
											<div className="flex items-center gap-3 text-xs text-(--desktop-text-dim)">
												<div className="flex items-center gap-1">
													<CalendarIcon width={12} height={12} />
													<span>{formatDate(result.document.updated_at)}</span>
												</div>
												<div className="flex items-center gap-1">
													<DocumentTextIcon width={12} height={12} />
													<span>
														{t('panels.search.wordCount', {
															count: result.document.word_count,
														})}
													</span>
												</div>
												{result.document.tags.length > 0 && (
													<div className="flex items-center gap-1">
														<TagIcon width={12} height={12} />
														<span>{result.document.tags[0]}</span>
														{result.document.tags.length > 1 && (
															<span className="text-(--desktop-text-dim)">
																+{result.document.tags.length - 1}
															</span>
														)}
													</div>
												)}
											</div>
										</motion.button>
									</li>
								);
							})}
						</ul>
					</div>
				)}

				{/* Empty State */}
				{results.length === 0 && !isSearching && !error && (
					<div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto">
						<DesktopAppPanel className="border-dashed bg-transparent">
							<DesktopAppEmptyState
								icon={
									<MagnifyingGlassIcon
										width={48}
										height={48}
										className="mx-auto text-blue-300"
									/>
								}
								title={t('panels.search.emptyTitle')}
								description={
									query
										? t('panels.search.emptyHintWithQuery')
										: t('panels.search.emptyHintNoQuery')
								}
								className="py-10"
							/>
						</DesktopAppPanel>
					</div>
				)}
			</div>
		</motion.div>
	);
};
