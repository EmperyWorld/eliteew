import { useDebounce } from '@hooks/useDebounce';
import { apiClient } from '@services/api/client';
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
	CalendarIcon,
	CubeIcon,
	MagnifyingGlassIcon,
	ShoppingCartIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useAdminNavigate } from '../AdminEmbeddedRouter';
import { useIsDesktopEmbeddedAdmin } from '../AdminShellModeContext';
import clsx from 'clsx';

interface SearchResult {
	products: Array<{
		id: string;
		name: string;
		price: number;
		category: string;
	}>;
	orders: Array<{
		id: string;
		orderNumber: string;
		customerName: string;
		status: string;
	}>;
	users: Array<{ id: string; name: string; email: string }>;
	bookings: Array<{
		id: string;
		guestName: string;
		consultation?: { title: string };
		masterclass?: { title: string };
	}>;
}

function useOnClickOutside(
	ref: React.RefObject<HTMLElement | null>,
	handler: () => void
) {
	useEffect(() => {
		const listener = (event: MouseEvent | TouchEvent) => {
			if (!ref.current || ref.current.contains(event.target as Node)) {
				return;
			}
			handler();
		};
		document.addEventListener('mousedown', listener);
		document.addEventListener('touchstart', listener);
		return () => {
			document.removeEventListener('mousedown', listener);
			document.removeEventListener('touchstart', listener);
		};
	}, [ref, handler]);
}

/**
 * Result row as plain button (not `role="option"`): grouped sections are not valid
 * direct children of `role="listbox"` for axe; outer panel uses `role="region"` instead.
 */
function GlobalSearchHitButton({
	selected,
	className,
	children,
	...rest
}: Omit<React.ComponentProps<'button'>, 'aria-current'> & {
	selected: boolean;
}) {
	return selected ? (
		<button type="button" aria-current="true" className={className} {...rest}>
			{children}
		</button>
	) : (
		<button type="button" className={className} {...rest}>
			{children}
		</button>
	);
}

export const GlobalSearch: React.FC = () => {
	const { t } = useTranslation('siteStudio');
	const embedded = useIsDesktopEmbeddedAdmin();
	const navigate = useAdminNavigate();
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<SearchResult | null>(null);
	const [loading, setLoading] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const debouncedQuery = useDebounce(query, 300);

	const isMac =
		typeof navigator !== 'undefined' &&
		/Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);

	useOnClickOutside(containerRef, () => {
		setIsOpen(false);
		setActiveIndex(-1);
	});

	useEffect(() => {
		const onDoc = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				inputRef.current?.focus();
				setIsOpen(true);
			}
		};
		document.addEventListener('keydown', onDoc);
		return () => document.removeEventListener('keydown', onDoc);
	}, []);

	useEffect(() => {
		const search = async () => {
			if (!debouncedQuery.trim()) {
				setResults(null);
				setActiveIndex(-1);
				return;
			}

			setLoading(true);
			try {
				const { data } = await apiClient.get<SearchResult>(
					`/admin/search?q=${debouncedQuery}`
				);
				setResults(data);
				setActiveIndex(-1);
			} catch (error) {
				console.error('MagnifyingGlassIcon failed:', error);
			} finally {
				setLoading(false);
			}
		};

		search();
	}, [debouncedQuery]);

	const hasResults =
		results &&
		(results.products.length > 0 ||
			results.orders.length > 0 ||
			results.bookings.length > 0);

	const comboboxListExpanded = Boolean(isOpen && query.trim() && hasResults);

	const hitLayout = useMemo(() => {
		if (!results) {
			return null;
		}
		let c = 0;
		const productIdx = results.products.map(() => c++);
		const orderIdx = results.orders.map(() => c++);
		const bookingIdx = results.bookings.map(() => c++);
		return {
			productIdx,
			orderIdx,
			bookingIdx,
			total: c,
		};
	}, [results]);

	const hitCount = hitLayout?.total ?? 0;

	useEffect(() => {
		if (activeIndex < 0 || !listRef.current) return;
		const el = listRef.current.querySelector<HTMLElement>(
			`[data-global-search-hit="${activeIndex}"]`
		);
		el?.scrollIntoView({ block: 'nearest' });
	}, [activeIndex]);

	const handleNavigate = (path: string) => {
		navigate(path);
		setIsOpen(false);
		setQuery('');
		setActiveIndex(-1);
	};

	const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (!isOpen || !query.trim() || loading) return;

		if (e.key === 'Escape') {
			e.preventDefault();
			setIsOpen(false);
			setActiveIndex(-1);
			return;
		}

		if (!hasResults || hitCount === 0) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			setActiveIndex((i) => {
				if (i < 0) return 0;
				return i + 1 >= hitCount ? 0 : i + 1;
			});
			return;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			setActiveIndex((i) => {
				if (i <= 0) return hitCount - 1;
				return i - 1;
			});
			return;
		}
		if (e.key === 'Enter' && activeIndex >= 0) {
			e.preventDefault();
			const el = listRef.current?.querySelector<HTMLElement>(
				`[data-global-search-hit="${activeIndex}"]`
			);
			const path = el?.dataset.path;
			if (path) handleNavigate(path);
		}
	};

	return (
		<div
			ref={containerRef}
			className={clsx('relative w-full', embedded ? 'max-w-none' : 'max-w-lg')}
		>
			<div className="relative group">
				<MagnifyingGlassIcon
					className={clsx(
						'absolute top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary-500 transition-colors pointer-events-none',
						embedded ? 'left-2.5' : 'left-4'
					)}
					width={embedded ? 15 : 18}
					height={embedded ? 15 : 18}
					aria-hidden
				/>
				{comboboxListExpanded ? (
					<input
						ref={inputRef}
						type="search"
						role="combobox"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setIsOpen(true);
							setActiveIndex(-1);
						}}
						onFocus={() => setIsOpen(true)}
						onKeyDown={onInputKeyDown}
						placeholder={t('adminChrome.globalSearch.placeholder')}
						aria-autocomplete="list"
						aria-controls="global-search-results"
						aria-expanded="true"
						className={clsx(
							'w-full bg-neutral-100/80 border border-transparent placeholder:text-neutral-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 focus:bg-white transition-[background-color,border-color,box-shadow] duration-200 dark:bg-slate-800/80 dark:focus:bg-slate-900 dark:text-white dark:placeholder:text-slate-500',
							embedded
								? 'pl-8 pr-14 py-1.5 rounded-lg text-xs'
								: 'pl-11 pr-20 py-2.5 rounded-xl text-sm'
						)}
					/>
				) : (
					<input
						ref={inputRef}
						type="search"
						role="combobox"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setIsOpen(true);
							setActiveIndex(-1);
						}}
						onFocus={() => setIsOpen(true)}
						onKeyDown={onInputKeyDown}
						placeholder={t('adminChrome.globalSearch.placeholder')}
						aria-autocomplete="list"
						aria-controls="global-search-results"
						aria-expanded="false"
						className={clsx(
							'w-full bg-neutral-100/80 border border-transparent placeholder:text-neutral-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 focus:bg-white transition-[background-color,border-color,box-shadow] duration-200 dark:bg-slate-800/80 dark:focus:bg-slate-900 dark:text-white dark:placeholder:text-slate-500',
							embedded
								? 'pl-8 pr-14 py-1.5 rounded-lg text-xs'
								: 'pl-11 pr-20 py-2.5 rounded-xl text-sm'
						)}
					/>
				)}
				<div
					className={clsx(
						'absolute top-1/2 -translate-y-1/2 flex items-center gap-2',
						embedded ? 'right-2' : 'right-3'
					)}
				>
					{query ? (
						<button
							type="button"
							onClick={() => {
								setQuery('');
								setResults(null);
								setActiveIndex(-1);
							}}
							className="min-h-9 min-w-9 inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
							aria-label={t('adminChrome.globalSearch.clearAria')}
						>
							<XMarkIcon width={14} height={14} />
						</button>
					) : (
						<kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 bg-neutral-200/80 dark:bg-slate-700 dark:text-slate-400 rounded border border-neutral-300/50 dark:border-slate-600">
							{isMac ? '⌘' : 'Ctrl'}+K
						</kbd>
					)}
				</div>
			</div>

			{isOpen && query.trim().length > 0 && (
				<section
					ref={listRef}
					id="global-search-results"
					aria-label={t('adminChrome.globalSearch.resultsLabel')}
					className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-neutral-200/80 dark:border-slate-600 max-h-[70vh] overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200"
				>
					{loading ? (
						<div className="p-8 text-center">
							<div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto dark:border-primary-800" />
							<p className="text-sm text-neutral-500 dark:text-slate-400 mt-3">
								{t('adminChrome.globalSearch.searching')}
							</p>
						</div>
					) : !hasResults ? (
						<div className="p-8 text-center">
							<MagnifyingGlassIcon
								width={32}
								height={32}
								className="mx-auto text-neutral-200 dark:text-slate-600 mb-2"
							/>
							<p className="text-sm text-neutral-500 dark:text-slate-400">
								{t('adminChrome.globalSearch.empty', { query })}
							</p>
						</div>
					) : (
						<div className="py-2">
							{results?.products.length && hitLayout ? (
								<div className="mb-1">
									<div className="px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 border-b border-neutral-100 dark:border-slate-700">
										<CubeIcon
											width={12}
											height={12}
											className="text-primary-400"
										/>{' '}
										{t('adminChrome.globalSearch.sectionProducts')}
										<span className="ml-auto text-neutral-300 dark:text-slate-600">
											{results.products.length}
										</span>
									</div>
									{results.products.map((product, i) => {
										const idx = hitLayout.productIdx[i];
										const path = `/admin/products/${product.id}`;
										return (
											<GlobalSearchHitButton
												key={product.id}
												selected={activeIndex === idx}
												data-global-search-hit={idx}
												data-path={path}
												onClick={() => handleNavigate(path)}
												onMouseEnter={() => setActiveIndex(idx)}
												className={clsx(
													'w-full text-left px-4 py-3 flex justify-between items-center transition-colors group min-h-11',
													activeIndex === idx
														? 'bg-primary-50 dark:bg-primary-950/50 ring-2 ring-inset ring-primary-300 dark:ring-primary-700'
														: 'hover:bg-primary-50/50 dark:hover:bg-slate-700/50'
												)}
											>
												<div className="flex items-center gap-3 min-w-0">
													<span className="w-8 h-8 shrink-0 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
														<CubeIcon
															width={14}
															height={14}
															className="text-primary-600 dark:text-primary-400"
														/>
													</span>
													<span className="text-sm font-medium text-neutral-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-300 truncate">
														{product.name}
													</span>
												</div>
												<span className="text-sm font-semibold text-neutral-600 dark:text-slate-300 shrink-0">
													{product.price.toLocaleString()} ₽
												</span>
											</GlobalSearchHitButton>
										);
									})}
								</div>
							) : null}

							{results?.orders.length && hitLayout ? (
								<div className="mb-1">
									<div className="px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 border-b border-neutral-100 dark:border-slate-700">
										<ShoppingCartIcon
											width={12}
											height={12}
											className="text-orange-400"
										/>{' '}
										{t('adminChrome.globalSearch.sectionOrders')}
										<span className="ml-auto text-neutral-300 dark:text-slate-600">
											{results.orders.length}
										</span>
									</div>
									{results.orders.map((order, i) => {
										const idx = hitLayout.orderIdx[i];
										const path = `/admin/orders?id=${order.id}`;
										return (
											<GlobalSearchHitButton
												key={order.id}
												selected={activeIndex === idx}
												data-global-search-hit={idx}
												data-path={path}
												onClick={() => handleNavigate(path)}
												onMouseEnter={() => setActiveIndex(idx)}
												className={clsx(
													'w-full text-left px-4 py-3 hover:bg-orange-50/50 dark:hover:bg-slate-700/50 flex justify-between items-center transition-colors group min-h-11',
													activeIndex === idx
														? 'bg-orange-50 dark:bg-orange-950/30 ring-2 ring-inset ring-orange-200 dark:ring-orange-800'
														: ''
												)}
											>
												<div className="flex items-center gap-3 min-w-0">
													<span className="w-8 h-8 shrink-0 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
														<ShoppingCartIcon
															width={14}
															height={14}
															className="text-orange-600 dark:text-orange-300"
														/>
													</span>
													<div className="min-w-0">
														<span className="text-sm font-mono font-semibold text-neutral-900 dark:text-white group-hover:text-orange-700 dark:group-hover:text-orange-300">
															#{order.orderNumber}
														</span>
														<span className="text-xs text-neutral-500 dark:text-slate-400 ml-2">
															{order.customerName}
														</span>
													</div>
												</div>
												<span className="text-xs font-medium bg-neutral-100 dark:bg-slate-700 px-2 py-1 rounded-full shrink-0">
													{order.status}
												</span>
											</GlobalSearchHitButton>
										);
									})}
								</div>
							) : null}

							{results?.bookings.length && hitLayout ? (
								<div className="mb-1">
									<div className="px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 border-b border-neutral-100 dark:border-slate-700">
										<CalendarIcon
											width={12}
											height={12}
											className="text-blue-400"
										/>{' '}
										{t('adminChrome.globalSearch.sectionBookings')}
										<span className="ml-auto text-neutral-300 dark:text-slate-600">
											{results.bookings.length}
										</span>
									</div>
									{results.bookings.map((booking, i) => {
										const idx = hitLayout.bookingIdx[i];
										const path = '/admin/bookings';
										return (
											<GlobalSearchHitButton
												key={booking.id}
												selected={activeIndex === idx}
												data-global-search-hit={idx}
												data-path={path}
												onClick={() => handleNavigate(path)}
												onMouseEnter={() => setActiveIndex(idx)}
												className={clsx(
													'w-full text-left px-4 py-3 hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-colors group min-h-11',
													activeIndex === idx
														? 'bg-blue-50 dark:bg-blue-950/30 ring-2 ring-inset ring-blue-200 dark:ring-blue-800'
														: ''
												)}
											>
												<div className="flex items-center gap-3">
													<span className="w-8 h-8 shrink-0 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
														<CalendarIcon
															width={14}
															height={14}
															className="text-blue-600 dark:text-blue-300"
														/>
													</span>
													<div className="min-w-0 text-left">
														<div className="text-sm font-medium text-neutral-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300">
															{booking.consultation?.title ||
																booking.masterclass?.title ||
																t('adminChrome.globalSearch.bookingFallback')}
														</div>
														<div className="text-xs text-neutral-500 dark:text-slate-400">
															{booking.guestName}
														</div>
													</div>
												</div>
											</GlobalSearchHitButton>
										);
									})}
								</div>
							) : null}
						</div>
					)}
				</section>
			)}
		</div>
	);
};
