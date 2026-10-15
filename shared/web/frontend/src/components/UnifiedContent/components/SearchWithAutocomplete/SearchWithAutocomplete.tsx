/**
 * SearchWithAutocomplete - Поиск с автодополнением
 *
 * Функции:
 * - Автодополнение по именам файлов
 * - Автодополнение по тегам
 * - История поисков
 * - Быстрые фильтры
 */

import * as React from 'react';
import {
	useState,
	useEffect,
	useRef,
	useCallback,
	useMemo,
	useId,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { contentApi } from '../../../../services/contentApi';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppInput,
	DesktopAppStatusBadge,
} from '../../../../pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '../../../../pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellSelectListOptionInteractiveClassName,
} from '../../../../pages/Desktop/utils/desktopVisualSystem';
import { cn } from '../../../../utils/cn';
import { log } from '../../../../utils/logger';
import { readJsonStorage, writeJsonStorage } from '../../../../utils/storage';
import {
	ArrowPathIcon,
	ClockIcon,
	DocumentTextIcon,
	MagnifyingGlassIcon,
	TagIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

interface SearchSuggestion {
	type: 'file' | 'tag' | 'history';
	id?: string;
	label: string;
	subtitle?: string;
	icon?: React.ReactNode;
}

interface SearchWithAutocompleteProps {
	value: string;
	onChange: (value: string) => void;
	onSelect?: (suggestion: SearchSuggestion) => void;
	placeholder?: string;
	className?: string;
	/** Ref для фокуса (Ctrl+F) */
	inputRef?: React.RefObject<HTMLInputElement | null>;
}

function historyToSuggestions(history: string[]): SearchSuggestion[] {
	return history.slice(0, 5).map((h) => ({
		type: 'history' as const,
		label: h,
		subtitle: 'Недавний поиск',
		icon: <ClockIcon className="h-4 w-4" />,
	}));
}

export const SearchWithAutocomplete: React.FC<SearchWithAutocompleteProps> = ({
	value,
	onChange,
	onSelect,
	placeholder = 'Поиск файлов, тегов...',
	className = '',
	inputRef: externalInputRef,
}) => {
	const shellFrame = useDesktopShellFrame();
	const shellContentPanelClass = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);
	const listOptionShell = useMemo(
		() => getDesktopShellSelectListOptionInteractiveClassName(shellFrame),
		[shellFrame]
	);
	const [isOpen, setIsOpen] = useState(false);
	const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
	const [loading, setLoading] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const [searchHistory, setSearchHistory] = useState<string[]>([]);

	const listboxId = useId();
	const internalInputRef = useRef<HTMLInputElement>(null);
	const inputRef = externalInputRef ?? internalInputRef;
	const containerRef = useRef<HTMLDivElement>(null);
	const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const suggestionsRequestIdRef = useRef(0);
	const suggestionsAbortRef = useRef<AbortController | null>(null);

	const queryTrimmed = value.trim();
	const queryMeetsApi = queryTrimmed.length >= 2;

	const panelSuggestions = useMemo((): SearchSuggestion[] => {
		if (!queryMeetsApi) {
			return historyToSuggestions(searchHistory);
		}
		return suggestions;
	}, [queryMeetsApi, searchHistory, suggestions]);

	// Загружаем историю поисков из localStorage
	useEffect(() => {
		try {
			const parsed = readJsonStorage<string[]>('content_search_history', []);
			if (Array.isArray(parsed)) {
				setSearchHistory(parsed.slice(0, 5));
			}
		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : String(e);
			log.warn('Failed to load search history', errorMessage);
		}
	}, []);

	// Сохраняем историю поисков
	const saveToHistory = useCallback((query: string) => {
		if (!query.trim()) {
			return;
		}

		setSearchHistory((prev) => {
			const updated = [query, ...prev.filter((q) => q !== query)].slice(0, 10);
			writeJsonStorage('content_search_history', updated);
			return updated.slice(0, 5);
		});
	}, []);

	// Загружаем предложения (только для запроса >= 2 символов)
	const fetchSuggestions = useCallback(
		async (query: string): Promise<void> => {
			if (!query.trim() || query.length < 2) {
				return;
			}

			const requestId = ++suggestionsRequestIdRef.current;
			suggestionsAbortRef.current?.abort();
			const controller = new AbortController();
			suggestionsAbortRef.current = controller;
			setLoading(true);
			try {
				const apiSuggestions = await contentApi.getAutocompleteSuggestions(
					query,
					{
						limit: 5,
						signal: controller.signal,
					}
				);
				const results: SearchSuggestion[] = apiSuggestions.map(
					(suggestion) => ({
						type: suggestion.type,
						id: suggestion.id,
						label:
							suggestion.type === 'tag'
								? `#${suggestion.label}`
								: suggestion.label,
						subtitle: suggestion.subtitle,
						icon:
							suggestion.type === 'file' ? (
								<DocumentTextIcon className="h-4 w-4" />
							) : (
								<TagIcon className="h-4 w-4" />
							),
					})
				);

				const historyMatches = searchHistory
					.filter((h) => h.toLowerCase().includes(query.toLowerCase()))
					.slice(0, 3)
					.map((h) => ({
						type: 'history' as const,
						label: h,
						subtitle: 'История поиска',
						icon: <ClockIcon className="h-4 w-4" />,
					}));

				results.push(...historyMatches);

				if (requestId === suggestionsRequestIdRef.current) {
					setSuggestions(results);
				}
			} catch (error) {
				if (controller.signal.aborted) {
					return;
				}
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				log.error('Failed to fetch suggestions:', errorMessage);
				if (requestId === suggestionsRequestIdRef.current) {
					setSuggestions([]);
				}
			} finally {
				if (requestId === suggestionsRequestIdRef.current) {
					setLoading(false);
				}
			}
		},
		[searchHistory]
	);

	useEffect(() => {
		if (!queryMeetsApi) {
			if (debounceTimer.current) {
				clearTimeout(debounceTimer.current);
				debounceTimer.current = null;
			}
			suggestionsAbortRef.current?.abort();
			setLoading(false);
			return;
		}

		if (debounceTimer.current) {
			clearTimeout(debounceTimer.current);
		}

		debounceTimer.current = setTimeout(() => {
			void fetchSuggestions(queryTrimmed);
		}, 300);

		return (): void => {
			if (debounceTimer.current) {
				clearTimeout(debounceTimer.current);
			}
		};
	}, [queryTrimmed, queryMeetsApi, fetchSuggestions]);

	useEffect(
		() => () => {
			suggestionsAbortRef.current?.abort();
		},
		[]
	);

	useEffect(() => {
		if (selectedIndex >= panelSuggestions.length) {
			setSelectedIndex(
				panelSuggestions.length > 0 ? panelSuggestions.length - 1 : -1
			);
		}
	}, [panelSuggestions.length, selectedIndex]);

	useEffect(() => {
		if (selectedIndex < 0 || !isOpen) {
			return;
		}
		const el = document.getElementById(`${listboxId}-opt-${selectedIndex}`);
		el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}, [selectedIndex, isOpen, listboxId]);

	// Обработка выбора предложения
	const handleSelect = useCallback(
		(suggestion: SearchSuggestion): void => {
			let searchValue = suggestion.label;

			if (suggestion.type === 'tag') {
				searchValue = suggestion.label.replace('#', '');
			}

			onChange(searchValue);
			saveToHistory(searchValue);
			setIsOpen(false);
			setSelectedIndex(-1);
			onSelect?.(suggestion);
		},
		[onChange, onSelect, saveToHistory]
	);

	const handleClear = useCallback((): void => {
		onChange('');
		setSelectedIndex(-1);
		setIsOpen(true);
		inputRef.current?.focus();
	}, [onChange, inputRef]);

	// Обработка клавиатуры (combobox)
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>): void => {
			switch (e.key) {
				case 'ArrowDown': {
					e.preventDefault();
					if (!isOpen) {
						setIsOpen(true);
						setSelectedIndex(panelSuggestions.length > 0 ? 0 : -1);
						return;
					}
					if (panelSuggestions.length === 0) {
						return;
					}
					setSelectedIndex((prev) =>
						prev < panelSuggestions.length - 1 ? prev + 1 : prev
					);
					break;
				}
				case 'ArrowUp': {
					e.preventDefault();
					if (!isOpen) {
						return;
					}
					setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
					break;
				}
				case 'Enter': {
					if (!isOpen) {
						return;
					}
					e.preventDefault();
					if (selectedIndex >= 0 && selectedIndex < panelSuggestions.length) {
						const suggestion = panelSuggestions[selectedIndex];
						if (suggestion) {
							handleSelect(suggestion);
						}
					} else if (value.trim()) {
						saveToHistory(value.trim());
						setIsOpen(false);
						setSelectedIndex(-1);
					}
					break;
				}
				case 'Escape': {
					if (!isOpen) {
						return;
					}
					e.preventDefault();
					setIsOpen(false);
					setSelectedIndex(-1);
					break;
				}
				case 'Home': {
					if (!isOpen || panelSuggestions.length === 0) {
						return;
					}
					e.preventDefault();
					setSelectedIndex(0);
					break;
				}
				case 'End': {
					if (!isOpen || panelSuggestions.length === 0) {
						return;
					}
					e.preventDefault();
					setSelectedIndex(panelSuggestions.length - 1);
					break;
				}
				default:
					break;
			}
		},
		[
			isOpen,
			panelSuggestions,
			selectedIndex,
			value,
			handleSelect,
			saveToHistory,
		]
	);

	// Клик вне компонента
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent): void => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
				setSelectedIndex(-1);
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			return (): void => {
				document.removeEventListener('mousedown', handleClickOutside);
			};
		}
		return undefined;
	}, [isOpen]);

	const showPanel = isOpen;
	const showLoadingBlock = queryMeetsApi && loading;
	const activeDescendantId =
		selectedIndex >= 0 && selectedIndex < panelSuggestions.length
			? `${listboxId}-opt-${selectedIndex}`
			: undefined;
	const hasValue = value.length > 0;

	return (
		<div ref={containerRef} className={cn('relative', className)}>
			<div className="relative">
				<MagnifyingGlassIcon
					className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--desktop-text-dim)"
					aria-hidden
				/>
				<DesktopAppInput
					ref={inputRef}
					role="combobox"
					aria-expanded={showPanel}
					aria-controls={listboxId}
					aria-autocomplete="list"
					aria-activedescendant={activeDescendantId}
					aria-busy={showLoadingBlock}
					placeholder={placeholder}
					value={value}
					autoComplete="off"
					onChange={(e) => {
						onChange(e.target.value);
						setIsOpen(true);
						setSelectedIndex(-1);
					}}
					onFocus={() => setIsOpen(true)}
					onKeyDown={handleKeyDown}
					className={cn('w-full pl-10', hasValue ? 'pr-20' : 'pr-10')}
				/>
				{hasValue ? (
					<button
						type="button"
						className={cn(
							'absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-(--desktop-radius) text-(--desktop-text-dim) transition-colors hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary)',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						aria-label="Очистить поле поиска"
						onMouseDown={(e) => {
							e.preventDefault();
						}}
						onClick={handleClear}
					>
						<XMarkIcon className="h-4 w-4 shrink-0" aria-hidden />
					</button>
				) : null}
			</div>

			{/* Список предложений (listbox) */}
			<AnimatePresence>
				{showPanel ? (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.2 }}
						className="absolute z-50 mt-2 w-full"
					>
						<div
							className={cn(
								shellContentPanelClass,
								'min-h-0 overflow-hidden p-1'
							)}
						>
							<div
								id={listboxId}
								role="listbox"
								aria-label="Предложения поиска"
								aria-busy={showLoadingBlock}
							>
								{showLoadingBlock ? (
									<div
										role="status"
										aria-live="polite"
										aria-busy="true"
										className="flex items-center justify-center gap-3 px-4 py-5 text-sm text-(--desktop-text-muted) antialiased"
									>
										<ArrowPathIcon
											className="h-4 w-4 shrink-0 animate-spin text-[rgb(var(--desktop-accent-rgb))]"
											aria-hidden
										/>
										<span className="animate-pulse">Ищем совпадения…</span>
									</div>
								) : panelSuggestions.length > 0 ? (
									<div className="max-h-[min(18rem,50dvh)] overflow-y-auto overscroll-contain py-1 [scrollbar-gutter:stable]">
										{panelSuggestions.map((suggestion, index) => (
											<motion.div
												key={`${listboxId}-${suggestion.type}-${suggestion.id ?? suggestion.label}-${suggestion.subtitle ?? ''}`}
												role="option"
												id={`${listboxId}-opt-${index}`}
												aria-selected={selectedIndex === index}
												initial={{ opacity: 0 }}
												animate={{ opacity: 1 }}
												transition={{ duration: 0.12, delay: index * 0.02 }}
												className={cn(
													'flex cursor-pointer items-center gap-3 rounded-(--desktop-radius) px-3 py-3 text-left transition-[background-color,color,box-shadow] duration-150 outline-none',
													selectedIndex === index
														? cn(
																listOptionShell.highlight,
																'text-(--desktop-text-primary) ring-2 ring-inset ring-[rgb(var(--desktop-accent-rgb))]/40'
															)
														: cn(
																listOptionShell.hoverFocus,
																'text-(--desktop-text-secondary)'
															)
												)}
												onMouseDown={(e) => {
													e.preventDefault();
												}}
												onMouseEnter={() => setSelectedIndex(index)}
												onClick={() => handleSelect(suggestion)}
											>
												<div
													className={cn(
														'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-(--desktop-border-subtle)',
														suggestion.type === 'file'
															? 'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.14)_100%,transparent)] text-[rgb(var(--desktop-accent-rgb))]'
															: suggestion.type === 'tag'
																? 'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.1)_100%,transparent)] text-(--desktop-text-secondary)'
																: 'bg-(--desktop-surface-soft) text-(--desktop-text-muted)'
													)}
												>
													{suggestion.icon}
												</div>
												<div className="min-w-0 flex-1">
													<div className="truncate text-sm font-medium">
														{suggestion.label}
													</div>
													{suggestion.subtitle ? (
														<div className="mt-0.5 truncate text-xs text-(--desktop-text-dim)">
															{suggestion.subtitle}
														</div>
													) : null}
												</div>
												<DesktopAppStatusBadge className="shrink-0 border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-dim)">
													{suggestion.type === 'file'
														? 'Файл'
														: suggestion.type === 'tag'
															? 'Тег'
															: 'История'}
												</DesktopAppStatusBadge>
												{suggestion.type === 'history' ? (
													<ClockIcon
														className="h-3.5 w-3.5 shrink-0 text-(--desktop-text-dim)"
														aria-hidden
													/>
												) : null}
											</motion.div>
										))}
									</div>
								) : (
									<div className="px-4 py-4 text-center text-sm text-(--desktop-text-muted) antialiased">
										{queryMeetsApi
											? 'Ничего не найдено'
											: 'Нет недавних запросов'}
									</div>
								)}
							</div>
						</div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
};

export default SearchWithAutocomplete;
