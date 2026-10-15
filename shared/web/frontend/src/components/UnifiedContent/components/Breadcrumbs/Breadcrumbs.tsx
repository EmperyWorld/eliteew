/**
 * Breadcrumbs - Улучшенная навигация по фильтрам и коллекциям
 *
 * Функции:
 * - Отображение активной коллекции
 * - Показ активных фильтров
 * - Навигация по компании/проекту
 * - Быстрый сброс фильтров
 */

import { motion } from 'framer-motion';
import * as React from 'react';
import { useCallback, useRef } from 'react';
import {
	BriefcaseIcon,
	BuildingOffice2Icon,
	ChevronRightIcon,
	EyeIcon,
	FunnelIcon,
	HomeIcon,
	MagnifyingGlassIcon,
	StarIcon,
	TagIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { ButtonV2 } from '../../../ui/ButtonV2';
import { contentTypeLabels, visibilityLabels } from '../../utils/contentUtils';
import type { SmartCollection } from '../SmartCollections';

const MIDDLE_CRUMB_MAX_CHARS = 28;

function truncateMiddle(text: string, maxLen: number): string {
	if (text.length <= maxLen) {
		return text;
	}
	const ellipsis = '…';
	const inner = maxLen - ellipsis.length;
	if (inner < 2) {
		return ellipsis;
	}
	const left = Math.ceil(inner / 2);
	const right = Math.floor(inner / 2);
	return `${text.slice(0, left)}${ellipsis}${text.slice(text.length - right)}`;
}

interface BreadcrumbItem {
	key: string;
	label: string;
	onClick?: () => void;
	icon?: React.ReactNode;
	removable?: boolean;
	onRemove?: () => void;
}

interface BreadcrumbsProps {
	// Navigation
	onHome?: () => void;

	// Smart Collection
	activeCollection?: SmartCollection | null;
	onClearCollection?: () => void;

	// Filters
	filterType?: string;
	filterVisibility?: string;
	onClearFilters?: () => void;

	// MagnifyingGlassIcon
	searchQuery?: string;
	onClearSearch?: () => void;

	// Company/Project
	selectedCompany?: string | null;
	selectedProject?: string | null;
	companies?: Array<{ id: string; name: string }>;
	projects?: Array<{ id: string; name: string }>;
	onClearCompany?: () => void;
	onClearProject?: () => void;

	// Current tab
	currentTab?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
	onHome,
	activeCollection,
	onClearCollection,
	filterType,
	filterVisibility,
	onClearFilters,
	searchQuery,
	onClearSearch,
	selectedCompany,
	selectedProject,
	companies = [],
	projects = [],
	onClearCompany,
	onClearProject,
	currentTab,
}) => {
	const items: BreadcrumbItem[] = [];

	// HomeIcon
	if (onHome) {
		items.push({
			key: 'crumb-home',
			label: 'Менеджер контента',
			onClick: onHome,
			icon: <HomeIcon className="w-4 h-4" />,
		});
	}

	// Current Tab
	if (currentTab) {
		const tabLabels: Record<string, string> = {
			browser: 'Файлы',
			favorites: 'Избранное',
			duplicates: 'Дубликаты',
			'file-manager': 'Менеджер',
			upload: 'Загрузка',
			analytics: 'Аналитика',
		};

		if (tabLabels[currentTab] && currentTab !== 'browser') {
			items.push({
				key: `crumb-tab-${currentTab}`,
				label: tabLabels[currentTab],
				icon:
					currentTab === 'favorites' ? (
						<StarIcon className="w-4 h-4" />
					) : undefined,
			});
		}
	}

	// Company
	if (selectedCompany) {
		const company = companies.find((c) => c.id === selectedCompany);
		if (company) {
			items.push({
				key: `crumb-company-${selectedCompany}`,
				label: company.name,
				onClick: onClearCompany,
				icon: <BuildingOffice2Icon className="w-4 h-4" />,
				removable: true,
				onRemove: onClearCompany,
			});
		}
	}

	// Project
	if (selectedProject) {
		const project = projects.find((p) => p.id === selectedProject);
		if (project) {
			items.push({
				key: `crumb-project-${selectedProject}`,
				label: project.name,
				onClick: onClearProject,
				icon: <BriefcaseIcon className="w-4 h-4" />,
				removable: true,
				onRemove: onClearProject,
			});
		}
	}

	// Active Collection
	if (activeCollection) {
		items.push({
			key: `crumb-collection-${activeCollection.id}`,
			label: activeCollection.label || activeCollection.id,
			onClick: onClearCollection,
			icon: activeCollection.icon,
			removable: true,
			onRemove: onClearCollection,
		});
	}

	// MagnifyingGlassIcon Query
	if (searchQuery) {
		items.push({
			key: `crumb-search-${searchQuery}`,
			label: `Поиск: "${searchQuery}"`,
			onClick: onClearSearch,
			icon: <MagnifyingGlassIcon className="w-4 h-4" />,
			removable: true,
			onRemove: onClearSearch,
		});
	}

	// FunnelIcon Type
	if (filterType && filterType !== 'all') {
		items.push({
			key: `crumb-filter-type-${filterType}`,
			label: contentTypeLabels[filterType] || filterType,
			onClick: onClearFilters,
			icon: <TagIcon className="w-4 h-4" />,
			removable: true,
			onRemove: onClearFilters,
		});
	}

	// FunnelIcon Visibility
	if (filterVisibility && filterVisibility !== 'all') {
		items.push({
			key: `crumb-filter-vis-${filterVisibility}`,
			label: visibilityLabels[filterVisibility] || filterVisibility,
			onClick: onClearFilters,
			icon: <EyeIcon className="w-4 h-4" />,
			removable: true,
			onRemove: onClearFilters,
		});
	}

	const navRef = useRef<HTMLElement>(null);

	const moveBreadcrumbFocus = useCallback(
		(fromIndex: number, delta: number) => {
			const root = navRef.current;
			if (!root) {
				return;
			}
			const focusables = Array.from(
				root.querySelectorAll<HTMLElement>('[data-breadcrumb-focusable="true"]')
			);
			if (!focusables.length) {
				return;
			}
			let next = fromIndex + delta;
			if (next < 0) {
				next = focusables.length - 1;
			} else if (next >= focusables.length) {
				next = 0;
			}
			focusables[next]?.focus();
		},
		[]
	);

	const handleNavKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLElement>) => {
			const root = navRef.current;
			if (!root) {
				return;
			}
			const focusables = Array.from(
				root.querySelectorAll<HTMLElement>('[data-breadcrumb-focusable="true"]')
			);
			if (!focusables.length) {
				return;
			}
			const active = document.activeElement as HTMLElement | null;
			const idx = active ? focusables.indexOf(active) : -1;
			if (idx < 0) {
				return;
			}

			if (e.key === 'HomeIcon') {
				e.preventDefault();
				focusables[0]?.focus();
				return;
			}
			if (e.key === 'End') {
				e.preventDefault();
				focusables[focusables.length - 1]?.focus();
				return;
			}
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				moveBreadcrumbFocus(idx, 1);
				return;
			}
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				moveBreadcrumbFocus(idx, -1);
			}
		},
		[moveBreadcrumbFocus]
	);

	// Don't show breadcrumbs if only home
	if (items.length <= 1) {
		return null;
	}

	return (
		<motion.nav
			ref={navRef}
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			className="flex items-center gap-2 text-sm bg-linear-to-r from-white/5 via-white/3 to-transparent backdrop-blur-xl rounded-xl p-3 border border-white/10 shadow-lg"
			aria-label="Хлебные крошки"
			onKeyDown={handleNavKeyDown}
		>
			<FunnelIcon className="w-4 h-4 text-purple-400 shrink-0" aria-hidden />

			<ol className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
				{items.map((item, index) => {
					const isLast = index === items.length - 1;
					const isFirst = index === 0;
					const isMiddle = !isFirst && !isLast;

					const displayLabel =
						isMiddle && item.label.length > MIDDLE_CRUMB_MAX_CHARS
							? truncateMiddle(item.label, MIDDLE_CRUMB_MAX_CHARS)
							: item.label;

					return (
						<li
							key={item.key}
							className="flex items-center gap-2 min-w-0 max-w-full shrink"
						>
							{item.icon && (
								<span className="text-white/60 shrink-0" aria-hidden>
									{item.icon}
								</span>
							)}

							{isLast ? (
								<span
									className="text-white font-semibold truncate max-w-[min(100%,280px)] min-w-0"
									title={item.label}
									aria-current="page"
								>
									{displayLabel}
								</span>
							) : item.onClick ? (
								<button
									type="button"
									data-breadcrumb-focusable="true"
									onClick={item.onClick}
									className="text-white/60 hover:text-white transition-colors truncate max-w-[min(100%,200px)] min-w-0 text-left cursor-pointer hover:underline"
									title={item.label}
								>
									{displayLabel}
								</button>
							) : (
								<span
									className="text-white/60 truncate max-w-[min(100%,200px)] min-w-0"
									title={item.label}
								>
									{displayLabel}
								</span>
							)}

							{!isLast && (
								<ChevronRightIcon
									className="w-4 h-4 text-white/40 shrink-0"
									aria-hidden
								/>
							)}

							{isLast && item.removable && item.onRemove && (
								<button
									type="button"
									data-breadcrumb-focusable="true"
									onClick={item.onRemove}
									className="ml-2 p-1 hover:bg-white/10 rounded transition-colors shrink-0"
									title="Убрать фильтр"
									aria-label={`Убрать фильтр: ${item.label}`}
								>
									<XMarkIcon
										className="w-3 h-3 text-white/60 hover:text-white"
										aria-hidden
									/>
								</button>
							)}
						</li>
					);
				})}
			</ol>

			{/* Clear All Button */}
			{(activeCollection ||
				searchQuery ||
				(filterType && filterType !== 'all') ||
				(filterVisibility && filterVisibility !== 'all')) && (
				<ButtonV2
					variant="ghost"
					size="sm"
					onClick={() => {
						if (onClearCollection) {
							onClearCollection();
						}
						if (onClearSearch) {
							onClearSearch();
						}
						if (onClearFilters) {
							onClearFilters();
						}
					}}
					className="shrink-0"
				>
					Сбросить все
				</ButtonV2>
			)}
		</motion.nav>
	);
};

export default Breadcrumbs;
